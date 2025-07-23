import { getAllAddressesWithMiners } from '../../../lib/database/operations.js';
import sql from '../../../lib/database/connection.js';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const chain = searchParams.get('chain') || 'base';
  
  try {
    // Get what getAllAddressesWithMiners returns
    const allAddresses = await getAllAddressesWithMiners(chain);
    
    // Get detailed miner_addresses data
    const minerData = await sql`
      SELECT address, total_miners, active_miners, last_updated_at
      FROM miner_addresses 
      WHERE chain = ${chain} 
        AND is_active = true
      ORDER BY last_updated_at DESC
      LIMIT 20
    `;
    
    // Check for duplicates
    const uniqueAddresses = new Set(allAddresses);
    
    return Response.json({
      success: true,
      chain,
      totalAddresses: allAddresses.length,
      uniqueAddresses: uniqueAddresses.size,
      hasDuplicates: allAddresses.length !== uniqueAddresses.size,
      firstTenAddresses: allAddresses.slice(0, 10),
      minerDataSample: minerData.slice(0, 10).map(r => ({
        address: r.address,
        totalMiners: r.total_miners,
        activeMiners: r.active_miners,
        lastUpdated: r.last_updated_at
      }))
    });
    
  } catch (error) {
    console.error('Error getting miner addresses:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
}