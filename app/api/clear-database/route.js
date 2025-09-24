import sql from '../../../lib/database/connection.js';

export async function POST(req) {
  try {
    const { chain, confirm } = await req.json();

    // Safety check
    if (confirm !== 'DELETE_ALL_DATA') {
      return Response.json({
        error: 'Confirmation required. Send { confirm: "DELETE_ALL_DATA" }'
      }, { status: 400 });
    }

    if (!chain || chain !== 'base') {
      return Response.json({
        error: 'Invalid chain. Only "base" is supported'
      }, { status: 400 });
    }

    console.log(`🗑️ CLEARING ALL DATABASE DATA for ${chain} chain...`);

    // Clear all tables for the specified chain
    const results = [];

    // Clear address ratios
    const ratiosResult = await sql`DELETE FROM address_ratios WHERE chain = ${chain}`;
    results.push(`Deleted ${ratiosResult.rowCount} address ratios`);

    // Clear miner addresses
    const minersResult = await sql`DELETE FROM miner_addresses WHERE chain = ${chain}`;
    results.push(`Deleted ${minersResult.rowCount} miner addresses`);

    // Clear scan history
    const historyResult = await sql`DELETE FROM scan_history WHERE chain = ${chain}`;
    results.push(`Deleted ${historyResult.rowCount} scan history entries`);

    // Clear scan progress
    const progressResult = await sql`DELETE FROM scan_progress WHERE chain = ${chain}`;
    results.push(`Deleted ${progressResult.rowCount} scan progress entries`);

    // Clear LP sell transactions (if any)
    const sellResult = await sql`DELETE FROM lp_sell_transactions WHERE chain = ${chain}`;
    results.push(`Deleted ${sellResult.rowCount} sell transactions`);

    // Clear LP scan progress
    const lpProgressResult = await sql`DELETE FROM lp_scan_progress WHERE chain = ${chain}`;
    results.push(`Deleted ${lpProgressResult.rowCount} LP scan progress entries`);

    console.log(`✅ Database cleared for ${chain} chain`);
    results.forEach(result => console.log(`   - ${result}`));

    return Response.json({
      success: true,
      chain,
      message: `Database cleared for ${chain} chain`,
      details: results
    });

  } catch (error) {
    console.error('❌ Database clear error:', error);
    return Response.json({
      error: error.message || 'Failed to clear database'
    }, { status: 500 });
  }
}