import { scanForMinerAddresses } from '../../../utils/addressScanner.js';
import { incrementalScanFromId } from '../../../utils/incrementalScanner.js';
import { 
  initializeDatabase, 
  getAddressesWithMiners, 
  storeDiscoveredAddresses,
  needsRefresh,
  startScanRecord,
  completeScanRecord,
  getScanProgress,
  updateScanProgress,
  resetScanProgress
} from '../../../lib/database/operations.js';

export async function POST(req) {
  try {
    const { chain = 'abstract', maxMiners = 100, scanType = 'cached' } = await req.json();

    // Validate parameters
    if (!['abstract', 'base'].includes(chain)) {
      return Response.json({ error: 'Invalid chain. Use "abstract" or "base"' }, { status: 400 });
    }

    if (maxMiners < 1 || maxMiners > 10000) {
      return Response.json({ error: 'maxMiners must be between 1 and 10000' }, { status: 400 });
    }

    // Initialize database if needed
    try {
      await initializeDatabase();
    } catch (dbError) {
      console.log('Database already initialized or minor error:', dbError.message);
    }

    // Get scan progress
    const scanProgress = await getScanProgress(chain);
    
    // Always try to load cached data first
    const cachedAddresses = await getAddressesWithMiners(chain, 1000);
    
    // If requesting cached only, return cached data
    if (scanType === 'cached') {
      console.log(`📋 Using cached data for ${chain} chain`);
      
      return Response.json({
        success: true,
        chain,
        totalAddresses: cachedAddresses.length,
        fromCache: true,
        addresses: cachedAddresses.map(addr => addr.address),
        lastUpdated: cachedAddresses[0]?.lastUpdated,
        scanProgress: {
          lastCheckedMinerId: scanProgress?.last_checked_miner_id || 0,
          totalMinersFound: scanProgress?.total_miners_found || 0,
          totalMinersInContract: null // Will be populated during scan
        }
      });
    }

    // Continue scanning from last checked ID (not reset)
    const startTime = Date.now();
    const lastCheckedId = scanProgress?.last_checked_miner_id || 0;
    
    console.log(`🔍 Starting incremental scan for ${chain} chain from miner ID ${lastCheckedId + 1} (max ${maxMiners} miners)`);
    
    // Start scan tracking
    const scanId = await startScanRecord(chain, lastCheckedId + 1, lastCheckedId + maxMiners, 'incremental');
    
    try {
      // Perform incremental scan with appropriate batch size for chain
      const batchSize = chain === 'base' ? 15 : 25; // Balanced batch size to avoid rate limits
      const scanResult = await incrementalScanFromId(chain, lastCheckedId, maxMiners, batchSize);
      
      // Only store new addresses (function already handles duplicates)
      let newAddressesStored = 0;
      if (scanResult.addresses.length > 0) {
        console.log(`💾 Storing ${scanResult.addresses.length} newly discovered addresses for ${chain}`);
        await storeDiscoveredAddresses(chain, scanResult.addresses);
        newAddressesStored = scanResult.addresses.length;
      }
      
      // Update scan progress
      await updateScanProgress(chain, scanResult.lastCheckedId, newAddressesStored);
      
      const duration = Date.now() - startTime;
      await completeScanRecord(scanId, newAddressesStored, duration);
      
      // Get updated cached addresses to return
      const updatedAddresses = await getAddressesWithMiners(chain, 1000);
      
      return Response.json({
        success: true,
        chain,
        totalAddresses: updatedAddresses.length,
        newAddressesFound: newAddressesStored,
        scannedMiners: scanResult.totalScanned,
        fromCache: false,
        scanDuration: duration,
        addresses: updatedAddresses.map(addr => addr.address),
        scanProgress: {
          lastCheckedMinerId: scanResult.lastCheckedId,
          hasMore: scanResult.hasMore,
          totalMinersInContract: scanResult.totalMinersInContract,
          scanRange: scanResult.scanRange
        }
      });

    } catch (scanError) {
      const duration = Date.now() - startTime;
      await completeScanRecord(scanId, 0, duration, scanError.message);
      throw scanError;
    }

  } catch (error) {
    console.error('Address scan error:', error);
    return Response.json({ 
      error: error.message || 'Failed to scan for addresses' 
    }, { status: 500 });
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const chain = searchParams.get('chain') || 'abstract';

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

    console.log(`📋 Getting cached addresses for ${chain} chain`);
    
    const [cachedAddresses, scanProgress] = await Promise.all([
      getAddressesWithMiners(chain, 1000),
      getScanProgress(chain)
    ]);
    
    return Response.json({
      success: true,
      chain,
      totalAddresses: cachedAddresses.length,
      fromCache: true,
      addresses: cachedAddresses.map(addr => addr.address),
      lastUpdated: cachedAddresses[0]?.lastUpdated,
      scanProgress: {
        lastCheckedMinerId: scanProgress?.last_checked_miner_id || 0,
        totalMinersFound: scanProgress?.total_miners_found || 0
      }
    });

  } catch (error) {
    console.error('Address scan error:', error);
    return Response.json({ 
      error: error.message || 'Failed to get cached addresses' 
    }, { status: 500 });
  }
}