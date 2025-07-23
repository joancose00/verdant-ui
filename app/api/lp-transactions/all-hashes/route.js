import { NextResponse } from 'next/server';
import sql from '../../../../lib/database/connection.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const chain = searchParams.get('chain') || 'base';
  
  try {
    // Get all transaction hashes for the chain
    const transactions = await sql`
      SELECT tx_hash, seller_address, block_number
      FROM lp_sell_transactions
      WHERE chain = ${chain}
      ORDER BY block_number DESC
    `;
    
    return NextResponse.json({
      chain,
      totalTransactions: transactions.length,
      transactions: transactions.map(tx => ({
        hash: tx.tx_hash,
        seller: tx.seller_address,
        blockNumber: tx.block_number
      }))
    });
    
  } catch (error) {
    console.error('Error fetching all transaction hashes:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch transaction hashes',
      details: error.message 
    }, { status: 500 });
  }
}