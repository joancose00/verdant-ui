#!/usr/bin/env node

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Database connection
const sql = neon(process.env.DATABASE_URL);

async function resetRatioData() {
  console.log('🔄 Resetting Ratio of Shame database...');
  
  try {
    // Clear all ratio data
    const deletedRatios = await sql`
      DELETE FROM address_ratios
      RETURNING address, chain, ratio
    `;
    
    console.log(`✅ Cleared ${deletedRatios.length} ratio records`);
    
    if (deletedRatios.length > 0) {
      console.log('📋 Cleared ratios by chain:');
      const chainCounts = deletedRatios.reduce((acc, row) => {
        acc[row.chain] = (acc[row.chain] || 0) + 1;
        return acc;
      }, {});
      
      Object.entries(chainCounts).forEach(([chain, count]) => {
        console.log(`   - ${chain}: ${count} ratios`);
      });
    }
    
    // Verify table is empty
    const remainingRatios = await sql`SELECT COUNT(*) as count FROM address_ratios`;
    console.log(`📊 Remaining ratios in table: ${remainingRatios[0].count}`);
    
    console.log('\n🎉 Ratio of Shame database reset completed successfully!');
    console.log('   Next "Update Ratios" will calculate fresh ratios with the fixed logic.');
    
  } catch (error) {
    console.error('❌ Error resetting ratio data:', error);
    process.exit(1);
  }
}

// Run the reset
resetRatioData();