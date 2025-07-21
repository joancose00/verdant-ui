import sql from './connection.js';

/**
 * Initialize database tables
 */
export async function initializeDatabase() {
  try {
    // Create miner_addresses table
    await sql`
      CREATE TABLE IF NOT EXISTS miner_addresses (
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
    await sql`CREATE INDEX IF NOT EXISTS idx_miner_addresses_chain ON miner_addresses(chain)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_miner_addresses_active ON miner_addresses(is_active)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_miner_addresses_chain_active ON miner_addresses(chain, is_active)`;

    // Create scan_history table
    await sql`
      CREATE TABLE IF NOT EXISTS scan_history (
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

    // Create scan progress table to track last checked miner ID per chain
    await sql`
      CREATE TABLE IF NOT EXISTS scan_progress (
        id SERIAL PRIMARY KEY,
        chain VARCHAR(10) NOT NULL UNIQUE,
        last_checked_miner_id BIGINT DEFAULT 0,
        total_miners_found INTEGER DEFAULT 0,
        last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_chain_progress CHECK (chain IN ('abstract', 'base'))
      )
    `;

    // Create address_ratios table to cache ratio calculations
    await sql`
      CREATE TABLE IF NOT EXISTS address_ratios (
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
    await sql`CREATE INDEX IF NOT EXISTS idx_address_ratios_chain ON address_ratios(chain)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_address_ratios_ratio ON address_ratios(chain, ratio DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_address_ratios_updated ON address_ratios(last_calculated_at)`;

    // Insert initial progress records if they don't exist
    await sql`
      INSERT INTO scan_progress (chain, last_checked_miner_id, total_miners_found)
      VALUES ('abstract', 0, 0), ('base', 0, 0)
      ON CONFLICT (chain) DO NOTHING
    `;

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Get all addresses with miners for a specific chain
 */
export async function getAddressesWithMiners(chain, limit = 100) {
  try {
    const addresses = await sql`
      SELECT address, total_miners, active_miners, last_updated_at
      FROM miner_addresses 
      WHERE chain = ${chain} AND is_active = true
      ORDER BY last_updated_at DESC
      LIMIT ${limit}
    `;
    
    return addresses.map(row => ({
      address: row.address,
      totalMiners: row.total_miners,
      activeMiners: row.active_miners,
      lastUpdated: row.last_updated_at
    }));
  } catch (error) {
    console.error('❌ Failed to get addresses:', error);
    throw error;
  }
}

/**
 * Store discovered addresses in the database
 */
export async function storeDiscoveredAddresses(chain, addresses) {
  try {
    if (!addresses || addresses.length === 0) {
      console.log(`📋 No new addresses to store for ${chain} chain`);
      return [];
    }

    // Check for existing addresses first
    const existingAddresses = await sql`
      SELECT address FROM miner_addresses 
      WHERE address = ANY(${addresses}) AND chain = ${chain}
    `;
    
    const existingAddressSet = new Set(existingAddresses.map(row => row.address));
    const newAddresses = addresses.filter(addr => !existingAddressSet.has(addr));
    
    if (newAddresses.length === 0) {
      console.log(`📋 All ${addresses.length} addresses already exist for ${chain} chain`);
      return [];
    }
    
    const results = [];
    
    for (const address of newAddresses) {
      // Insert new address
      const result = await sql`
        INSERT INTO miner_addresses (address, chain, total_miners, is_active)
        VALUES (${address}, ${chain}, 1, true)
        ON CONFLICT (address, chain) 
        DO UPDATE SET
          last_updated_at = CURRENT_TIMESTAMP,
          is_active = true
        RETURNING *
      `;
      
      results.push(result[0]);
    }
    
    console.log(`✅ Stored ${results.length} new addresses for ${chain} chain (${addresses.length - results.length} were duplicates)`);
    return results;
  } catch (error) {
    console.error('❌ Failed to store addresses:', error);
    throw error;
  }
}

/**
 * Update miner counts for an address
 */
export async function updateAddressMinerCounts(address, totalMiners, activeMiners) {
  try {
    const result = await sql`
      UPDATE miner_addresses 
      SET 
        total_miners = ${totalMiners},
        active_miners = ${activeMiners},
        last_updated_at = CURRENT_TIMESTAMP,
        is_active = ${totalMiners > 0}
      WHERE address = ${address}
      RETURNING *
    `;
    
    return result[0];
  } catch (error) {
    console.error('❌ Failed to update miner counts:', error);
    throw error;
  }
}

/**
 * Start a new scan record
 */
export async function startScanRecord(chain, startMinerId, endMinerId, scanType = 'discovery') {
  try {
    const result = await sql`
      INSERT INTO scan_history (chain, scan_type, start_miner_id, end_miner_id, status)
      VALUES (${chain}, ${scanType}, ${startMinerId}, ${endMinerId}, 'running')
      RETURNING id
    `;
    
    return result[0].id;
  } catch (error) {
    console.error('❌ Failed to start scan record:', error);
    throw error;
  }
}

/**
 * Complete a scan record
 */
export async function completeScanRecord(scanId, addressesFound, duration, error = null) {
  try {
    const status = error ? 'failed' : 'completed';
    
    await sql`
      UPDATE scan_history 
      SET 
        addresses_found = ${addressesFound},
        scan_duration_ms = ${duration},
        completed_at = CURRENT_TIMESTAMP,
        status = ${status},
        error_message = ${error}
      WHERE id = ${scanId}
    `;
    
    console.log(`✅ Scan ${scanId} completed with status: ${status}`);
  } catch (error) {
    console.error('❌ Failed to complete scan record:', error);
    throw error;
  }
}

/**
 * Get the latest scan information for a chain
 */
export async function getLatestScanInfo(chain) {
  try {
    const result = await sql`
      SELECT *
      FROM scan_history 
      WHERE chain = ${chain} AND status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 1
    `;
    
    return result[0];
  } catch (error) {
    console.error('❌ Failed to get latest scan info:', error);
    throw error;
  }
}

/**
 * Check if we need to refresh data (if last scan was > 1 hour ago)
 */
export async function needsRefresh(chain, hoursThreshold = 1) {
  try {
    const latestScan = await getLatestScanInfo(chain);
    
    if (!latestScan) {
      return true; // No scan found, needs initial scan
    }
    
    const lastScanTime = new Date(latestScan.completed_at);
    const now = new Date();
    const hoursSinceLastScan = (now - lastScanTime) / (1000 * 60 * 60);
    
    return hoursSinceLastScan > hoursThreshold;
  } catch (error) {
    console.error('❌ Failed to check refresh need:', error);
    return true; // Assume refresh needed on error
  }
}

/**
 * Get scan progress for a chain
 */
export async function getScanProgress(chain) {
  try {
    const result = await sql`
      SELECT * FROM scan_progress 
      WHERE chain = ${chain}
    `;
    
    return result[0];
  } catch (error) {
    console.error('❌ Failed to get scan progress:', error);
    throw error;
  }
}

/**
 * Update scan progress - set new last checked miner ID
 */
export async function updateScanProgress(chain, lastCheckedMinerId, newAddressesFound = 0) {
  try {
    const result = await sql`
      UPDATE scan_progress 
      SET 
        last_checked_miner_id = ${lastCheckedMinerId},
        total_miners_found = total_miners_found + ${newAddressesFound},
        last_updated_at = CURRENT_TIMESTAMP
      WHERE chain = ${chain}
      RETURNING *
    `;
    
    console.log(`✅ Updated scan progress for ${chain}: last miner ID ${lastCheckedMinerId}`);
    return result[0];
  } catch (error) {
    console.error('❌ Failed to update scan progress:', error);
    throw error;
  }
}

/**
 * Reset scan progress for a chain (force full rescan)
 */
export async function resetScanProgress(chain) {
  try {
    const result = await sql`
      UPDATE scan_progress 
      SET 
        last_checked_miner_id = 0,
        total_miners_found = 0,
        last_updated_at = CURRENT_TIMESTAMP
      WHERE chain = ${chain}
      RETURNING *
    `;
    
    console.log(`✅ Reset scan progress for ${chain}`);
    return result[0];
  } catch (error) {
    console.error('❌ Failed to reset scan progress:', error);
    throw error;
  }
}

/**
 * Get cached ratio data for a chain, ordered by highest ratio
 * Only shows addresses with active miners and meaningful activity
 */
export async function getCachedRatios(chain, limit = 100) {
  try {
    const ratios = await sql`
      SELECT address, total_deposits, total_withdrawals, ratio, total_miners, active_miners, last_calculated_at
      FROM address_ratios 
      WHERE chain = ${chain}
        AND ratio > 0
        AND active_miners > 0
        AND (total_deposits > 0 OR total_withdrawals > 0)
      ORDER BY ratio DESC, total_withdrawals DESC
      LIMIT ${limit}
    `;
    
    return ratios.map(row => ({
      address: row.address,
      totalDeposits: parseFloat(row.total_deposits).toFixed(2),
      totalWithdrawals: parseFloat(row.total_withdrawals).toFixed(2),
      ratio: parseFloat(row.ratio).toFixed(4),
      totalMiners: row.total_miners || 0,
      activeMiners: row.active_miners || 0,
      lastCalculatedAt: row.last_calculated_at
    }));
  } catch (error) {
    console.error('❌ Failed to get cached ratios:', error);
    throw error;
  }
}

/**
 * Store or update ratio data for an address
 */
export async function storeRatioData(chain, address, totalDeposits, totalWithdrawals, ratio, totalMiners = 0, activeMiners = 0) {
  try {
    const result = await sql`
      INSERT INTO address_ratios (address, chain, total_deposits, total_withdrawals, ratio, total_miners, active_miners)
      VALUES (${address}, ${chain}, ${totalDeposits}, ${totalWithdrawals}, ${ratio}, ${totalMiners}, ${activeMiners})
      ON CONFLICT (address, chain)
      DO UPDATE SET
        total_deposits = EXCLUDED.total_deposits,
        total_withdrawals = EXCLUDED.total_withdrawals,
        ratio = EXCLUDED.ratio,
        total_miners = EXCLUDED.total_miners,
        active_miners = EXCLUDED.active_miners,
        last_calculated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    return result[0];
  } catch (error) {
    console.error('❌ Failed to store ratio data:', error);
    throw error;
  }
}

/**
 * Get addresses that need ratio calculation (addresses with miners but no cached ratios)
 */
export async function getAddressesNeedingRatioCalculation(chain, limit = 50) {
  try {
    const addresses = await sql`
      SELECT ma.address
      FROM miner_addresses ma
      LEFT JOIN address_ratios ar ON ma.address = ar.address AND ma.chain = ar.chain
      WHERE ma.chain = ${chain} 
        AND ma.is_active = true
        AND ar.address IS NULL
      ORDER BY ma.last_updated_at DESC
      LIMIT ${limit}
    `;
    
    return addresses.map(row => row.address);
  } catch (error) {
    console.error('❌ Failed to get addresses needing ratio calculation:', error);
    throw error;
  }
}

/**
 * Get all addresses with active miners for a chain
 */
export async function getAllAddressesWithMiners(chain) {
  try {
    const addresses = await sql`
      SELECT address
      FROM miner_addresses 
      WHERE chain = ${chain} 
        AND is_active = true
      ORDER BY last_updated_at DESC
    `;
    
    return addresses.map(row => row.address);
  } catch (error) {
    console.error('❌ Failed to get all addresses with miners:', error);
    throw error;
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats() {
  try {
    const [addressStats, progressStats, ratioStats] = await Promise.all([
      sql`
        SELECT 
          chain,
          COUNT(*) as total_addresses,
          COUNT(*) FILTER (WHERE is_active = true) as active_addresses,
          MAX(last_updated_at) as last_update
        FROM miner_addresses 
        GROUP BY chain
      `,
      sql`
        SELECT 
          chain,
          last_checked_miner_id,
          total_miners_found,
          last_updated_at as progress_updated
        FROM scan_progress
      `,
      sql`
        SELECT 
          chain,
          COUNT(*) as total_ratios,
          MAX(last_calculated_at) as last_ratio_update
        FROM address_ratios
        GROUP BY chain
      `
    ]);
    
    return {
      addresses: addressStats,
      progress: progressStats,
      ratios: ratioStats
    };
  } catch (error) {
    console.error('❌ Failed to get database stats:', error);
    throw error;
  }
}