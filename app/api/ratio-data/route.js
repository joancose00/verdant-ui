import { 
  initializeDatabase, 
  getCachedRatios,
  storeRatioData,
  getAddressesNeedingRatioCalculation,
  getCurrentRatioAddresses,
  getAllAddressesWithActiveMiners,
  getAllAddressesWithAnyMiners,
  getMinerSellData,
  debugLPTransactionData
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
  const debugLogs = [];
  const log = (message) => {
    console.log(message);
    debugLogs.push(`${new Date().toISOString()}: ${message}`);
  };

  try {
    const { chain = 'abstract', scanType = 'update', batchSize = 10 } = await req.json();
    log(`📊 Starting ratio calculation for ${chain} chain (${scanType} mode)`);

    // Validate parameters
    if (!['abstract', 'base'].includes(chain)) {
      return Response.json({ error: 'Invalid chain. Use "abstract" or "base"', debugLogs }, { status: 400 });
    }

    // Initialize database if needed
    try {
      await initializeDatabase();
      log('✅ Database initialized successfully');
    } catch (dbError) {
      log(`⚠️ Database init: ${dbError.message}`);
    }

    const startTime = Date.now();

    // Debug LP transaction data first
    await debugLPTransactionData(chain);

    // Get addresses to process based on scan type
    let addressesToProcess;
    if (scanType === 'refreshCurrent') {
      // Refresh only addresses currently shown in the filtered results
      addressesToProcess = await getCurrentRatioAddresses(chain, 100);
      log(`🔍 Found ${addressesToProcess.length} addresses in current filtered results`);
      log(`📝 Sample addresses: ${addressesToProcess.slice(0, 5).join(', ')}`);
    } else if (scanType === 'scanAllActive') {
      // Get all addresses with active miners
      addressesToProcess = await getAllAddressesWithActiveMiners(chain);
      log(`🔍 Found ${addressesToProcess.length} addresses with active miners`);
      log(`📝 Sample addresses: ${addressesToProcess.slice(0, 5).join(', ')}`);
    } else if (scanType === 'scanEverything') {
      // Get all addresses with any miners (active or inactive)
      addressesToProcess = await getAllAddressesWithAnyMiners(chain);
      log(`🔍 Found ${addressesToProcess.length} addresses with any miners`);
      log(`📝 Sample addresses: ${addressesToProcess.slice(0, 5).join(', ')}`);
    } else {
      // Default: Get only addresses that need ratio calculation (no cached ratios)
      addressesToProcess = await getAddressesNeedingRatioCalculation(chain, batchSize);
      log(`🔍 Found ${addressesToProcess.length} addresses needing ratio calculation`);
      log(`📝 Sample addresses: ${addressesToProcess.slice(0, 5).join(', ')}`);
    }
    
    if (addressesToProcess.length === 0) {
      log(`📋 No addresses need ratio calculation for ${chain} chain`);
      const existingRatios = await getCachedRatios(chain, 100);
      
      return Response.json({
        success: true,
        chain,
        ratioData: existingRatios,
        addressesScanned: 0,
        newRatiosCalculated: 0,
        totalRatios: existingRatios.length,
        scanDuration: Date.now() - startTime,
        lastUpdated: existingRatios[0]?.lastCalculatedAt || new Date().toISOString(),
        debugLogs
      });
    }

    log(`📈 Processing ${addressesToProcess.length} addresses for ratio calculation`);

    let ratiosCalculated = 0;
    let ratiosErrors = 0;
    const totalAddresses = addressesToProcess.length;

    // Process addresses in batches (conservative for Base to prevent corruption)
    const rateBatchSize = chain === 'base' ? 1 : 6; // Process Base addresses one at a time to prevent corruption
    const rateDelay = chain === 'base' ? 800 : 350; // Longer delays for Base to prevent RPC conflicts
    
    for (let i = 0; i < addressesToProcess.length; i += rateBatchSize) {
      const batch = addressesToProcess.slice(i, i + rateBatchSize);
      const currentBatch = Math.floor(i/rateBatchSize) + 1;
      const totalBatches = Math.ceil(addressesToProcess.length/rateBatchSize);
      log(`⚡ Processing ratio batch ${currentBatch}/${totalBatches} (addresses ${i + 1}-${Math.min(i + rateBatchSize, addressesToProcess.length)})`);

      // Process batch in parallel
      const promises = batch.map(async (address) => {
        try {
          log(`   🔍 ${address}: Fetching metrics, miner stats, and sell data...`);
          // Fetch metrics, miner stats, and sell data in parallel
          const [metrics, minerStats, sellData] = await Promise.all([
            getAddressMetricsDirect(chain, address),
            getMinerStatsDirect(chain, address),
            getMinerSellData(chain, address)
          ]);
          
          log(`   📥 ${address}: Metrics: ${metrics ? 'SUCCESS' : 'FAILED'}, MinerStats: ${minerStats ? 'SUCCESS' : 'FAILED'}, SellData: ${sellData ? 'SUCCESS' : 'FAILED'}`);
          
          if (metrics && minerStats) {
            const deposits = parseFloat(metrics.deposits) || 0;
            const withdrawals = parseFloat(metrics.withdrawals) || 0;
            const activeMiners = parseInt(minerStats.activeMiners) || 0;
            const totalMiners = parseInt(minerStats.totalMiners) || 0;
            const totalSells = sellData ? sellData.totalSells : 0;
            
            // Only skip if no miners at all (but allow addresses with inactive miners for sell data)
            if (totalMiners === 0) {
              log(`   ⚠️  ${address}: No miners at all - skipping`);
              return false;
            }
            
            log(`   📊 ${address}: Processing - ${activeMiners}/${totalMiners} miners, ${deposits} deposits, ${withdrawals} withdrawals, ${totalSells} sells`);
            
            if (sellData && sellData.totalTransactions > 0) {
              log(`   💰 ${address}: Found ${sellData.totalTransactions} sell transactions, ${sellData.directSales} direct, ${sellData.tracedToMiner} traced`);
            } else {
              log(`   ⚠️  ${address}: No sell transactions found (sellData: ${JSON.stringify(sellData)})`);
            }
            
            // Calculate withdrawal ratio: withdrawals / deposits
            let withdrawalRatio = 0;
            if (deposits > 0) {
              withdrawalRatio = withdrawals / deposits;
            } else if (withdrawals > 0) {
              withdrawalRatio = 999; // Very high ratio for addresses with withdrawals but no deposits
            }

            // Calculate sell ratio: total sells / deposits
            let sellRatio = 0;
            if (deposits > 0) {
              sellRatio = totalSells / deposits;
            } else if (totalSells > 0) {
              sellRatio = 999; // Very high ratio for addresses with sells but no deposits
            }

            // Store ratio data with both ratios
            await storeRatioData(chain, address, deposits, withdrawals, withdrawalRatio, totalMiners, activeMiners, totalSells, sellRatio);
            console.log(`   ✅ ${address}: Withdrawal ${withdrawalRatio.toFixed(4)}x (${withdrawals}/${deposits}), Sell ${sellRatio.toFixed(4)}x (${totalSells}/${deposits}) - ${activeMiners}/${totalMiners} active miners`);
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
      lastUpdated: new Date().toISOString(),
      debugLogs
    });

  } catch (error) {
    log(`❌ Ratio calculation error: ${error.message}`);
    return Response.json({ 
      error: error.message || 'Failed to calculate ratios',
      debugLogs
    }, { status: 500 });
  }
}