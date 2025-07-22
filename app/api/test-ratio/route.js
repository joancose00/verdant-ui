import { getAllAddressesWithMiners, getAddressesNeedingRatioCalculation } from '../../../lib/database/operations.js';

export async function GET() {
  try {
    console.log('🧪 Testing ratio data preparation...');
    
    // Test Abstract chain address discovery
    const abstractAddressesWithMiners = await getAllAddressesWithMiners('abstract');
    console.log(`📊 Abstract addresses with miners: ${abstractAddressesWithMiners.length}`);
    console.log(`📝 First 5 Abstract addresses: ${abstractAddressesWithMiners.slice(0, 5).join(', ')}`);
    
    const abstractNeedingRatios = await getAddressesNeedingRatioCalculation('abstract', 100);
    console.log(`📊 Abstract addresses needing ratios: ${abstractNeedingRatios.length}`);
    console.log(`📝 First 5 needing ratios: ${abstractNeedingRatios.slice(0, 5).join(', ')}`);
    
    return Response.json({
      success: true,
      abstract: {
        totalWithMiners: abstractAddressesWithMiners.length,
        needingRatios: abstractNeedingRatios.length,
        sampleAddresses: abstractAddressesWithMiners.slice(0, 10),
        sampleNeedingRatios: abstractNeedingRatios.slice(0, 10)
      }
    });
    
  } catch (error) {
    console.error('❌ Test ratio error:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { chain = 'abstract', address } = await req.json();
    
    console.log(`🧪 Testing single address ratio calculation: ${address} on ${chain}`);
    
    // Import the direct functions
    const { getAddressMetricsDirect, getMinerStatsDirect } = await import('../../../utils/directCalls.js');
    
    console.log('🔍 Fetching metrics...');
    const metrics = await getAddressMetricsDirect(chain, address);
    console.log(`📊 Metrics result:`, metrics);
    
    console.log('⛏️ Fetching miner stats...');
    const minerStats = await getMinerStatsDirect(chain, address);
    console.log(`⛏️ Miner stats result:`, minerStats);
    
    if (!metrics || !minerStats) {
      return Response.json({
        success: false,
        error: 'Failed to fetch metrics or miner stats',
        metrics,
        minerStats
      });
    }
    
    const deposits = parseFloat(metrics.deposits) || 0;
    const withdrawals = parseFloat(metrics.withdrawals) || 0;
    const activeMiners = parseInt(minerStats.activeMiners) || 0;
    const totalMiners = parseInt(minerStats.totalMiners) || 0;
    
    let ratio = 0;
    if (deposits > 0) {
      ratio = withdrawals / deposits;
    } else if (withdrawals > 0) {
      ratio = 999;
    }
    
    console.log(`📊 Final calculation: ${withdrawals}/${deposits} = ${ratio}, ${activeMiners}/${totalMiners} miners`);
    
    return Response.json({
      success: true,
      address,
      chain,
      metrics,
      minerStats,
      calculation: {
        deposits,
        withdrawals,
        ratio,
        activeMiners,
        totalMiners,
        wouldInclude: activeMiners > 0
      }
    });
    
  } catch (error) {
    console.error('❌ Single address test error:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}