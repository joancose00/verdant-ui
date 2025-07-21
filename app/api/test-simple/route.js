import { ethers } from 'ethers';

export async function GET() {
  try {
    console.log('🧪 Simple test starting...');
    
    // Test environment variables
    const hasAbsRpc = !!process.env.RPC_URL_ABS;
    const hasBaseRpc = !!process.env.RPC_URL_BASE;
    const hasAbsStorage = !!process.env.STORAGE_CONTRACT_ABS;
    const hasBaseStorage = !!process.env.STORAGE_CONTRACT_BASE;
    
    console.log(`Environment check: ABS_RPC=${hasAbsRpc}, BASE_RPC=${hasBaseRpc}, ABS_STORAGE=${hasAbsStorage}, BASE_STORAGE=${hasBaseStorage}`);
    
    if (!hasAbsRpc || !hasAbsStorage) {
      return Response.json({
        success: false,
        error: 'Missing Abstract environment variables',
        details: {
          hasAbsRpc,
          hasAbsStorage,
          absRpc: process.env.RPC_URL_ABS || 'MISSING',
          absStorage: process.env.STORAGE_CONTRACT_ABS || 'MISSING'
        }
      });
    }
    
    // Test Abstract blockchain connection
    console.log('🔗 Testing Abstract connection...');
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_ABS);
    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ Abstract RPC connected, block: ${blockNumber}`);
    
    // Test Abstract contract
    console.log('📋 Testing Abstract contract...');
    const storageAbi = [
      'function deposits(address _player) external view returns (uint256)',
      'function withdrawals(address _player) external view returns (uint256)'
    ];
    
    const storageContract = new ethers.Contract(
      process.env.STORAGE_CONTRACT_ABS, 
      storageAbi, 
      provider
    );
    
    // Test with a known address (or zero address)
    const testAddress = '0x0000000000000000000000000000000000000000';
    const deposits = await storageContract.deposits(testAddress);
    const withdrawals = await storageContract.withdrawals(testAddress);
    
    console.log(`✅ Abstract contract call successful: deposits=${deposits}, withdrawals=${withdrawals}`);
    
    return Response.json({
      success: true,
      message: 'All basic tests passed',
      results: {
        environment: {
          hasAbsRpc,
          hasBaseRpc,
          hasAbsStorage,
          hasBaseStorage
        },
        blockchain: {
          blockNumber,
          network: await provider.getNetwork()
        },
        contract: {
          address: process.env.STORAGE_CONTRACT_ABS,
          testDeposits: deposits.toString(),
          testWithdrawals: withdrawals.toString()
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Simple test failed:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { chain, address } = await req.json();
    
    console.log(`🧪 Testing ${chain} chain with address ${address}`);
    
    const isBase = chain === 'base';
    const rpcUrl = isBase ? process.env.RPC_URL_BASE : process.env.RPC_URL_ABS;
    const storageAddress = isBase ? process.env.STORAGE_CONTRACT_BASE : process.env.STORAGE_CONTRACT_ABS;
    
    if (!rpcUrl || !storageAddress) {
      return Response.json({
        success: false,
        error: `Missing environment variables for ${chain}`,
        rpcUrl: rpcUrl || 'MISSING',
        storageAddress: storageAddress || 'MISSING'
      });
    }
    
    // Test the exact same logic as address-metrics API
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const storageAbi = [
      'function deposits(address _player) external view returns (uint256)',
      'function withdrawals(address _player) external view returns (uint256)'
    ];
    const storageCore = new ethers.Contract(storageAddress, storageAbi, provider);
    
    const deposits = await storageCore.deposits(address);
    const withdrawals = await storageCore.withdrawals(address);
    
    const formattedDeposits = parseFloat(ethers.formatEther(deposits)).toFixed(2);
    const formattedWithdrawals = parseFloat(ethers.formatEther(withdrawals)).toFixed(2);
    
    let ratio;
    if (deposits > 0n) {
      const depositsNum = parseFloat(formattedDeposits);
      const withdrawalsNum = parseFloat(formattedWithdrawals);
      ratio = (withdrawalsNum / depositsNum).toFixed(2);
    } else {
      ratio = "10.00";
    }
    
    return Response.json({
      success: true,
      chain,
      address,
      deposits: formattedDeposits,
      withdrawals: formattedWithdrawals,
      ratio: ratio,
      raw: {
        deposits: deposits.toString(),
        withdrawals: withdrawals.toString()
      }
    });
    
  } catch (error) {
    console.error(`❌ POST test failed:`, error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}