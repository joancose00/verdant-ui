require('dotenv').config();
const { Network, Alchemy } = require('alchemy-sdk');

// Configuration
const config = {
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
};

const alchemy = new Alchemy(config);

async function fetchLPTransactions() {
  const lpAddress = process.env.BASE_LP_ADDRESS;
  
  try {
    console.log(`Fetching SELL transactions for LP: ${lpAddress}`);
    console.log('Looking for transfers where tokens go TO the LP (sells)\n');
    
    // Get the latest block number
    const latestBlock = await alchemy.core.getBlockNumber();
    console.log(`Latest block: ${latestBlock}`);
    
    // For sells: tokens go TO the LP
    const tokenTransfersToLP = await alchemy.core.getAssetTransfers({
      toAddress: lpAddress,
      category: ["erc20"],
      withMetadata: true,
      maxCount: 100,  // Get more to have enough after filtering
      order: "desc",
    });
    
    // Group transfers by transaction hash to find sells
    const transfersByTx = {};
    tokenTransfersToLP.transfers.forEach(transfer => {
      if (!transfersByTx[transfer.hash]) {
        transfersByTx[transfer.hash] = [];
      }
      transfersByTx[transfer.hash].push(transfer);
    });
    
    // Also get ETH/WETH transfers FROM the LP to match with token transfers
    const ethTransfersFromLP = await alchemy.core.getAssetTransfers({
      fromAddress: lpAddress,
      category: ["external", "erc20"],
      withMetadata: true,
      maxCount: 100,
      order: "desc",
    });
    
    // Add these to our transaction groups
    ethTransfersFromLP.transfers.forEach(transfer => {
      if (transfersByTx[transfer.hash]) {
        transfersByTx[transfer.hash].push(transfer);
      }
    });
    
    // Filter for sell transactions (token IN, ETH/WETH OUT)
    const sellTransactions = [];
    Object.entries(transfersByTx).forEach(([hash, transfers]) => {
      const tokenIn = transfers.find(t => t.to === lpAddress.toLowerCase() && t.category === 'erc20');
      const ethOut = transfers.find(t => t.from === lpAddress.toLowerCase());
      
      if (tokenIn && ethOut) {
        sellTransactions.push({
          hash,
          tokenIn,
          ethOut,
          blockNum: parseInt(tokenIn.blockNum, 16),
          timestamp: tokenIn.metadata?.blockTimestamp
        });
      }
    });
    
    // Sort by block number (most recent first)
    sellTransactions.sort((a, b) => b.blockNum - a.blockNum);
    
    console.log(`\nFound ${sellTransactions.length} sell transactions:`);
    sellTransactions.slice(0, 20).forEach((tx, index) => {
      const blocksAgo = latestBlock - tx.blockNum;
      
      console.log(`\n${index + 1}. SELL Transaction`);
      console.log(`   Hash: ${tx.hash}`);
      console.log(`   Block: ${tx.blockNum} (${blocksAgo} blocks ago)`);
      console.log(`   Seller: ${tx.tokenIn.from}`);
      console.log(`   Token Sold: ${tx.tokenIn.value} ${tx.tokenIn.asset}`);
      console.log(`   ETH Received: ${tx.ethOut.value} ${tx.ethOut.asset || 'ETH'}`);
      if (tx.tokenIn.rawContract?.address) {
        console.log(`   Token Contract: ${tx.tokenIn.rawContract.address}`);
      }
      if (tx.timestamp) {
        const time = new Date(tx.timestamp);
        console.log(`   Time: ${time.toISOString()}`);
      }
    });
    
  } catch (error) {
    console.error('Error fetching transactions:', error);
  }
}

// Run the function
fetchLPTransactions();