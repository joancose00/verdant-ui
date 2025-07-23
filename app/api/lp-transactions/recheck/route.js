import { NextResponse } from 'next/server';
import sql from '../../../../lib/database/connection.js';

// Enhanced tracing function with detailed logging
async function traceFundingWithLogs(address, chain, alchemyUrl, depth = 0, maxDepth = 10, visited = new Set(), logs = []) {
  // Get environment variables
  const refinementAddress = chain === 'abstract' ? process.env.REFINEMENT_ADDRESS_ABS : process.env.REFINEMENT_ADDRESS_BASE;
  const tokenAddress = chain === 'abstract' ? process.env.TOKEN_ADDRESS_ABS : process.env.TOKEN_ADDRESS_BASE;
  const stakingAddress = process.env.STAKING_ADDRESS_BASE; // Currently only on Base
  const lpAddress = chain === 'abstract' ? process.env.ABS_LP_ADDRESS : process.env.BASE_LP_ADDRESS;
  
  if (!tokenAddress) {
    logs.push(`[Depth ${depth}] ERROR: Token address not found in environment for ${chain}`);
    return { isLinkedToMiner: false, traceDepth: depth, logs };
  }
  
  logs.push(`[Depth ${depth}] Chain: ${chain}, Token: ${tokenAddress}, Refinement: ${refinementAddress}`);
  // Prevent infinite loops and limit depth
  if (depth > maxDepth || visited.has(address.toLowerCase())) {
    logs.push(`[Depth ${depth}] Skipping ${address} - ${depth > maxDepth ? 'max depth reached' : 'already visited'}`);
    return { isLinkedToMiner: false, traceDepth: depth, logs };
  }
  
  visited.add(address.toLowerCase());
  logs.push(`[Depth ${depth}] Checking address: ${address}`);
  
  try {
    // Check if this address is directly a miner
    const minerCheck = await sql`
      SELECT address FROM miner_addresses
      WHERE LOWER(address) = ${address.toLowerCase()}
      AND chain = ${chain}
      LIMIT 1
    `;
    
    if (minerCheck.length > 0) {
      logs.push(`[Depth ${depth}] ✅ FOUND MINER: ${address} is a direct miner!`);
      return { 
        isLinkedToMiner: true, 
        traceDepth: depth, 
        minerAddress: address,
        tracePath: [address],
        logs 
      };
    }
    
    logs.push(`[Depth ${depth}] Not a direct miner, fetching incoming VDNT transfers...`);
    logs.push(`[Depth ${depth}] Using token address: ${tokenAddress}`);
    
    // Get ALL incoming VDNT transfers to this address with pagination
    let allVdntTransfers = [];
    let pageKey = null;
    let pageCount = 0;
    const maxPages = 5; // Check up to 5 pages of results
    
    while (pageCount < maxPages) {
      logs.push(`[Depth ${depth}] Fetching page ${pageCount + 1} of VDNT transfers...`);
      
      const params = {
        toAddress: address,
        category: ['erc20'],
        contractAddresses: [tokenAddress.toLowerCase()],
        withMetadata: true,
        maxCount: '0x3e8', // 1000 in hex
        order: 'desc',
        excludeZeroValue: false
      };
      
      if (pageKey) {
        params.pageKey = pageKey;
        logs.push(`[Depth ${depth}] Using pageKey: ${pageKey.substring(0, 20)}...`);
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
      
      if (transfersData.error) {
        logs.push(`[Depth ${depth}] Error on page ${pageCount + 1}: ${transfersData.error?.message || 'Unknown error'}`);
        break;
      }
      
      if (transfersData.result?.transfers) {
        const pageTransfers = transfersData.result.transfers.length;
        logs.push(`[Depth ${depth}] Page ${pageCount + 1}: Found ${pageTransfers} VDNT transfers`);
        allVdntTransfers = allVdntTransfers.concat(transfersData.result.transfers);
        pageKey = transfersData.result.pageKey;
        
        if (!pageKey || pageTransfers === 0) {
          logs.push(`[Depth ${depth}] No more pages - ${!pageKey ? 'no pageKey' : 'no transfers'}`);
          break;
        }
      } else {
        logs.push(`[Depth ${depth}] No transfer data in response for page ${pageCount + 1}`);
        break;
      }
      
      pageCount++;
    }
    
    logs.push(`[Depth ${depth}] Total pages searched: ${pageCount} (up to ${maxPages} max)`);
    
    logs.push(`[Depth ${depth}] Found ${allVdntTransfers.length} VDNT transfers`);
    
    // If no VDNT transfers found, debug by checking all transfers
    if (allVdntTransfers.length === 0) {
      logs.push(`[Depth ${depth}] No VDNT transfers found. Debugging...`);
      
      // First, let's check if ANY transfers mention VDNT in any form
      logs.push(`[Depth ${depth}] Checking last 100 transfers for any VDNT-related activity...`);
      
      const allTransfersResponse = await fetch(alchemyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'alchemy_getAssetTransfers',
          params: [{
            toAddress: address,
            category: ['erc20'],
            withMetadata: true,
            maxCount: '0x64', // 100 transfers
            order: 'desc'
          }],
          id: 200 + depth
        })
      });
      
      const allTransfersData = await allTransfersResponse.json();
      if (allTransfersData.result?.transfers && allTransfersData.result.transfers.length > 0) {
        logs.push(`[Depth ${depth}] Found ${allTransfersData.result.transfers.length} total ERC20 transfers`);
        
        // Check if any transfers have VDNT in the asset name
        const vdntRelated = allTransfersData.result.transfers.filter(t => 
          t.asset && (t.asset.includes('VDNT') || t.asset.includes('Verdant'))
        );
        
        if (vdntRelated.length > 0) {
          logs.push(`[Depth ${depth}] Found ${vdntRelated.length} transfers with VDNT/Verdant in name:`);
          vdntRelated.forEach(t => {
            logs.push(`[Depth ${depth}] - From: ${t.from} | Value: ${t.value} ${t.asset} | Contract: ${t.rawContract?.address}`);
          });
        }
        
        // Show first 10 transfers for debugging
        logs.push(`[Depth ${depth}] First 10 transfers:`);
        allTransfersData.result.transfers.slice(0, 10).forEach((t, i) => {
          logs.push(`[Depth ${depth}] ${i+1}. From: ${t.from} | Value: ${t.value} ${t.asset} | Contract: ${t.rawContract?.address}`);
        });
        
        // Check if our token address appears anywhere
        const ourTokenTransfers = allTransfersData.result.transfers.filter(t => 
          t.rawContract?.address?.toLowerCase() === tokenAddress.toLowerCase()
        );
        logs.push(`[Depth ${depth}] Transfers matching our token address ${tokenAddress}: ${ourTokenTransfers.length}`);
        
        if (ourTokenTransfers.length > 0) {
          logs.push(`[Depth ${depth}] Our token transfers found but filtered out by exclusions`);
          ourTokenTransfers.slice(0, 3).forEach(t => {
            logs.push(`[Depth ${depth}] - From: ${t.from} (excluded because: checking...)`);
          });
        }
      } else {
        logs.push(`[Depth ${depth}] No ERC20 transfers found at all for this address`);
      }
    }
    
    // Filter transfers to only include direct wallet-to-wallet transfers
    const validTransfers = allVdntTransfers.filter(t => {
      // First log what we're checking
      if (allVdntTransfers.length <= 10) { // Only log details for small sets
        logs.push(`[Depth ${depth}] Checking transfer: from ${t.from?.substring(0, 10)}... value: ${t.value}`);
      }
      
      // Exclude transfers from refinement address (game rewards)
      if (t.from && refinementAddress && t.from.toLowerCase() === refinementAddress.toLowerCase()) {
        logs.push(`[Depth ${depth}] Skipping transfer from refinement address (game reward)`);
        return false;
      }
      // Exclude transfers from staking address
      if (t.from && stakingAddress && t.from.toLowerCase() === stakingAddress.toLowerCase()) {
        logs.push(`[Depth ${depth}] Skipping transfer from staking address`);
        return false;
      }
      // Exclude transfers from zero address (minting)
      if (t.from && t.from.toLowerCase() === '0x0000000000000000000000000000000000000000') {
        logs.push(`[Depth ${depth}] Skipping transfer from zero address (minting)`);
        return false;
      }
      // Exclude transfers from LP address (trades)
      if (t.from && lpAddress && t.from.toLowerCase() === lpAddress.toLowerCase()) {
        logs.push(`[Depth ${depth}] Skipping transfer from LP address (trade)`);
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
        logs.push(`[Depth ${depth}] Skipping transfer from known aggregator`);
        return false;
      }
      
      return true; // Include all other VDNT transfers
    });
    
    logs.push(`[Depth ${depth}] ${validTransfers.length} valid VDNT transfers (excluding refinement)`);
    
    // Recursively check the senders of valid transfers
    for (const transfer of validTransfers.slice(0, 5)) { // Limit to top 5 to reduce API calls
      if (transfer.from && transfer.from !== address) {
        logs.push(`[Depth ${depth}] Following VDNT transfer from ${transfer.from} (${transfer.value} VDNT)`);
        
        const traceResult = await traceFundingWithLogs(
          transfer.from, 
          chain, 
          alchemyUrl, 
          depth + 1, 
          maxDepth, 
          visited,
          logs
        );
        
        if (traceResult.isLinkedToMiner) {
          logs.push(`[Depth ${depth}] ✅ INDIRECT CONNECTION FOUND via ${transfer.from}`);
          return { 
            isLinkedToMiner: true, 
            traceDepth: depth,
            minerAddress: traceResult.minerAddress,
            tracePath: [address, ...(traceResult.tracePath || [traceResult.minerAddress])],
            logs
          };
        }
      }
    }
    
    logs.push(`[Depth ${depth}] No miner connections found for ${address}`);
    return { isLinkedToMiner: false, traceDepth: depth, logs };
    
  } catch (error) {
    logs.push(`[Depth ${depth}] Error tracing ${address}: ${error.message}`);
    return { isLinkedToMiner: false, traceDepth: depth, logs };
  }
}

export async function POST(request) {
  try {
    const { txHash, chain } = await request.json();
    
    if (!txHash || !chain) {
      return NextResponse.json({ 
        error: 'Missing required parameters: txHash and chain' 
      }, { status: 400 });
    }
    
    // Get transaction details from database
    const transaction = await sql`
      SELECT * FROM lp_sell_transactions
      WHERE tx_hash = ${txHash} AND chain = ${chain}
      LIMIT 1
    `;
    
    if (transaction.length === 0) {
      return NextResponse.json({ 
        error: 'Transaction not found' 
      }, { status: 404 });
    }
    
    const tx = transaction[0];
    const apiKey = chain === 'abstract' ? process.env.ALCHEMY_API_KEY_ABS : process.env.ALCHEMY_API_KEY_BASE;
    const alchemyUrl = chain === 'abstract' 
      ? `https://abstract-mainnet.g.alchemy.com/v2/${apiKey}`
      : `https://base-mainnet.g.alchemy.com/v2/${apiKey}`;
    
    console.log(`🔄 Rechecking miner status for tx ${txHash} (seller: ${tx.seller_address})`);
    
    // Log transaction details
    const logs = [];
    logs.push(`Transaction: ${txHash}`);
    logs.push(`Seller: ${tx.seller_address}`);
    logs.push(`VDNT Sold: ${tx.vdnt_amount}`);
    logs.push(`Block: ${tx.block_number}`);
    logs.push(`---`);
    
    // First check if directly a miner
    const directMinerCheck = await sql`
      SELECT address FROM miner_addresses
      WHERE LOWER(address) = ${tx.seller_address.toLowerCase()}
      AND chain = ${chain}
      LIMIT 1
    `;
    
    let result;
    
    if (directMinerCheck.length > 0) {
      logs.push(`✅ ${tx.seller_address} is a DIRECT miner`);
      result = {
        isMiner: true,
        isIndirectMiner: false,
        minerConnection: tx.seller_address,
        traceDepth: 0,
        tracePath: [tx.seller_address],
        logs
      };
    } else {
      // Perform deep trace with logging
      const traceResult = await traceFundingWithLogs(
        tx.seller_address, 
        chain, 
        alchemyUrl, 
        0, 
        10, // Max depth of 10
        new Set(),
        []
      );
      
      result = {
        isMiner: false,
        isIndirectMiner: traceResult.isLinkedToMiner,
        minerConnection: traceResult.minerAddress || null,
        traceDepth: traceResult.traceDepth || 0,
        tracePath: traceResult.tracePath || null,
        logs: traceResult.logs
      };
    }
    
    // Update database with new results
    await sql`
      UPDATE lp_sell_transactions
      SET 
        is_direct_miner = ${result.isMiner},
        is_indirect_miner = ${result.isIndirectMiner},
        miner_address = ${result.minerConnection},
        trace_depth = ${result.traceDepth},
        trace_path = ${result.tracePath ? JSON.stringify(result.tracePath) : null},
        updated_at = CURRENT_TIMESTAMP
      WHERE tx_hash = ${txHash} AND chain = ${chain}
    `;
    
    console.log(`✅ Recheck complete for ${txHash}:`, {
      isMiner: result.isMiner,
      isIndirectMiner: result.isIndirectMiner,
      minerConnection: result.minerConnection,
      traceDepth: result.traceDepth
    });
    
    return NextResponse.json({
      success: true,
      txHash,
      chain,
      minerStatus: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error rechecking transaction:', error);
    return NextResponse.json({ 
      error: 'Failed to recheck transaction',
      details: error.message 
    }, { status: 500 });
  }
}