import { ethers } from 'ethers';

const STORAGE_CORE_ABI = [
  'function deposits(address _player) external view returns (uint256)',
  'function withdrawals(address _player) external view returns (uint256)'
];

const MINER_LOGIC_ABI = [
  "function getPlayerMiners(address _player) external view returns (uint256[] minerIds, uint8[] minerTypes, uint8[] rarities, uint8[] lives, uint8[] shields, uint64[] lastMaintenance, uint64[] lastReward, uint64[] gracePeriodEnd, uint256[] pendingRewards, uint256[] maintenanceCosts)"
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

    const isBase = chain === 'base';
    const storageAddress = isBase ? process.env.STORAGE_CONTRACT_BASE : process.env.STORAGE_CONTRACT_ABS;
    const rpcUrl = isBase ? process.env.RPC_URL_BASE : process.env.RPC_URL_ABS;

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const storageCore = new ethers.Contract(storageAddress, STORAGE_CORE_ABI, provider);

    // Fetch with retry logic
    let deposits, withdrawals;
    const maxRetries = isBase ? 3 : 1;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        deposits = await storageCore.deposits(address);
        withdrawals = await storageCore.withdrawals(address);
        break;
      } catch (error) {
        console.error(`Direct metrics attempt ${attempt}/${maxRetries} failed:`, error.message);
        if (attempt === maxRetries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, isBase ? 1000 : 500));
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

    const isBase = chain === 'base';
    const rpcUrl = isBase ? process.env.RPC_URL_BASE : process.env.RPC_URL_ABS;
    const minerContract = isBase ? process.env.MINER_CONTRACT_BASE : process.env.MINER_CONTRACT_ABS;

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const minerLogic = new ethers.Contract(minerContract, MINER_LOGIC_ABI, provider);

    // Fetch with retry logic
    let minerData;
    const maxRetries = isBase ? 3 : 1;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        minerData = await minerLogic.getPlayerMiners(address);
        break;
      } catch (error) {
        console.error(`Direct miner stats attempt ${attempt}/${maxRetries} failed:`, error.message);
        if (attempt === maxRetries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, isBase ? 1000 : 500));
      }
    }

    const [minerIds, minerTypes, rarities, lives, shields, lastMaintenance, lastReward, gracePeriodEnd, pendingRewards, maintenanceCosts] = minerData;

    const currentTime = Math.floor(Date.now() / 1000);
    let activeMinersCount = 0;
    let totalPendingRewards = 0n;
    
    const miners = minerIds.map((id, index) => {
      const gracePeriodEndTime = Number(gracePeriodEnd[index]);
      const isActive = gracePeriodEndTime > currentTime;
      
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