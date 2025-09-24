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
        total_sells DECIMAL(30,18) DEFAULT 0,
        sell_ratio DECIMAL(10,4) DEFAULT 0,
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
    
    // Add new columns if they don't exist (for existing installations)
    try {
      // Check if total_sells column exists
      const totalSellsExists = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'address_ratios' 
        AND column_name = 'total_sells'
      `;
      
      if (totalSellsExists.length === 0) {
        await sql`ALTER TABLE address_ratios ADD COLUMN total_sells DECIMAL(30,18) DEFAULT 0`;
        console.log('✅ Added total_sells column to address_ratios table');
      }
    } catch (e) {
      console.error('Error adding total_sells column:', e.message);
    }
    
    try {
      // Check if sell_ratio column exists
      const sellRatioExists = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'address_ratios' 
        AND column_name = 'sell_ratio'
      `;
      
      if (sellRatioExists.length === 0) {
        await sql`ALTER TABLE address_ratios ADD COLUMN sell_ratio DECIMAL(10,4) DEFAULT 0`;
        console.log('✅ Added sell_ratio column to address_ratios table');
      }
    } catch (e) {
      console.error('Error adding sell_ratio column:', e.message);
    }
    
    // Create index for sell_ratio after the column is added
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_address_ratios_sell_ratio ON address_ratios(chain, sell_ratio DESC)`;
    } catch (e) {
      console.log('Index creation for sell_ratio:', e.message);
    }

    // Add 14-day ratio columns if they don't exist
    try {
      await sql`ALTER TABLE address_ratios ADD COLUMN IF NOT EXISTS deposits_14d DECIMAL(20,2) DEFAULT 0`;
      await sql`ALTER TABLE address_ratios ADD COLUMN IF NOT EXISTS withdrawals_14d DECIMAL(20,2) DEFAULT 0`;
      await sql`ALTER TABLE address_ratios ADD COLUMN IF NOT EXISTS ratio_14d DECIMAL(10,4) DEFAULT 0`;
      await sql`ALTER TABLE address_ratios ADD COLUMN IF NOT EXISTS ratio_14d_calculated_at TIMESTAMP`;
      console.log('✅ 14-day ratio columns added/verified');
    } catch (error) {
      console.log('ℹ️ 14-day ratio columns already exist or minor error:', error.message);
    }

    // Create lp_sell_transactions table
    await sql`
      CREATE TABLE IF NOT EXISTS lp_sell_transactions (
        id SERIAL PRIMARY KEY,
        chain VARCHAR(10) NOT NULL,
        tx_hash VARCHAR(66) NOT NULL,
        block_number BIGINT NOT NULL,
        block_timestamp TIMESTAMP,
        seller_address VARCHAR(42) NOT NULL,
        vdnt_amount DECIMAL(30,18) NOT NULL,
        eth_amount DECIMAL(30,18) NOT NULL,
        is_direct_miner BOOLEAN DEFAULT FALSE,
        is_indirect_miner BOOLEAN DEFAULT FALSE,
        miner_address VARCHAR(42),
        trace_depth INTEGER DEFAULT 0,
        trace_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_chain_lp CHECK (chain IN ('abstract', 'base')),
        CONSTRAINT valid_tx_hash CHECK (tx_hash ~ '^0x[a-fA-F0-9]{64}$'),
        CONSTRAINT valid_seller_address CHECK (seller_address ~ '^0x[a-fA-F0-9]{40}$'),
        UNIQUE(chain, tx_hash)
      )
    `;

    // Create indexes for lp_sell_transactions
    await sql`CREATE INDEX IF NOT EXISTS idx_lp_transactions_chain ON lp_sell_transactions(chain)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_lp_transactions_block ON lp_sell_transactions(chain, block_number DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_lp_transactions_seller ON lp_sell_transactions(seller_address)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_lp_transactions_miner ON lp_sell_transactions(miner_address)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_lp_transactions_created ON lp_sell_transactions(created_at DESC)`;

    // Create lp_scan_progress table to track latest scanned blocks
    await sql`
      CREATE TABLE IF NOT EXISTS lp_scan_progress (
        id SERIAL PRIMARY KEY,
        chain VARCHAR(10) NOT NULL UNIQUE,
        last_scanned_block BIGINT DEFAULT 0,
        total_transactions INTEGER DEFAULT 0,
        last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_chain_lp_progress CHECK (chain IN ('abstract', 'base'))
      )
    `;

    // Insert initial LP scan progress records
    await sql`
      INSERT INTO lp_scan_progress (chain, last_scanned_block, total_transactions)
      VALUES ('abstract', 0, 0), ('base', 0, 0)
      ON CONFLICT (chain) DO NOTHING
    `;

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
 * Save LP sell transactions to database
 */
export async function saveLPTransactions(transactions, chain) {
  if (!transactions || transactions.length === 0) return;
  
  try {
    for (const tx of transactions) {
      await sql`
        INSERT INTO lp_sell_transactions (
          chain, tx_hash, block_number, block_timestamp, seller_address,
          vdnt_amount, eth_amount, is_direct_miner, is_indirect_miner,
          miner_address, trace_depth, trace_path
        ) VALUES (
          ${chain}, ${tx.hash}, ${tx.blockNum}, 
          ${tx.timestamp ? new Date(tx.timestamp) : null},
          ${tx.seller}, ${tx.tokenSold.amount}, ${tx.ethReceived.amount},
          ${tx.isMiner || false}, ${tx.isIndirectMiner || false},
          ${tx.minerConnection}, ${tx.traceDepth || 0},
          ${tx.tracePath ? JSON.stringify(tx.tracePath) : null}
        )
        ON CONFLICT (chain, tx_hash) DO UPDATE SET
          is_direct_miner = EXCLUDED.is_direct_miner,
          is_indirect_miner = EXCLUDED.is_indirect_miner,
          miner_address = EXCLUDED.miner_address,
          trace_depth = EXCLUDED.trace_depth,
          trace_path = EXCLUDED.trace_path,
          updated_at = CURRENT_TIMESTAMP
      `;
    }
    
    console.log(`💾 Saved ${transactions.length} LP transactions for ${chain}`);
  } catch (error) {
    console.error('Error saving LP transactions:', error);
    throw error;
  }
}

/**
 * Get LP sell transactions from database
 */
export async function getLPTransactions(chain, limit = 50, offset = 0) {
  try {
    const transactions = await sql`
      SELECT 
        tx_hash as hash,
        block_number as "blockNum",
        block_timestamp as timestamp,
        seller_address as seller,
        vdnt_amount,
        eth_amount,
        is_direct_miner as "isMiner",
        is_indirect_miner as "isIndirectMiner",
        miner_address as "minerConnection",
        trace_depth as "traceDepth",
        trace_path as "tracePath"
      FROM lp_sell_transactions
      WHERE chain = ${chain}
      ORDER BY block_number DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
    
    return transactions.map(tx => ({
      ...tx,
      tokenSold: {
        amount: tx.vdnt_amount.toString(),
        symbol: 'VDNT'
      },
      ethReceived: {
        amount: tx.eth_amount.toString(),
        symbol: chain === 'abstract' ? 'ETH' : 'VIRTUAL'
      },
      tracePath: tx.tracePath ? JSON.parse(tx.tracePath) : null,
      blocksAgo: 0 // Will be calculated in API
    }));
  } catch (error) {
    console.error('Error getting LP transactions:', error);
    throw error;
  }
}

/**
 * Update LP scan progress
 */
export async function updateLPScanProgress(chain, lastScannedBlock, transactionCount) {
  try {
    const blockNum = parseInt(lastScannedBlock);
    console.log(`📝 Updating scan progress for ${chain}: block ${blockNum}, +${transactionCount} transactions`);
    
    await sql`
      UPDATE lp_scan_progress
      SET 
        last_scanned_block = ${blockNum},
        total_transactions = total_transactions + ${parseInt(transactionCount)},
        last_updated_at = CURRENT_TIMESTAMP
      WHERE chain = ${chain}
    `;
  } catch (error) {
    console.error('Error updating LP scan progress:', error);
    throw error;
  }
}

/**
 * Get LP scan progress
 */
export async function getLPScanProgress(chain) {
  try {
    const result = await sql`
      SELECT last_scanned_block, total_transactions, last_updated_at
      FROM lp_scan_progress
      WHERE chain = ${chain}
      LIMIT 1
    `;
    
    if (result[0]) {
      const progress = {
        last_scanned_block: parseInt(result[0].last_scanned_block) || 0,
        total_transactions: parseInt(result[0].total_transactions) || 0,
        last_updated_at: result[0].last_updated_at
      };
      console.log(`📋 Retrieved scan progress for ${chain}:`, progress);
      return progress;
    }
    
    return { last_scanned_block: 0, total_transactions: 0 };
  } catch (error) {
    console.error('Error getting LP scan progress:', error);
    return { last_scanned_block: 0, total_transactions: 0 };
  }
}

/**
 * Clear all LP transaction data and reset scan progress
 */
export async function clearLPTransactionData(chain) {
  try {
    console.log(`🧹 Clearing LP transaction data for ${chain}...`);
    
    // Clear transactions
    await sql`
      DELETE FROM lp_sell_transactions
      WHERE chain = ${chain}
    `;
    
    // Reset scan progress to start from block 0
    await sql`
      UPDATE lp_scan_progress
      SET 
        last_scanned_block = 0,
        total_transactions = 0,
        last_updated_at = CURRENT_TIMESTAMP
      WHERE chain = ${chain}
    `;
    
    console.log(`✅ Cleared LP transaction data for ${chain}`);
  } catch (error) {
    console.error('Error clearing LP transaction data:', error);
    throw error;
  }
}

/**
 * Get the next block range to process (1M blocks at a time)
 */
export async function getNextBlockRange(chain) {
  try {
    const progress = await getLPScanProgress(chain);
    const startBlock = parseInt(progress.last_scanned_block || 0);
    const endBlock = startBlock + 1000000; // 1 million blocks
    
    console.log(`📊 Next block range for ${chain}: ${startBlock} -> ${endBlock} (last_scanned: ${progress.last_scanned_block})`);
    
    return {
      startBlock,
      endBlock,
      isComplete: false // We'll determine this based on actual chain height
    };
  } catch (error) {
    console.error('Error getting next block range:', error);
    return { startBlock: 0, endBlock: 1000000, isComplete: false };
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
export async function getCachedRatios(chain, limit = 1000) {
  try {
    const ratios = await sql`
      SELECT address, total_deposits, total_withdrawals, ratio, total_miners, active_miners,
             deposits_14d, withdrawals_14d, ratio_14d, ratio_14d_calculated_at, last_calculated_at
      FROM address_ratios
      WHERE chain = ${chain}
      ORDER BY ratio DESC, total_withdrawals DESC, address
      LIMIT ${limit}
    `;

    return ratios.map(row => ({
      address: row.address,
      totalDeposits: parseFloat(row.total_deposits || 0).toFixed(2),
      totalWithdrawals: parseFloat(row.total_withdrawals || 0).toFixed(2),
      ratio: parseFloat(row.ratio || 0).toFixed(4),
      totalMiners: row.total_miners || 0,
      activeMiners: row.active_miners || 0,
      deposits14d: parseFloat(row.deposits_14d || 0),
      withdrawals14d: parseFloat(row.withdrawals_14d || 0),
      ratio14d: parseFloat(row.ratio_14d || 0),
      ratio14dCalculated: row.ratio_14d_calculated_at,
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
    console.log(`💾 STORING RATIO DATA: ${address} -> deposits=${totalDeposits}, withdrawals=${totalWithdrawals}, ratio=${ratio}`);

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

    console.log(`💾 STORED RESULT: ${result[0].address} -> deposits=${result[0].total_deposits}, withdrawals=${result[0].total_withdrawals}`);

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
 * Get addresses from current filtered ratio results (addresses currently shown in UI)
 */
export async function getCurrentRatioAddresses(chain, limit = 100) {
  try {
    const addresses = await sql`
      SELECT address
      FROM address_ratios 
      WHERE chain = ${chain}
        AND (ratio > 0 OR sell_ratio > 0)
        AND active_miners > 0
        AND (total_deposits > 0 OR total_withdrawals > 0 OR total_sells > 0)
      ORDER BY ratio DESC, total_withdrawals DESC
      LIMIT ${limit}
    `;
    
    return addresses.map(row => row.address);
  } catch (error) {
    console.error('❌ Failed to get current ratio addresses:', error);
    throw error;
  }
}

/**
 * Get all addresses with active miners for a chain
 * Uses both miner_addresses and address_ratios to get the most accurate count
 */
export async function getAllAddressesWithActiveMiners(chain) {
  try {
    const addresses = await sql`
      SELECT DISTINCT ma.address, ma.last_updated_at
      FROM miner_addresses ma
      LEFT JOIN address_ratios ar ON ma.address = ar.address AND ma.chain = ar.chain
      WHERE ma.chain = ${chain}
        AND ma.is_active = true
        AND (
          (ar.active_miners IS NOT NULL AND ar.active_miners > 0) OR
          (ar.active_miners IS NULL AND ma.active_miners > 0)
        )
      ORDER BY ma.last_updated_at DESC
    `;

    return addresses.map(row => row.address);
  } catch (error) {
    console.error('❌ Failed to get addresses with active miners:', error);
    throw error;
  }
}

/**
 * Get all addresses with any miners for a chain (active or inactive)
 */
export async function getAllAddressesWithAnyMiners(chain) {
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
    console.error('❌ Failed to get all addresses with any miners:', error);
    throw error;
  }
}

/**
 * Get sell data for a miner address (direct and indirect sells)
 */
export async function getMinerSellData(chain, minerAddress) {
  try {
    console.log(`🔍 Getting sell data for miner owner ${minerAddress} on ${chain}`);
    
    // The key insight: we need to find ALL sell transactions that are connected to miners owned by this address
    // This means we need to look at all transactions where the miner_address field points to this address
    // OR where this address directly sold tokens
    
    const result = await sql`
      SELECT 
        SUM(vdnt_amount) as total_sells,
        COUNT(*) as total_transactions,
        COUNT(*) FILTER (WHERE LOWER(seller_address) = LOWER(${minerAddress})) as direct_sales,
        COUNT(*) FILTER (WHERE LOWER(miner_address) = LOWER(${minerAddress})) as traced_to_miner
      FROM lp_sell_transactions
      WHERE chain = ${chain}
        AND (
          LOWER(seller_address) = LOWER(${minerAddress}) OR
          LOWER(miner_address) = LOWER(${minerAddress})
        )
    `;
    
    console.log(`   💰 Sell data for miner owner ${minerAddress}:`, result[0]);
    
    if (result.length > 0 && result[0]) {
      const sellData = {
        directSells: 0, // We'll calculate this differently if needed
        indirectSells: 0, // We'll calculate this differently if needed  
        totalSells: parseFloat(result[0].total_sells || 0),
        totalTransactions: parseInt(result[0].total_transactions || 0),
        directSales: parseInt(result[0].direct_sales || 0),
        tracedToMiner: parseInt(result[0].traced_to_miner || 0)
      };
      
      console.log(`   ✅ Processed sell data:`, sellData);
      return sellData;
    }
    
    return {
      directSells: 0,
      indirectSells: 0,
      totalSells: 0,
      totalTransactions: 0,
      directSales: 0,
      tracedToMiner: 0
    };
    
  } catch (error) {
    console.error('❌ Failed to get miner sell data:', error);
    return {
      directSells: 0,
      indirectSells: 0,
      totalSells: 0,
      totalTransactions: 0,
      directSales: 0,
      tracedToMiner: 0
    };
  }
}

/**
 * Debug function to check LP transaction data
 */
export async function debugLPTransactionData(chain) {
  try {
    const stats = await sql`
      SELECT 
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE is_direct_miner = true) as direct_miners,
        COUNT(*) FILTER (WHERE is_indirect_miner = true) as indirect_miners,
        COUNT(*) FILTER (WHERE miner_address IS NOT NULL) as has_miner_address,
        MIN(block_number) as min_block,
        MAX(block_number) as max_block,
        SUM(vdnt_amount) as total_vdnt_sold
      FROM lp_sell_transactions
      WHERE chain = ${chain}
    `;
    
    const sampleTxs = await sql`
      SELECT seller_address, is_direct_miner, is_indirect_miner, miner_address, vdnt_amount
      FROM lp_sell_transactions
      WHERE chain = ${chain}
      LIMIT 5
    `;
    
    // Get some addresses from miner_addresses table to compare
    const minerOwners = await sql`
      SELECT address
      FROM miner_addresses
      WHERE chain = ${chain} AND is_active = true
      LIMIT 5
    `;
    
    console.log(`📊 LP Transaction Debug for ${chain}:`, {
      stats: stats[0],
      samples: sampleTxs,
      minerOwners: minerOwners.map(r => r.address)
    });
    
    return { stats: stats[0], samples: sampleTxs, minerOwners: minerOwners.map(r => r.address) };
  } catch (error) {
    console.error('❌ Failed to debug LP transaction data:', error);
    return null;
  }
}

/**
 * Get 14-day bloom/refinement data for an address
 */
async function get14DayData(address, chain) {
  try {
    const alchemyApiKey = process.env.ALCHEMY_API_KEY_BASE;
    const minerContractAddress = process.env.MINER_CONTRACT_BASE;
    const alchemyUrl = `https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;

    // Calculate timestamp for 14 days ago
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const fourteenDaysAgo = currentTimestamp - (14 * 24 * 60 * 60);

    // Get transactions FROM the address TO the miner contract
    const response = await fetch(alchemyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'alchemy_getAssetTransfers',
        params: [{
          fromAddress: address,
          toAddress: minerContractAddress,
          category: ['external'],
          withMetadata: true,
          excludeZeroValue: false,
          maxCount: '0x3e8', // 1000 in hex
          order: 'desc'
        }]
      })
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message);
    }

    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(alchemyUrl);

    // Function signatures
    const PURCHASE_BLOOM_SIGNATURE = '0xb947e924';
    const CLAIM_REFINEMENT_SIGNATURE = '0x79bdb19a';

    // Event topics
    const purchaseBloomTopic = '0xe23a5f8390716f10c4e92f3d40fb979c90bae202d8c4a2734ac0be6904d3fb1a';
    const refinementCollectedTopic = '0xa2d771c2d4b15215eb766bc2c8baaeb7d636af874d2e1f1296e418f75f0e58c8';

    let totalVerdantSpent = 0;
    let totalVerdantClaimed = 0;

    for (const transfer of data.result.transfers) {
      const txTimestamp = new Date(transfer.metadata.blockTimestamp).getTime() / 1000;

      // Skip if older than 14 days
      if (txTimestamp < fourteenDaysAgo) continue;

      try {
        const tx = await provider.getTransaction(transfer.hash);
        if (!tx || !tx.data) continue;

        const receipt = await provider.getTransactionReceipt(transfer.hash);
        if (!receipt) continue;

        // Check for bloom purchases
        if (tx.data.toLowerCase().startsWith(PURCHASE_BLOOM_SIGNATURE.toLowerCase())) {
          for (const log of receipt.logs) {
            if (log.topics[0] === purchaseBloomTopic &&
                log.topics[1] === ethers.zeroPadValue(address.toLowerCase(), 32)) {
              const verdantAmount = ethers.getBigInt(log.data.slice(0, 66));
              totalVerdantSpent += parseFloat(ethers.formatEther(verdantAmount));
              break;
            }
          }
        }

        // Check for refinement claims
        if (tx.data.toLowerCase().startsWith(CLAIM_REFINEMENT_SIGNATURE.toLowerCase())) {
          for (const log of receipt.logs) {
            if (log.topics[0] === refinementCollectedTopic &&
                log.topics[1] === ethers.zeroPadValue(address.toLowerCase(), 32)) {
              const verdantAmount = ethers.getBigInt(log.data.slice(0, 66));
              totalVerdantClaimed += parseFloat(ethers.formatEther(verdantAmount));
              break;
            }
          }
        }
      } catch (txError) {
        console.warn(`⚠️ Error processing transaction ${transfer.hash}:`, txError.message);
        continue;
      }
    }

    return {
      verdantSpent: totalVerdantSpent,
      verdantClaimed: totalVerdantClaimed
    };
  } catch (error) {
    console.error('❌ Failed to get 14-day data for', address, ':', error);
    return {
      verdantSpent: 0,
      verdantClaimed: 0
    };
  }
}

/**
 * Refresh 14-day ratios for addresses with active miners
 */
export async function refreshAddresses14DayRatios() {
  try {
    console.log('🔄 Starting 14-day ratio refresh for addresses with active miners...');

    // Get addresses with active miners
    const activeAddresses = await sql`
      SELECT address, chain, active_miners
      FROM address_ratios
      WHERE active_miners > 0 AND chain = 'base'
      ORDER BY active_miners DESC
    `;

    console.log(`📊 Found ${activeAddresses.length} addresses with active miners to process`);

    let updatedCount = 0;
    const batchSize = 5; // Process in smaller batches to avoid rate limits

    for (let i = 0; i < activeAddresses.length; i += batchSize) {
      const batch = activeAddresses.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(activeAddresses.length/batchSize)} (${batch.length} addresses)`);

      const batchPromises = batch.map(async (addressRecord) => {
        try {
          console.log(`   📊 Calculating 14-day ratio for ${addressRecord.address} (${addressRecord.active_miners} active miners)...`);

          const { verdantSpent, verdantClaimed } = await get14DayData(addressRecord.address, addressRecord.chain);

          // Calculate 14-day ratio
          let ratio14d = 0;
          if (verdantSpent > 0) {
            ratio14d = verdantClaimed / verdantSpent;
          } else if (verdantClaimed > 0) {
            ratio14d = 999; // Set to high value for infinite ratio display
          }

          // Update database
          await sql`
            UPDATE address_ratios
            SET
              deposits_14d = ${verdantSpent},
              withdrawals_14d = ${verdantClaimed},
              ratio_14d = ${ratio14d},
              ratio_14d_calculated_at = CURRENT_TIMESTAMP
            WHERE address = ${addressRecord.address} AND chain = ${addressRecord.chain}
          `;

          console.log(`   ✅ Updated ${addressRecord.address}: spent=${verdantSpent.toFixed(4)}, claimed=${verdantClaimed.toFixed(4)}, ratio=${ratio14d.toFixed(4)}`);
          return true;
        } catch (error) {
          console.error(`   ❌ Failed to update 14-day ratio for ${addressRecord.address}:`, error);
          return false;
        }
      });

      const results = await Promise.all(batchPromises);
      updatedCount += results.filter(Boolean).length;

      // Small delay between batches to be respectful to rate limits
      if (i + batchSize < activeAddresses.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`✅ 14-day ratio refresh completed. Updated ${updatedCount}/${activeAddresses.length} addresses`);

    return {
      success: true,
      updatedCount,
      totalProcessed: activeAddresses.length
    };
  } catch (error) {
    console.error('❌ Failed to refresh 14-day ratios:', error);
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