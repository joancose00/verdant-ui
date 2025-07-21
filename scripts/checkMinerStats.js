require('dotenv').config();
const { ethers } = require('ethers');

// Contract ABI for getPlayerMiners
const MINER_LOGIC_ABI = [
  "function getPlayerMiners(address _player) external view returns (uint256[] minerIds, uint8[] minerTypes, uint8[] rarities, uint8[] lives, uint8[] shields, uint64[] lastMaintenance, uint64[] lastReward, uint64[] gracePeriodEnd, uint256[] pendingRewards, uint256[] maintenanceCosts)"
];

async function checkMinerStats(playerAddress, chain = 'abstract') {
  try {
    // Validate address
    if (!ethers.isAddress(playerAddress)) {
      console.error('Error: Invalid Ethereum address provided');
      process.exit(1);
    }
    
    // Setup based on chain
    const isBase = chain === 'base';
    const rpcUrl = isBase ? process.env.RPC_URL_BASE : process.env.RPC_URL_ABS;
    const minerContract = isBase ? process.env.MINER_CONTRACT_BASE : process.env.MINER_CONTRACT_ABS;
    const networkName = isBase ? 'Base' : 'Abstract Chain';
    const chainId = isBase ? '8453' : '2741';
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const minerLogic = new ethers.Contract(minerContract, MINER_LOGIC_ABI, provider);
    
    console.log('=== Verdant Miner Stats Checker ===\n');
    console.log(`Checking Address: ${playerAddress}`);
    console.log(`MinerLogic Contract: ${minerContract}`);
    console.log(`Network: ${networkName} (${chainId})\n`);
    
    // Get miner data
    console.log('Fetching miner data...\n');
    const minerData = await minerLogic.getPlayerMiners(playerAddress);
    const [minerIds, minerTypes, rarities, lives, shields, lastMaintenance, lastReward, gracePeriodEnd, pendingRewards, maintenanceCosts] = minerData;
    
    console.log(`Total Miners Found: ${minerIds.length}\n`);
    
    if (minerIds.length === 0) {
      console.log('No miners found for this address.');
      return;
    }
    
    // Display each miner's details
    let totalPendingRewards = 0n;
    let activeMinersCount = 0;
    
    for (let i = 0; i < minerIds.length; i++) {
      console.log(`--- Miner #${i + 1} ---`);
      console.log(`ID: ${minerIds[i]}`);
      console.log(`Type: ${minerTypes[i]} (Rarity: ${rarities[i]})`);
      console.log(`Lives: ${lives[i]}`);
      console.log(`Shields: ${shields[i]}`);
      console.log(`Active: ${lives[i] > 0 && shields[i] > 0 ? 'Yes' : 'No'}`);
      console.log(`Last Maintenance: ${new Date(Number(lastMaintenance[i]) * 1000).toLocaleString()}`);
      console.log(`Last Reward Claim: ${new Date(Number(lastReward[i]) * 1000).toLocaleString()}`);
      console.log(`Pending Rewards: ${ethers.formatEther(pendingRewards[i])} VERDITE`);
      console.log(`Maintenance Cost: ${ethers.formatEther(maintenanceCosts[i])} BLOOM`);
      console.log('');
      
      if (lives[i] > 0 && shields[i] > 0) {
        activeMinersCount++;
        totalPendingRewards += pendingRewards[i];
      }
    }
    
    console.log('=== Summary ===');
    console.log(`Active Miners: ${activeMinersCount}/${minerIds.length}`);
    console.log(`Total Pending Rewards: ${ethers.formatEther(totalPendingRewards)} VERDITE`);
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.code === 'CALL_EXCEPTION') {
      console.error('\nThis might mean:');
      console.error('- The contract address is incorrect');
      console.error('- The contract doesn\'t have getPlayerMiners function');
      console.error('- You\'re on the wrong network');
    }
  }
}

// Get address from command line argument
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node checkMinerStats.js <address> [chain]');
  console.log('Example: node checkMinerStats.js 0x1234567890123456789012345678901234567890 base');
  console.log('Chain options: abstract (default), base');
  process.exit(1);
}

const playerAddress = args[0];
const chain = args[1] || 'abstract';

if (!['abstract', 'base'].includes(chain)) {
  console.error('Error: Invalid chain. Use "abstract" or "base"');
  process.exit(1);
}

// Run if called directly
if (require.main === module) {
  checkMinerStats(playerAddress, chain);
}

module.exports = { checkMinerStats };