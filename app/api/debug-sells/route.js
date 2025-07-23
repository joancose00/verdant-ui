import sql from '../../../lib/database/connection.js';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const chain = searchParams.get('chain') || 'base';
  
  try {
    // Get overall stats
    const stats = await sql`
      SELECT 
        COUNT(*) as total_count,
        COUNT(DISTINCT seller_address) as unique_sellers,
        COUNT(DISTINCT miner_address) as unique_miner_addresses,
        COUNT(*) FILTER (WHERE is_direct_miner = true) as direct_miners,
        COUNT(*) FILTER (WHERE is_indirect_miner = true) as indirect_miners,
        COUNT(*) FILTER (WHERE miner_address IS NOT NULL) as has_miner_address,
        SUM(vdnt_amount) as total_vdnt_sold
      FROM lp_sell_transactions
      WHERE chain = ${chain}
    `;
    
    // Get some sample transactions with miner connections
    const minerTxs = await sql`
      SELECT 
        seller_address, 
        is_direct_miner, 
        is_indirect_miner, 
        miner_address, 
        vdnt_amount,
        tx_hash
      FROM lp_sell_transactions
      WHERE chain = ${chain}
        AND (is_direct_miner = true OR is_indirect_miner = true)
      LIMIT 10
    `;
    
    // Get some miner owner addresses to compare
    const minerOwners = await sql`
      SELECT address, active_miners, total_miners
      FROM miner_addresses
      WHERE chain = ${chain} AND is_active = true
      LIMIT 10
    `;
    
    // Check if any miner owners have sell transactions (case-insensitive)
    const minerOwnersWithSells = await sql`
      SELECT DISTINCT ma.address, 
        COUNT(DISTINCT lst.tx_hash) as sell_count,
        SUM(lst.vdnt_amount) as total_sells
      FROM miner_addresses ma
      LEFT JOIN lp_sell_transactions lst ON 
        (LOWER(lst.seller_address) = LOWER(ma.address) OR LOWER(lst.miner_address) = LOWER(ma.address))
        AND lst.chain = ma.chain
      WHERE ma.chain = ${chain} 
        AND ma.is_active = true
      GROUP BY ma.address
      HAVING COUNT(DISTINCT lst.tx_hash) > 0
      LIMIT 10
    `;
    
    // Let's also check what addresses appear in both tables
    const minerOwnerSample = await sql`
      SELECT 
        'miner_owner' as source,
        LOWER(address) as address_lower,
        address as original_address
      FROM miner_addresses
      WHERE chain = ${chain}
      LIMIT 5
    `;
    
    const directMinerSample = await sql`
      SELECT 
        'direct_miner' as source,
        LOWER(seller_address) as address_lower,
        seller_address as original_address
      FROM lp_sell_transactions
      WHERE chain = ${chain} AND is_direct_miner = true
      LIMIT 5
    `;
    
    const indirectMinerSample = await sql`
      SELECT 
        'indirect_miner' as source,
        LOWER(miner_address) as address_lower,
        miner_address as original_address
      FROM lp_sell_transactions
      WHERE chain = ${chain} AND is_indirect_miner = true AND miner_address IS NOT NULL
      LIMIT 5
    `;
    
    const addressComparison = [...minerOwnerSample, ...directMinerSample, ...indirectMinerSample];
    
    // Check if there's ANY overlap between miner owners and sell addresses
    const overlapCheck = await sql`
      SELECT COUNT(*) as overlap_count
      FROM miner_addresses ma
      WHERE ma.chain = ${chain}
        AND EXISTS (
          SELECT 1 
          FROM lp_sell_transactions lst
          WHERE lst.chain = ma.chain
            AND (
              LOWER(lst.seller_address) = LOWER(ma.address) OR 
              LOWER(lst.miner_address) = LOWER(ma.address)
            )
        )
    `;
    
    return Response.json({
      success: true,
      chain,
      stats: stats[0],
      sampleMinerTransactions: minerTxs,
      sampleMinerOwners: minerOwners,
      minerOwnersWithSells: minerOwnersWithSells,
      addressComparison: addressComparison,
      overlapCheck: overlapCheck[0],
      debug: {
        totalTransactions: stats[0].total_count,
        transactionsWithMiners: parseInt(stats[0].direct_miners) + parseInt(stats[0].indirect_miners),
        minerOwnersCount: minerOwners.length,
        minerOwnersWithSellsCount: minerOwnersWithSells.length,
        totalOverlap: overlapCheck[0].overlap_count
      }
    });
  } catch (error) {
    console.error('Debug sells error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
}