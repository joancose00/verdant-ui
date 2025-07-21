require('dotenv').config();
const { ethers } = require('ethers');

// ABI for the deposits and withdrawals functions
const STORAGE_CORE_ABI = [
    'function deposits(address _player) external view returns (uint256)',
    'function withdrawals(address _player) external view returns (uint256)'
];

async function getAddressMetrics(address, chain = 'abstract') {
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
    
    // Calculate ratio with 2 decimal places
    let ratio;
    if (deposits > 0n) {
        // Convert to numbers for decimal calculation
        const depositsNum = Number(deposits);
        const withdrawalsNum = Number(withdrawals);
        ratio = (withdrawalsNum / depositsNum).toFixed(2);
    } else {
        ratio = "10.00";
    }
    
    return {
        deposits: deposits.toString(),
        withdrawals: withdrawals.toString(),
        ratio: ratio
    };
}

// Example usage
async function main() {
    const address = process.argv[2];
    const chain = process.argv[3] || 'abstract';
    
    if (!address) {
        console.error('Usage: node getAddressMetrics.js <address> [chain]');
        console.error('Chain options: abstract (default), base');
        process.exit(1);
    }
    
    if (!['abstract', 'base'].includes(chain)) {
        console.error('Error: Invalid chain. Use "abstract" or "base"');
        process.exit(1);
    }
    
    try {
        const metrics = await getAddressMetrics(address, chain);
        console.log('Address:', address);
        console.log('Chain:', chain);
        console.log('Deposits:', metrics.deposits);
        console.log('Withdrawals:', metrics.withdrawals);
        console.log('Ratio:', metrics.ratio);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { getAddressMetrics };