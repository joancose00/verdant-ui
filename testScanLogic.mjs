#!/usr/bin/env node

function testScanLogic() {
    console.log('🧪 Testing scan logic...');
    
    const startMinerId = 0;
    const maxMiners = 100;
    const batchSize = 5;
    const totalMiners = 1056;
    
    console.log(`📋 Input parameters:`);
    console.log(`   startMinerId: ${startMinerId}`);
    console.log(`   maxMiners: ${maxMiners}`);
    console.log(`   batchSize: ${batchSize}`);
    console.log(`   totalMiners: ${totalMiners}`);
    
    const actualStart = startMinerId + 1;
    const scanEnd = actualStart + maxMiners - 1;
    const scanLimit = Math.min(scanEnd, totalMiners);
    
    console.log(`\n🎯 Scan range calculation:`);
    console.log(`   actualStart: ${actualStart}`);
    console.log(`   scanEnd: ${scanEnd}`);
    console.log(`   totalMiners: ${totalMiners}`);
    console.log(`   scanLimit: ${scanLimit}`);
    
    const minersToScan = scanLimit - actualStart + 1;
    const batches = Math.ceil(minersToScan / batchSize);
    
    console.log(`\n📊 Batch calculation:`);
    console.log(`   minersToScan: ${minersToScan}`);
    console.log(`   batchSize: ${batchSize}`);
    console.log(`   batches: ${batches}`);
    
    console.log(`\n⚡ First few batches:`);
    for (let batch = 0; batch < Math.min(5, batches); batch++) {
        const batchStart = actualStart + (batch * batchSize);
        const batchEnd = Math.min(batchStart + batchSize - 1, scanLimit);
        console.log(`   Batch ${batch + 1}/${batches}: miners ${batchStart}-${batchEnd}`);
    }
}

testScanLogic();