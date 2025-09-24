import { ethers } from 'ethers';

const STORAGE_CORE_ABI = [
  'function deposits(address _player) external view returns (uint256)',
  'function withdrawals(address _player) external view returns (uint256)'
];

const MINER_LOGIC_ABI = [
  "function getPlayerMiners(address _player) external view returns (uint256[] minerIds, uint8[] minerTypes, uint8[] rarities, uint8[] lives, uint8[] shields, uint64[] lastMaintenance, uint64[] lastReward, uint64[] gracePeriodEnd, uint256[] pendingRewards, uint256[] maintenanceCosts)",
  "function getPlayerRefinements(address _player) external view returns (tuple(uint256 verdantAmount, uint256 verditeAmount, uint64 collectionTime)[] memory)",
  "event PurchasedBloom(address indexed player, uint256 verdantAmount, uint256 bloomAmount)"
];

/**
 * Direct address metrics - same logic as /api/address-metrics
 */
export async function getAddressMetricsDirect(chain, address) {
  try {
    console.log(`📊 Direct address metrics for ${address} on ${chain}`);
    
    if (!ethers.isAddress(address)) {
      console.error(`❌ Invalid address format: ${address}`);
      throw new Error('Invalid Ethereum address');
    }

    if (chain !== 'base') {
      throw new Error('Only base chain is supported');
    }
    const storageAddress = process.env.STORAGE_CONTRACT_BASE;
    const rpcUrl = process.env.RPC_URL_BASE;

    // Create fresh provider for each call to avoid any caching issues
    // Add random delay to prevent concurrent call conflicts
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    const provider = new ethers.JsonRpcProvider(rpcUrl, null, { 
      staticNetwork: true,
      batchMaxCount: 1  // Disable batching to prevent call mixing
    });
    const storageCore = new ethers.Contract(storageAddress, STORAGE_CORE_ABI, provider);

    // Fetch with retry logic
    let deposits, withdrawals;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`   📋 Calling deposits(${address}) and withdrawals(${address}) on ${storageAddress}`);
        deposits = await storageCore.deposits(address);
        withdrawals = await storageCore.withdrawals(address);
        console.log(`   📋 Raw contract response: deposits=${deposits.toString()}, withdrawals=${withdrawals.toString()}`);
        break;
      } catch (error) {
        console.error(`Direct metrics attempt ${attempt}/${maxRetries} failed:`, error.message);
        if (attempt === maxRetries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

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

    console.log(`✅ Direct metrics success: ${formattedDeposits}/${formattedWithdrawals} = ${ratio}`);
    
    return {
      deposits: formattedDeposits,
      withdrawals: formattedWithdrawals,
      ratio: ratio
    };

  } catch (error) {
    console.error(`❌ Direct address metrics failed for ${address}:`, error.message);
    return null;
  }
}

/**
 * Direct miner stats - same logic as /api/miner-stats  
 */
export async function getMinerStatsDirect(chain, address) {
  try {
    console.log(`⛏️ Direct miner stats for ${address} on ${chain}`);
    
    if (!ethers.isAddress(address)) {
      console.error(`❌ Invalid address format: ${address}`);
      throw new Error('Invalid Ethereum address');
    }

    if (chain !== 'base') {
      throw new Error('Only base chain is supported');
    }
    const rpcUrl = process.env.RPC_URL_BASE;
    const minerContract = process.env.MINER_CONTRACT_BASE;

    // Add random delay to prevent concurrent call conflicts
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    const provider = new ethers.JsonRpcProvider(rpcUrl, null, { 
      staticNetwork: true,
      batchMaxCount: 1  // Disable batching to prevent call mixing
    });
    const minerLogic = new ethers.Contract(minerContract, MINER_LOGIC_ABI, provider);

    // Fetch with retry logic
    let minerData;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`   🔗 Calling getPlayerMiners(${address}) on ${minerContract}`);
        minerData = await minerLogic.getPlayerMiners(address);
        console.log(`   🔗 Raw miner data: ${minerData[0].length} miners found`);
        if (minerData[0].length > 0) {
          console.log(`   🔗 First miner: id=${minerData[0][0]}, lives=${minerData[3][0]}, shields=${minerData[4][0]}`);
        }
        break;
      } catch (error) {
        console.error(`Direct miner stats attempt ${attempt}/${maxRetries} failed:`, error.message);
        if (attempt === maxRetries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const [minerIds, minerTypes, rarities, lives, shields, lastMaintenance, lastReward, gracePeriodEnd, pendingRewards, maintenanceCosts] = minerData;

    const currentTime = Math.floor(Date.now() / 1000);
    let activeMinersCount = 0;
    let totalPendingRewards = 0n;
    
    console.log(`🕐 Current time: ${currentTime} (${new Date(currentTime * 1000).toISOString()})`);
    
    const miners = minerIds.map((id, index) => {
      const gracePeriodEndTime = Number(gracePeriodEnd[index]);
      // Use same logic as wallet interface: lives > 0 && shields > 0
      const isActive = lives[index] > 0 && shields[index] > 0;
      
      // Debug first few miners
      if (index < 3) {
        console.log(`⛏️ Miner ${id}: lives=${lives[index]}, shields=${shields[index]}, isActive=${isActive}`);
      }
      
      if (isActive) {
        activeMinersCount++;
        totalPendingRewards += pendingRewards[index];
      }

      return {
        id: Number(id),
        type: Number(minerTypes[index]),
        rarity: Number(rarities[index]),
        lives: Number(lives[index]),
        shields: Number(shields[index]),
        lastMaintenance: Number(lastMaintenance[index]),
        lastReward: Number(lastReward[index]),
        gracePeriodEnd: gracePeriodEndTime,
        isActive,
        pendingRewards: parseFloat(ethers.formatEther(pendingRewards[index])).toFixed(2),
        maintenanceCost: parseFloat(ethers.formatEther(maintenanceCosts[index])).toFixed(2)
      };
    });

    console.log(`✅ Direct miner stats success: ${minerIds.length} total, ${activeMinersCount} active`);
    if (minerIds.length > 0 && activeMinersCount === 0) {
      console.log(`⚠️ WARNING: ${address} has ${minerIds.length} miners but 0 active - checking first few:`);
      for (let i = 0; i < Math.min(3, minerIds.length); i++) {
        console.log(`   Miner ${minerIds[i]}: lives=${lives[i]}, shields=${shields[i]} -> active=${lives[i] > 0 && shields[i] > 0}`);
      }
    }

    return {
      totalMiners: minerIds.length,
      activeMiners: activeMinersCount,
      totalPendingRewards: parseFloat(ethers.formatEther(totalPendingRewards)).toFixed(2),
      miners
    };

  } catch (error) {
    console.error(`❌ Direct miner stats failed for ${address}:`, error.message);
    return null;
  }
}

/**
 * Direct bloom history - same logic as /api/bloom-history
 */
export async function getBloomHistoryDirect(chain, address) {
  try {
    console.log(`🌸 Direct bloom history for ${address} on ${chain}`);

    if (!ethers.isAddress(address)) {
      console.error(`❌ Invalid address format: ${address}`);
      throw new Error('Invalid Ethereum address');
    }

    if (chain !== 'base') {
      throw new Error('Only base chain is supported');
    }

    const alchemyApiKey = process.env.ALCHEMY_API_KEY_BASE;
    const minerContractAddress = process.env.MINER_CONTRACT_BASE;
    const PURCHASE_BLOOM_SIGNATURE = '0xb947e924'; // purchaseBloom(uint256,address)

    // Calculate timestamp for 14 days ago
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const fourteenDaysAgo = currentTimestamp - (14 * 24 * 60 * 60);

    // Add random delay to prevent concurrent call conflicts
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

    // Use Alchemy's getAssetTransfers API to get transaction history
    const alchemyUrl = `https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;

    console.log(`   📅 Fetching transaction history from ${address} to ${minerContractAddress}`);

    // Get transactions FROM the address TO the miner contract
    const response = await fetch(alchemyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'alchemy_getAssetTransfers',
        params: [{
          fromAddress: address,
          toAddress: minerContractAddress,
          category: ['external'],
          withMetadata: true,
          excludeZeroValue: false,
          maxCount: '0x3e8', // 1000 in hex
          order: 'desc'
        }]
      })
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message);
    }

    const provider = new ethers.JsonRpcProvider(alchemyUrl, null, {
      staticNetwork: true,
      batchMaxCount: 1
    });

    // Process transactions to find bloom purchases
    let totalVerdantSpent = 0;
    let totalBloomReceived = 0;
    const purchases = [];

    console.log(`   🔍 Processing ${data.result.transfers.length} transactions`);

    for (const transfer of data.result.transfers) {
      const txTimestamp = new Date(transfer.metadata.blockTimestamp).getTime() / 1000;

      // Skip if older than 14 days
      if (txTimestamp < fourteenDaysAgo) continue;

      try {
        // Get transaction details to check if it's a purchaseBloom call
        const tx = await provider.getTransaction(transfer.hash);
        if (!tx || !tx.data) continue;

        // Check if transaction data starts with purchaseBloom function signature
        if (tx.data.toLowerCase().startsWith(PURCHASE_BLOOM_SIGNATURE.toLowerCase())) {
          // Get transaction receipt to find PurchasedBloom event
          const receipt = await provider.getTransactionReceipt(transfer.hash);
          if (!receipt) continue;

          // Look for PurchasedBloom event in logs
          const purchaseBloomTopic = '0xe23a5f8390716f10c4e92f3d40fb979c90bae202d8c4a2734ac0be6904d3fb1a';

          for (const log of receipt.logs) {
            if (log.topics[0] === purchaseBloomTopic &&
                log.topics[1] === ethers.zeroPadValue(address.toLowerCase(), 32)) {

              // Decode the event data
              const verdantAmount = ethers.getBigInt(log.data.slice(0, 66));
              const bloomAmount = ethers.getBigInt('0x' + log.data.slice(66, 130));

              const verdantAmountFormatted = parseFloat(ethers.formatEther(verdantAmount));
              const bloomAmountFormatted = parseFloat(ethers.formatEther(bloomAmount));

              totalVerdantSpent += verdantAmountFormatted;
              totalBloomReceived += bloomAmountFormatted;

              purchases.push({
                transactionHash: transfer.hash,
                blockNumber: parseInt(transfer.blockNum, 16),
                timestamp: new Date(txTimestamp * 1000).toISOString(),
                verdantAmount: verdantAmountFormatted.toFixed(2),
                bloomAmount: bloomAmountFormatted.toFixed(2),
                timeAgo: formatTimeAgo(txTimestamp, currentTimestamp)
              });
              break;
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to process transaction ${transfer.hash}:`, error.message);
        continue;
      }
    }

    // Sort purchases by timestamp (most recent first)
    purchases.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    console.log(`✅ Direct bloom history success: ${purchases.length} purchases in last 14 days`);

    return {
      totalPurchases: purchases.length,
      totalVerdantSpent: totalVerdantSpent.toFixed(2),
      totalBloomReceived: totalBloomReceived.toFixed(2),
      purchases
    };

  } catch (error) {
    console.error(`❌ Direct bloom history failed for ${address}:`, error.message);
    return null;
  }
}

function formatTimeAgo(timestamp, currentTimestamp) {
  const diffSeconds = currentTimestamp - timestamp;
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}