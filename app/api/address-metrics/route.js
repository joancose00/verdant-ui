import { ethers } from 'ethers';

// ABI for the deposits and withdrawals functions
const STORAGE_CORE_ABI = [
  'function deposits(address _player) external view returns (uint256)',
  'function withdrawals(address _player) external view returns (uint256)'
];

export async function POST(req) {
  try {
    const { address, chain } = await req.json();

    // Validate address
    if (!ethers.isAddress(address)) {
      return Response.json({ error: 'Invalid Ethereum address' }, { status: 400 });
    }

    // Select contract and RPC based on chain
    const isBase = chain === 'base';
    const storageAddress = isBase ? process.env.STORAGE_CONTRACT_BASE : process.env.STORAGE_CONTRACT_ABS;
    const rpcUrl = isBase ? process.env.RPC_URL_BASE : process.env.RPC_URL_ABS;

    // Connect to provider
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Create contract instance
    const storageCore = new ethers.Contract(storageAddress, STORAGE_CORE_ABI, provider);

    // Fetch deposits and withdrawals
    const deposits = await storageCore.deposits(address);
    const withdrawals = await storageCore.withdrawals(address);

    // Format with 18 decimals and round to 2 decimal places
    const formattedDeposits = parseFloat(ethers.formatEther(deposits)).toFixed(2);
    const formattedWithdrawals = parseFloat(ethers.formatEther(withdrawals)).toFixed(2);

    // Calculate ratio with 2 decimal places
    let ratio;
    if (deposits > 0n) {
      // Convert to numbers for decimal calculation
      const depositsNum = parseFloat(formattedDeposits);
      const withdrawalsNum = parseFloat(formattedWithdrawals);
      ratio = (1 + (withdrawalsNum / depositsNum)).toFixed(2);
    } else {
      ratio = "10.00";
    }

    return Response.json({
      deposits: formattedDeposits,
      withdrawals: formattedWithdrawals,
      ratio: ratio
    });

  } catch (error) {
    console.error('Address metrics error:', error);
    return Response.json({ 
      error: error.message || 'Failed to fetch address metrics' 
    }, { status: 500 });
  }
}