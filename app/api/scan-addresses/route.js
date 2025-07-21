import { scanForMinerAddresses } from '../../../utils/addressScanner.js';

export async function POST(req) {
  try {
    const { chain = 'abstract', maxMiners = 1000 } = await req.json();

    // Validate parameters
    if (!['abstract', 'base'].includes(chain)) {
      return Response.json({ error: 'Invalid chain. Use "abstract" or "base"' }, { status: 400 });
    }

    if (maxMiners < 1 || maxMiners > 10000) {
      return Response.json({ error: 'maxMiners must be between 1 and 10000' }, { status: 400 });
    }

    console.log(`Starting address scan for ${chain} chain (max ${maxMiners} miners)`);
    
    // Scan for addresses with miners
    const addresses = await scanForMinerAddresses(chain, 50, maxMiners); // Use smaller batch size for API
    
    return Response.json({
      success: true,
      chain,
      totalAddresses: addresses.length,
      scannedMiners: maxMiners,
      addresses: addresses.slice(0, 100) // Limit response size, return first 100 addresses
    });

  } catch (error) {
    console.error('Address scan error:', error);
    return Response.json({ 
      error: error.message || 'Failed to scan for addresses' 
    }, { status: 500 });
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const chain = searchParams.get('chain') || 'abstract';
  const maxMiners = parseInt(searchParams.get('maxMiners')) || 500;

  try {
    // Validate parameters
    if (!['abstract', 'base'].includes(chain)) {
      return Response.json({ error: 'Invalid chain. Use "abstract" or "base"' }, { status: 400 });
    }

    console.log(`Starting address scan for ${chain} chain (max ${maxMiners} miners)`);
    
    const addresses = await scanForMinerAddresses(chain, 50, maxMiners);
    
    return Response.json({
      success: true,
      chain,
      totalAddresses: addresses.length,
      scannedMiners: maxMiners,
      addresses: addresses.slice(0, 50) // Limit for GET requests
    });

  } catch (error) {
    console.error('Address scan error:', error);
    return Response.json({ 
      error: error.message || 'Failed to scan for addresses' 
    }, { status: 500 });
  }
}