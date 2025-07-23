// Quick test to check sell data
import { config } from 'dotenv';
config();

import { debugLPTransactionData, getMinerSellData } from './lib/database/operations.js';

async function test() {
  try {
    console.log('Testing sell data for base chain...');
    
    const debug = await debugLPTransactionData('base');
    console.log('Debug result:', debug);
    
    if (debug && debug.minerOwners && debug.minerOwners.length > 0) {
      console.log('\nTesting with first miner owner:', debug.minerOwners[0]);
      const sellData = await getMinerSellData('base', debug.minerOwners[0]);
      console.log('Sell data:', sellData);
    }
  } catch (error) {
    console.error('Test error:', error);
  }
  
  process.exit(0);
}

test();