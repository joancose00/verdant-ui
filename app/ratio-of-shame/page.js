'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatNumber, formatRatio } from '../../utils/formatters';

export default function GlobalRatioOfShamePage() {
  const router = useRouter();
  const [abstractData, setAbstractData] = useState([]);
  const [baseData, setBaseData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState({ abstract: null, base: null });
  
  // Filter states
  const [filters, setFilters] = useState({
    minWithdrawals: '',
    minDeposits: '',
    minRatio: '',
    minSells: '',
    minSellRatio: '',
    minActiveMiners: '',
    minTotalMiners: '',
    chainFilter: 'all' // 'all', 'abstract', 'base'
  });
  
  // Sort state
  const [sortBy, setSortBy] = useState('withdrawalRatio'); // 'withdrawalRatio' or 'sellRatio'

  // Load cached data from both chains on component mount
  useEffect(() => {
    loadCachedData();
  }, []);

  const loadCachedData = async () => {
    setError('');
    setLoading(true);

    try {
      console.log('📋 Loading cached ratio data for both chains...');
      
      // Load cached data from both chains via GET requests
      const [abstractResponse, baseResponse] = await Promise.all([
        fetch('/api/ratio-data?chain=abstract'),
        fetch('/api/ratio-data?chain=base')
      ]);

      const [abstractResult, baseResult] = await Promise.all([
        abstractResponse.json(),
        baseResponse.json()
      ]);

      if (abstractResult.error) console.error('Abstract error:', abstractResult.error);
      if (baseResult.error) console.error('Base error:', baseResult.error);

      // Add chain info to each item
      const abstractWithChain = (abstractResult.ratioData || []).map(item => ({
        ...item,
        chain: 'abstract'
      }));

      const baseWithChain = (baseResult.ratioData || []).map(item => ({
        ...item,
        chain: 'base'
      }));

      setAbstractData(abstractWithChain);
      setBaseData(baseWithChain);
      setLastUpdated({
        abstract: abstractResult.lastUpdated,
        base: baseResult.lastUpdated
      });

      console.log(`✅ Cached data loaded - Abstract: ${abstractWithChain.length} addresses, Base: ${baseWithChain.length} addresses`);

    } catch (err) {
      console.error('Global data load error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshAllRatioData = async () => {
    setError('');
    setLoading(true);

    try {
      console.log('🔄 Refreshing ratio data for both chains...');
      
      // Refresh current displayed data for both chains via POST requests
      const [abstractResponse, baseResponse] = await Promise.all([
        fetch('/api/ratio-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            chain: 'abstract', 
            scanType: 'refreshCurrent', 
            batchSize: 50 
          })
        }),
        fetch('/api/ratio-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            chain: 'base', 
            scanType: 'refreshCurrent', 
            batchSize: 50 
          })
        })
      ]);

      const [abstractResult, baseResult] = await Promise.all([
        abstractResponse.json(),
        baseResponse.json()
      ]);

      if (abstractResult.error) console.error('Abstract error:', abstractResult.error);
      if (baseResult.error) console.error('Base error:', baseResult.error);

      // Add chain info to each item
      const abstractWithChain = (abstractResult.ratioData || []).map(item => ({
        ...item,
        chain: 'abstract'
      }));

      const baseWithChain = (baseResult.ratioData || []).map(item => ({
        ...item,
        chain: 'base'
      }));

      setAbstractData(abstractWithChain);
      setBaseData(baseWithChain);
      setLastUpdated({
        abstract: abstractResult.lastUpdated,
        base: baseResult.lastUpdated
      });

      console.log(`✅ Refresh complete - Abstract: ${abstractWithChain.length} addresses, Base: ${baseWithChain.length} addresses`);

    } catch (err) {
      console.error('Global refresh error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Combine, filter and sort data
  const combinedData = [...abstractData, ...baseData]
    .filter(item => {
      // Chain filter
      if (filters.chainFilter !== 'all' && item.chain !== filters.chainFilter) return false;
      
      // Value filters
      if (filters.minWithdrawals && parseFloat(item.totalWithdrawals) < parseFloat(filters.minWithdrawals)) return false;
      if (filters.minDeposits && parseFloat(item.totalDeposits) < parseFloat(filters.minDeposits)) return false;
      if (filters.minRatio && parseFloat(item.ratio) < parseFloat(filters.minRatio)) return false;
      if (filters.minSells && parseFloat(item.totalSells || 0) < parseFloat(filters.minSells)) return false;
      if (filters.minSellRatio && parseFloat(item.sellRatio || 0) < parseFloat(filters.minSellRatio)) return false;
      if (filters.minActiveMiners && parseInt(item.activeMiners) < parseInt(filters.minActiveMiners)) return false;
      if (filters.minTotalMiners && parseInt(item.totalMiners) < parseInt(filters.minTotalMiners)) return false;
      
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'withdrawalRatio') {
        return parseFloat(b.ratio) - parseFloat(a.ratio);
      } else {
        return parseFloat(b.sellRatio || 0) - parseFloat(a.sellRatio || 0);
      }
    });

  const clearFilters = () => {
    setFilters({
      minWithdrawals: '',
      minDeposits: '',
      minRatio: '',
      minSells: '',
      minSellRatio: '',
      minActiveMiners: '',
      minTotalMiners: '',
      chainFilter: 'all'
    });
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

  const getSellRatioColor = (ratio) => {
    if (ratio >= 5.0) return '#dc2626'; // Red for very high sell ratios
    if (ratio >= 3.0) return '#ea580c'; // Orange for high sell ratios  
    if (ratio >= 1.5) return '#ca8a04'; // Yellow for medium sell ratios
    return '#059669'; // Green for low sell ratios
  };

  const getSellRatioLabel = (ratio) => {
    if (ratio >= 5.0) return 'EXTREME DUMPING';
    if (ratio >= 3.0) return 'High Dumping';
    if (ratio >= 1.5) return 'Moderate Dumping';
    return 'Acceptable';
  };

  const getChainColor = (chain) => {
    return chain === 'abstract' ? '#10b981' : '#3b82f6';
  };

  const getChainIcon = (chain) => {
    return chain === 'abstract' ? '⚡' : '🔷';
  };

  const handleAddressClick = (address, chain) => {
    // Navigate to the appropriate chain page with the address pre-filled
    // We'll use localStorage to pass the address and redirect to the wallet query tab
    localStorage.setItem('selectedAddress', address);
    localStorage.setItem('selectedTab', '1'); // Wallet Query tab index
    router.push(`/${chain}`);
  };

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here if desired
      console.log(`${type} copied to clipboard: ${text}`);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#0a0a0a', 
      color: '#ffffff',
      padding: '30px'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <Link href="/" style={{ 
          color: '#dc2626', 
          textDecoration: 'none', 
          fontSize: '14px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          marginBottom: '20px'
        }}>
          ← Back to Home
        </Link>
        
        <h1 style={{ 
          fontSize: '42px', 
          fontWeight: 'bold', 
          margin: '0 0 10px 0',
          background: 'linear-gradient(45deg, #dc2626, #ea580c, #ca8a04)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          🌍 Global Ratio of Shame
        </h1>
        
        <p style={{ color: '#a3a3a3', fontSize: '18px', margin: 0 }}>
          Combined Ratio of Shame across Abstract and Base networks
        </p>
      </div>

      {/* Information Panel */}
      <div style={{
        background: '#1a1a2e',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #16213e',
        marginBottom: '20px'
      }}>
        <h3 style={{ color: '#ffffff', margin: '0 0 15px 0', fontSize: '16px' }}>📊 Understanding Ratio of Shame</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '15px' }}>
          <div>
            <h4 style={{ color: '#dc2626', margin: '0 0 8px 0', fontSize: '14px' }}>🔴 Withdrawal Ratio</h4>
            <p style={{ color: '#a3a3a3', fontSize: '13px', margin: 0, lineHeight: '1.4' }}>
              <strong>Withdrawals ÷ Deposits</strong><br/>
              Tracks VDNT claimed through game refinement. This is what the game uses to calculate shield costs. Higher ratios = more expensive shields.
            </p>
          </div>
          
          <div>
            <h4 style={{ color: '#f59e0b', margin: '0 0 8px 0', fontSize: '14px' }}>🟡 Sell Ratio</h4>
            <p style={{ color: '#a3a3a3', fontSize: '13px', margin: 0, lineHeight: '1.4' }}>
              <strong>Market Sells ÷ Deposits</strong><br/>
              Traces actual market sell orders back to miner owners through blockchain analysis. Shows real dumping behavior regardless of refinement claims. Note that some players have multiple accounts and may be consolidating funds before selling, resulting in sell amounts that far exceed the deposits on record for that account.
            </p>
          </div>
        </div>
        
        <div style={{ 
          padding: '12px', 
          background: '#0f172a', 
          borderRadius: '6px', 
          border: '1px solid #1e293b'
        }}>
          <h4 style={{ color: '#10b981', margin: '0 0 6px 0', fontSize: '13px' }}>🔍 Filtering Criteria</h4>
          <p style={{ color: '#64748b', fontSize: '12px', margin: 0, lineHeight: '1.3' }}>
            Only shows addresses with: <strong>Active miners</strong> + <strong>Either withdrawal ratio OR sell ratio &gt; 0</strong> + <strong>Some activity (deposits/withdrawals/sells)</strong>
          </p>
        </div>
      </div>

      {/* Stats Panel */}
      <div style={{
        background: '#1a1a1a',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #333',
        marginBottom: '30px'
      }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={refreshAllRatioData}
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
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>

          <div style={{ display: 'flex', gap: '30px' }}>
            <div>
              <span style={{ color: '#10b981', fontSize: '12px' }}>Abstract Addresses</span>
              <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '18px' }}>
                {formatNumber(abstractData.length)}
              </div>
            </div>
            
            <div>
              <span style={{ color: '#3b82f6', fontSize: '12px' }}>Base Addresses</span>
              <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '18px' }}>
                {formatNumber(baseData.length)}
              </div>
            </div>

            <div>
              <span style={{ color: '#dc2626', fontSize: '12px' }}>Total Entries</span>
              <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '18px' }}>
                {formatNumber(combinedData.length)}
              </div>
              <div style={{ color: '#6b7280', fontSize: '10px' }}>
                (some addresses appear on both chains)
              </div>
            </div>
          </div>
        </div>

        {(lastUpdated.abstract || lastUpdated.base) && (
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#6ee7b7' }}>
            {lastUpdated.abstract && `Abstract: ${new Date(lastUpdated.abstract).toLocaleString()}`}
            {lastUpdated.abstract && lastUpdated.base && ' • '}
            {lastUpdated.base && `Base: ${new Date(lastUpdated.base).toLocaleString()}`}
          </div>
        )}
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
          {/* Chain Filter */}
          <div>
            <label style={{ color: '#a3a3a3', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Network
            </label>
            <select
              value={filters.chainFilter}
              onChange={(e) => setFilters({ ...filters, chainFilter: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '6px',
                color: '#ffffff',
                fontSize: '14px'
              }}
            >
              <option value="all">All Networks</option>
              <option value="abstract">⚡ Abstract Only</option>
              <option value="base">🔷 Base Only</option>
            </select>
          </div>

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

          {/* Minimum Sells Filter */}
          <div>
            <label style={{ color: '#a3a3a3', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Min Sells
            </label>
            <input
              type="number"
              value={filters.minSells}
              onChange={(e) => setFilters({ ...filters, minSells: e.target.value })}
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

          {/* Minimum Sell Ratio Filter */}
          <div>
            <label style={{ color: '#a3a3a3', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Min Sell Ratio
            </label>
            <input
              type="number"
              step="0.1"
              value={filters.minSellRatio}
              onChange={(e) => setFilters({ ...filters, minSellRatio: e.target.value })}
              placeholder="e.g. 2.0"
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
        {(Object.values(filters).some(f => f !== '' && f !== 'all')) && (
          <div style={{ 
            marginTop: '12px', 
            padding: '8px', 
            background: '#1a1a1a', 
            borderRadius: '6px',
            fontSize: '12px',
            color: '#10b981'
          }}>
            Showing {formatNumber(combinedData.length)} of {formatNumber([...abstractData, ...baseData].length)} addresses
            {filters.chainFilter !== 'all' && ` (${filters.chainFilter} only)`}
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
                Refreshing Global Ratio Data
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
              Processing both Abstract and Base chains...
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

      {/* Combined Data Display */}
      {([...abstractData, ...baseData].length > 0) ? (
        combinedData.length > 0 ? (
        <div style={{
          background: '#1a1a1a',
          padding: '30px',
          borderRadius: '12px',
          border: '1px solid #333'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ color: '#ffffff', margin: 0 }}>
              Global Ratio of Shame ({formatNumber(combinedData.length)} addresses)
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ color: '#ffffff', fontSize: '14px' }}>
                Sort by:
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: '6px 12px',
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontSize: '14px'
                }}
              >
                <option value="withdrawalRatio">Withdrawal Ratio</option>
                <option value="sellRatio">Sell Ratio</option>
              </select>
            </div>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', 
            gap: '16px'
          }}>
            {combinedData.map((item, index) => (
              <div 
                key={`${item.chain}-${item.address}`}
                style={{
                  background: '#262626',
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

                {/* Chain Badge */}
                <div style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '16px',
                  background: getChainColor(item.chain),
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {getChainIcon(item.chain)} {item.chain.toUpperCase()}
                </div>

                {/* Address */}
                <div style={{ 
                  marginTop: '16px',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div 
                    onClick={() => handleAddressClick(item.address, item.chain)}
                    style={{ 
                      fontFamily: 'monospace', 
                      fontSize: '14px', 
                      color: '#ffffff',
                      wordBreak: 'break-all',
                      cursor: 'pointer',
                      transition: 'color 0.2s ease',
                      flex: 1
                    }}
                    onMouseEnter={(e) => e.target.style.color = getChainColor(item.chain)}
                    onMouseLeave={(e) => e.target.style.color = '#ffffff'}
                  >
                    {item.address}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(item.address, 'Address');
                    }}
                    style={{
                      background: 'none',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      color: '#aaa',
                      cursor: 'pointer',
                      padding: '4px 6px',
                      fontSize: '12px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#333';
                      e.target.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'transparent';
                      e.target.style.color = '#aaa';
                    }}
                    title="Copy address"
                  >
                    📋
                  </button>
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
                    <span style={{ color: '#a3a3a3', fontSize: '12px' }}>Total Sells</span>
                    <div style={{ color: '#f59e0b', fontWeight: 'bold' }}>
                      {formatNumber(item.totalSells || 0)}
                    </div>
                  </div>

                  <div>
                    <span style={{ color: '#a3a3a3', fontSize: '12px' }}>Active Miners</span>
                    <div style={{ color: '#ffffff', fontWeight: 'bold' }}>
                      {formatNumber(item.activeMiners || 0)}
                    </div>
                  </div>
                </div>

                {/* Ratios */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', textAlign: 'center', padding: '8px 0' }}>
                  {/* Withdrawal Ratio */}
                  <div style={{ 
                    padding: '8px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '6px',
                    border: `1px solid ${getRatioColor(item.ratio)}`
                  }}>
                    <div style={{ color: '#a3a3a3', fontSize: '10px', marginBottom: '4px' }}>WITHDRAWAL RATIO</div>
                    <div style={{ 
                      fontSize: '18px', 
                      fontWeight: 'bold', 
                      color: getRatioColor(item.ratio),
                      marginBottom: '2px'
                    }}>
                      {formatRatio(item.ratio)}x
                    </div>
                    <div style={{ 
                      fontSize: '10px', 
                      color: getRatioColor(item.ratio),
                      fontWeight: 'bold'
                    }}>
                      {getRatioLabel(item.ratio)}
                    </div>
                  </div>

                  {/* Sell Ratio */}
                  <div style={{ 
                    padding: '8px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '6px',
                    border: `1px solid ${getSellRatioColor(item.sellRatio || 0)}`
                  }}>
                    <div style={{ color: '#a3a3a3', fontSize: '10px', marginBottom: '4px' }}>SELL RATIO</div>
                    <div style={{ 
                      fontSize: '18px', 
                      fontWeight: 'bold', 
                      color: getSellRatioColor(item.sellRatio || 0),
                      marginBottom: '2px'
                    }}>
                      {formatRatio(item.sellRatio || 0)}x
                    </div>
                    <div style={{ 
                      fontSize: '10px', 
                      color: getSellRatioColor(item.sellRatio || 0),
                      fontWeight: 'bold'
                    }}>
                      {getSellRatioLabel(item.sellRatio || 0)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        ) : (
          // Filtered results are empty
          <div style={{
            background: '#1a1a1a',
            padding: '40px',
            borderRadius: '12px',
            border: '1px solid #333',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <h3 style={{ color: '#ffffff', marginBottom: '8px' }}>No Addresses Match Filters</h3>
            <p style={{ color: '#a3a3a3', marginBottom: '20px' }}>
              Try adjusting your filter criteria or clear filters to see all addresses.
            </p>
            <button
              onClick={clearFilters}
              style={{
                padding: '10px 20px',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Clear All Filters
            </button>
          </div>
        )
      ) : (
        // No data available at all
        <div style={{
          background: '#1a1a1a',
          padding: '40px',
          borderRadius: '12px',
          border: '1px solid #333',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤷‍♀️</div>
          <h3 style={{ color: '#ffffff', marginBottom: '8px' }}>No Ratio Data Available</h3>
          <p style={{ color: '#a3a3a3', marginBottom: '20px' }}>
            Visit the individual network pages to calculate ratios first.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <Link href="/abstract" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: '#10b981',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              ⚡ Abstract
            </Link>
            <Link href="/base" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: '#3b82f6',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              🔷 Base
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}