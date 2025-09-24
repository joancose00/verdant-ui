import { getAllAddressesWithActiveMiners, getCachedRatios } from '../../../lib/database/operations.js';
import { getMinerStatsDirect } from '../../../utils/directCalls.js';

export async function POST(req) {
  const debugLogs = [];
  const log = (message) => {
    console.log(message);
    debugLogs.push(`${new Date().toISOString()}: ${message}`);
  };

  try {
    const { chain = 'base' } = await req.json();
    log(`🗺️ Starting miner map data collection for ${chain} chain`);

    // Validate parameters
    if (chain !== 'base') {
      return Response.json({ error: 'Invalid chain. Only "base" is supported', debugLogs }, { status: 400 });
    }

    const startTime = Date.now();

    // Get addresses with active miners from database
    const addressesWithActiveMiners = await getAllAddressesWithActiveMiners(chain);
    log(`🔍 Found ${addressesWithActiveMiners.length} addresses with active miners`);

    // Get cached withdrawal ratios for all addresses
    const ratioData = await getCachedRatios(chain, 1000);
    const ratioMap = {};
    ratioData.forEach(item => {
      ratioMap[item.address] = item.ratio;
    });
    log(`📊 Loaded ${Object.keys(ratioMap).length} withdrawal ratios from cache`);

    if (addressesWithActiveMiners.length === 0) {
      return Response.json({
        success: true,
        chain,
        miners: [],
        addressesScanned: 0,
        totalMiners: 0,
        scanDuration: Date.now() - startTime,
        debugLogs
      });
    }

    // Collect all active miners from these addresses
    const allMiners = [];
    let addressesScanned = 0;
    let errors = 0;

    // Process addresses in batches to avoid overwhelming the RPC
    const batchSize = 5;
    const delay = 1000; // 1 second between batches

    for (let i = 0; i < addressesWithActiveMiners.length; i += batchSize) {
      const batch = addressesWithActiveMiners.slice(i, i + batchSize);
      const currentBatch = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(addressesWithActiveMiners.length / batchSize);

      log(`⚡ Processing miner batch ${currentBatch}/${totalBatches} (addresses ${i + 1}-${Math.min(i + batchSize, addressesWithActiveMiners.length)})`);

      // Process batch in parallel
      const promises = batch.map(async (address) => {
        try {
          log(`   🔍 ${address}: Fetching miner stats...`);
          const minerStats = await getMinerStatsDirect(chain, address);

          if (minerStats && minerStats.miners) {
            // Filter only active miners and add owner info and withdrawal ratio
            const activeMiners = minerStats.miners
              .filter(miner => miner.isActive)
              .map(miner => ({
                ...miner,
                owner: address,
                ownerRatio: ratioMap[address] || 0
              }));

            log(`   ✅ ${address}: Found ${activeMiners.length} active miners out of ${minerStats.miners.length} total`);
            return activeMiners;
          } else {
            log(`   ⚠️  ${address}: No miner stats returned`);
            return [];
          }
        } catch (error) {
          log(`   ❌ ${address}: Error - ${error.message}`);
          return [];
        }
      });

      const results = await Promise.all(promises);

      // Flatten results and add to main array
      results.forEach((minerArray) => {
        if (Array.isArray(minerArray)) {
          allMiners.push(...minerArray);
        }
      });

      addressesScanned += batch.length;

      // Add delay between batches
      if (i + batchSize < addressesWithActiveMiners.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const duration = Date.now() - startTime;
    log(`✅ Miner map collection complete for ${chain}`);
    log(`   - Addresses scanned: ${addressesScanned}`);
    log(`   - Total active miners found: ${allMiners.length}`);
    log(`   - Errors: ${errors}`);
    log(`   - Duration: ${Math.round(duration / 1000)}s`);

    return Response.json({
      success: true,
      chain,
      miners: allMiners,
      addressesScanned,
      totalMiners: allMiners.length,
      scanDuration: duration,
      debugLogs
    });

  } catch (error) {
    log(`❌ Miner map error: ${error.message}`);
    return Response.json({
      error: error.message || 'Failed to collect miner map data',
      debugLogs
    }, { status: 500 });
  }
}