require('dotenv').config();
const { ethers } = require('ethers');

// StorageCore ABI (minimal - just what we need)
const STORAGE_CORE_ABI = [
    "function nextMinerId() view returns (uint256)",
    "function miners(uint256 minerId) view returns (tuple(address owner, uint8 minerType, uint8 lives, uint8 shields, uint64 lastMaintenance, uint64 lastReward, uint64 gracePeriodEnd))"
];

/**
 * Scans the StorageCore contract to find all unique addresses that own miners
 * @param {string} chain - 'abstract' or 'base'
 * @param {number} batchSize - Number of miners to check per batch
 * @param {number} maxMiners - Maximum number of miners to scan (0 = scan all)
 * @returns {Array} Array of unique addresses that own miners
 */
async function scanForMinerAddresses(chain = 'abstract', batchSize = 100, maxMiners = 0) {
    console.log(`🔍 Scanning for miner addresses on ${chain}...`);
    
    // Setup provider and contract
    const isBase = chain === 'base';
    const rpcUrl = isBase ? process.env.RPC_URL_BASE : process.env.RPC_URL_ABS;
    const storageAddress = isBase ? process.env.STORAGE_CONTRACT_BASE : process.env.STORAGE_CONTRACT_ABS;
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const storageCore = new ethers.Contract(storageAddress, STORAGE_CORE_ABI, provider);
    
    try {
        // Get the current nextMinerId to know how many miners exist
        const nextMinerId = await storageCore.nextMinerId();
        const totalMiners = Number(nextMinerId) - 1; // nextMinerId is 1-indexed
        const scanlimit = maxMiners > 0 ? Math.min(maxMiners, totalMiners) : totalMiners;
        
        console.log(`📊 Total miners in contract: ${totalMiners}`);
        console.log(`🎯 Scanning first ${scanlimit} miners...`);
        
        const addresses = new Set();
        const batches = Math.ceil(scanlimit / batchSize);
        
        for (let batch = 0; batch < batches; batch++) {
            const startId = (batch * batchSize) + 1;
            const endId = Math.min(startId + batchSize - 1, scanlimit);
            
            console.log(`⚡ Processing batch ${batch + 1}/${batches} (miners ${startId}-${endId})`);
            
            // Create promises for batch
            const promises = [];
            for (let minerId = startId; minerId <= endId; minerId++) {
                promises.push(
                    storageCore.miners(minerId).catch(() => null) // Handle reverted calls gracefully
                );
            }
            
            // Execute batch
            const results = await Promise.all(promises);
            
            // Process results
            results.forEach((miner, index) => {
                if (miner && miner.owner !== ethers.ZeroAddress) {
                    addresses.add(miner.owner);
                }
            });
            
            console.log(`   Found ${addresses.size} unique addresses so far...`);
            
            // Add delay to avoid rate limiting
            if (batch < batches - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        const addressList = Array.from(addresses);
        console.log(`✅ Scan complete! Found ${addressList.length} unique addresses with miners`);
        
        return addressList;
        
    } catch (error) {
        console.error('❌ Error scanning for addresses:', error);
        throw error;
    }
}

/**
 * Scans recent transactions to find addresses that interacted with StorageCore
 * @param {string} chain - 'abstract' or 'base'
 * @param {number} blockRange - Number of recent blocks to scan
 * @returns {Array} Array of unique addresses that interacted with the contract
 */
async function scanRecentTransactions(chain = 'abstract', blockRange = 1000) {
    console.log(`🔍 Scanning recent transactions on ${chain}...`);
    
    const isBase = chain === 'base';
    const rpcUrl = isBase ? process.env.RPC_URL_BASE : process.env.RPC_URL_ABS;
    const storageAddress = isBase ? process.env.STORAGE_CONTRACT_BASE : process.env.STORAGE_CONTRACT_ABS;
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - blockRange);
        
        console.log(`📊 Scanning blocks ${fromBlock} to ${currentBlock}`);
        
        // This approach requires an archive node or indexing service
        // For demo purposes, we'll return empty array
        console.log('⚠️  Transaction scanning requires archive node access or indexing service');
        
        return [];
        
    } catch (error) {
        console.error('❌ Error scanning transactions:', error);
        throw error;
    }
}

module.exports = {
    scanForMinerAddresses,
    scanRecentTransactions
};

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    const chain = args[0] || 'abstract';
    const maxMiners = parseInt(args[1]) || 1000; // Default to first 1000 miners
    
    scanForMinerAddresses(chain, 100, maxMiners)
        .then(addresses => {
            console.log('\n📋 Addresses with miners:');
            addresses.forEach((addr, index) => {
                console.log(`${index + 1}. ${addr}`);
            });
        })
        .catch(console.error);
}