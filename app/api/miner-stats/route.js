import { ethers } from 'ethers';

// Contract ABI for getPlayerMiners
const MINER_LOGIC_ABI = [
  "function getPlayerMiners(address _player) external view returns (uint256[] minerIds, uint8[] minerTypes, uint8[] rarities, uint8[] lives, uint8[] shields, uint64[] lastMaintenance, uint64[] lastReward, uint64[] gracePeriodEnd, uint256[] pendingRewards, uint256[] maintenanceCosts)",
  "function getPlayerRefinements(address _player) external view returns (tuple(uint256 verdantAmount, uint256 verditeAmount, uint64 collectionTime)[] memory)",
  "event PurchasedBloom(address indexed player, uint256 verdantAmount, uint256 bloomAmount)"
];

// Miner type names
const MINER_TYPE_NAMES = {
  0: 'Starter',
  1: 'Basic',
  2: 'Advanced',
  3: 'Elite'
};

export async function POST(req) {
  try {
    const { address, chain } = await req.json();

    // Validate address
    if (!ethers.isAddress(address)) {
      return Response.json({ error: 'Invalid Ethereum address' }, { status: 400 });
    }

    // Setup based on chain
    const isBase = chain === 'base';
    const rpcUrl = isBase ? process.env.RPC_URL_BASE : process.env.RPC_URL_ABS;
    const minerContract = isBase ? process.env.MINER_CONTRACT_BASE : process.env.MINER_CONTRACT_ABS;

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const minerLogic = new ethers.Contract(minerContract, MINER_LOGIC_ABI, provider);

    // Get miner data and refinements in parallel
    const [minerData, refinementsData] = await Promise.all([
      minerLogic.getPlayerMiners(address),
      minerLogic.getPlayerRefinements(address)
    ]);

    const [minerIds, minerTypes, rarities, lives, shields, lastMaintenance, lastReward, gracePeriodEnd, pendingRewards, maintenanceCosts] = minerData;

    // Process miner data
    let totalPendingRewards = 0n;
    let activeMinersCount = 0;
    const miners = [];

    for (let i = 0; i < minerIds.length; i++) {
      const isActive = lives[i] > 0 && shields[i] > 0;
      
      if (isActive) {
        activeMinersCount++;
        totalPendingRewards += pendingRewards[i];
      }

      const typeId = Number(minerTypes[i]);
      const gracePeriodTimestamp = Number(gracePeriodEnd[i]);
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const isInGracePeriod = gracePeriodTimestamp > currentTimestamp;
      
      miners.push({
        id: minerIds[i].toString(),
        type: typeId,
        typeName: MINER_TYPE_NAMES[typeId] || 'Unknown',
        lives: Number(lives[i]),
        shields: Number(shields[i]),
        active: isActive,
        lastMaintenance: new Date(Number(lastMaintenance[i]) * 1000).toISOString(),
        lastReward: new Date(Number(lastReward[i]) * 1000).toISOString(),
        pendingRewards: parseFloat(ethers.formatEther(pendingRewards[i])).toFixed(2),
        maintenanceCost: parseFloat(ethers.formatEther(maintenanceCosts[i])).toFixed(2),
        gracePeriodEnd: gracePeriodTimestamp > 0 ? new Date(gracePeriodTimestamp * 1000).toISOString() : null,
        isInGracePeriod: isInGracePeriod
      });
    }

    // Process refinement data
    const currentTimestamp = Math.floor(Date.now() / 1000);
    let totalRefiningAmount = 0n;
    let readyToClaim = 0;
    let nextClaimableTime = null;

    const refinements = refinementsData.map((refinement, index) => {
      const verdantAmount = parseFloat(ethers.formatEther(refinement.verdantAmount));
      const verditeAmount = parseFloat(ethers.formatEther(refinement.verditeAmount));
      const collectionTime = Number(refinement.collectionTime);
      const isReady = currentTimestamp >= collectionTime;

      totalRefiningAmount += refinement.verdantAmount;

      if (isReady) {
        readyToClaim++;
      } else if (!nextClaimableTime || collectionTime < nextClaimableTime) {
        nextClaimableTime = collectionTime;
      }

      return {
        id: index,
        verdantAmount: verdantAmount.toFixed(2),
        verditeAmount: verditeAmount.toFixed(2),
        collectionTime: new Date(collectionTime * 1000).toISOString(),
        isReady: isReady,
        timeUntilReady: isReady ? 0 : collectionTime - currentTimestamp
      };
    });

    return Response.json({
      totalMiners: minerIds.length,
      activeMiners: activeMinersCount,
      totalPendingRewards: parseFloat(ethers.formatEther(totalPendingRewards)).toFixed(2),
      miners,
      refinements: {
        total: refinements.length,
        totalRefiningAmount: parseFloat(ethers.formatEther(totalRefiningAmount)).toFixed(2),
        readyToClaim: readyToClaim,
        nextClaimableTime: nextClaimableTime ? new Date(nextClaimableTime * 1000).toISOString() : null,
        items: refinements
      }
    });

  } catch (error) {
    console.error('Miner stats error:', error);
    return Response.json({ 
      error: error.message || 'Failed to fetch miner stats' 
    }, { status: 500 });
  }
}