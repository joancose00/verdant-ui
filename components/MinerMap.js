'use client';

import { useState, useEffect } from 'react';
import { formatNumber } from '../utils/formatters';
import WalletQueryModal from './WalletQueryModal';

export default function MinerMap({ savedState, onStateChange }) {
  const [miners, setMiners] = useState(savedState?.miners || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(savedState?.lastUpdated || null);

  // Sorting state
  const [sortField, setSortField] = useState(savedState?.sortField || 'pendingRewards');
  const [sortDirection, setSortDirection] = useState(savedState?.sortDirection || 'desc');

  // Copy feedback state
  const [copiedAddress, setCopiedAddress] = useState(null);

  // Modal state
  const [modalAddress, setModalAddress] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter states
  const [filters, setFilters] = useState(savedState?.filters || {
    typeFilter: 'all', // 'all', '0', '1', '2', '3' for Promo, Basic, Advanced, Elite
    livesFilter: '',
    shieldsFilter: '',
    gracePeriodFilter: 'all',
    minPendingRewards: ''
  });

  // Save state when it changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange({
        miners,
        lastUpdated,
        sortField,
        sortDirection,
        filters
      });
    }
  }, [miners, lastUpdated, sortField, sortDirection, filters]);

  // Load miner data
  const loadMinerData = async () => {
    setError('');
    setLoading(true);

    try {
      console.log('🗺️ Loading miner map data...');

      // Get all addresses with active miners from database
      const response = await fetch('/api/miner-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chain: 'base' })
      });

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      setMiners(data.miners || []);
      setLastUpdated(new Date().toISOString());

      console.log(`✅ Miner map loaded: ${data.miners?.length || 0} active miners`);

    } catch (err) {
      console.error('Miner map error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load data only if we don't have saved data
  useEffect(() => {
    if (!savedState?.miners || savedState.miners.length === 0) {
      loadMinerData();
    }
  }, []);

  // Handle column sorting
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc'); // Default to desc for most fields
    }
  };

  // Apply shield filter
  const applyShieldsFilter = (miner) => {
    if (!filters.shieldsFilter || filters.shieldsFilter === '') return true;

    const shields = miner.shields;
    const filterValue = filters.shieldsFilter;

    // Check for comparison operators
    if (filterValue.startsWith('<')) {
      const num = parseInt(filterValue.slice(1));
      return shields < num;
    }
    if (filterValue.startsWith('>')) {
      const num = parseInt(filterValue.slice(1));
      return shields > num;
    }
    if (filterValue.startsWith('<=')) {
      const num = parseInt(filterValue.slice(2));
      return shields <= num;
    }
    if (filterValue.startsWith('>=')) {
      const num = parseInt(filterValue.slice(2));
      return shields >= num;
    }
    // Exact match
    return shields === parseInt(filterValue);
  };

  // Apply filters
  const filteredMiners = miners.filter(miner => {
    // Type filter
    if (filters.typeFilter !== 'all' && miner.type !== parseInt(filters.typeFilter)) {
      return false;
    }

    // Lives filter
    if (filters.livesFilter !== '' && miner.lives !== parseInt(filters.livesFilter)) {
      return false;
    }

    // Shields filter
    if (!applyShieldsFilter(miner)) {
      return false;
    }

    // Grace period filter
    if (filters.gracePeriodFilter === 'active') {
      if (miner.gracePeriodEnd === 0 || miner.gracePeriodEnd <= Math.floor(Date.now() / 1000)) {
        return false;
      }
    } else if (filters.gracePeriodFilter === 'inactive') {
      if (miner.gracePeriodEnd > 0 && miner.gracePeriodEnd > Math.floor(Date.now() / 1000)) {
        return false;
      }
    }

    // Minimum pending rewards filter
    if (filters.minPendingRewards !== '' && parseFloat(miner.pendingRewards) < parseFloat(filters.minPendingRewards)) {
      return false;
    }

    return true;
  });

  // Sort filtered miners
  const sortedMiners = [...filteredMiners].sort((a, b) => {
    let aValue, bValue;

    switch (sortField) {
      case 'id':
        aValue = a.id;
        bValue = b.id;
        break;
      case 'type':
        aValue = a.type;
        bValue = b.type;
        break;
      case 'lives':
        aValue = a.lives;
        bValue = b.lives;
        break;
      case 'shields':
        aValue = a.shields;
        bValue = b.shields;
        break;
      case 'pendingRewards':
        aValue = parseFloat(a.pendingRewards);
        bValue = parseFloat(b.pendingRewards);
        break;
      case 'maintenanceCost':
        aValue = parseFloat(a.maintenanceCost);
        bValue = parseFloat(b.maintenanceCost);
        break;
      case 'gracePeriodEnd':
        aValue = a.gracePeriodEnd;
        bValue = b.gracePeriodEnd;
        break;
      case 'ownerRatio':
        aValue = parseFloat(a.ownerRatio);
        bValue = parseFloat(b.ownerRatio);
        break;
      default:
        aValue = a[sortField];
        bValue = b[sortField];
    }

    const comparison = sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    return comparison;
  });

  // Copy to clipboard with feedback
  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log(`${type} copied to clipboard: ${text}`);

      setCopiedAddress(text);
      setTimeout(() => setCopiedAddress(null), 2000);

    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);

      setCopiedAddress(text);
      setTimeout(() => setCopiedAddress(null), 2000);
    }
  };

  // Get miner type color
  const getTypeColor = (type) => {
    switch (type) {
      case 0: return '#10b981'; // Promo - Green
      case 1: return '#3b82f6'; // Basic - Blue
      case 2: return '#8b5cf6'; // Advanced - Purple
      case 3: return '#f59e0b'; // Elite - Orange
      default: return '#6b7280';
    }
  };

  // Get miner type name
  const getTypeName = (type) => {
    switch (type) {
      case 0: return 'Promo';
      case 1: return 'Basic';
      case 2: return 'Advanced';
      case 3: return 'Elite';
      default: return 'Unknown';
    }
  };

  // Format number with commas for better readability
  const formatRewardNumber = (num) => {
    const parts = num.toString().split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  // Get ratio color (same as Ratio of Shame)
  const getRatioColor = (ratio) => {
    if (ratio >= 2.0) return '#dc2626'; // Red for very high ratios
    if (ratio >= 1.5) return '#ea580c'; // Orange for high ratios
    if (ratio >= 1.0) return '#ca8a04'; // Yellow for medium ratios
    return '#059669'; // Green for low ratios
  };

  // Format grace period (bombing protection)
  const formatGracePeriod = (gracePeriodEnd) => {
    if (gracePeriodEnd === 0) return { text: '-', color: '#dc2626', status: 'vulnerable' };

    const currentTime = Math.floor(Date.now() / 1000);
    const timeRemaining = gracePeriodEnd - currentTime;

    if (timeRemaining <= 0) {
      return { text: '-', color: '#dc2626', status: 'vulnerable' };
    }

    // Convert seconds to hours and days
    const hours = Math.floor(timeRemaining / 3600);
    const days = Math.floor(hours / 24);

    let text, color, status;

    if (days > 0) {
      text = `${days}d ${hours % 24}h`;
      color = '#10b981'; // Green - well protected
      status = 'protected';
    } else if (hours > 0) {
      text = `${hours}h`;
      color = hours > 6 ? '#10b981' : '#f59e0b'; // Green if >6h, orange if <6h
      status = hours > 6 ? 'protected' : 'ending';
    } else {
      const minutes = Math.floor(timeRemaining / 60);
      text = `${minutes}m`;
      color = '#f59e0b'; // Orange for minutes remaining
      status = 'ending';
    }

    return { text, color, status };
  };

  return (
    <div style={{ color: '#ffffff' }}>
      {/* Header */}
      <div style={{
        background: '#1a1a1a',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #333',
        marginBottom: '30px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h3 style={{ color: '#ffffff', margin: '0 0 8px 0', fontSize: '18px' }}>
              🗺️ Active Miner Map
            </h3>
            <p style={{ color: '#a3a3a3', margin: 0, fontSize: '14px' }}>
              Detailed stats for all active miners on Base network
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button
              onClick={loadMinerData}
              disabled={loading}
              style={{
                padding: '10px 20px',
                background: loading ? '#404040' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Loading...' : 'Refresh Miners'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#a3a3a3', fontSize: '14px' }}>Active Miners:</span>
              <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '16px' }}>
                {formatNumber(sortedMiners.length)}
              </span>
            </div>
          </div>
        </div>

        {lastUpdated && (
          <div style={{ fontSize: '12px', color: '#6ee7b7', marginTop: '12px' }}>
            Last Updated: {new Date(lastUpdated).toLocaleString()}
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{
        background: '#1a1a1a',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #333',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '14px' }}>Filters:</span>

          {/* Type filter */}
          <select
            value={filters.typeFilter}
            onChange={(e) => setFilters({ ...filters, typeFilter: e.target.value })}
            style={{
              padding: '6px 12px',
              background: '#333',
              border: '1px solid #555',
              borderRadius: '4px',
              color: 'white',
              fontSize: '12px',
              cursor: 'pointer'
            }}
            title="Filter by miner type"
          >
            <option value="all">All Types</option>
            <option value="0">Promo</option>
            <option value="1">Basic</option>
            <option value="2">Advanced</option>
            <option value="3">Elite</option>
          </select>

          {/* Lives filter */}
          <select
            value={filters.livesFilter}
            onChange={(e) => setFilters({ ...filters, livesFilter: e.target.value })}
            style={{
              padding: '6px 12px',
              background: '#333',
              border: '1px solid #555',
              borderRadius: '4px',
              color: 'white',
              fontSize: '12px',
              cursor: 'pointer'
            }}
            title="Filter by number of lives"
          >
            <option value="">All Lives</option>
            <option value="1">1 Life</option>
            <option value="2">2 Lives</option>
          </select>

          {/* Shields filter */}
          <input
            type="text"
            placeholder="Shields (e.g., 2, <3, >1)"
            value={filters.shieldsFilter}
            onChange={(e) => setFilters({ ...filters, shieldsFilter: e.target.value })}
            style={{
              padding: '6px 12px',
              background: '#333',
              border: '1px solid #555',
              borderRadius: '4px',
              color: 'white',
              fontSize: '12px',
              width: '150px'
            }}
            title="Filter by shields: exact (2), less than (<3), greater than (>1)"
          />

          {/* Grace period filter */}
          <select
            value={filters.gracePeriodFilter}
            onChange={(e) => setFilters({ ...filters, gracePeriodFilter: e.target.value })}
            style={{
              padding: '6px 12px',
              background: '#333',
              border: '1px solid #555',
              borderRadius: '4px',
              color: 'white',
              fontSize: '12px',
              cursor: 'pointer'
            }}
            title="Filter by grace period status"
          >
            <option value="all">All Grace Periods</option>
            <option value="active">Protected Only</option>
            <option value="inactive">Vulnerable Only</option>
          </select>

          {/* Pending rewards filter */}
          <input
            type="number"
            placeholder="Min Rewards"
            value={filters.minPendingRewards}
            onChange={(e) => setFilters({ ...filters, minPendingRewards: e.target.value })}
            step="0.01"
            style={{
              padding: '6px 12px',
              background: '#333',
              border: '1px solid #555',
              borderRadius: '4px',
              color: 'white',
              fontSize: '12px',
              width: '120px'
            }}
            title="Minimum pending rewards (VDT)"
          />

          {/* Clear filters button */}
          <button
            onClick={() => setFilters({
              typeFilter: 'all',
              livesFilter: '',
              shieldsFilter: '',
              gracePeriodFilter: 'all',
              minPendingRewards: ''
            })}
            style={{
              padding: '6px 12px',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Clear Filters
          </button>

          {/* Filter results indicator */}
          {(filters.typeFilter !== 'all' || filters.livesFilter || filters.shieldsFilter || filters.gracePeriodFilter !== 'all' || filters.minPendingRewards) && (
            <span style={{
              color: '#10b981',
              fontSize: '12px',
              fontStyle: 'italic'
            }}>
              Showing {sortedMiners.length} of {miners.length} miners
            </span>
          )}
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
          <div style={{ color: '#ffffff', fontSize: '16px' }}>Loading active miners...</div>
        </div>
      ) : sortedMiners.length > 0 ? (
        <div style={{
          background: '#1a1a1a',
          borderRadius: '12px',
          border: '1px solid #333',
          overflow: 'hidden'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '14px'
            }}>
              <thead>
                <tr style={{ background: '#262626' }}>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#ffffff', borderRight: '1px solid #333' }}>Owner</th>
                  <th
                    onClick={() => handleSort('ownerRatio')}
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      color: '#ffffff',
                      borderRight: '1px solid #333',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    title="Click to sort by owner's withdrawal ratio"
                  >
                    Ratio {sortField === 'ownerRatio' && (
                      <span style={{ marginLeft: '4px', fontSize: '12px' }}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th
                    onClick={() => handleSort('id')}
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      color: '#ffffff',
                      borderRight: '1px solid #333',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    title="Click to sort by miner ID"
                  >
                    ID {sortField === 'id' && (
                      <span style={{ marginLeft: '4px', fontSize: '12px' }}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th
                    onClick={() => handleSort('type')}
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      color: '#ffffff',
                      borderRight: '1px solid #333',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    title="Click to sort by miner type"
                  >
                    Type {sortField === 'type' && (
                      <span style={{ marginLeft: '4px', fontSize: '12px' }}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th
                    onClick={() => handleSort('lives')}
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      color: '#ffffff',
                      borderRight: '1px solid #333',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    title="Click to sort by lives"
                  >
                    Lives {sortField === 'lives' && (
                      <span style={{ marginLeft: '4px', fontSize: '12px' }}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th
                    onClick={() => handleSort('shields')}
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      color: '#ffffff',
                      borderRight: '1px solid #333',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    title="Click to sort by shields"
                  >
                    Shields {sortField === 'shields' && (
                      <span style={{ marginLeft: '4px', fontSize: '12px' }}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th
                    onClick={() => handleSort('pendingRewards')}
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      color: '#ffffff',
                      borderRight: '1px solid #333',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    title="Click to sort by pending rewards"
                  >
                    Pending Rewards {sortField === 'pendingRewards' && (
                      <span style={{ marginLeft: '4px', fontSize: '12px' }}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th
                    onClick={() => handleSort('gracePeriodEnd')}
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      color: '#ffffff',
                      borderRight: '1px solid #333',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    title="Click to sort by bombing protection time"
                  >
                    Grace Period {sortField === 'gracePeriodEnd' && (
                      <span style={{ marginLeft: '4px', fontSize: '12px' }}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th
                    onClick={() => handleSort('maintenanceCost')}
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      color: '#ffffff',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    title="Click to sort by maintenance cost"
                  >
                    Maintenance Cost {sortField === 'maintenanceCost' && (
                      <span style={{ marginLeft: '4px', fontSize: '12px' }}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedMiners.map((miner, index) => (
                  <tr key={`${miner.owner}-${miner.id}`} style={{
                    borderBottom: '1px solid #333',
                    background: index % 2 === 0 ? '#1a1a1a' : '#222222'
                  }}>
                    <td style={{ padding: '10px', borderRight: '1px solid #333' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>🔷</span>
                        <span
                          onClick={() => {
                            setModalAddress(miner.owner);
                            setIsModalOpen(true);
                          }}
                          style={{
                            fontFamily: 'monospace',
                            color: '#3b82f6',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                          title="Click to view wallet details"
                        >
                          {miner.owner.slice(0, 6)}...{miner.owner.slice(-4)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(miner.owner, 'Address');
                          }}
                          style={{
                            background: copiedAddress === miner.owner ? '#10b981' : 'none',
                            border: `1px solid ${copiedAddress === miner.owner ? '#10b981' : '#444'}`,
                            borderRadius: '3px',
                            color: copiedAddress === miner.owner ? '#ffffff' : '#aaa',
                            cursor: 'pointer',
                            padding: '2px 6px',
                            fontSize: '10px',
                            marginLeft: '4px',
                            transition: 'all 0.2s ease'
                          }}
                          title={copiedAddress === miner.owner ? 'Copied!' : 'Copy address'}
                        >
                          {copiedAddress === miner.owner ? '✓' : '📋'}
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', borderRight: '1px solid #333' }}>
                      <span style={{
                        color: getRatioColor(parseFloat(miner.ownerRatio)),
                        fontWeight: 'bold',
                        fontSize: '12px'
                      }}>
                        {parseFloat(miner.ownerRatio).toFixed(2)}x
                      </span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', color: '#ffffff', borderRight: '1px solid #333' }}>
                      #{miner.id}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', borderRight: '1px solid #333' }}>
                      <span style={{
                        color: getTypeColor(miner.type),
                        fontWeight: 'bold',
                        fontSize: '12px'
                      }}>
                        {getTypeName(miner.type)}
                      </span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', color: miner.lives > 50 ? '#10b981' : miner.lives > 25 ? '#f59e0b' : '#dc2626', borderRight: '1px solid #333' }}>
                      {miner.lives}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', color: miner.shields > 50 ? '#10b981' : miner.shields > 25 ? '#f59e0b' : '#dc2626', borderRight: '1px solid #333' }}>
                      {miner.shields}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#10b981', borderRight: '1px solid #333' }}>
                      {formatRewardNumber(parseFloat(miner.pendingRewards).toFixed(4))} VDT
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', borderRight: '1px solid #333' }}>
                      {(() => {
                        const gracePeriod = formatGracePeriod(miner.gracePeriodEnd);
                        return (
                          <span
                            style={{
                              color: gracePeriod.color,
                              fontWeight: 'bold',
                              fontSize: '12px'
                            }}
                            title={gracePeriod.status === 'protected' ? 'Safe: Miner is protected from bombing' :
                                   gracePeriod.status === 'ending' ? 'Warning: Bombing protection ending soon' :
                                   gracePeriod.status === 'vulnerable' ? 'Vulnerable: Miner can be bombed' :
                                   'Unknown protection status'}
                          >
                            {gracePeriod.text}
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#dc2626' }}>
                      {formatRewardNumber(parseFloat(miner.maintenanceCost).toFixed(4))} VDT
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
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⛏️</div>
          <h3 style={{ color: '#ffffff', marginBottom: '8px' }}>No Active Miners</h3>
          <p style={{ color: '#a3a3a3', marginBottom: '0' }}>
            No active miners found. Click "Refresh Miners" to scan for active miners.
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