import { ethers } from 'ethers';
import { 
  initializeDatabase, 
  getCachedRatios,
  storeRatioData,
  getAddressesNeedingRatioCalculation,
  getAllAddressesWithMiners
} from '../../../lib/database/operations.js';

const STORAGE_CORE_ABI = [
  'function deposits(address _player) external view returns (uint256)',
  'function withdrawals(address _player) external view returns (uint256)'
];

const MINER_LOGIC_ABI = [
  "function getPlayerMiners(address _player) external view returns (uint256[] minerIds, uint8[] minerTypes, uint8[] rarities, uint8[] lives, uint8[] shields, uint64[] lastMaintenance, uint64[] lastReward, uint64[] gracePeriodEnd, uint256[] pendingRewards, uint256[] maintenanceCosts)"
];

export async function GET(req) {
  console.log('🚀 RATIO-DATA GET CALLED');
  const { searchParams } = new URL(req.url);
  const chain = searchParams.get('chain') || 'abstract';
  console.log(`📊 GET request for ${chain} chain`);

  try {
    const ratios = await getCachedRatios(chain, 100);
    console.log(`✅ Found ${ratios.length} cached ratios`);
    
    return Response.json({
      success: true,
      chain,
      ratioData: ratios,
      lastUpdated: ratios[0]?.lastCalculatedAt || null
    });
  } catch (error) {
    console.error('❌ GET error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  console.log('🚀 RATIO-DATA POST CALLED');
  
  try {
    const { chain = 'abstract', scanType = 'update' } = await req.json();
    console.log(`📊 POST request for ${chain} chain, scanType: ${scanType}`);
    
    // Get addresses to process
    const addressesToProcess = await getAllAddressesWithMiners(chain);
    console.log(`🔍 Found ${addressesToProcess.length} addresses with miners`);
    
    if (addressesToProcess.length === 0) {
      console.log('📋 No addresses to process');
      return Response.json({
        success: true,
        chain,
        ratioData: [],
        addressesScanned: 0,
        newRatiosCalculated: 0,
        totalRatios: 0
      });
    }
    
    // Test with just first address
    const testAddress = addressesToProcess[0];
    console.log(`🧪 Testing with address: ${testAddress}`);
    
    // Simple direct calls inline
    const isBase = chain === 'base';
    const rpcUrl = isBase ? process.env.RPC_URL_BASE : process.env.RPC_URL_ABS;
    const storageAddress = isBase ? process.env.STORAGE_CONTRACT_BASE : process.env.STORAGE_CONTRACT_ABS;
    
    console.log(`🔗 Using RPC: ${rpcUrl}`);
    console.log(`📋 Using contract: ${storageAddress}`);
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const storageCore = new ethers.Contract(storageAddress, STORAGE_CORE_ABI, provider);
    
    const deposits = await storageCore.deposits(testAddress);
    const withdrawals = await storageCore.withdrawals(testAddress);
    
    console.log(`💰 ${testAddress}: deposits=${ethers.formatEther(deposits)}, withdrawals=${ethers.formatEther(withdrawals)}`);
    
    return Response.json({
      success: true,
      chain,
      testAddress,
      deposits: ethers.formatEther(deposits),
      withdrawals: ethers.formatEther(withdrawals),
      addressesFound: addressesToProcess.length
    });
    
  } catch (error) {
    console.error('❌ POST error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}