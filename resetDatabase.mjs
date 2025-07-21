#!/usr/bin/env node

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Database connection
const sql = neon(process.env.DATABASE_URL);

async function resetDatabase() {
  console.log('🔄 Starting database reset...');
  
  try {
    // Drop all tables
    console.log('🗑️  Dropping existing tables...');
    
    await sql`DROP TABLE IF EXISTS scan_history CASCADE`;
    await sql`DROP TABLE IF EXISTS miner_addresses CASCADE`;
    await sql`DROP TABLE IF EXISTS scan_progress CASCADE`;
    await sql`DROP TABLE IF EXISTS address_ratios CASCADE`;
    
    console.log('✅ All tables dropped successfully');
    
    // Recreate tables
    console.log('🏗️  Recreating tables...');
    
    // Create miner_addresses table
    await sql`
      CREATE TABLE miner_addresses (
        id SERIAL PRIMARY KEY,
        address VARCHAR(42) NOT NULL,
        chain VARCHAR(10) NOT NULL,
        first_discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_miners INTEGER DEFAULT 0,
        active_miners INTEGER DEFAULT 0,
        last_scan_block BIGINT,
        is_active BOOLEAN DEFAULT TRUE,
        CONSTRAINT valid_address CHECK (address ~ '^0x[a-fA-F0-9]{40}$'),
        CONSTRAINT valid_chain CHECK (chain IN ('abstract', 'base')),
        UNIQUE(address, chain)
      )
    `;

    // Create indexes
    await sql`CREATE INDEX idx_miner_addresses_chain ON miner_addresses(chain)`;
    await sql`CREATE INDEX idx_miner_addresses_active ON miner_addresses(is_active)`;
    await sql`CREATE INDEX idx_miner_addresses_chain_active ON miner_addresses(chain, is_active)`;

    // Create scan_history table
    await sql`
      CREATE TABLE scan_history (
        id SERIAL PRIMARY KEY,
        chain VARCHAR(10) NOT NULL,
        scan_type VARCHAR(20) DEFAULT 'discovery',
        start_miner_id BIGINT NOT NULL,
        end_miner_id BIGINT NOT NULL,
        addresses_found INTEGER DEFAULT 0,
        scan_duration_ms INTEGER,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        status VARCHAR(10) DEFAULT 'running',
        error_message TEXT,
        CONSTRAINT valid_chain_history CHECK (chain IN ('abstract', 'base')),
        CONSTRAINT valid_status CHECK (status IN ('running', 'completed', 'failed'))
      )
    `;

    // Create scan progress table
    await sql`
      CREATE TABLE scan_progress (
        id SERIAL PRIMARY KEY,
        chain VARCHAR(10) NOT NULL UNIQUE,
        last_checked_miner_id BIGINT DEFAULT 0,
        total_miners_found INTEGER DEFAULT 0,
        last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_chain_progress CHECK (chain IN ('abstract', 'base'))
      )
    `;

    // Create address_ratios table
    await sql`
      CREATE TABLE address_ratios (
        id SERIAL PRIMARY KEY,
        address VARCHAR(42) NOT NULL,
        chain VARCHAR(10) NOT NULL,
        total_deposits DECIMAL(20,2) DEFAULT 0,
        total_withdrawals DECIMAL(20,2) DEFAULT 0,
        ratio DECIMAL(10,4) DEFAULT 0,
        total_miners INTEGER DEFAULT 0,
        active_miners INTEGER DEFAULT 0,
        last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_address_ratio CHECK (address ~ '^0x[a-fA-F0-9]{40}$'),
        CONSTRAINT valid_chain_ratio CHECK (chain IN ('abstract', 'base')),
        UNIQUE(address, chain)
      )
    `;

    // Create indexes for ratio table
    await sql`CREATE INDEX idx_address_ratios_chain ON address_ratios(chain)`;
    await sql`CREATE INDEX idx_address_ratios_ratio ON address_ratios(chain, ratio DESC)`;
    await sql`CREATE INDEX idx_address_ratios_updated ON address_ratios(last_calculated_at)`;

    // Insert initial progress records
    await sql`
      INSERT INTO scan_progress (chain, last_checked_miner_id, total_miners_found)
      VALUES ('abstract', 0, 0), ('base', 0, 0)
    `;

    console.log('✅ All tables recreated successfully');
    console.log('✅ Initial scan progress records inserted');
    
    // Verify tables exist
    console.log('🔍 Verifying table creation...');
    
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('miner_addresses', 'scan_history', 'scan_progress', 'address_ratios')
      ORDER BY table_name
    `;
    
    console.log('📋 Created tables:');
    tables.forEach(table => {
      console.log(`   - ${table.table_name}`);
    });
    
    // Show initial scan progress
    const initialProgress = await sql`SELECT * FROM scan_progress ORDER BY chain`;
    console.log('📊 Initial scan progress:');
    initialProgress.forEach(progress => {
      console.log(`   - ${progress.chain}: last_checked_miner_id = ${progress.last_checked_miner_id}`);
    });
    
    console.log('\n🎉 Database reset completed successfully!');
    
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  }
}

// Run the reset
resetDatabase();