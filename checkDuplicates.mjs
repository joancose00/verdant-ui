#!/usr/bin/env node

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const sql = neon(process.env.DATABASE_URL);

async function checkDuplicates() {
  console.log('🔍 Checking for duplicate addresses in the database...\n');
  
  try {
    // First, get total count for each chain
    const chainCounts = await sql`
      SELECT chain, COUNT(*) as total_addresses
      FROM miner_addresses
      GROUP BY chain
      ORDER BY chain
    `;
    
    console.log('📊 Total addresses by chain:');
    chainCounts.forEach(row => {
      console.log(`   - ${row.chain}: ${row.total_addresses} addresses`);
    });
    console.log('');
    
    // Check for duplicates within each chain
    const duplicatesPerChain = await sql`
      SELECT chain, address, COUNT(*) as occurrences
      FROM miner_addresses
      GROUP BY chain, address
      HAVING COUNT(*) > 1
      ORDER BY chain, occurrences DESC
    `;
    
    if (duplicatesPerChain.length === 0) {
      console.log('✅ No duplicate addresses found within the same chain!\n');
    } else {
      console.log('❌ Found duplicate addresses within chains:');
      duplicatesPerChain.forEach(dup => {
        console.log(`   - Chain: ${dup.chain}, Address: ${dup.address}, Occurrences: ${dup.occurrences}`);
      });
      console.log('');
    }
    
    // Check for addresses that appear on both chains (this is allowed)
    const crossChainAddresses = await sql`
      SELECT address, array_agg(chain ORDER BY chain) as chains, COUNT(*) as chain_count
      FROM miner_addresses
      GROUP BY address
      HAVING COUNT(DISTINCT chain) > 1
      ORDER BY chain_count DESC
      LIMIT 10
    `;
    
    if (crossChainAddresses.length > 0) {
      console.log(`📋 Addresses that appear on both chains (this is allowed):`);
      console.log(`   Found ${crossChainAddresses.length} addresses on multiple chains`);
      console.log(`   Showing first 10:`);
      crossChainAddresses.forEach((addr, index) => {
        console.log(`   ${index + 1}. ${addr.address} - Chains: ${addr.chains.join(', ')}`);
      });
      console.log('');
    }
    
    // Get unique count for Base specifically
    const baseUniqueCount = await sql`
      SELECT COUNT(DISTINCT address) as unique_addresses
      FROM miner_addresses
      WHERE chain = 'base'
    `;
    
    const baseActualCount = await sql`
      SELECT COUNT(*) as total_rows
      FROM miner_addresses
      WHERE chain = 'base'
    `;
    
    console.log('🔎 Base chain verification:');
    console.log(`   - Total rows in database: ${baseActualCount[0].total_rows}`);
    console.log(`   - Unique addresses: ${baseUniqueCount[0].unique_addresses}`);
    
    if (baseActualCount[0].total_rows !== baseUniqueCount[0].unique_addresses) {
      console.log(`   ❌ MISMATCH! There are ${baseActualCount[0].total_rows - baseUniqueCount[0].unique_addresses} duplicate entries!`);
      
      // Find the specific duplicates
      const baseDuplicates = await sql`
        SELECT address, COUNT(*) as occurrences
        FROM miner_addresses
        WHERE chain = 'base'
        GROUP BY address
        HAVING COUNT(*) > 1
        ORDER BY occurrences DESC
      `;
      
      console.log(`\n   Duplicate addresses on Base:`);
      baseDuplicates.forEach(dup => {
        console.log(`   - ${dup.address}: appears ${dup.occurrences} times`);
      });
    } else {
      console.log(`   ✅ All ${baseActualCount[0].total_rows} addresses are unique!`);
    }
    
    // Sample some Base addresses to verify they look correct
    console.log('\n📝 Sample of Base addresses (first 5):');
    const sampleAddresses = await sql`
      SELECT address, first_discovered_at, total_miners, active_miners
      FROM miner_addresses
      WHERE chain = 'base'
      ORDER BY first_discovered_at
      LIMIT 5
    `;
    
    sampleAddresses.forEach((addr, index) => {
      console.log(`   ${index + 1}. ${addr.address}`);
      console.log(`      - Discovered: ${new Date(addr.first_discovered_at).toLocaleString()}`);
      console.log(`      - Miners: ${addr.total_miners} total, ${addr.active_miners} active`);
    });
    
  } catch (error) {
    console.error('❌ Error checking duplicates:', error);
    process.exit(1);
  }
}

// Run the check
checkDuplicates();