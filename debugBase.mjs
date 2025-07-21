#!/usr/bin/env node

import 'dotenv/config';
import { ethers } from 'ethers';

const STORAGE_CORE_ABI = [
    "function nextMinerId() view returns (uint256)",
    "function miners(uint256 minerId) view returns (tuple(address owner, uint8 minerType, uint8 lives, uint8 shields, uint64 lastMaintenance, uint64 lastReward, uint64 gracePeriodEnd))"
];

async function debugBase() {
    console.log('🔍 Debugging Base network...');
    
    const rpcUrl = process.env.RPC_URL_BASE;
    const storageAddress = process.env.STORAGE_CONTRACT_BASE;
    
    console.log(`📡 RPC URL: ${rpcUrl}`);
    console.log(`📋 Contract: ${storageAddress}`);
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const storageCore = new ethers.Contract(storageAddress, STORAGE_CORE_ABI, provider);
    
    try {
        // Get total miners
        const nextMinerId = await storageCore.nextMinerId();
        const totalMiners = Number(nextMinerId) - 1;
        
        console.log(`📊 nextMinerId: ${nextMinerId}`);
        console.log(`📊 totalMiners: ${totalMiners}`);
        
        // Test scanning logic
        const startMinerId = 0;
        const maxMiners = 100;
        const actualStart = startMinerId + 1;
        const scanEnd = actualStart + maxMiners - 1;
        const scanLimit = Math.min(scanEnd, totalMiners);
        
        console.log(`\n🎯 Scan calculation:`);
        console.log(`   startMinerId: ${startMinerId}`);
        console.log(`   maxMiners: ${maxMiners}`);
        console.log(`   actualStart: ${actualStart}`);
        console.log(`   scanEnd: ${scanEnd}`);
        console.log(`   scanLimit: ${scanLimit}`);
        console.log(`   miners to scan: ${scanLimit - actualStart + 1}`);
        
        // Test a few miners
        console.log(`\n🔍 Testing first few miners:`);
        for (let i = 1; i <= 5; i++) {
            try {
                const miner = await storageCore.miners(i);
                console.log(`   Miner ${i}: owner=${miner.owner}, type=${miner.minerType}`);
            } catch (error) {
                console.log(`   Miner ${i}: ERROR - ${error.message.substring(0, 50)}...`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

debugBase();