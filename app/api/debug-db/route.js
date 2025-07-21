import sql from '../../../lib/database/connection.js';

export async function GET() {
  try {
    console.log('🔍 Debug: Checking database connection...');
    
    // Check if DATABASE_URL is set
    const hasDbUrl = !!process.env.DATABASE_URL;
    const dbUrlLength = process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0;
    
    console.log(`DATABASE_URL exists: ${hasDbUrl}`);
    console.log(`DATABASE_URL length: ${dbUrlLength}`);
    
    // Test basic query
    const result = await sql`SELECT NOW() as current_time`;
    console.log('✅ Database connection successful');
    
    // Check if tables exist
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    // Count records in miner_addresses table
    let addressCounts = {};
    try {
      const abstractCount = await sql`SELECT COUNT(*) as count FROM miner_addresses WHERE chain = 'abstract'`;
      const baseCount = await sql`SELECT COUNT(*) as count FROM miner_addresses WHERE chain = 'base'`;
      addressCounts = {
        abstract: parseInt(abstractCount[0].count),
        base: parseInt(baseCount[0].count)
      };
    } catch (tableError) {
      console.log('⚠️ miner_addresses table may not exist:', tableError.message);
      addressCounts = { error: 'Table not found or empty' };
    }
    
    // Count records in ratio_data table if it exists
    let ratioCounts = {};
    try {
      const abstractRatios = await sql`SELECT COUNT(*) as count FROM ratio_data WHERE chain = 'abstract'`;
      const baseRatios = await sql`SELECT COUNT(*) as count FROM ratio_data WHERE chain = 'base'`;
      ratioCounts = {
        abstract: parseInt(abstractRatios[0].count),
        base: parseInt(baseRatios[0].count)
      };
    } catch (ratioError) {
      console.log('⚠️ ratio_data table may not exist:', ratioError.message);
      ratioCounts = { error: 'Table not found or empty' };
    }
    
    return Response.json({
      success: true,
      database: {
        connected: true,
        currentTime: result[0].current_time,
        hasDbUrl,
        dbUrlLength
      },
      tables: tables.map(t => t.table_name),
      addressCounts,
      ratioCounts,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercelUrl: !!process.env.VERCEL_URL,
        nextauthUrl: !!process.env.NEXTAUTH_URL
      }
    });
    
  } catch (error) {
    console.error('❌ Database debug error:', error);
    return Response.json({ 
      success: false,
      error: error.message,
      database: {
        connected: false,
        hasDbUrl: !!process.env.DATABASE_URL,
        dbUrlLength: process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercelUrl: !!process.env.VERCEL_URL,
        nextauthUrl: !!process.env.NEXTAUTH_URL
      }
    }, { status: 500 });
  }
}