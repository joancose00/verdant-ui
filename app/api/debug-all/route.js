import { ethers } from 'ethers';
import sql from '../../../lib/database/connection.js';

export async function GET() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: {},
    database: {},
    blockchain: {},
    apiTests: {}
  };

  try {
    // Environment Check
    diagnostics.environment = {
      nodeEnv: process.env.NODE_ENV,
      hasVercelUrl: !!process.env.VERCEL_URL,
      hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      databaseUrlLength: process.env.DATABASE_URL?.length || 0,
      
      // RPC URLs
      hasAbsRpc: !!process.env.RPC_URL_ABS,
      hasBaseRpc: !!process.env.RPC_URL_BASE,
      absRpcUrl: process.env.RPC_URL_ABS || 'MISSING',
      baseRpcUrl: process.env.RPC_URL_BASE || 'MISSING',
      
      // Contract addresses
      hasAbsStorage: !!process.env.STORAGE_CONTRACT_ABS,
      hasBaseStorage: !!process.env.STORAGE_CONTRACT_BASE,
      hasAbsMiner: !!process.env.MINER_CONTRACT_ABS,
      hasBaseMiner: !!process.env.MINER_CONTRACT_BASE,
      
      absStorageContract: process.env.STORAGE_CONTRACT_ABS || 'MISSING',
      baseStorageContract: process.env.STORAGE_CONTRACT_BASE || 'MISSING',
      absMinerContract: process.env.MINER_CONTRACT_ABS || 'MISSING',
      baseMinerContract: process.env.MINER_CONTRACT_BASE || 'MISSING'
    };

    // Database Check
    try {
      const dbTest = await sql`SELECT NOW() as current_time, version() as pg_version`;
      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `;
      
      const addressCounts = await sql`
        SELECT chain, COUNT(*) as count, MAX(last_updated_at) as last_update
        FROM miner_addresses 
        GROUP BY chain
      `;
      
      diagnostics.database = {
        connected: true,
        currentTime: dbTest[0].current_time,
        version: dbTest[0].pg_version,
        tables: tables.map(t => t.table_name),
        addressCounts: addressCounts.reduce((acc, row) => {
          acc[row.chain] = {
            count: parseInt(row.count),
            lastUpdate: row.last_update
          };
          return acc;
        }, {})
      };
    } catch (dbError) {
      diagnostics.database = {
        connected: false,
        error: dbError.message
      };
    }

    // Blockchain Connection Tests
    for (const chain of ['abstract', 'base']) {
      const isBase = chain === 'base';
      const rpcUrl = isBase ? process.env.RPC_URL_BASE : process.env.RPC_URL_ABS;
      const storageContract = isBase ? process.env.STORAGE_CONTRACT_BASE : process.env.STORAGE_CONTRACT_ABS;
      const minerContract = isBase ? process.env.MINER_CONTRACT_BASE : process.env.MINER_CONTRACT_ABS;
      
      diagnostics.blockchain[chain] = {
        rpcUrl,
        storageContract,
        minerContract,
        rpcTest: null,
        contractTest: null
      };

      if (rpcUrl) {
        try {
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const blockNumber = await provider.getBlockNumber();
          diagnostics.blockchain[chain].rpcTest = {
            success: true,
            blockNumber,
            network: await provider.getNetwork()
          };

          // Test storage contract
          if (storageContract) {
            try {
              const storageAbi = ['function nextMinerId() view returns (uint256)'];
              const storage = new ethers.Contract(storageContract, storageAbi, provider);
              const nextMinerId = await storage.nextMinerId();
              
              diagnostics.blockchain[chain].contractTest = {
                success: true,
                nextMinerId: nextMinerId.toString(),
                totalMiners: (Number(nextMinerId) - 1).toString()
              };
            } catch (contractError) {
              diagnostics.blockchain[chain].contractTest = {
                success: false,
                error: contractError.message
              };
            }
          }
        } catch (rpcError) {
          diagnostics.blockchain[chain].rpcTest = {
            success: false,
            error: rpcError.message
          };
        }
      }
    }

    // API Endpoint Tests
    const baseUrl = getBaseUrl();
    
    // Test address-metrics API
    try {
      const testAddress = '0x742d35Cc6634C0532925a3b8D8C3e6f4F2c7C7';
      const response = await fetch(`${baseUrl}/api/address-metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chain: 'abstract', address: testAddress })
      });
      
      const data = await response.json();
      diagnostics.apiTests.addressMetrics = {
        success: response.ok,
        status: response.status,
        data: response.ok ? data : null,
        error: !response.ok ? data.error : null
      };
    } catch (apiError) {
      diagnostics.apiTests.addressMetrics = {
        success: false,
        error: apiError.message
      };
    }

    // Test miner-stats API
    try {
      const testAddress = '0x742d35Cc6634C0532925a3b8D8C3e6f4F2c7C7';
      const response = await fetch(`${baseUrl}/api/miner-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chain: 'abstract', address: testAddress })
      });
      
      const data = await response.json();
      diagnostics.apiTests.minerStats = {
        success: response.ok,
        status: response.status,
        data: response.ok ? data : null,
        error: !response.ok ? data.error : null
      };
    } catch (apiError) {
      diagnostics.apiTests.minerStats = {
        success: false,
        error: apiError.message
      };
    }

    return Response.json({
      success: true,
      diagnostics
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error.message,
      diagnostics
    }, { status: 500 });
  }
}

function getBaseUrl() {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }
  return 'http://localhost:3000';
}