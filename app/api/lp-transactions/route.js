import { NextResponse } from 'next/server';
import sql from '../../../lib/database/connection.js';
import { getLPTransactions, saveLPTransactions, getLPScanProgress, updateLPScanProgress, clearLPTransactionData, getNextBlockRange } from '../../../lib/database/operations.js';

// Cache for traced addresses to avoid redundant API calls
const tracedAddresses = new Map();

// Recursive function to trace wallet funding back through transfers
async function traceFunding(address, chain, alchemyUrl, depth = 0, maxDepth = 10, visited = new Set()) {
  // Get environment variables
  const refinementAddress = chain === 'abstract' ? process.env.REFINEMENT_ADDRESS_ABS : process.env.REFINEMENT_ADDRESS_BASE;
  const tokenAddress = chain === 'abstract' ? process.env.TOKEN_ADDRESS_ABS : process.env.TOKEN_ADDRESS_BASE;
  const stakingAddress = process.env.STAKING_ADDRESS_BASE; // Currently only on Base
  const lpAddress = chain === 'abstract' ? process.env.ABS_LP_ADDRESS : process.env.BASE_LP_ADDRESS;
  // Prevent infinite loops and limit depth
  if (depth > maxDepth || visited.has(address.toLowerCase())) {
    return { isLinkedToMiner: false, traceDepth: depth };
  }
  
  visited.add(address.toLowerCase());
  
  // Check cache first
  const cacheKey = `${chain}:${address.toLowerCase()}:${depth}`;
  if (tracedAddresses.has(cacheKey)) {
    return tracedAddresses.get(cacheKey);
  }
  
  try {
    // Check if this address is directly a miner
    const minerCheck = await sql`
      SELECT address FROM miner_addresses
      WHERE LOWER(address) = ${address.toLowerCase()}
      AND chain = ${chain}
      LIMIT 1
    `;
    
    if (minerCheck.length > 0) {
      const result = { isLinkedToMiner: true, traceDepth: depth, minerAddress: address };
      tracedAddresses.set(cacheKey, result);
      return result;
    }
    
    // Get ALL incoming VDNT transfers to this address with pagination
    let allVdntTransfers = [];
    let pageKey = null;
    let pageCount = 0;
    const maxPages = 3; // Limit pages for performance in main API
    
    while (pageCount < maxPages) {
      const params = {
        toAddress: address,
        category: ['erc20'],
        contractAddresses: [tokenAddress.toLowerCase()],
        withMetadata: false,
        maxCount: '0x3e8', // 1000 in hex
        order: 'desc'
      };
      
      if (pageKey) {
        params.pageKey = pageKey;
      }
      
      const transfersResponse = await fetch(alchemyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'alchemy_getAssetTransfers',
          params: [params],
          id: 100 + depth + pageCount
        })
      });
      
      const transfersData = await transfersResponse.json();
      
      if (transfersData.error || !transfersData.result?.transfers) {
        break;
      }
      
      allVdntTransfers = allVdntTransfers.concat(transfersData.result.transfers);
      pageKey = transfersData.result.pageKey;
      
      if (!pageKey || transfersData.result.transfers.length === 0) {
        break; // No more pages
      }
      
      pageCount++;
    }
    
    if (allVdntTransfers.length === 0) {
      const result = { isLinkedToMiner: false, traceDepth: depth };
      tracedAddresses.set(cacheKey, result);
      return result;
    }
    
    // Filter transfers to only include direct wallet-to-wallet transfers
    const validTransfers = allVdntTransfers.filter(t => {
      // Exclude transfers from refinement address (game rewards)
      if (t.from && refinementAddress && t.from.toLowerCase() === refinementAddress.toLowerCase()) {
        return false;
      }
      // Exclude transfers from staking address
      if (t.from && stakingAddress && t.from.toLowerCase() === stakingAddress.toLowerCase()) {
        return false;
      }
      // Exclude transfers from zero address (minting)
      if (t.from && t.from.toLowerCase() === '0x0000000000000000000000000000000000000000') {
        return false;
      }
      // Exclude transfers from LP address (trades)
      if (t.from && lpAddress && t.from.toLowerCase() === lpAddress.toLowerCase()) {
        return false;
      }
      
      // List of known aggregator/router addresses to exclude (can be expanded)
      const knownAggregators = [
        '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad', // Uniswap Universal Router
        '0x1111111254eeb25477b68fb85ed929f73a960582', // 1inch v5
        '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // 0x Exchange Proxy
        '0x6e4141d33021b52c91c28608403db4a0ffb50ec6', // Additional aggregator
        '0x9cd09ec4d9d598e699c805c1b07a54fd25c1b5e2', // Additional aggregator/router
        '0x00000000009726632680fb29d3f7a9734e3010e2', // Additional aggregator/router
        '0x6160006c4aa63ad1cb8cc075d99127f9d8948bb5', // Additional aggregator/router
      ].map(a => a.toLowerCase());
      
      if (t.from && knownAggregators.includes(t.from.toLowerCase())) {
        return false;
      }
      
      return true; // Include all other VDNT transfers
    });
    
    // Recursively check the senders of valid transfers
    for (const transfer of validTransfers.slice(0, 5)) { // Limit to top 5 to reduce API calls
      if (transfer.from && transfer.from !== address) {
        const traceResult = await traceFunding(transfer.from, chain, alchemyUrl, depth + 1, maxDepth, visited);
        if (traceResult.isLinkedToMiner) {
          const result = { 
            isLinkedToMiner: true, 
            traceDepth: depth,
            minerAddress: traceResult.minerAddress,
            tracePath: traceResult.tracePath ? [address, ...traceResult.tracePath] : [address, traceResult.minerAddress]
          };
          tracedAddresses.set(cacheKey, result);
          return result;
        }
      }
    }
    
    const result = { isLinkedToMiner: false, traceDepth: depth };
    tracedAddresses.set(cacheKey, result);
    return result;
    
  } catch (error) {
    console.error(`Error tracing funding for ${address}:`, error);
    const result = { isLinkedToMiner: false, traceDepth: depth };
    tracedAddresses.set(cacheKey, result);
    return result;
  }
}

async function fetchAllTransfers(alchemyUrl, params, maxResults = 10000, startBlock = null, endBlock = null) {
  const allTransfers = [];
  let pageKey = null;
  let page = 0;
  
  while (allTransfers.length < maxResults && page < 100) { // Increased to 100 pages for large ranges
    const requestParams = {
      ...params,
      maxCount: '0x64', // 100 results per page
    };
    
    // Add block range filtering if provided
    if (startBlock !== null && startBlock > 0) {
      requestParams.fromBlock = '0x' + Math.floor(startBlock).toString(16);
    }
    if (endBlock !== null && endBlock > 0) {
      requestParams.toBlock = '0x' + Math.floor(endBlock).toString(16);
    }
    
    // Debug block range conversion
    if (page === 0 && (startBlock !== null || endBlock !== null)) {
      console.log(`🔢 Block range conversion: ${startBlock} (0x${Math.floor(startBlock || 0).toString(16)}) -> ${endBlock} (0x${Math.floor(endBlock || 0).toString(16)})`);
    }
    
    if (pageKey) {
      requestParams.pageKey = pageKey;
    }
    
    const response = await fetch(alchemyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'alchemy_getAssetTransfers',
        params: [requestParams],
        id: 100 + page
      })
    });
    
    const data = await response.json();
    if (data.error) {
      console.error('Alchemy API error:', data.error);
      break;
    }
    
    if (!data.result?.transfers || data.result.transfers.length === 0) {
      break;
    }
    
    allTransfers.push(...data.result.transfers);
    pageKey = data.result.pageKey;
    page++;
    
    if (!pageKey) {
      break; // No more pages
    }
    
    // Add small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`📄 Fetched ${allTransfers.length} transfers in ${page} pages`);
  return allTransfers;
}

async function fetchAndStoreNewTransactions(chain, alchemyUrl, lpAddress, startBlock, endBlock) {
  try {
    if (startBlock >= endBlock) {
      console.log(`⚠️ Invalid block range: start=${startBlock} >= end=${endBlock}, skipping`);
      await updateLPScanProgress(chain, endBlock, 0);
      return;
    }
    
    console.log(`🔍 Fetching LP transactions for ${chain} from block ${startBlock} to ${endBlock} (range: ${(endBlock - startBlock).toLocaleString()} blocks)`);
    
    // Get all asset transfers TO the LP (tokens being sold)
    console.log('📥 Fetching transfers TO LP...');
    const transfersTo = await fetchAllTransfers(alchemyUrl, {
      toAddress: lpAddress,
      category: ['erc20'],
      withMetadata: true,
      order: 'desc',
      excludeZeroValue: false
    }, 10000, startBlock, endBlock);

    // Get all asset transfers FROM the LP (ETH/WETH being sent out)
    console.log('📤 Fetching transfers FROM LP...');
    const transfersFrom = await fetchAllTransfers(alchemyUrl, {
      fromAddress: lpAddress,
      category: ['external', 'erc20'],
      withMetadata: true,
      order: 'desc'
    }, 10000, startBlock, endBlock);

    // Group transfers by transaction hash
    const transfersByTx = {};
    
    console.log(`🔗 Grouping ${transfersTo.length} incoming and ${transfersFrom.length} outgoing transfers...`);
    
    transfersTo.forEach(transfer => {
      if (!transfersByTx[transfer.hash]) {
        transfersByTx[transfer.hash] = [];
      }
      transfersByTx[transfer.hash].push({ ...transfer, direction: 'in' });
    });
    
    transfersFrom.forEach(transfer => {
      if (!transfersByTx[transfer.hash]) {
        transfersByTx[transfer.hash] = [];
      }
      transfersByTx[transfer.hash].push({ ...transfer, direction: 'out' });
    });

    // Process transactions and identify sell transactions
    const allTransactionHashes = Object.keys(transfersByTx);
    console.log(`🔍 Processing ${allTransactionHashes.length} unique transactions for sell identification...`);
    
    const sellTransactions = [];
    let processedCount = 0;
    
    for (const [hash, transfers] of Object.entries(transfersByTx)) {
      processedCount++;
      if (processedCount % 50 === 0) {
        console.log(`⏳ Processed ${processedCount}/${allTransactionHashes.length} transactions...`);
      }
      // Find all VDNT transfers TO the LP
      const vdntTransfersToLP = transfers.filter(t => 
        t.direction === 'in' && 
        t.to?.toLowerCase() === lpAddress.toLowerCase() && 
        t.category === 'erc20' &&
        t.asset === 'VDNT'
      );
      
      // Find all ETH/WETH transfers FROM the LP
      const ethTransfersFromLP = transfers.filter(t => 
        t.direction === 'out' && 
        t.from?.toLowerCase() === lpAddress.toLowerCase() &&
        (t.category === 'external' || (t.category === 'erc20' && (t.asset === 'WETH' || t.asset === 'ETH' || t.asset === 'VIRTUAL')))
      );
      
      if (vdntTransfersToLP.length > 0 && ethTransfersFromLP.length > 0) {
        // Filter by block range
        const blockNum = parseInt(vdntTransfersToLP[0].blockNum, 16);
        if (blockNum < startBlock || blockNum > endBlock) {
          continue; // Skip transactions outside our target range
        }
        
        // Sum up all VDNT sent to LP
        const totalVdntIn = vdntTransfersToLP.reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
        
        // Sum up all ETH/WETH sent from LP
        const totalEthOut = ethTransfersFromLP.reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
        
        // Get the actual transaction sender by fetching transaction details
        let seller = null;
        try {
          const txResponse = await fetch(alchemyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_getTransactionByHash',
              params: [hash],
              id: 99
            })
          });
          
          const txData = await txResponse.json();
          if (txData.result && txData.result.from) {
            seller = txData.result.from;
          }
        } catch (error) {
          console.error('Error fetching transaction details:', error);
        }
        
        // Fallback if we couldn't get the transaction sender
        if (!seller) {
          seller = vdntTransfersToLP[0].from;
        }
        
        sellTransactions.push({
          hash,
          seller,
          tokenSold: {
            amount: totalVdntIn.toString(),
            symbol: 'VDNT',
            contract: vdntTransfersToLP[0].rawContract?.address
          },
          ethReceived: {
            amount: totalEthOut.toString(),
            symbol: chain === 'abstract' ? 'ETH' : 'VIRTUAL'
          },
          blockNum,
          timestamp: vdntTransfersToLP[0].metadata?.blockTimestamp,
          blocksAgo: 0, // Will be calculated later
          transferCount: transfers.length
        });
      }
    }

    if (sellTransactions.length === 0) {
      console.log(`📭 No new sell transactions found for ${chain}`);
      await updateLPScanProgress(chain, endBlock, 0);
      return;
    }

    // Check which sellers are directly miners
    const sellerAddresses = [...new Set(sellTransactions.map(tx => tx.seller.toLowerCase()))];
    let directMinerAddresses = new Set();
    
    if (sellerAddresses.length > 0) {
      try {
        const miners = await sql`
          SELECT DISTINCT LOWER(address) as address
          FROM miner_addresses
          WHERE LOWER(address) = ANY(${sellerAddresses})
          AND chain = ${chain}
        `;
        directMinerAddresses = new Set(miners.map(m => m.address));
      } catch (error) {
        console.error('Error checking miner addresses:', error);
      }
    }

    // Process in batches to avoid timeouts
    const BATCH_SIZE = 20; // Process 20 transactions at a time
    const transactionsWithMinerInfo = [];
    
    console.log(`🧩 Processing ${sellTransactions.length} sell transactions in batches of ${BATCH_SIZE}...`);
    
    for (let i = 0; i < sellTransactions.length; i += BATCH_SIZE) {
      const batch = sellTransactions.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(sellTransactions.length / BATCH_SIZE);
      
      console.log(`🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} transactions)...`);
      
      // Process batch
      for (const tx of batch) {
        const isDirect = directMinerAddresses.has(tx.seller.toLowerCase());
        let traceResult = null;
        
        if (!isDirect) {
          // Only trace if not a direct miner
          traceResult = await traceFunding(tx.seller, chain, alchemyUrl, 0, 10); // Full depth of 10
        }
        
        transactionsWithMinerInfo.push({
          ...tx,
          isMiner: isDirect,
          isIndirectMiner: traceResult?.isLinkedToMiner || false,
          traceDepth: traceResult?.traceDepth || 0,
          minerConnection: isDirect ? tx.seller : (traceResult?.minerAddress || null),
          tracePath: traceResult?.tracePath || null
        });
      }
      
      // Save batch to database to avoid losing progress
      if (transactionsWithMinerInfo.length >= BATCH_SIZE) {
        const currentBatch = transactionsWithMinerInfo.slice(-batch.length);
        await saveLPTransactions(currentBatch, chain);
        console.log(`💾 Saved batch ${batchNumber} (${currentBatch.length} transactions) to database`);
      }
      
      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < sellTransactions.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Save any remaining transactions (in case last batch wasn't full)
    const remainingTransactions = transactionsWithMinerInfo.slice(-(sellTransactions.length % BATCH_SIZE));
    if (remainingTransactions.length > 0) {
      await saveLPTransactions(remainingTransactions, chain);
      console.log(`💾 Saved final batch (${remainingTransactions.length} transactions) to database`);
    }
    
    // Update scan progress
    await updateLPScanProgress(chain, endBlock, transactionsWithMinerInfo.length);
    
    console.log(`✅ Successfully processed ${transactionsWithMinerInfo.length} new LP transactions for ${chain} (blocks ${startBlock}-${endBlock})`);
    
  } catch (error) {
    console.error('Error fetching and storing new transactions:', error);
    throw error;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const chain = searchParams.get('chain') || 'base';
  const loadMore = searchParams.get('loadMore') === 'true';
  const processNextRange = searchParams.get('processNextRange') === 'true';
  const clearData = searchParams.get('clearData') === 'true';
  const offset = parseInt(searchParams.get('offset') || '0');
  
  const lpAddress = chain === 'abstract' ? process.env.ABS_LP_ADDRESS : process.env.BASE_LP_ADDRESS;
  const apiKey = chain === 'abstract' ? process.env.ALCHEMY_API_KEY_ABS : process.env.ALCHEMY_API_KEY_BASE;
  const alchemyUrl = chain === 'abstract' 
    ? `https://abstract-mainnet.g.alchemy.com/v2/${apiKey}`
    : `https://base-mainnet.g.alchemy.com/v2/${apiKey}`;
  
  try {
    // Get current latest block number
    const blockResponse = await fetch(alchemyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      })
    });
    
    const blockData = await blockResponse.json();
    if (blockData.error) {
      throw new Error(blockData.error.message);
    }
    const latestBlock = parseInt(blockData.result, 16);
    
    // Clear data if requested (fresh start)
    if (clearData) {
      await clearLPTransactionData(chain);
      console.log(`🆕 Starting fresh scan for ${chain} from block 0`);
    }
    
    // Get scan progress
    const scanProgress = await getLPScanProgress(chain);
    const isFirstRun = scanProgress.last_scanned_block === 0;
    
    // Process next range if requested OR if it's first run
    if (processNextRange || isFirstRun) {
      const blockRange = await getNextBlockRange(chain);
      
      // Don't process beyond current blockchain height
      const actualEndBlock = Math.min(blockRange.endBlock, latestBlock);
      
      if (blockRange.startBlock < latestBlock) {
        // Ensure we don't process beyond the current chain height
        const safeEndBlock = Math.min(actualEndBlock, latestBlock);
        console.log(`🚀 Processing block range ${blockRange.startBlock} to ${safeEndBlock} for ${chain}`);
        console.log(`📊 Block numbers: start=${blockRange.startBlock}, end=${safeEndBlock}, latest=${latestBlock}`);
        await fetchAndStoreNewTransactions(chain, alchemyUrl, lpAddress, blockRange.startBlock, safeEndBlock);
      } else {
        console.log(`✅ ${chain} is up to date (block ${blockRange.startBlock} >= ${latestBlock})`);
      }
    }
    
    // Get transactions from database
    const dbTransactions = await getLPTransactions(chain, 50, offset);
    const updatedScanProgress = await getLPScanProgress(chain);
    
    // Calculate blocks ago for each transaction
    const transactionsWithBlocksAgo = dbTransactions.map(tx => ({
      ...tx,
      blocksAgo: latestBlock - tx.blockNum
    }));
    
    // Calculate next range info
    const nextRange = await getNextBlockRange(chain);
    const canProcessMore = nextRange.startBlock < latestBlock;
    
    return NextResponse.json({
      chain,
      lpAddress,
      latestBlock,
      transactions: transactionsWithBlocksAgo,
      totalFound: transactionsWithBlocksAgo.length,
      hasMore: transactionsWithBlocksAgo.length === 50,
      scanProgress: {
        lastScannedBlock: updatedScanProgress.last_scanned_block,
        totalTransactions: updatedScanProgress.total_transactions,
        nextRangeStart: nextRange.startBlock,
        nextRangeEnd: Math.min(nextRange.endBlock, latestBlock),
        canProcessMore
      }
    });
    
  } catch (error) {
    console.error('Error fetching LP transactions:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch transactions',
      details: error.message 
    }, { status: 500 });
  }
}