require('dotenv').config();
const { ethers } = require('ethers');

// StorageCore ABI (minimal - just what we need)
const STORAGE_CORE_ABI = [
    "function nextMinerId() view returns (uint256)",
    "function miners(uint256 minerId) view returns (tuple(address owner, uint8 minerType, uint8 lives, uint8 shields, uint64 lastMaintenance, uint64 lastReward, uint64 gracePeriodEnd))"
];

/**
 * Incremental scan starting from a specific miner ID
 * @param {string} chain - 'abstract' or 'base'
 * @param {number} startMinerId - Starting miner ID (exclusive)
 * @param {number} maxMiners - Maximum number of miners to scan
 * @param {number} batchSize - Number of miners to check per batch
 * @returns {Object} Scan results with addresses and next start ID
 */
async function incrementalScanFromId(chain, startMinerId, maxMiners = 100, batchSize = 50) {
    console.log(`🔍 Starting incremental scan from miner ID ${startMinerId} on ${chain}...`);
    
    // Ensure all parameters are numbers
    startMinerId = Number(startMinerId);
    maxMiners = Number(maxMiners);
    batchSize = Number(batchSize);
    
    console.log(`📋 Parameters: startMinerId=${startMinerId}, maxMiners=${maxMiners}, batchSize=${batchSize}`);
    
    // Balance batch size to avoid Alchemy rate limits
    if (chain === 'base' && batchSize > 15) {
        batchSize = 15; // Balanced to avoid 429 errors
        console.log(`⚡ Optimized batch size to ${batchSize} for Base network (Alchemy rate limits)`);
    }
    
    // Setup provider and contract
    const isBase = chain === 'base';
    const rpcUrl = isBase ? process.env.BASE_RPC : process.env.ABS_RPC;
    const storageAddress = isBase ? process.env.STORAGE_CONTRACT_BASE : process.env.STORAGE_CONTRACT_ABS;
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const storageCore = new ethers.Contract(storageAddress, STORAGE_CORE_ABI, provider);
    
    try {
        // Get the current nextMinerId to know how many miners exist
        let nextMinerId;
        let totalMiners;
        
        try {
            nextMinerId = await storageCore.nextMinerId();
            totalMiners = Number(nextMinerId) - 1;
        } catch (contractError) {
            console.error(`❌ Failed to get nextMinerId from contract:`, contractError.message);
            // Fallback: assume a reasonable number for Base
            if (chain === 'base') {
                totalMiners = 1056; // Known value from previous successful calls
                console.log(`⚠️  Using fallback totalMiners: ${totalMiners} for Base`);
            } else {
                throw contractError; // Re-throw for Abstract since we don't have a fallback
            }
        }
        
        console.log(`📊 Total miners in contract: ${totalMiners}`);
        console.log(`🎯 Starting from miner ID: ${Number(startMinerId) + 1}`);
        
        // Calculate scan range
        const actualStart = startMinerId + 1;
        const scanEnd = actualStart + maxMiners - 1;
        const scanLimit = Math.min(scanEnd, totalMiners);
        
        console.log(`🎯 Scan range calculation:`);
        console.log(`   actualStart: ${Number(actualStart)}`);
        console.log(`   scanEnd: ${Number(scanEnd)}`);
        console.log(`   totalMiners: ${Number(totalMiners)}`);
        console.log(`   scanLimit: ${Number(scanLimit)}`);
        console.log(`   miners to scan: ${Number(scanLimit - actualStart + 1)}`);
        
        if (actualStart > totalMiners) {
            console.log('✅ All miners have been scanned');
            return {
                addresses: [],
                lastCheckedId: totalMiners,
                totalScanned: 0,
                hasMore: false,
                totalMinersInContract: totalMiners
            };
        }
        
        console.log(`📈 Scanning miners ${actualStart} to ${scanLimit} (${scanLimit - actualStart + 1} miners)`);
        
        const addresses = new Set();
        const minersToScan = scanLimit - actualStart + 1;
        const batches = Math.ceil(minersToScan / batchSize);
        let lastProcessedId = startMinerId;
        
        console.log(`📊 Batch calculation:`);
        console.log(`   minersToScan: ${Number(minersToScan)}`);
        console.log(`   batchSize: ${Number(batchSize)}`);
        console.log(`   batches: ${Number(batches)}`);
        
        for (let batch = 0; batch < batches; batch++) {
            const batchStart = actualStart + (batch * batchSize);
            const batchEnd = Math.min(batchStart + batchSize - 1, scanLimit);
            
            console.log(`⚡ Processing batch ${batch + 1}/${batches} (miners ${Number(batchStart)}-${Number(batchEnd)})`);
            
            // Create promises for batch
            const promises = [];
            for (let minerId = batchStart; minerId <= batchEnd; minerId++) {
                promises.push(
                    storageCore.miners(minerId)
                        .then(miner => ({ minerId, miner }))
                        .catch(error => ({ minerId, error }))
                );
            }
            
            // Execute batch
            const results = await Promise.all(promises);
            
            // Process results
            results.forEach(({ minerId, miner, error }) => {
                lastProcessedId = Math.max(lastProcessedId, minerId);
                
                if (miner && miner.owner !== ethers.ZeroAddress) {
                    addresses.add(miner.owner);
                } else if (error) {
                    // Only log non-expected errors
                    if (!error.message.includes('missing revert data') && 
                        !error.message.includes('CALL_EXCEPTION') &&
                        !error.message.includes('maximuum 10 calls in 1 batch') &&
                        !error.message.includes('maximumm 10 calls in 1 batch') &&
                        !error.message.includes('missing response for request')) {
                        console.warn(`⚠️  Error checking miner ${minerId}:`, error.message);
                    }
                }
            });
            
            console.log(`   Found ${addresses.size} unique addresses so far...`);
            
            // Balanced delays to avoid Alchemy rate limits
            if (batch < batches - 1) {
                const delay = chain === 'base' ? 300 : 200;  // Balanced to avoid 429 errors
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        const addressList = Array.from(addresses);
        const hasMore = scanLimit < totalMiners;
        
        console.log(`✅ Incremental scan complete!`);
        console.log(`   - Scanned miners: ${actualStart} to ${lastProcessedId}`);
        console.log(`   - New addresses found: ${addressList.length}`);
        console.log(`   - Has more miners: ${hasMore}`);
        
        return {
            addresses: addressList,
            lastCheckedId: lastProcessedId,
            totalScanned: lastProcessedId - startMinerId,
            hasMore: hasMore,
            totalMinersInContract: totalMiners,
            scanRange: {
                start: actualStart,
                end: lastProcessedId
            }
        };
        
    } catch (error) {
        console.error('❌ Error in incremental scan:', error);
        throw error;
    }
}

/**
 * Get the total number of miners in a contract
 * @param {string} chain - 'abstract' or 'base'
 * @returns {number} Total number of miners
 */
async function getTotalMiners(chain) {
    const isBase = chain === 'base';
    const rpcUrl = isBase ? process.env.BASE_RPC : process.env.ABS_RPC;
    const storageAddress = isBase ? process.env.STORAGE_CONTRACT_BASE : process.env.STORAGE_CONTRACT_ABS;
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const storageCore = new ethers.Contract(storageAddress, STORAGE_CORE_ABI, provider);
    
    const nextMinerId = await storageCore.nextMinerId();
    return Number(nextMinerId) - 1;
}

module.exports = {
    incrementalScanFromId,
    getTotalMiners
};

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    const chain = args[0] || 'abstract';
    const startId = parseInt(args[1]) || 0;
    const maxMiners = parseInt(args[2]) || 100;
    
    incrementalScanFromId(chain, startId, maxMiners)
        .then(result => {
            console.log('\n📋 Scan Results:');
            console.log(`   Last Checked ID: ${result.lastCheckedId}`);
            console.log(`   New Addresses: ${result.addresses.length}`);
            console.log(`   Has More: ${result.hasMore}`);
            console.log('\n🏠 New Addresses Found:');
            result.addresses.forEach((addr, index) => {
                console.log(`${index + 1}. ${addr}`);
            });
        })
        .catch(console.error);
}