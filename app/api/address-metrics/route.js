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

    // Fetch deposits and withdrawals with retry logic for Base network
    let deposits, withdrawals;
    const maxRetries = isBase ? 3 : 1; // More retries for Base due to RPC instability
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📞 Attempt ${attempt}/${maxRetries} for ${address} on ${chain}`);
        
        deposits = await storageCore.deposits(address);
        withdrawals = await storageCore.withdrawals(address);
        
        console.log(`✅ Success on attempt ${attempt}: deposits=${ethers.formatEther(deposits)}, withdrawals=${ethers.formatEther(withdrawals)}`);
        break; // Success, exit retry loop
        
      } catch (error) {
        console.error(`❌ Attempt ${attempt} failed for ${address}:`, error.message);
        
        if (attempt === maxRetries) {
          // Last attempt failed, throw the error
          throw error;
        }
        
        // Wait before retrying (balanced for Alchemy rate limits)
        const delay = isBase ? 400 * attempt : 300 * attempt;
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Format with 18 decimals and round to 2 decimal places
    const formattedDeposits = parseFloat(ethers.formatEther(deposits)).toFixed(2);
    const formattedWithdrawals = parseFloat(ethers.formatEther(withdrawals)).toFixed(2);

    // Calculate true ratio (withdrawals/deposits) with 2 decimal places
    let ratio;
    if (deposits > 0n) {
      // Convert to numbers for decimal calculation
      const depositsNum = parseFloat(formattedDeposits);
      const withdrawalsNum = parseFloat(formattedWithdrawals);
      ratio = (withdrawalsNum / depositsNum).toFixed(2);
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