#!/usr/bin/env node

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Database connection
const sql = neon(process.env.DATABASE_URL);

async function resetBaseProgress() {
  console.log('🔄 Resetting Base chain scan progress...');
  
  try {
    // Reset scan progress for Base chain only
    const result = await sql`
      UPDATE scan_progress 
      SET 
        last_checked_miner_id = 0,
        total_miners_found = 0,
        last_updated_at = CURRENT_TIMESTAMP
      WHERE chain = 'base'
      RETURNING *
    `;
    
    console.log('✅ Base scan progress reset successfully');
    console.log(`   - Chain: ${result[0].chain}`);
    console.log(`   - Last checked miner ID: ${result[0].last_checked_miner_id}`);
    console.log(`   - Total miners found: ${result[0].total_miners_found}`);
    
    // Also clear any Base addresses to start fresh
    const deletedAddresses = await sql`
      DELETE FROM miner_addresses 
      WHERE chain = 'base'
      RETURNING address
    `;
    
    console.log(`✅ Cleared ${deletedAddresses.length} cached Base addresses`);
    
    console.log('\n🎉 Base chain reset completed successfully!');
    console.log('   Next "Scan for More" will start from miner ID 1');
    
  } catch (error) {
    console.error('❌ Error resetting Base progress:', error);
    process.exit(1);
  }
}

// Run the reset
resetBaseProgress();