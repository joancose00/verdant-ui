import { ethers } from 'ethers';

// ABI for the deposits and withdrawals functions
const STORAGE_CORE_ABI = [
  'function deposits(address _player) external view returns (uint256)',
  'function withdrawals(address _player) external view returns (uint256)'
];

// Contract ABI for getPlayerMiners
const MINER_LOGIC_ABI = [
  "function getPlayerMiners(address _player) external view returns (uint256[] minerIds, uint8[] minerTypes, uint8[] rarities, uint8[] lives, uint8[] shields, uint64[] lastMaintenance, uint64[] lastReward, uint64[] gracePeriodEnd, uint256[] pendingRewards, uint256[] maintenanceCosts)"
];

/**
 * Fetch address metrics directly (deposits, withdrawals, ratio)
 */
export async function getAddressMetrics(chain, address) {
  // Validate address
  if (!ethers.isAddress(address)) {
    throw new Error('Invalid Ethereum address');
  }

  // Select contract and RPC based on chain
  const isBase = chain === 'base';
  const storageAddress = isBase ? process.env.STORAGE_CONTRACT_BASE : process.env.STORAGE_CONTRACT_ABS;
  const rpcUrl = isBase ? process.env.RPC_URL_BASE : process.env.RPC_URL_ABS;

  // Connect to provider
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  // Create contract instance
  const storageCore = new ethers.Contract(storageAddress, STORAGE_CORE_ABI, provider);

  // Fetch deposits and withdrawals with retry logic
  let deposits, withdrawals;
  const maxRetries = isBase ? 3 : 1;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      deposits = await storageCore.deposits(address);
      withdrawals = await storageCore.withdrawals(address);
      break;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, isBase ? 1000 : 500));
    }
  }

  // Format values
  const formattedDeposits = parseFloat(ethers.formatEther(deposits)).toFixed(2);
  const formattedWithdrawals = parseFloat(ethers.formatEther(withdrawals)).toFixed(2);

  // Calculate ratio
  let ratio;
  if (deposits > 0n) {
    const depositsNum = parseFloat(formattedDeposits);
    const withdrawalsNum = parseFloat(formattedWithdrawals);
    ratio = (withdrawalsNum / depositsNum).toFixed(2);
  } else {
    ratio = "10.00";
  }

  return {
    deposits: formattedDeposits,
    withdrawals: formattedWithdrawals,
    ratio: ratio
  };
}

/**
 * Fetch miner stats directly
 */
export async function getMinerStats(chain, address) {
  // Validate address
  if (!ethers.isAddress(address)) {
    throw new Error('Invalid Ethereum address');
  }

  // Setup based on chain
  const isBase = chain === 'base';
  const rpcUrl = isBase ? process.env.RPC_URL_BASE : process.env.RPC_URL_ABS;
  const minerContract = isBase ? process.env.MINER_CONTRACT_BASE : process.env.MINER_CONTRACT_ABS;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const minerLogic = new ethers.Contract(minerContract, MINER_LOGIC_ABI, provider);

  // Fetch miner data with retry logic
  let minerData;
  const maxRetries = isBase ? 3 : 1;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      minerData = await minerLogic.getPlayerMiners(address);
      break;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, isBase ? 1000 : 500));
    }
  }

  const [minerIds, minerTypes, rarities, lives, shields, lastMaintenance, lastReward, gracePeriodEnd, pendingRewards, maintenanceCosts] = minerData;

  // Process miners and count active ones
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

  return {
    totalMiners: minerIds.length,
    activeMiners: activeMinersCount,
    totalPendingRewards: parseFloat(ethers.formatEther(totalPendingRewards)).toFixed(2),
    miners
  };
}