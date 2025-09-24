import { ethers } from 'ethers';

// purchaseBloom function signature for filtering transactions
const PURCHASE_BLOOM_SIGNATURE = '0xb947e924'; // First 4 bytes of keccak256("purchaseBloom(uint256,address)")

export async function POST(req) {
  try {
    const { address, chain } = await req.json();

    // Validate address
    if (!ethers.isAddress(address)) {
      return Response.json({ error: 'Invalid Ethereum address' }, { status: 400 });
    }

    // Setup based on chain
    const isBase = chain === 'base';
    if (!isBase) {
      return Response.json({ error: 'Only Base chain is supported' }, { status: 400 });
    }

    const alchemyApiKey = process.env.ALCHEMY_API_KEY_BASE;
    const minerContractAddress = process.env.MINER_CONTRACT_BASE;

    // Calculate timestamp for 14 days ago
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const fourteenDaysAgo = currentTimestamp - (14 * 24 * 60 * 60);

    // Use Alchemy's getAssetTransfers API to get transaction history
    const alchemyUrl = `https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;

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

    const provider = new ethers.JsonRpcProvider(`https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`);

    // Process transactions to find bloom purchases
    let totalVerdantSpent = 0;
    let totalBloomReceived = 0;
    const purchases = [];

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
          const purchaseBloomTopic = '0xe23a5f8390716f10c4e92f3d40fb979c90bae202d8c4a2734ac0be6904d3fb1a'; // keccak256("PurchasedBloom(address,uint256,uint256)")

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

    return Response.json({
      totalPurchases: purchases.length,
      totalVerdantSpent: totalVerdantSpent.toFixed(2),
      totalBloomReceived: totalBloomReceived.toFixed(2),
      purchases
    });

  } catch (error) {
    console.error('Bloom history error:', error);
    return Response.json({
      error: error.message || 'Failed to fetch bloom purchase history'
    }, { status: 500 });
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