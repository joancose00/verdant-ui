-- Verdant UI Database Schema
-- Stores addresses with miners for fast querying

-- Create extension for UUID generation if needed
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Miner addresses table
CREATE TABLE IF NOT EXISTS miner_addresses (
  id SERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL UNIQUE, -- Ethereum address
  chain VARCHAR(10) NOT NULL, -- 'abstract' or 'base'
  first_discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total_miners INTEGER DEFAULT 0,
  active_miners INTEGER DEFAULT 0,
  last_scan_block BIGINT, -- Block number when last scanned
  is_active BOOLEAN DEFAULT TRUE, -- Still has miners
  CONSTRAINT valid_address CHECK (address ~ '^0x[a-fA-F0-9]{40}$'),
  CONSTRAINT valid_chain CHECK (chain IN ('abstract', 'base'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_miner_addresses_chain ON miner_addresses(chain);
CREATE INDEX IF NOT EXISTS idx_miner_addresses_active ON miner_addresses(is_active);
CREATE INDEX IF NOT EXISTS idx_miner_addresses_updated ON miner_addresses(last_updated_at);
CREATE INDEX IF NOT EXISTS idx_miner_addresses_chain_active ON miner_addresses(chain, is_active);

-- Scan history table to track discovery progress
CREATE TABLE IF NOT EXISTS scan_history (
  id SERIAL PRIMARY KEY,
  chain VARCHAR(10) NOT NULL,
  scan_type VARCHAR(20) DEFAULT 'discovery', -- 'discovery', 'refresh', 'full'
  start_miner_id BIGINT NOT NULL,
  end_miner_id BIGINT NOT NULL,
  addresses_found INTEGER DEFAULT 0,
  scan_duration_ms INTEGER,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  status VARCHAR(10) DEFAULT 'running', -- 'running', 'completed', 'failed'
  error_message TEXT,
  CONSTRAINT valid_chain_history CHECK (chain IN ('abstract', 'base')),
  CONSTRAINT valid_status CHECK (status IN ('running', 'completed', 'failed'))
);

-- Create index for scan history
CREATE INDEX IF NOT EXISTS idx_scan_history_chain ON scan_history(chain);
CREATE INDEX IF NOT EXISTS idx_scan_history_status ON scan_history(status);
CREATE INDEX IF NOT EXISTS idx_scan_history_completed ON scan_history(completed_at);

-- Function to update last_updated_at automatically
CREATE OR REPLACE FUNCTION update_last_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update last_updated_at
CREATE TRIGGER trigger_update_miner_addresses_updated_at
  BEFORE UPDATE ON miner_addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_last_updated_at();