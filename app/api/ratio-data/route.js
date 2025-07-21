import { 
  initializeDatabase, 
  getCachedRatios,
  storeRatioData,
  getAddressesNeedingRatioCalculation,
  getAllAddressesWithMiners
} from '../../../lib/database/operations.js';
import { getAddressMetricsDirect, getMinerStatsDirect } from '../../../utils/directCalls.js';




export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const chain = searchParams.get('chain') || 'abstract';
  const count = searchParams.get('count') === 'true';

  try {
    // Validate parameters
    if (!['abstract', 'base'].includes(chain)) {
      return Response.json({ error: 'Invalid chain. Use "abstract" or "base"' }, { status: 400 });
    }

    // Initialize database if needed
    try {
      await initializeDatabase();
    } catch (dbError) {
      console.log('Database already initialized or minor error:', dbError.message);
    }

    // If count is requested, return the number of addresses that need processing
    if (count) {
      const addressesToProcess = await getAddressesNeedingRatioCalculation(chain, 1000);
      return Response.json({
        success: true,
        chain,
        addressesToProcess: addressesToProcess.length
      });
    }

    console.log(`📊 Getting cached ratio data for ${chain} chain`);
    
    const ratioData = await getCachedRatios(chain, 100);
    
    return Response.json({
      success: true,
      chain,
      ratioData,
      lastUpdated: ratioData[0]?.lastCalculatedAt || null
    });

  } catch (error) {
    console.error('Ratio data error:', error);
    return Response.json({ 
      error: error.message || 'Failed to get ratio data' 
    }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { chain = 'abstract', scanType = 'update', batchSize = 10 } = await req.json();

    // Validate parameters
    if (!['abstract', 'base'].includes(chain)) {
      return Response.json({ error: 'Invalid chain. Use "abstract" or "base"' }, { status: 400 });
    }

    // Initialize database if needed
    try {
      await initializeDatabase();
    } catch (dbError) {
      console.log('Database already initialized or minor error:', dbError.message);
    }

    const startTime = Date.now();
    console.log(`📊 Starting ratio calculation for ${chain} chain (${scanType} mode)`);

    // Get addresses to process based on scan type
    let addressesToProcess;
    if (scanType === 'scanAll') {
      // Get all addresses with active miners, ignoring existing ratios
      const allAddresses = await getAllAddressesWithMiners(chain);
      console.log(`🔍 Found ${allAddresses.length} total addresses with active miners`);
      addressesToProcess = allAddresses;
    } else {
      // Get only addresses that need ratio calculation (no cached ratios)
      addressesToProcess = await getAddressesNeedingRatioCalculation(chain, batchSize);
    }
    
    if (addressesToProcess.length === 0) {
      console.log(`📋 No addresses need ratio calculation for ${chain} chain`);
      const existingRatios = await getCachedRatios(chain, 100);
      
      return Response.json({
        success: true,
        chain,
        ratioData: existingRatios,
        addressesScanned: 0,
        newRatiosCalculated: 0,
        totalRatios: existingRatios.length,
        scanDuration: Date.now() - startTime,
        lastUpdated: existingRatios[0]?.lastCalculatedAt || new Date().toISOString()
      });
    }

    console.log(`📈 Processing ${addressesToProcess.length} addresses for ratio calculation`);

    let ratiosCalculated = 0;
    let ratiosErrors = 0;
    const totalAddresses = addressesToProcess.length;

    // Process addresses in batches (balanced for Alchemy rate limits)
    const rateBatchSize = chain === 'base' ? 5 : 6; // Moderate batch size to avoid rate limits
    const rateDelay = chain === 'base' ? 400 : 350; // Balanced delays to respect compute units
    
    for (let i = 0; i < addressesToProcess.length; i += rateBatchSize) {
      const batch = addressesToProcess.slice(i, i + rateBatchSize);
      const currentBatch = Math.floor(i/rateBatchSize) + 1;
      const totalBatches = Math.ceil(addressesToProcess.length/rateBatchSize);
      console.log(`⚡ Processing ratio batch ${currentBatch}/${totalBatches} (addresses ${i + 1}-${Math.min(i + rateBatchSize, addressesToProcess.length)})`);

      // Process batch in parallel
      const promises = batch.map(async (address) => {
        try {
          // Fetch both metrics and miner stats in parallel using direct calls
          const [metrics, minerStats] = await Promise.all([
            getAddressMetricsDirect(chain, address),
            getMinerStatsDirect(chain, address)
          ]);
          
          if (metrics && minerStats) {
            const deposits = parseFloat(metrics.deposits) || 0;
            const withdrawals = parseFloat(metrics.withdrawals) || 0;
            const activeMiners = parseInt(minerStats.activeMiners) || 0;
            const totalMiners = parseInt(minerStats.totalMiners) || 0;
            
            // Only process addresses with active miners
            if (activeMiners === 0) {
              console.log(`   ⚠️  ${address}: No active miners (${totalMiners} total, ${activeMiners} active) - skipping`);
              return false;
            }
            
            // Calculate true ratio: withdrawals / deposits
            let ratio = 0;
            if (deposits > 0) {
              ratio = withdrawals / deposits;
            } else if (withdrawals > 0) {
              ratio = 999; // Very high ratio for addresses with withdrawals but no deposits
            }

            // Store ratio data with miner counts
            await storeRatioData(chain, address, deposits, withdrawals, ratio, totalMiners, activeMiners);
            console.log(`   ✅ ${address}: ${ratio.toFixed(4)}x (${withdrawals}/${deposits}) - ${activeMiners}/${totalMiners} active miners`);
            return true;
          } else {
            const failedService = !metrics ? 'metrics' : 'miner stats';
            console.log(`   ⚠️  ${address}: Failed to get ${failedService}`);
            return false;
          }
        } catch (error) {
          console.error(`   ❌ ${address}: Error -`, error.message);
          return false;
        }
      });

      const results = await Promise.all(promises);
      ratiosCalculated += results.filter(Boolean).length;
      ratiosErrors += results.filter(r => !r).length;

      // Add delay between batches to avoid rate limiting (longer for Base)
      if (i + rateBatchSize < addressesToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, rateDelay));
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Ratio calculation complete for ${chain}`);
    console.log(`   - Addresses processed: ${addressesToProcess.length}`);
    console.log(`   - Ratios calculated: ${ratiosCalculated}`);
    console.log(`   - Errors: ${ratiosErrors}`);
    console.log(`   - Duration: ${Math.round(duration/1000)}s`);

    // Get updated ratio data
    const updatedRatios = await getCachedRatios(chain, 100);

    return Response.json({
      success: true,
      chain,
      ratioData: updatedRatios,
      addressesScanned: addressesToProcess.length,
      newRatiosCalculated: ratiosCalculated,
      totalRatios: updatedRatios.length,
      scanDuration: duration,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Ratio calculation error:', error);
    return Response.json({ 
      error: error.message || 'Failed to calculate ratios' 
    }, { status: 500 });
  }
}