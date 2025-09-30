'use client';

import { useState, useEffect } from 'react';
import { formatNumber, formatRatio } from '../utils/formatters';
import WalletQueryModal from './WalletQueryModal';

export default function RatioOfShameTab({ savedState, onStateChange }) {
  const [baseData, setBaseData] = useState(savedState?.baseData || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(savedState?.lastUpdated || { base: null });
  const [isMobile, setIsMobile] = useState(false);

  // Filter state - simple checkbox for active miners only (default: true)
  const [showActiveMinersOnly, setShowActiveMinersOnly] = useState(
    savedState?.showActiveMinersOnly !== undefined ? savedState.showActiveMinersOnly : true
  );

  // Sorting state
  const [sortField, setSortField] = useState(savedState?.sortField || 'ratio');
  const [sortDirection, setSortDirection] = useState(savedState?.sortDirection || 'desc');

  // Copy feedback state
  const [copiedAddress, setCopiedAddress] = useState(null);

  // Modal state
  const [modalAddress, setModalAddress] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Save state when it changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange({
        baseData,
        lastUpdated,
        showActiveMinersOnly,
        sortField,
        sortDirection
      });
    }
  }, [baseData, lastUpdated, showActiveMinersOnly, sortField, sortDirection]);

  // Set up mobile detection and load cached data
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    if (!savedState?.baseData || savedState.baseData.length === 0) {
      loadCachedData();
    }

    return () => {
      window.removeEventListener('resize', checkIsMobile);
    };
  }, []);

  const loadCachedData = async () => {
    setError('');
    setLoading(true);

    try {
      console.log('📋 Loading cached ratio data for Base chain...');

      // Load cached data from base chain via GET request
      const baseResponse = await fetch('/api/ratio-data?chain=base');
      const baseResult = await baseResponse.json();

      if (baseResult.error) console.error('Base error:', baseResult.error);

      // Add chain info to each item
      const baseWithChain = (baseResult.ratioData || []).map(item => ({
        ...item,
        chain: 'base'
      }));

      setBaseData(baseWithChain);
      setLastUpdated({
        base: baseResult.lastUpdated
      });

      console.log(`✅ Cached data loaded - Base: ${baseWithChain.length} addresses`);

    } catch (err) {
      console.error('Global data load error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshAllData = async () => {
    setError('');
    setLoading(true);

    try {
      console.log('🔄 Refreshing ALL addresses for Base chain...');

      const baseResponse = await fetch('/api/ratio-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain: 'base',
          scanType: 'scanEverything',
          batchSize: 10  // Reduced from 50 to prevent timeouts
        })
      });

      // Check if the response is ok and is JSON
      if (!baseResponse.ok) {
        const errorText = await baseResponse.text();
        throw new Error(`API request failed (${baseResponse.status}): ${errorText}`);
      }

      // Check Content-Type header
      const contentType = baseResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await baseResponse.text();
        throw new Error(`Expected JSON response but got: ${responseText.substring(0, 100)}`);
      }

      const baseResult = await baseResponse.json();

      if (baseResult.error) console.error('Base error:', baseResult.error);

      const baseWithChain = (baseResult.ratioData || []).map(item => ({
        ...item,
        chain: 'base'
      }));

      setBaseData(baseWithChain);
      setLastUpdated({
        base: baseResult.lastUpdated
      });

      console.log(`✅ Refresh All complete - Base: ${baseWithChain.length} addresses`);

    } catch (err) {
      console.error('Refresh All error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshActiveData = async () => {
    setError('');
    setLoading(true);

    try {
      console.log('🔄 Refreshing ACTIVE addresses for Base chain...');

      const baseResponse = await fetch('/api/ratio-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain: 'base',
          scanType: 'scanAllActive',
          batchSize: 10  // Reduced from 50 to prevent timeouts
        })
      });

      // Check if the response is ok and is JSON
      if (!baseResponse.ok) {
        const errorText = await baseResponse.text();
        throw new Error(`API request failed (${baseResponse.status}): ${errorText}`);
      }

      // Check Content-Type header
      const contentType = baseResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await baseResponse.text();
        throw new Error(`Expected JSON response but got: ${responseText.substring(0, 100)}`);
      }

      const baseResult = await baseResponse.json();

      if (baseResult.error) console.error('Base error:', baseResult.error);

      const baseWithChain = (baseResult.ratioData || []).map(item => ({
        ...item,
        chain: 'base'
      }));

      setBaseData(baseWithChain);
      setLastUpdated({
        base: baseResult.lastUpdated
      });

      console.log(`✅ Refresh Active complete - Base: ${baseWithChain.length} addresses`);

      // Also refresh 14-day ratios for addresses with active miners
      console.log('🔄 Refreshing 14-day ratios for addresses with active miners...');

      const refresh14DayResponse = await fetch('/api/refresh-14d-ratios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      // Check if the response is ok and is JSON
      if (!refresh14DayResponse.ok) {
        const errorText = await refresh14DayResponse.text();
        console.warn(`14-day ratio refresh failed (${refresh14DayResponse.status}): ${errorText}`);
        // Continue without throwing - this is not critical
      }

      const contentType14d = refresh14DayResponse.headers.get('content-type');
      if (!contentType14d || !contentType14d.includes('application/json')) {
        const responseText = await refresh14DayResponse.text();
        console.warn(`14-day refresh expected JSON but got: ${responseText.substring(0, 100)}`);
        // Continue without throwing - this is not critical
      }

      const refresh14DayResult = refresh14DayResponse.ok ? await refresh14DayResponse.json() : { success: false };

      if (refresh14DayResult.success) {
        console.log(`✅ 14-day ratios refreshed for ${refresh14DayResult.updatedCount} addresses`);

        // Reload the ratio data to get the updated 14-day ratios
        const updatedBaseResponse = await fetch('/api/ratio-data?chain=base');

        // Check if the response is ok and is JSON
        if (!updatedBaseResponse.ok) {
          console.warn(`Failed to reload ratio data (${updatedBaseResponse.status})`);
          return; // Exit early but don't throw
        }

        const updatedContentType = updatedBaseResponse.headers.get('content-type');
        if (!updatedContentType || !updatedContentType.includes('application/json')) {
          const responseText = await updatedBaseResponse.text();
          console.warn(`Expected JSON response but got: ${responseText.substring(0, 100)}`);
          return; // Exit early but don't throw
        }

        const updatedBaseResult = await updatedBaseResponse.json();

        if (!updatedBaseResult.error) {
          const updatedBaseWithChain = (updatedBaseResult.ratioData || []).map(item => ({
            ...item,
            chain: 'base'
          }));
          setBaseData(updatedBaseWithChain);
          setLastUpdated({
            base: updatedBaseResult.lastUpdated
          });
        }
      } else {
        console.warn('14-day ratio refresh failed:', refresh14DayResult.error);
      }

    } catch (err) {
      console.error('Refresh Active error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle column sorting
  const handleSort = (field) => {
    if (sortField === field) {
      // Same field, toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to desc for numeric fields
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filter and sort data
  const combinedData = [...baseData]
    .filter(item => {
      // Filter by active miners only if checkbox is checked
      if (showActiveMinersOnly && parseInt(item.activeMiners) === 0) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      let aValue, bValue;

      switch (sortField) {
        case 'deposits':
          aValue = parseFloat(a.totalDeposits);
          bValue = parseFloat(b.totalDeposits);
          break;
        case 'withdrawals':
          aValue = parseFloat(a.totalWithdrawals);
          bValue = parseFloat(b.totalWithdrawals);
          break;
        case 'ratio':
          aValue = parseFloat(a.ratio);
          bValue = parseFloat(b.ratio);
          break;
        case 'ratio14d':
          aValue = parseFloat(a.ratio14d || 0);
          bValue = parseFloat(b.ratio14d || 0);
          break;
        default:
          aValue = parseFloat(a.ratio);
          bValue = parseFloat(b.ratio);
          break;
      }

      const comparison = sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      return comparison;
    });

  const getRatioColor = (ratio) => {
    if (ratio >= 2.0) return '#dc2626'; // Red for very high ratios
    if (ratio >= 1.5) return '#ea580c'; // Orange for high ratios
    if (ratio >= 1.0) return '#ca8a04'; // Yellow for medium ratios
    return '#059669'; // Green for low ratios
  };


  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log(`${type} copied to clipboard: ${text}`);

      // Show visual feedback
      setCopiedAddress(text);
      setTimeout(() => setCopiedAddress(null), 2000); // Clear after 2 seconds

    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);

      // Show visual feedback even for fallback
      setCopiedAddress(text);
      setTimeout(() => setCopiedAddress(null), 2000);
    }
  };

  const handleAddressClick = (address) => {
    setModalAddress(address);
    setIsModalOpen(true);
  };

  return (
    <div style={{ color: '#ffffff' }}>
      {/* Header with stats and controls */}
      <div style={{
        background: '#1a1a1a',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #333',
        marginBottom: '30px'
      }}>
        <div style={{
          display: 'flex',
          gap: isMobile ? '10px' : '20px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={refreshAllData}
            disabled={loading}
            style={{
              padding: isMobile ? '8px 12px' : '10px 20px',
              background: loading ? '#404040' : '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: isMobile ? '12px' : '14px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
            title="Update ratios for ALL addresses in database"
          >
            {loading ? 'Loading...' : 'Refresh All'}
          </button>

          <button
            onClick={refreshActiveData}
            disabled={loading}
            style={{
              padding: isMobile ? '8px 12px' : '10px 20px',
              background: loading ? '#404040' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: isMobile ? '12px' : '14px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
            title="Update ratios and 14-day ratios for addresses with active miners only"
          >
            {loading ? 'Loading...' : 'Refresh Active'}
          </button>

          <div style={{
            color: '#a3a3a3',
            fontSize: '12px',
            fontStyle: 'italic',
            maxWidth: '200px',
            lineHeight: '1.3'
          }}>
            ⚠️ Refresh operations may take several minutes to complete
          </div>


          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#a3a3a3', fontSize: '14px' }}>Total Addresses:</span>
            <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '16px' }}>
              {formatNumber(combinedData.length)}
            </span>
          </div>

          {lastUpdated.base && (
            <div style={{ fontSize: '12px', color: '#6ee7b7' }}>
              Last Updated: {new Date(lastUpdated.base).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Filter Toggle */}
      <div style={{
        background: '#1a1a1a',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #333',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="checkbox"
            id="activeMinersOnly"
            checked={showActiveMinersOnly}
            onChange={(e) => setShowActiveMinersOnly(e.target.checked)}
            style={{
              width: '16px',
              height: '16px',
              accentColor: '#10b981'
            }}
          />
          <label
            htmlFor="activeMinersOnly"
            style={{
              color: '#ffffff',
              fontSize: '14px',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            Show only addresses with active miners
          </label>
          <span style={{
            color: '#6b7280',
            fontSize: '12px',
            marginLeft: '8px'
          }}>
            ({showActiveMinersOnly
              ? `${combinedData.length} active`
              : `${combinedData.length} total`} addresses)
          </span>
        </div>
      </div>

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

      {/* Data Display */}
      {loading ? (
        <div style={{
          background: '#1a1a1a',
          padding: '40px',
          borderRadius: '12px',
          border: '1px solid #333',
          textAlign: 'center'
        }}>
          <div style={{ color: '#ffffff', fontSize: '16px' }}>Loading ratio data...</div>
        </div>
      ) : combinedData.length > 0 ? (
        <div style={{
          background: '#1a1a1a',
          borderRadius: '12px',
          border: '1px solid #333',
          overflow: 'hidden'
        }}>
          <div style={{
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: isMobile ? '12px' : '14px',
              minWidth: isMobile ? '800px' : 'auto'
            }}>
              <thead>
                <tr style={{ background: '#262626' }}>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#ffffff', borderRight: '1px solid #333' }}>#</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#ffffff', borderRight: '1px solid #333' }}>Address</th>
                  <th
                    onClick={() => handleSort('deposits')}
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      color: '#ffffff',
                      borderRight: '1px solid #333',
                      cursor: 'pointer',
                      userSelect: 'none',
                      position: 'relative'
                    }}
                    title="Click to sort by deposits"
                  >
                    Deposits {sortField === 'deposits' && (
                      <span style={{ marginLeft: '4px', fontSize: '12px' }}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th
                    onClick={() => handleSort('withdrawals')}
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      color: '#ffffff',
                      borderRight: '1px solid #333',
                      cursor: 'pointer',
                      userSelect: 'none',
                      position: 'relative'
                    }}
                    title="Click to sort by withdrawals"
                  >
                    Withdrawals {sortField === 'withdrawals' && (
                      <span style={{ marginLeft: '4px', fontSize: '12px' }}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th
                    onClick={() => handleSort('ratio')}
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      color: '#ffffff',
                      borderRight: '1px solid #333',
                      cursor: 'pointer',
                      userSelect: 'none',
                      position: 'relative'
                    }}
                    title="Click to sort by ratio"
                  >
                    Ratio {sortField === 'ratio' && (
                      <span style={{ marginLeft: '4px', fontSize: '12px' }}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th
                    onClick={() => handleSort('ratio14d')}
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      color: '#ffffff',
                      borderRight: '1px solid #333',
                      cursor: 'pointer',
                      userSelect: 'none',
                      position: 'relative'
                    }}
                    title="Click to sort by 14-day ratio (claimed/spent)"
                  >
                    14-Day Ratio {sortField === 'ratio14d' && (
                      <span style={{ marginLeft: '4px', fontSize: '12px' }}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th style={{ padding: '12px', textAlign: 'center', color: '#ffffff' }}>Active Miners</th>
                </tr>
              </thead>
              <tbody>
                {combinedData.map((item, index) => (
                  <tr key={item.address} style={{
                    borderBottom: '1px solid #333',
                    background: index % 2 === 0 ? '#1a1a1a' : '#222222'
                  }}>
                    <td style={{ padding: '10px', color: '#a3a3a3', borderRight: '1px solid #333' }}>
                      {index + 1}
                    </td>
                    <td style={{ padding: '10px', borderRight: '1px solid #333' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>🔷</span>
                        <span
                          onClick={() => handleAddressClick(item.address)}
                          style={{
                            fontFamily: 'monospace',
                            color: '#3b82f6',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                          title="Click to view in Wallet Query"
                        >
                          {item.address.slice(0, 8)}...{item.address.slice(-6)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(item.address, 'Address');
                          }}
                          style={{
                            background: copiedAddress === item.address ? '#10b981' : 'none',
                            border: `1px solid ${copiedAddress === item.address ? '#10b981' : '#444'}`,
                            borderRadius: '3px',
                            color: copiedAddress === item.address ? '#ffffff' : '#aaa',
                            cursor: 'pointer',
                            padding: '2px 6px',
                            fontSize: '10px',
                            marginLeft: '4px',
                            transition: 'all 0.2s ease'
                          }}
                          title={copiedAddress === item.address ? 'Copied!' : 'Copy address'}
                        >
                          {copiedAddress === item.address ? '✓' : '📋'}
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#10b981', borderRight: '1px solid #333' }}>
                      {formatNumber(item.totalDeposits)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#dc2626', borderRight: '1px solid #333' }}>
                      {formatNumber(item.totalWithdrawals)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', borderRight: '1px solid #333' }}>
                      <span style={{
                        color: getRatioColor(parseFloat(item.ratio)),
                        fontWeight: 'bold'
                      }}>
                        {formatRatio(item.ratio)}
                      </span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', borderRight: '1px solid #333' }}>
                      {item.ratio14dCalculated ? (
                        <span style={{
                          color: item.ratio14d >= 999 ? '#dc2626' : getRatioColor(parseFloat(item.ratio14d)),
                          fontWeight: 'bold'
                        }}>
                          {item.ratio14d >= 999 ? '∞' : formatRatio(item.ratio14d)}
                        </span>
                      ) : (
                        <span style={{ color: '#6b7280', fontSize: '12px' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', color: item.activeMiners > 0 ? '#10b981' : '#6b7280' }}>
                      {item.activeMiners}/{item.totalMiners}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{
          background: '#1a1a1a',
          padding: '40px',
          borderRadius: '12px',
          border: '1px solid #333',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
          <h3 style={{ color: '#ffffff', marginBottom: '8px' }}>No Ratio Data</h3>
          <p style={{ color: '#a3a3a3', marginBottom: '0' }}>
            No addresses found. Click "Refresh All" or "Refresh Active" to load data.
          </p>
        </div>
      )}

      {/* Wallet Query Modal */}
      <WalletQueryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        address={modalAddress}
        chain="base"
      />
    </div>
  );
}