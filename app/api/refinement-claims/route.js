import { ethers } from 'ethers';

// claimRefinement function signature for filtering transactions
const CLAIM_REFINEMENT_SIGNATURE = '0x79bdb19a'; // First 4 bytes of keccak256("claimRefinement(uint256)")

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

    // Process transactions to find refinement claims
    let totalVerdantClaimed = 0;
    let totalVerditeRefined = 0;
    const claims = [];

    for (const transfer of data.result.transfers) {
      const txTimestamp = new Date(transfer.metadata.blockTimestamp).getTime() / 1000;

      // Skip if older than 14 days
      if (txTimestamp < fourteenDaysAgo) continue;

      try {
        // Get transaction details to check if it's a claimRefinement call
        const tx = await provider.getTransaction(transfer.hash);
        if (!tx || !tx.data) continue;

        // Check if transaction data starts with claimRefinement function signature
        if (tx.data.toLowerCase().startsWith(CLAIM_REFINEMENT_SIGNATURE.toLowerCase())) {
          // Get transaction receipt to find RefinementCollected event
          const receipt = await provider.getTransactionReceipt(transfer.hash);
          if (!receipt) continue;

          // Look for RefinementCollected event in logs
          const refinementCollectedTopic = '0xa2d771c2d4b15215eb766bc2c8baaeb7d636af874d2e1f1296e418f75f0e58c8'; // keccak256("RefinementCollected(address,uint256,uint256)")

          for (const log of receipt.logs) {
            if (log.topics[0] === refinementCollectedTopic &&
                log.topics[1] === ethers.zeroPadValue(address.toLowerCase(), 32)) {

              // Decode the event data
              const verdantAmount = ethers.getBigInt(log.data.slice(0, 66));
              const verditeAmount = ethers.getBigInt('0x' + log.data.slice(66, 130));

              const verdantAmountFormatted = parseFloat(ethers.formatEther(verdantAmount));
              const verditeAmountFormatted = parseFloat(ethers.formatEther(verditeAmount));

              totalVerdantClaimed += verdantAmountFormatted;
              totalVerditeRefined += verditeAmountFormatted;

              claims.push({
                transactionHash: transfer.hash,
                blockNumber: parseInt(transfer.blockNum, 16),
                timestamp: new Date(txTimestamp * 1000).toISOString(),
                verdantAmount: verdantAmountFormatted.toFixed(2),
                verditeAmount: verditeAmountFormatted.toFixed(2),
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

    // Sort claims by timestamp (most recent first)
    claims.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return Response.json({
      totalClaims: claims.length,
      totalVerdantClaimed: totalVerdantClaimed.toFixed(2),
      totalVerditeRefined: totalVerditeRefined.toFixed(2),
      claims
    });

  } catch (error) {
    console.error('Refinement claims error:', error);
    return Response.json({
      error: error.message || 'Failed to fetch refinement claim history'
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