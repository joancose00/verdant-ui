'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// Miner type color themes
const MINER_COLORS = {
  'Starter': { bg: '#065f46', border: '#10b981', text: '#10b981' },   // Green
  'Basic': { bg: '#134e4a', border: '#14b8a6', text: '#14b8a6' },     // Teal
  'Advanced': { bg: '#581c87', border: '#a855f7', text: '#a855f7' },  // Purple
  'Elite': { bg: '#7c2d12', border: '#f97316', text: '#f97316' }      // Orange
};

export default function WalletQueryInterface({ chain, prefilledAddress }) {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [minerStats, setMinerStats] = useState(null);
  const [addressMetrics, setAddressMetrics] = useState(null);
  const [error, setError] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [sortBy, setSortBy] = useState('number');

  // Update address when prefilledAddress changes
  useEffect(() => {
    if (prefilledAddress && prefilledAddress !== address) {
      setAddress(prefilledAddress);
    }
  }, [prefilledAddress]);

  const handleQuery = async () => {
    setError('');
    setMinerStats(null);
    setAddressMetrics(null);

    // Validate address
    if (!ethers.isAddress(address)) {
      setError('Invalid Ethereum address');
      return;
    }

    setLoading(true);

    try {
      // Fetch both miner stats and address metrics
      const [minerResponse, metricsResponse] = await Promise.all([
        fetch('/api/miner-stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, chain })
        }),
        fetch('/api/address-metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, chain })
        })
      ]);

      const minerData = await minerResponse.json();
      const metricsData = await metricsResponse.json();

      if (minerData.error) throw new Error(minerData.error);
      if (metricsData.error) throw new Error(metricsData.error);

      setMinerStats(minerData);
      setAddressMetrics(metricsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ 
        background: '#1a1a1a', 
        padding: '30px', 
        borderRadius: '12px', 
        border: '1px solid #333',
        marginBottom: '30px'
      }}>
        <h2 style={{ marginTop: 0, color: '#ffffff' }}>Query Wallet</h2>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Enter wallet address (0x...)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={{
              flex: 1,
              padding: '12px',
              border: '2px solid #333',
              borderRadius: '6px',
              fontSize: '16px',
              background: '#262626',
              color: '#ffffff'
            }}
          />
          <button
            onClick={handleQuery}
            disabled={loading || !address}
            style={{
              padding: '12px 30px',
              background: loading ? '#404040' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: loading || !address ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Querying...' : 'Query'}
          </button>
        </div>

        {error && (
          <div style={{ 
            background: '#7f1d1d', 
            color: '#fca5a5', 
            padding: '12px', 
            borderRadius: '6px',
            marginBottom: '20px'
          }}>
            Error: {error}
          </div>
        )}
      </div>

      {addressMetrics && (
        <div style={{ 
          background: '#1a1a1a', 
          padding: '30px', 
          borderRadius: '12px',
          border: '1px solid #333',
          marginBottom: '30px'
        }}>
          <h2 style={{ color: '#ffffff' }}>Address Metrics</h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)', 
            gap: '20px',
            marginTop: '20px'
          }}>
            <div style={{ 
              padding: '25px', 
              background: '#1e3a8a', 
              borderRadius: '12px',
              textAlign: 'center',
              border: '1px solid #3b82f6'
            }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#93bbfc', fontSize: '16px' }}>Deposits</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#ffffff' }}>
                {addressMetrics.deposits}
              </p>
            </div>
            <div style={{ 
              padding: '25px', 
              background: '#064e3b', 
              borderRadius: '12px',
              textAlign: 'center',
              border: '1px solid #10b981'
            }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#6ee7b7', fontSize: '16px' }}>Withdrawals</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#ffffff' }}>
                {addressMetrics.withdrawals}
              </p>
            </div>
            <div style={{ 
              padding: '25px', 
              background: '#7c2d12', 
              borderRadius: '12px',
              textAlign: 'center',
              border: '1px solid #f97316'
            }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#fed7aa', fontSize: '16px' }}>Ratio</h3>
              <p style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, color: '#ffffff' }}>
                {addressMetrics.ratio}
              </p>
            </div>
          </div>
        </div>
      )}

      {minerStats && (
        <div style={{ 
          background: '#1a1a1a', 
          padding: '30px', 
          borderRadius: '12px', 
          border: '1px solid #333',
          marginBottom: '30px'
        }}>
          <h2 style={{ color: '#ffffff' }}>Miner Stats</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px' }}>
            <div style={{ background: '#262626', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
              <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>Total Miners</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '28px', fontWeight: 'bold' }}>{minerStats.totalMiners}</p>
            </div>
            <div style={{ background: '#262626', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
              <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>Active Miners</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>{minerStats.activeMiners}</p>
            </div>
            <div style={{ background: '#262626', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
              <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>Total Pending Rewards</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '20px', fontWeight: 'bold', color: '#fbbf24' }}>{minerStats.totalPendingRewards} VERDITE</p>
            </div>
          </div>
          
          {minerStats.miners && minerStats.miners.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                <h3 style={{ color: '#ffffff', margin: 0 }}>
                  Individual Miners 
                  <span style={{ color: '#a3a3a3', fontWeight: 'normal', fontSize: '16px', marginLeft: '10px' }}>
                    ({minerStats.miners.filter(miner => !showActiveOnly || miner.active).length})
                  </span>
                </h3>
                
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ color: '#a3a3a3', fontSize: '14px' }}>Show:</label>
                    <button
                      onClick={() => setShowActiveOnly(!showActiveOnly)}
                      style={{
                        padding: '6px 16px',
                        border: '1px solid #333',
                        borderRadius: '6px',
                        background: showActiveOnly ? '#10b981' : '#262626',
                        color: '#ffffff',
                        fontSize: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {showActiveOnly ? 'Active Only' : 'All Miners'}
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ color: '#a3a3a3', fontSize: '14px' }}>Sort by:</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      style={{
                        padding: '6px 12px',
                        border: '1px solid #333',
                        borderRadius: '6px',
                        background: '#262626',
                        color: '#ffffff',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="number">Miner Number</option>
                      <option value="type">Type</option>
                      <option value="rewards">Pending Rewards</option>
                      <option value="grace">Grace Period</option>
                      <option value="status">Status</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                gap: '16px' 
              }}>
                {minerStats.miners
                  .map((miner, index) => ({ ...miner, originalIndex: index }))
                  .filter(miner => !showActiveOnly || miner.active)
                  .sort((a, b) => {
                    switch (sortBy) {
                      case 'number':
                        return a.originalIndex - b.originalIndex;
                      case 'type':
                        return a.type - b.type;
                      case 'rewards':
                        return parseFloat(b.pendingRewards) - parseFloat(a.pendingRewards);
                      case 'grace':
                        // Sort by grace period (active grace periods first)
                        if (a.isInGracePeriod && !b.isInGracePeriod) return -1;
                        if (!a.isInGracePeriod && b.isInGracePeriod) return 1;
                        if (a.isInGracePeriod && b.isInGracePeriod) {
                          return new Date(a.gracePeriodEnd) - new Date(b.gracePeriodEnd);
                        }
                        return 0;
                      case 'status':
                        if (a.active && !b.active) return -1;
                        if (!a.active && b.active) return 1;
                        return 0;
                      default:
                        return 0;
                    }
                  })
                  .map((miner) => {
                    const index = miner.originalIndex;
                    const colors = MINER_COLORS[miner.typeName] || MINER_COLORS['Starter'];
                    return (
                      <div key={miner.id} style={{ 
                      border: `2px solid ${colors.border}`, 
                      padding: '16px', 
                      borderRadius: '10px',
                      background: colors.bg
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ margin: 0, color: '#ffffff', fontSize: '16px' }}>#{index + 1}</h4>
                        <span style={{ 
                          padding: '4px 10px', 
                          borderRadius: '16px', 
                          background: colors.border, 
                          color: '#000000',
                          fontWeight: 'bold',
                          fontSize: '12px'
                        }}>
                          {miner.typeName}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#e5e5e5', fontSize: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#a3a3a3' }}>ID:</span>
                          <span>{miner.id}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#a3a3a3' }}>Status:</span>
                          <span style={{ color: miner.active ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                            {miner.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#a3a3a3' }}>Lives/Shields:</span>
                          <span>{miner.lives}/{miner.shields}</span>
                        </div>
                        {miner.isInGracePeriod && (
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            padding: '6px 8px',
                            background: 'rgba(239, 68, 68, 0.2)',
                            borderRadius: '6px',
                            border: '1px solid #ef4444'
                          }}>
                            <span style={{ color: '#fca5a5', fontSize: '12px' }}>Grace Period:</span>
                            <span style={{ color: '#fca5a5', fontSize: '12px', fontWeight: 'bold' }}>
                              {new Date(miner.gracePeriodEnd).toLocaleString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        )}
                        <div style={{ 
                          borderTop: '1px solid rgba(255,255,255,0.1)', 
                          paddingTop: '8px', 
                          marginTop: '4px',
                          display: 'flex',
                          justifyContent: 'space-between'
                        }}>
                          <span style={{ color: '#a3a3a3' }}>Rewards:</span>
                          <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>
                            {miner.pendingRewards}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}