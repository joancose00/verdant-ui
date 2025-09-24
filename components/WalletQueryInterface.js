'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { formatNumber, formatRatio } from '../utils/formatters';

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
  const [bloomHistory, setBloomHistory] = useState(null);
  const [refinementClaims, setRefinementClaims] = useState(null);
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
    setBloomHistory(null);
    setRefinementClaims(null);

    // Validate address
    if (!ethers.isAddress(address)) {
      setError('Invalid Ethereum address');
      return;
    }

    setLoading(true);

    try {
      // Fetch miner stats, address metrics, bloom history, and refinement claims
      const [minerResponse, metricsResponse, bloomResponse, claimsResponse] = await Promise.all([
        fetch('/api/miner-stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, chain })
        }),
        fetch('/api/address-metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, chain })
        }),
        fetch('/api/bloom-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, chain })
        }),
        fetch('/api/refinement-claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, chain })
        })
      ]);

      const minerData = await minerResponse.json();
      const metricsData = await metricsResponse.json();
      const bloomData = await bloomResponse.json();
      const claimsData = await claimsResponse.json();

      if (minerData.error) throw new Error(minerData.error);
      if (metricsData.error) throw new Error(metricsData.error);
      if (bloomData.error) console.warn('Bloom history failed:', bloomData.error);
      if (claimsData.error) console.warn('Refinement claims failed:', claimsData.error);

      setMinerStats(minerData);
      setAddressMetrics(metricsData);
      setBloomHistory(bloomData.error ? null : bloomData);
      setRefinementClaims(claimsData.error ? null : claimsData);
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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
                {formatNumber(addressMetrics.deposits)}
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
                {formatNumber(addressMetrics.withdrawals)}
              </p>
            </div>
            <div style={{
              padding: '25px',
              background: '#7c2d12',
              borderRadius: '12px',
              textAlign: 'center',
              border: '1px solid #f97316'
            }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#fed7aa', fontSize: '16px' }}>All-Time Ratio</h3>
              <p style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, color: '#ffffff' }}>
                {formatRatio(addressMetrics.ratio)}
              </p>
            </div>

            {/* 14-Day Activity Ratio */}
            <div style={{
              padding: '25px',
              background: '#7c2d12',
              borderRadius: '12px',
              textAlign: 'center',
              border: '2px solid #dc2626'
            }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#fca5a5', fontSize: '16px' }}>14-Day Ratio</h3>
              {bloomHistory && refinementClaims ? (
                <div>
                  <p style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#ffffff' }}>
                    {(() => {
                      const verdantSpent = parseFloat(bloomHistory.totalVerdantSpent) || 0;
                      const verdantClaimed = parseFloat(refinementClaims.totalVerdantClaimed) || 0;

                      if (verdantSpent === 0) {
                        return verdantClaimed > 0 ? "∞" : "0.00";
                      }

                      const ratio = verdantClaimed / verdantSpent;
                      return ratio.toFixed(2);
                    })()}
                  </p>
                  <p style={{ fontSize: '10px', margin: 0, color: '#fca5a5' }}>
                    {formatNumber(refinementClaims?.totalVerdantClaimed || '0')} claimed / {formatNumber(bloomHistory?.totalVerdantSpent || '0')} spent
                  </p>
                </div>
              ) : (
                <p style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, color: '#dc2626' }}>
                  -
                </p>
              )}
            </div>

            {/* Refinement Card */}
            <div style={{
              padding: '25px',
              background: '#581c87',
              borderRadius: '12px',
              textAlign: 'center',
              border: '1px solid #a855f7'
            }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#c4b5fd', fontSize: '16px' }}>Refining</h3>
              {minerStats?.refinements ? (
                <div>
                  <p style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#ffffff' }}>
                    {formatNumber(minerStats.refinements.totalRefiningAmount)} VDNT
                  </p>
                  <p style={{ fontSize: '12px', margin: 0, color: '#c4b5fd' }}>
                    {minerStats.refinements.total} in queue
                    {minerStats.refinements.readyToClaim > 0 && (
                      <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                        <br/>{minerStats.refinements.readyToClaim} ready!
                      </span>
                    )}
                  </p>
                </div>
              ) : (
                <p style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: '#a855f7' }}>
                  0 VDNT
                </p>
              )}
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
              <p style={{ margin: '5px 0 0 0', fontSize: '20px', fontWeight: 'bold', color: '#fbbf24' }}>{formatNumber(minerStats.totalPendingRewards)} VERDITE</p>
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
                            {formatNumber(miner.pendingRewards)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Refinement Details Section */}
          {minerStats.refinements && minerStats.refinements.total > 0 && (
            <div>
              <h3 style={{ color: '#ffffff', margin: '30px 0 20px 0' }}>
                Refinement Queue
                <span style={{ color: '#a3a3a3', fontWeight: 'normal', fontSize: '16px', marginLeft: '10px' }}>
                  ({minerStats.refinements.total} items)
                </span>
              </h3>

              {/* Refinement Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                <div style={{ background: '#262626', padding: '15px', borderRadius: '8px', border: '1px solid #333' }}>
                  <p style={{ margin: 0, color: '#888', fontSize: '12px' }}>Total Refining</p>
                  <p style={{ margin: '5px 0 0 0', fontSize: '20px', fontWeight: 'bold', color: '#a855f7' }}>
                    {formatNumber(minerStats.refinements.totalRefiningAmount)} VDNT
                  </p>
                </div>
                <div style={{ background: '#262626', padding: '15px', borderRadius: '8px', border: '1px solid #333' }}>
                  <p style={{ margin: 0, color: '#888', fontSize: '12px' }}>Ready to Claim</p>
                  <p style={{ margin: '5px 0 0 0', fontSize: '20px', fontWeight: 'bold', color: minerStats.refinements.readyToClaim > 0 ? '#10b981' : '#666' }}>
                    {minerStats.refinements.readyToClaim}
                  </p>
                </div>
                {minerStats.refinements.nextClaimableTime && (
                  <div style={{ background: '#262626', padding: '15px', borderRadius: '8px', border: '1px solid #333' }}>
                    <p style={{ margin: 0, color: '#888', fontSize: '12px' }}>Next Claimable</p>
                    <p style={{ margin: '5px 0 0 0', fontSize: '14px', fontWeight: 'bold', color: '#fbbf24' }}>
                      {new Date(minerStats.refinements.nextClaimableTime).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}
              </div>

              {/* Individual Refinements */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
                {minerStats.refinements.items.map((refinement) => (
                  <div
                    key={refinement.id}
                    style={{
                      background: '#1a1a1a',
                      border: refinement.isReady ? '2px solid #10b981' : '1px solid #333',
                      borderRadius: '12px',
                      padding: '20px',
                      position: 'relative',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Status Badge */}
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: refinement.isReady ? '#10b981' : '#6b7280',
                      color: refinement.isReady ? '#000000' : '#ffffff',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase'
                    }}>
                      {refinement.isReady ? 'Ready' : 'Pending'}
                    </div>

                    {/* Header */}
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{
                        color: '#ffffff',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        margin: '0 0 4px 0'
                      }}>
                        Refinement #{refinement.id + 1}
                      </h4>
                      <div style={{ color: '#a3a3a3', fontSize: '12px' }}>
                        {formatNumber(refinement.verditeAmount)} VERDITE → {formatNumber(refinement.verdantAmount)} VDNT
                      </div>
                    </div>

                    {/* Amount Display */}
                    <div style={{
                      background: 'rgba(168, 85, 247, 0.1)',
                      border: '1px solid #a855f7',
                      borderRadius: '8px',
                      padding: '12px',
                      marginBottom: '16px',
                      textAlign: 'center'
                    }}>
                      <div style={{ color: '#c4b5fd', fontSize: '12px', marginBottom: '4px' }}>
                        Will Receive
                      </div>
                      <div style={{ color: '#ffffff', fontSize: '20px', fontWeight: 'bold' }}>
                        {formatNumber(refinement.verdantAmount)}
                      </div>
                      <div style={{ color: '#a855f7', fontSize: '14px', fontWeight: 'bold' }}>
                        VDNT
                      </div>
                    </div>

                    {/* Timing Info */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: refinement.isReady ? '#10b981' : '#a3a3a3',
                      fontSize: '13px'
                    }}>
                      <span style={{ fontSize: '16px' }}>
                        {refinement.isReady ? '✅' : '⏳'}
                      </span>
                      <div>
                        {refinement.isReady ? (
                          <span style={{ fontWeight: 'bold' }}>Ready to claim!</span>
                        ) : (
                          <>
                            <div>Claimable in:</div>
                            <div style={{ fontWeight: 'bold', marginTop: '2px' }}>
                              {new Date(refinement.collectionTime).toLocaleString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bloom Purchase History Section */}
      {bloomHistory && (
        <div style={{
          background: '#1a1a1a',
          padding: '30px',
          borderRadius: '12px',
          border: '1px solid #333',
          marginBottom: '30px'
        }}>
          <h2 style={{ color: '#ffffff', margin: '0 0 20px 0' }}>
            Bloom Purchase History
            <span style={{ color: '#a3a3a3', fontWeight: 'normal', fontSize: '16px', marginLeft: '10px' }}>
              (Last 14 Days)
            </span>
          </h2>

          {/* Bloom Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            <div style={{
              padding: '25px',
              background: '#134e4a',
              borderRadius: '12px',
              textAlign: 'center',
              border: '1px solid #14b8a6'
            }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#5eead4', fontSize: '16px' }}>Total Purchases</h3>
              <p style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, color: '#ffffff' }}>
                {bloomHistory.totalPurchases}
              </p>
            </div>
            <div style={{
              padding: '25px',
              background: '#581c87',
              borderRadius: '12px',
              textAlign: 'center',
              border: '1px solid #a855f7'
            }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#c4b5fd', fontSize: '16px' }}>VDNT Spent</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#ffffff' }}>
                {formatNumber(bloomHistory.totalVerdantSpent)}
              </p>
            </div>
            <div style={{
              padding: '25px',
              background: '#7c2d12',
              borderRadius: '12px',
              textAlign: 'center',
              border: '1px solid #f97316'
            }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#fed7aa', fontSize: '16px' }}>Bloom Received</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#ffffff' }}>
                {formatNumber(bloomHistory.totalBloomReceived)}
              </p>
            </div>
          </div>

          {/* Individual Purchases */}
          {bloomHistory.purchases.length > 0 ? (
            <div>
              <h3 style={{ color: '#ffffff', margin: '0 0 20px 0' }}>
                Individual Purchases
                <span style={{ color: '#a3a3a3', fontWeight: 'normal', fontSize: '16px', marginLeft: '10px' }}>
                  ({bloomHistory.purchases.length})
                </span>
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
                {bloomHistory.purchases.map((purchase, index) => (
                  <div
                    key={purchase.transactionHash}
                    style={{
                      background: '#262626',
                      border: '1px solid #333',
                      borderRadius: '12px',
                      padding: '20px',
                      position: 'relative',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Purchase Number */}
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: '#14b8a6',
                      color: '#000000',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}>
                      #{index + 1}
                    </div>

                    {/* Purchase Details */}
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{
                        color: '#ffffff',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        margin: '0 0 4px 0'
                      }}>
                        Bloom Purchase
                      </h4>
                      <div style={{ color: '#a3a3a3', fontSize: '12px' }}>
                        {purchase.timeAgo}
                      </div>
                    </div>

                    {/* Amount Display */}
                    <div style={{
                      background: 'rgba(20, 184, 166, 0.1)',
                      border: '1px solid #14b8a6',
                      borderRadius: '8px',
                      padding: '12px',
                      marginBottom: '16px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: '#5eead4', fontSize: '12px' }}>Spent:</span>
                        <span style={{ color: '#ffffff', fontWeight: 'bold' }}>
                          {formatNumber(purchase.verdantAmount)} VDNT
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#5eead4', fontSize: '12px' }}>Received:</span>
                        <span style={{ color: '#14b8a6', fontWeight: 'bold' }}>
                          {formatNumber(purchase.bloomAmount)} BLOOM
                        </span>
                      </div>
                    </div>

                    {/* Transaction Info */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      color: '#a3a3a3',
                      fontSize: '11px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Block:</span>
                        <span style={{ color: '#ffffff' }}>{purchase.blockNumber}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Time:</span>
                        <span style={{ color: '#ffffff' }}>
                          {new Date(purchase.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div style={{ marginTop: '8px', wordBreak: 'break-all' }}>
                        <span>TX: </span>
                        <a
                          href={`https://basescan.org/tx/${purchase.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#14b8a6', textDecoration: 'underline' }}
                        >
                          {purchase.transactionHash.slice(0, 10)}...{purchase.transactionHash.slice(-8)}
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#a3a3a3',
              background: '#262626',
              borderRadius: '12px',
              border: '1px solid #333'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🌸</div>
              <h3 style={{ color: '#ffffff', margin: '0 0 8px 0' }}>No Bloom Purchases</h3>
              <p style={{ margin: 0, fontSize: '14px' }}>
                This address hasn't purchased any Bloom tokens in the last 14 days.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Refinement Claims History Section */}
      {refinementClaims && (
        <div style={{
          background: '#1a1a1a',
          padding: '30px',
          borderRadius: '12px',
          border: '1px solid #333',
          marginBottom: '30px'
        }}>
          <h2 style={{ color: '#ffffff', margin: '0 0 20px 0' }}>
            Refinement Claims History
            <span style={{ color: '#a3a3a3', fontWeight: 'normal', fontSize: '16px', marginLeft: '10px' }}>
              (Last 14 Days)
            </span>
          </h2>

          {/* Claims Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            <div style={{
              padding: '25px',
              background: '#1e3a8a',
              borderRadius: '12px',
              textAlign: 'center',
              border: '1px solid #3b82f6'
            }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#93bbfc', fontSize: '16px' }}>Total Claims</h3>
              <p style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, color: '#ffffff' }}>
                {refinementClaims.totalClaims}
              </p>
            </div>
            <div style={{
              padding: '25px',
              background: '#064e3b',
              borderRadius: '12px',
              textAlign: 'center',
              border: '1px solid #10b981'
            }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#6ee7b7', fontSize: '16px' }}>VDNT Claimed</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#ffffff' }}>
                {formatNumber(refinementClaims.totalVerdantClaimed)}
              </p>
            </div>
            <div style={{
              padding: '25px',
              background: '#581c87',
              borderRadius: '12px',
              textAlign: 'center',
              border: '1px solid #a855f7'
            }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#c4b5fd', fontSize: '16px' }}>VERDITE Refined</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#ffffff' }}>
                {formatNumber(refinementClaims.totalVerditeRefined)}
              </p>
            </div>
          </div>

          {/* Individual Claims */}
          {refinementClaims.claims.length > 0 ? (
            <div>
              <h3 style={{ color: '#ffffff', margin: '0 0 20px 0' }}>
                Individual Claims
                <span style={{ color: '#a3a3a3', fontWeight: 'normal', fontSize: '16px', marginLeft: '10px' }}>
                  ({refinementClaims.claims.length})
                </span>
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
                {refinementClaims.claims.map((claim, index) => (
                  <div
                    key={claim.transactionHash}
                    style={{
                      background: '#262626',
                      border: '1px solid #333',
                      borderRadius: '12px',
                      padding: '20px',
                      position: 'relative',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Claim Number */}
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: '#10b981',
                      color: '#000000',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}>
                      #{index + 1}
                    </div>

                    {/* Claim Details */}
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{
                        color: '#ffffff',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        margin: '0 0 4px 0'
                      }}>
                        Refinement Claimed
                      </h4>
                      <div style={{ color: '#a3a3a3', fontSize: '12px' }}>
                        {claim.timeAgo}
                      </div>
                    </div>

                    {/* Amount Display */}
                    <div style={{
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid #10b981',
                      borderRadius: '8px',
                      padding: '12px',
                      marginBottom: '16px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: '#6ee7b7', fontSize: '12px' }}>Refined:</span>
                        <span style={{ color: '#ffffff', fontWeight: 'bold' }}>
                          {formatNumber(claim.verditeAmount)} VERDITE
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#6ee7b7', fontSize: '12px' }}>Received:</span>
                        <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                          {formatNumber(claim.verdantAmount)} VDNT
                        </span>
                      </div>
                    </div>

                    {/* Transaction Info */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      color: '#a3a3a3',
                      fontSize: '11px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Block:</span>
                        <span style={{ color: '#ffffff' }}>{claim.blockNumber}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Time:</span>
                        <span style={{ color: '#ffffff' }}>
                          {new Date(claim.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div style={{ marginTop: '8px', wordBreak: 'break-all' }}>
                        <span>TX: </span>
                        <a
                          href={`https://basescan.org/tx/${claim.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#10b981', textDecoration: 'underline' }}
                        >
                          {claim.transactionHash.slice(0, 10)}...{claim.transactionHash.slice(-8)}
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#a3a3a3',
              background: '#262626',
              borderRadius: '12px',
              border: '1px solid #333'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
              <h3 style={{ color: '#ffffff', margin: '0 0 8px 0' }}>No Refinement Claims</h3>
              <p style={{ margin: 0, fontSize: '14px' }}>
                This address hasn't claimed any refinements in the last 14 days.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}