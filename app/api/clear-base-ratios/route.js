import sql from '../../../lib/database/connection.js';

export async function POST(req) {
  try {
    const { chain = 'base' } = await req.json();
    
    console.log(`🧹 Clearing ratio data for ${chain}...`);
    
    const result = await sql`
      DELETE FROM address_ratios
      WHERE chain = ${chain}
    `;
    
    console.log(`✅ Cleared ${result.count} ratio records for ${chain}`);
    
    return Response.json({
      success: true,
      message: `Cleared ${result.count} ratio records for ${chain}`,
      recordsCleared: result.count
    });
    
  } catch (error) {
    console.error('Error clearing ratio data:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
}