import sql from '../../../lib/database/connection.js';

export async function GET(req) {
  try {
    const ratios = await sql`
      SELECT address, total_deposits, total_withdrawals, ratio, total_sells, sell_ratio, active_miners, last_calculated_at
      FROM address_ratios 
      WHERE chain = 'base'
      ORDER BY last_calculated_at DESC
      LIMIT 20
    `;
    
    // Check for duplicate values
    const uniqueDeposits = new Set(ratios.map(r => r.total_deposits.toString()));
    const uniqueWithdrawals = new Set(ratios.map(r => r.total_withdrawals.toString()));
    
    return Response.json({
      success: true,
      totalRecords: ratios.length,
      uniqueDepositValues: uniqueDeposits.size,
      uniqueWithdrawalValues: uniqueWithdrawals.size,
      ratios: ratios.map(r => ({
        address: r.address,
        deposits: r.total_deposits.toString(),
        withdrawals: r.total_withdrawals.toString(),
        ratio: r.ratio.toString(),
        sells: r.total_sells?.toString() || '0',
        sellRatio: r.sell_ratio?.toString() || '0',
        activeMiners: r.active_miners,
        lastCalculated: r.last_calculated_at
      }))
    });
    
  } catch (error) {
    console.error('Error getting base ratios:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
}