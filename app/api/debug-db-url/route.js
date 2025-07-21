import sql from '../../../lib/database/connection.js';

export async function GET() {
  try {
    // Get the DATABASE_URL (mask sensitive parts)
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return Response.json({
        error: "DATABASE_URL not set",
        environment: process.env.NODE_ENV
      });
    }

    // Parse URL to show connection details (without password)
    let urlInfo = {};
    try {
      const url = new URL(dbUrl);
      urlInfo = {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        pathname: url.pathname,
        username: url.username,
        // Don't show password for security
        passwordSet: !!url.password,
        search: url.search
      };
    } catch (urlError) {
      urlInfo = { error: "Invalid URL format" };
    }

    // Test database connection and get connection info
    const connectionTest = await sql`
      SELECT 
        current_database() as database_name,
        current_user as user_name,
        inet_server_addr() as server_ip,
        inet_server_port() as server_port,
        version() as version
    `;

    // Check what's in our tables
    const minerAddressCount = await sql`
      SELECT chain, COUNT(*) as count, MIN(first_discovered_at) as earliest, MAX(last_updated_at) as latest
      FROM miner_addresses 
      GROUP BY chain
    `;

    const scanProgress = await sql`
      SELECT chain, last_scanned_miner_id, addresses_discovered, last_scan_completed 
      FROM scan_progress
    `;

    // Show recent scan history
    const recentScans = await sql`
      SELECT chain, scan_type, start_miner_id, end_miner_id, addresses_found, started_at, completed_at, status
      FROM scan_history 
      ORDER BY started_at DESC 
      LIMIT 5
    `;

    return Response.json({
      success: true,
      database: {
        urlInfo,
        connection: connectionTest[0],
        minerAddresses: minerAddressCount,
        scanProgress,
        recentScans
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercelUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
        nextAuthUrl: process.env.NEXTAUTH_URL || null
      }
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}