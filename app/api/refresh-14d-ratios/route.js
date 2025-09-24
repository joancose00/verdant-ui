import { refreshAddresses14DayRatios } from '../../../lib/database/operations.js';

export async function POST(req) {
  try {
    const result = await refreshAddresses14DayRatios();
    return Response.json({
      success: true,
      message: `Updated 14-day ratios for ${result.updatedCount}/${result.totalProcessed} addresses with active miners`,
      updatedCount: result.updatedCount,
      totalProcessed: result.totalProcessed
    });
  } catch (error) {
    console.error('Error refreshing 14-day ratios:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}