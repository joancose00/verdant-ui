import { 
  getDatabaseStats, 
  getLatestScanInfo,
  initializeDatabase
} from '../../../lib/database/operations.js';

export async function GET(req) {
  try {
    // Initialize database if needed
    try {
      await initializeDatabase();
    } catch (dbError) {
      console.log('Database already initialized or minor error:', dbError.message);
    }

    const [stats, abstractScan, baseScan] = await Promise.all([
      getDatabaseStats(),
      getLatestScanInfo('abstract'),
      getLatestScanInfo('base')
    ]);

    return Response.json({
      success: true,
      statistics: stats,
      lastScans: {
        abstract: abstractScan,
        base: baseScan
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Database stats error:', error);
    return Response.json({ 
      error: error.message || 'Failed to get database statistics' 
    }, { status: 500 });
  }
}