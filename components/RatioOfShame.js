'use client';

import { useState, useEffect } from 'react';
import { formatNumber, formatRatio } from '../utils/formatters';

export default function RatioOfShame({ chain, onAddressSelect }) {
  const [ratioData, setRatioData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanNotification, setScanNotification] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, phase: '' });
  
  // Filter states
  const [filters, setFilters] = useState({
    minWithdrawals: '',
    minDeposits: '',
    minRatio: '',
    minActiveMiners: '',
    minTotalMiners: ''
  });

  // Load cached ratio data on component mount and chain change
  useEffect(() => {
    loadCachedRatios();
  }, [chain]);

  const loadCachedRatios = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`/api/ratio-data?chain=${chain}`, {
        method: 'GET'
      });

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      setRatioData(data.ratioData || []);
      setLastUpdated(data.lastUpdated);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const scanForMoreRatios = async (scanType = 'update') => {
    setError('');
    setLoading(true);
    setScanNotification(null);
    setScanProgress({ current: 0, total: 1, phase: 'Processing addresses...' });

    try {
      // Start the scan
      const response = await fetch('/api/ratio-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chain, scanType })
      });

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      setRatioData(data.ratioData || []);
      setLastUpdated(data.lastUpdated);

      // Show scan results notification
      const notification = {
        type: 'success',
        addressesScanned: data.addressesScanned || 0,
        newRatiosCalculated: data.newRatiosCalculated || 0,
        totalRatios: data.totalRatios || 0,
        scanDuration: data.scanDuration ? Math.round(data.scanDuration / 1000) : 0
      };
      setScanNotification(notification);

      // Auto-hide notification after 8 seconds
      setTimeout(() => setScanNotification(null), 8000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setScanProgress({ current: 0, total: 0, phase: '' });
    }
  };

  const getRatioColor = (ratio) => {
    if (ratio >= 2.0) return '#dc2626'; // Red for very high ratios
    if (ratio >= 1.5) return '#ea580c'; // Orange for high ratios  
    if (ratio >= 1.0) return '#ca8a04'; // Yellow for medium ratios
    return '#059669'; // Green for low ratios
  };

  const getRatioLabel = (ratio) => {
    if (ratio >= 2.0) return 'EXTREME SHAME';
    if (ratio >= 1.5) return 'High Shame';
    if (ratio >= 1.0) return 'Moderate Shame';
    return 'Acceptable';
  };

  // Filter the ratio data based on filter values
  const filteredRatioData = ratioData.filter(item => {
    if (filters.minWithdrawals && parseFloat(item.totalWithdrawals) < parseFloat(filters.minWithdrawals)) return false;
    if (filters.minDeposits && parseFloat(item.totalDeposits) < parseFloat(filters.minDeposits)) return false;
    if (filters.minRatio && parseFloat(item.ratio) < parseFloat(filters.minRatio)) return false;
    if (filters.minActiveMiners && parseInt(item.activeMiners) < parseInt(filters.minActiveMiners)) return false;
    if (filters.minTotalMiners && parseInt(item.totalMiners) < parseInt(filters.minTotalMiners)) return false;
    return true;
  });

  const clearFilters = () => {
    setFilters({
      minWithdrawals: '',
      minDeposits: '',
      minRatio: '',
      minActiveMiners: '',
      minTotalMiners: ''
    });
  };

  return (
    <div>
      {/* Control Panel */}
      <div style={{
        background: '#262626',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #333',
        marginBottom: '30px'
      }}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '15px' }}>
          <button
            onClick={() => scanForMoreRatios('update')}
            disabled={loading}
            style={{
              padding: '10px 20px',
              background: loading ? '#404040' : '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Calculating...' : 'Update Ratios'}
          </button>

          <button
            onClick={() => scanForMoreRatios('scanAll')}
            disabled={loading}
            style={{
              padding: '10px 20px',
              background: loading ? '#404040' : '#ea580c',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Calculating...' : 'Scan All Addresses'}
          </button>

          {lastUpdated && (
            <span style={{ color: '#6ee7b7', fontSize: '14px' }}>
              Last updated: {new Date(lastUpdated).toLocaleString()}
            </span>
          )}
        </div>

        <div style={{ 
          padding: '12px', 
          background: '#1a1a1a', 
          borderRadius: '6px', 
          border: '1px solid #333',
          marginBottom: '0'
        }}>
          <p style={{ margin: 0, color: '#a3a3a3', fontSize: '14px' }}>
            <strong style={{ color: '#dc2626' }}>Update Ratios:</strong> Calculate ratios for newly discovered addresses only<br/>
            <strong style={{ color: '#ea580c' }}>Scan All Addresses:</strong> Recalculate ratios for ALL addresses with active miners (slower)
          </p>
        </div>
      </div>

      {/* Filter Panel */}
      <div style={{
        background: '#262626',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #333',
        marginBottom: '30px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ color: '#ffffff', margin: 0, fontSize: '16px' }}>🔧 Filter Options</h3>
          <button
            onClick={clearFilters}
            style={{
              padding: '6px 12px',
              background: '#404040',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Clear Filters
          </button>
        </div>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '16px' 
        }}>
          {/* Minimum Withdrawals Filter */}
          <div>
            <label style={{ color: '#a3a3a3', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Min Withdrawals
            </label>
            <input
              type="number"
              value={filters.minWithdrawals}
              onChange={(e) => setFilters({ ...filters, minWithdrawals: e.target.value })}
              placeholder="e.g. 1000"
              style={{
                width: '100%',
                padding: '8px',
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '6px',
                color: '#ffffff',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Minimum Deposits Filter */}
          <div>
            <label style={{ color: '#a3a3a3', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Min Deposits
            </label>
            <input
              type="number"
              value={filters.minDeposits}
              onChange={(e) => setFilters({ ...filters, minDeposits: e.target.value })}
              placeholder="e.g. 500"
              style={{
                width: '100%',
                padding: '8px',
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '6px',
                color: '#ffffff',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Minimum Ratio Filter */}
          <div>
            <label style={{ color: '#a3a3a3', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Min Ratio
            </label>
            <input
              type="number"
              step="0.1"
              value={filters.minRatio}
              onChange={(e) => setFilters({ ...filters, minRatio: e.target.value })}
              placeholder="e.g. 1.5"
              style={{
                width: '100%',
                padding: '8px',
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '6px',
                color: '#ffffff',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Minimum Active Miners Filter */}
          <div>
            <label style={{ color: '#a3a3a3', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Min Active Miners
            </label>
            <input
              type="number"
              value={filters.minActiveMiners}
              onChange={(e) => setFilters({ ...filters, minActiveMiners: e.target.value })}
              placeholder="e.g. 5"
              style={{
                width: '100%',
                padding: '8px',
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '6px',
                color: '#ffffff',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Minimum Total Miners Filter */}
          <div>
            <label style={{ color: '#a3a3a3', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Min Total Miners
            </label>
            <input
              type="number"
              value={filters.minTotalMiners}
              onChange={(e) => setFilters({ ...filters, minTotalMiners: e.target.value })}
              placeholder="e.g. 10"
              style={{
                width: '100%',
                padding: '8px',
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '6px',
                color: '#ffffff',
                fontSize: '14px'
              }}
            />
          </div>
        </div>

        {/* Active Filter Summary */}
        {Object.values(filters).some(f => f !== '') && (
          <div style={{ 
            marginTop: '12px', 
            padding: '8px', 
            background: '#1a1a1a', 
            borderRadius: '6px',
            fontSize: '12px',
            color: '#10b981'
          }}>
            Showing {filteredRatioData.length} of {ratioData.length} addresses
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {loading && (
        <div style={{
          background: '#1a1a1a',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #333',
          marginBottom: '20px'
        }}>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ color: '#ffffff', fontSize: '14px', fontWeight: 'bold' }}>
                Calculating Ratios
              </span>
            </div>
            
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#333',
              borderRadius: '4px',
              overflow: 'hidden',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: '40%',
                backgroundColor: '#10b981',
                borderRadius: '4px',
                background: 'linear-gradient(90deg, #10b981, #059669)',
                animation: 'slide 1.5s ease-in-out infinite'
              }} />
            </div>
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              backgroundColor: '#10b981',
              borderRadius: '50%',
              animation: 'pulse 1.5s ease-in-out infinite'
            }} />
            <span style={{ color: '#a3a3a3', fontSize: '14px' }}>
              Processing addresses with miners... (3 retries per address on failure)
            </span>
          </div>
          
          <style jsx>{`
            @keyframes pulse {
              0%, 100% {
                opacity: 1;
                transform: scale(1);
              }
              50% {
                opacity: 0.5;
                transform: scale(1.2);
              }
            }
            @keyframes slide {
              0% {
                transform: translateX(-100%);
              }
              100% {
                transform: translateX(350%);
              }
            }
          `}</style>
        </div>
      )}

      {/* Scan Notification */}
      {scanNotification && (
        <div style={{ 
          margin: '0 0 20px 0',
          padding: '15px',
          background: '#7f1d1d',
          borderRadius: '8px',
          border: '2px solid #dc2626'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '18px' }}>📊</span>
                <h4 style={{ margin: 0, color: '#dc2626', fontSize: '16px', fontWeight: 'bold' }}>
                  Ratio Calculation Complete!
                </h4>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '8px' }}>
                <div>
                  <span style={{ color: '#fca5a5', fontSize: '12px' }}>Addresses Scanned</span>
                  <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '18px' }}>
                    {scanNotification.addressesScanned}
                  </div>
                </div>
                
                <div>
                  <span style={{ color: '#fca5a5', fontSize: '12px' }}>New Ratios</span>
                  <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '18px' }}>
                    {scanNotification.newRatiosCalculated}
                  </div>
                </div>
                
                <div>
                  <span style={{ color: '#fca5a5', fontSize: '12px' }}>Total Ratios</span>
                  <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '18px' }}>
                    {scanNotification.totalRatios}
                  </div>
                </div>
                
                <div>
                  <span style={{ color: '#fca5a5', fontSize: '12px' }}>Duration</span>
                  <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '18px' }}>
                    {scanNotification.scanDuration}s
                  </div>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setScanNotification(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#a3a3a3',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '4px',
                marginLeft: '8px'
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
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

      {/* Ratio Data Display */}
      {ratioData.length > 0 && (
        <div style={{
          background: '#262626',
          padding: '30px',
          borderRadius: '12px',
          border: '1px solid #333'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ color: '#ffffff', margin: 0 }}>
              Hall of Shame ({filteredRatioData.length} {filteredRatioData.length !== ratioData.length && `of ${ratioData.length}`} addresses)
            </h3>
          </div>

          {filteredRatioData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
              <h4 style={{ color: '#ffffff', marginBottom: '8px' }}>No Addresses Match Filters</h4>
              <p style={{ color: '#a3a3a3' }}>
                Try adjusting your filter criteria or clear filters to see all addresses.
              </p>
            </div>
          ) : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', 
              gap: '16px'
            }}>
              {filteredRatioData.map((item, index) => (
              <div 
                key={item.address}
                style={{
                  background: '#1a1a1a',
                  border: `2px solid ${getRatioColor(item.ratio)}`,
                  borderRadius: '12px',
                  padding: '16px',
                  position: 'relative'
                }}
              >
                {/* Rank Badge */}
                <div style={{
                  position: 'absolute',
                  top: '-8px',
                  left: '16px',
                  background: getRatioColor(item.ratio),
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  #{index + 1}
                </div>

                {/* Address */}
                <div 
                  onClick={() => onAddressSelect && onAddressSelect(item.address)}
                  style={{ 
                    fontFamily: 'monospace', 
                    fontSize: '14px', 
                    color: '#ffffff',
                    marginTop: '8px',
                    marginBottom: '12px',
                    wordBreak: 'break-all',
                    cursor: onAddressSelect ? 'pointer' : 'default',
                    transition: 'color 0.2s ease'
                  }}
                  onMouseEnter={(e) => { if(onAddressSelect) e.target.style.color = '#3b82f6' }}
                  onMouseLeave={(e) => { if(onAddressSelect) e.target.style.color = '#ffffff' }}
                >
                  {item.address}
                </div>

                {/* Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <span style={{ color: '#a3a3a3', fontSize: '12px' }}>Total Deposits</span>
                    <div style={{ color: '#10b981', fontWeight: 'bold' }}>
                      {formatNumber(item.totalDeposits)}
                    </div>
                  </div>
                  
                  <div>
                    <span style={{ color: '#a3a3a3', fontSize: '12px' }}>Total Withdrawals</span>
                    <div style={{ color: '#dc2626', fontWeight: 'bold' }}>
                      {formatNumber(item.totalWithdrawals)}
                    </div>
                  </div>

                  <div>
                    <span style={{ color: '#a3a3a3', fontSize: '12px' }}>Active Miners</span>
                    <div style={{ color: '#ffffff', fontWeight: 'bold' }}>
                      {formatNumber(item.activeMiners || 0)}
                    </div>
                  </div>
                  
                  <div>
                    <span style={{ color: '#a3a3a3', fontSize: '12px' }}>Total Miners</span>
                    <div style={{ color: '#a3a3a3', fontWeight: 'bold' }}>
                      {formatNumber(item.totalMiners || 0)}
                    </div>
                  </div>
                </div>

                {/* Ratio */}
                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                  <div style={{ 
                    fontSize: '24px', 
                    fontWeight: 'bold', 
                    color: getRatioColor(item.ratio),
                    marginBottom: '4px'
                  }}>
                    {item.ratio}x
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: getRatioColor(item.ratio),
                    fontWeight: 'bold'
                  }}>
                    {getRatioLabel(item.ratio)}
                  </div>
                </div>
              </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No Data Message */}
      {!loading && ratioData.length === 0 && !error && (
        <div style={{
          background: '#262626',
          padding: '40px',
          borderRadius: '12px',
          border: '1px solid #333',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤷‍♀️</div>
          <h3 style={{ color: '#ffffff', marginBottom: '8px' }}>No Ratio Data Yet</h3>
          <p style={{ color: '#a3a3a3', marginBottom: '20px' }}>
            Click "Update Ratios" to calculate withdrawal-to-deposit ratios for addresses with miners.
          </p>
        </div>
      )}
    </div>
  );
}