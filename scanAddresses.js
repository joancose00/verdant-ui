#!/usr/bin/env node

const { scanForMinerAddresses } = require('./utils/addressScanner.js');

async function main() {
    const args = process.argv.slice(2);
    
    // Parse arguments
    let chain = 'abstract';
    let maxMiners = 100; // Start small for testing
    
    if (args.length > 0) {
        chain = args[0];
    }
    if (args.length > 1) {
        maxMiners = parseInt(args[1]) || 100;
    }
    
    console.log(`🚀 Starting address scan...`);
    console.log(`📡 Chain: ${chain}`);
    console.log(`📊 Max miners to scan: ${maxMiners}`);
    console.log(`⏱️  This may take a few moments...\n`);
    
    try {
        const startTime = Date.now();
        const addresses = await scanForMinerAddresses(chain, 50, maxMiners);
        const endTime = Date.now();
        
        console.log(`\n✅ Scan completed in ${(endTime - startTime) / 1000}s`);
        console.log(`\n📋 Found ${addresses.length} unique addresses with miners:`);
        console.log('=' .repeat(50));
        
        addresses.forEach((address, index) => {
            console.log(`${String(index + 1).padStart(3, ' ')}. ${address}`);
        });
        
        if (addresses.length > 0) {
            console.log('\n💡 You can now use these addresses to query miner stats in your UI!');
            console.log('💡 Example usage in your app:');
            console.log(`   - Query miner stats: POST /api/miner-stats { "address": "${addresses[0]}", "chain": "${chain}" }`);
            console.log(`   - Query address metrics: POST /api/address-metrics { "address": "${addresses[0]}", "chain": "${chain}" }`);
        }
        
    } catch (error) {
        console.error('❌ Scan failed:', error.message);
        process.exit(1);
    }
}

// Show usage if no arguments or help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
📖 Usage: node scanAddresses.js [chain] [maxMiners]

Parameters:
  chain      Chain to scan ('abstract' or 'base') - default: abstract  
  maxMiners  Maximum number of miners to scan (1-10000) - default: 100

Examples:
  node scanAddresses.js                    # Scan first 100 miners on abstract
  node scanAddresses.js base               # Scan first 100 miners on base  
  node scanAddresses.js abstract 500       # Scan first 500 miners on abstract
  node scanAddresses.js base 1000          # Scan first 1000 miners on base

💡 Tip: Start with a small number (100-500) to test, then increase if needed.
    `);
    process.exit(0);
}

main();