import sql from './connection.js';

export async function add14DayRatioColumns() {
  try {
    console.log('🔄 Adding 14-day ratio columns to address_ratios table...');

    // Add 14-day deposits column
    await sql`
      ALTER TABLE address_ratios
      ADD COLUMN IF NOT EXISTS deposits_14d DECIMAL(20,2) DEFAULT 0
    `;

    // Add 14-day withdrawals column
    await sql`
      ALTER TABLE address_ratios
      ADD COLUMN IF NOT EXISTS withdrawals_14d DECIMAL(20,2) DEFAULT 0
    `;

    // Add 14-day ratio column
    await sql`
      ALTER TABLE address_ratios
      ADD COLUMN IF NOT EXISTS ratio_14d DECIMAL(10,4) DEFAULT 0
    `;

    // Add timestamp for when 14-day ratio was last calculated
    await sql`
      ALTER TABLE address_ratios
      ADD COLUMN IF NOT EXISTS ratio_14d_calculated_at TIMESTAMP
    `;

    console.log('✅ Successfully added 14-day ratio columns');
    return { success: true };
  } catch (error) {
    console.error('❌ Error adding 14-day ratio columns:', error);
    // If columns already exist, that's okay
    if (error.message.includes('already exists')) {
      console.log('ℹ️ Columns already exist, skipping...');
      return { success: true };
    }
    throw error;
  }
}

// Run the migration
add14DayRatioColumns()
  .then(() => {
    console.log('✅ Migration complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });