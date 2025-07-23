'use client';

import React, { useState, useEffect } from 'react';
import { formatNumber, formatAddress } from '../utils/formatters';
import { useRouter } from 'next/navigation';

export default function SellTransactions({ chain = 'base' }) {
  const router = useRouter();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [processingNext, setProcessingNext] = useState(false);
  const [error, setError] = useState(null);
  const [lpAddress, setLpAddress] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [scanProgress, setScanProgress] = useState(null);
  const [recheckingTx, setRecheckingTx] = useState(null);
  const [recheckLogs, setRecheckLogs] = useState({});
  const [sortBy, setSortBy] = useState('time'); // 'time', 'amount', 'seller', 'miner'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc', 'desc'
  const [filters, setFilters] = useState({
    showMinersOnly: false,
    showNonMinersOnly: false,
    minAmount: '',
    searchSeller: '',
    searchMiner: ''
  });

  useEffect(() => {
    fetchTransactions();
  }, [chain]);

  // Sort and filter transactions
  const getSortedAndFilteredTransactions = () => {
    let filtered = [...transactions];
    
    // Apply filters
    if (filters.showMinersOnly) {
      filtered = filtered.filter(tx => tx.isMiner || tx.isIndirectMiner);
    }
    if (filters.showNonMinersOnly) {
      filtered = filtered.filter(tx => !tx.isMiner && !tx.isIndirectMiner);
    }
    if (filters.minAmount) {
      const minAmt = parseFloat(filters.minAmount);
      filtered = filtered.filter(tx => parseFloat(tx.tokenSold.amount) >= minAmt);
    }
    if (filters.searchSeller) {
      const search = filters.searchSeller.toLowerCase();
      filtered = filtered.filter(tx => 
        tx.seller.toLowerCase().includes(search)
      );
    }
    if (filters.searchMiner) {
      const search = filters.searchMiner.toLowerCase();
      filtered = filtered.filter(tx => 
        tx.minerConnection && tx.minerConnection.toLowerCase().includes(search)
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'time':
          aValue = new Date(a.timestamp || 0);
          bValue = new Date(b.timestamp || 0);
          break;
        case 'amount':
          aValue = parseFloat(a.tokenSold.amount);
          bValue = parseFloat(b.tokenSold.amount);
          break;
        case 'seller':
          aValue = a.seller.toLowerCase();
          bValue = b.seller.toLowerCase();
          break;
        case 'miner':
          aValue = (a.isMiner || a.isIndirectMiner) ? 1 : 0;
          bValue = (b.isMiner || b.isIndirectMiner) ? 1 : 0;
          break;
        default:
          return 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
    
    return filtered;
  };
  
  const sortedAndFilteredTransactions = getSortedAndFilteredTransactions();

  const fetchTransactions = async (loadMore = false) => {
    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setTransactions([]);
    }
    setError(null);
    
    try {
      const offset = loadMore ? transactions.length : 0;
      const response = await fetch(`/api/lp-transactions?chain=${chain}&loadMore=${loadMore}&offset=${offset}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch transactions');
      }
      
      if (loadMore) {
        setTransactions(prev => [...prev, ...data.transactions]);
      } else {
        setTransactions(data.transactions);
      }
      
      setLpAddress(data.lpAddress);
      setHasMore(data.hasMore || false);
      setScanProgress(data.scanProgress || null);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    fetchTransactions(true);
  };

  const handleProcessNextRange = async () => {
    setProcessingNext(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/lp-transactions?chain=${chain}&processNextRange=true`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to process next range');
      }
      
      // Refresh the transaction list
      await fetchTransactions();
    } catch (err) {
      console.error('Error processing next range:', err);
      setError(err.message);
    } finally {
      setProcessingNext(false);
    }
  };


  const getTimeAgo = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  const getExplorerUrl = (hash) => {
    if (chain === 'abstract') {
      return `https://abscan.org/tx/${hash}`;
    }
    return `https://basescan.org/tx/${hash}`;
  };

  const getAddressExplorerUrl = (address) => {
    if (chain === 'abstract') {
      return `https://abscan.org/address/${address}`;
    }
    return `https://basescan.org/address/${address}`;
  };

  const handleMinerClick = (minerAddress) => {
    // Store the address and navigate to the wallet query page
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedAddress', minerAddress);
      localStorage.setItem('selectedTab', '1'); // Wallet Query tab
      window.location.href = `/${chain}`;
    }
  };

  const handleRecheckMiner = async (tx) => {
    setRecheckingTx(tx.hash);
    setError(null);
    
    try {
      const response = await fetch('/api/lp-transactions/recheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: tx.hash, chain })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to recheck miner status');
      }
      
      // Store logs for this transaction
      setRecheckLogs(prev => ({
        ...prev,
        [tx.hash]: data.minerStatus.logs
      }));
      
      // Update the transaction in the list
      setTransactions(prev => prev.map(t => {
        if (t.hash === tx.hash) {
          return {
            ...t,
            isMiner: data.minerStatus.isMiner,
            isIndirectMiner: data.minerStatus.isIndirectMiner,
            minerConnection: data.minerStatus.minerConnection,
            traceDepth: data.minerStatus.traceDepth,
            tracePath: data.minerStatus.tracePath
          };
        }
        return t;
      }));
      
      console.log('Recheck complete:', data);
    } catch (err) {
      console.error('Error rechecking miner status:', err);
      setError(err.message);
    } finally {
      setRecheckingTx(null);
    }
  };

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
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


  const containerStyle = {
    padding: '20px',
    backgroundColor: '#0a0a0a',
    borderRadius: '8px',
    color: '#e0e0e0',
  };

  const headerStyle = {
    marginBottom: '20px',
  };

  const titleStyle = {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '10px',
    color: chain === 'abstract' ? '#00ff88' : '#00aaff',
  };

  const lpAddressStyle = {
    fontSize: '14px',
    color: '#888',
    marginBottom: '20px',
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
  };

  const thStyle = {
    textAlign: 'left',
    padding: '12px',
    borderBottom: '2px solid #333',
    color: '#aaa',
    fontSize: '14px',
    fontWeight: 'normal',
  };

  const tdStyle = {
    padding: '12px',
    borderBottom: '1px solid #222',
    fontSize: '14px',
  };

  const linkStyle = {
    color: chain === 'abstract' ? '#00ff88' : '#00aaff',
    textDecoration: 'none',
  };

  const amountStyle = {
    fontWeight: 'bold',
  };

  const refreshButtonStyle = {
    padding: '8px 16px',
    backgroundColor: chain === 'abstract' ? '#00ff88' : '#00aaff',
    color: '#000',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    marginLeft: '20px',
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          Loading sell transactions...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '40px', color: '#ff4444' }}>
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h2 style={titleStyle}>
          Sell Transactions - {chain.charAt(0).toUpperCase() + chain.slice(1)}
        </h2>
        <div style={lpAddressStyle}>
          LP Address: {formatAddress(lpAddress)}
        </div>
        
        {/* Sorting and Filtering Controls */}
        <div style={{
          background: '#1a1a1a',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #333',
          marginBottom: '20px'
        }}>
          <h3 style={{ color: '#fff', fontSize: '16px', margin: '0 0 12px 0' }}>🔧 Sort & Filter</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {/* Sort By */}
            <div>
              <label style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  background: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '14px'
                }}
              >
                <option value="time">Time</option>
                <option value="amount">VDNT Amount</option>
                <option value="seller">Seller Address</option>
                <option value="miner">Miner Status</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                Order
              </label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  background: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '14px'
                }}
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>

            {/* Minimum Amount Filter */}
            <div>
              <label style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                Min VDNT Amount
              </label>
              <input
                type="number"
                value={filters.minAmount}
                onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })}
                placeholder="e.g. 1000"
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  background: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* Seller Search */}
            <div>
              <label style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                Search Seller
              </label>
              <input
                type="text"
                value={filters.searchSeller}
                onChange={(e) => setFilters({ ...filters, searchSeller: e.target.value })}
                placeholder="0x..."
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  background: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* Miner Search */}
            <div>
              <label style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                Search Miner
              </label>
              <input
                type="text"
                value={filters.searchMiner}
                onChange={(e) => setFilters({ ...filters, searchMiner: e.target.value })}
                placeholder="0x..."
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  background: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          {/* Filter Checkboxes */}
          <div style={{ display: 'flex', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filters.showMinersOnly}
                onChange={(e) => setFilters({ 
                  ...filters, 
                  showMinersOnly: e.target.checked,
                  showNonMinersOnly: e.target.checked ? false : filters.showNonMinersOnly
                })}
                style={{ marginRight: '6px' }}
              />
              Miners Only
            </label>
            <label style={{ display: 'flex', alignItems: 'center', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filters.showNonMinersOnly}
                onChange={(e) => setFilters({ 
                  ...filters, 
                  showNonMinersOnly: e.target.checked,
                  showMinersOnly: e.target.checked ? false : filters.showMinersOnly
                })}
                style={{ marginRight: '6px' }}
              />
              Non-Miners Only
            </label>
            
            {/* Results Count */}
            <div style={{ color: '#aaa', fontSize: '12px', marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
              Showing {sortedAndFilteredTransactions.length} of {transactions.length} transactions
            </div>
          </div>
        </div>
        
        {scanProgress && (
          <div style={{ 
            marginBottom: '20px',
            padding: '12px',
            backgroundColor: '#1a1a1a',
            borderRadius: '6px',
            border: '1px solid #333'
          }}>
            <div style={{ fontSize: '14px', color: '#ccc', marginBottom: '8px' }}>
              Last Scanned Block: {scanProgress.lastScannedBlock.toLocaleString()} | 
              Total Transactions: {scanProgress.totalTransactions}
            </div>
            {scanProgress.canProcessMore && (
              <button 
                onClick={handleProcessNextRange}
                disabled={processingNext}
                style={{
                  ...refreshButtonStyle,
                  backgroundColor: processingNext ? '#333' : (chain === 'abstract' ? '#00ff88' : '#00aaff'),
                  color: processingNext ? '#666' : '#000'
                }}
              >
                {processingNext ? 'Refreshing...' : 'Refresh'}
              </button>
            )}
          </div>
        )}
      </div>

      {transactions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          No sell transactions found
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Time</th>
                <th style={thStyle}>Seller</th>
                <th style={thStyle}>Miner</th>
                <th style={thStyle}>Token Sold</th>
                <th style={thStyle}>{chain === 'abstract' ? 'ETH' : 'VIRTUAL'} Received</th>
                <th style={thStyle}>Tx Hash</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedAndFilteredTransactions.map((tx, index) => (
                <React.Fragment key={tx.hash}>
                  <tr style={{ opacity: index > 20 ? 0.7 : 1 }}>
                  <td style={tdStyle}>{getTimeAgo(tx.timestamp)}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <a 
                        href={getAddressExplorerUrl(tx.seller)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={linkStyle}
                      >
                        {formatAddress(tx.seller)}
                      </a>
                      <button
                        onClick={() => copyToClipboard(tx.seller, 'Seller address')}
                        style={{
                          background: 'none',
                          border: '1px solid #444',
                          borderRadius: '3px',
                          color: '#aaa',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          fontSize: '10px',
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
                        title="Copy seller address"
                      >
                        📋
                      </button>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    {tx.isMiner || tx.isIndirectMiner ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => handleMinerClick(tx.isMiner ? tx.seller : tx.minerConnection)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            color: tx.isMiner ? '#4CAF50' : '#ff9800',
                            textDecoration: 'underline',
                            fontSize: '14px'
                          }}
                        >
                          {formatAddress(tx.isMiner ? tx.seller : tx.minerConnection)}
                        </button>
                        <button
                          onClick={() => copyToClipboard(tx.isMiner ? tx.seller : tx.minerConnection, 'Miner address')}
                          style={{
                            background: 'none',
                            border: '1px solid #444',
                            borderRadius: '3px',
                            color: '#aaa',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            fontSize: '10px',
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
                          title="Copy miner address"
                        >
                          📋
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: '#666', fontStyle: 'italic' }}>
                        None
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={amountStyle}>
                      {formatNumber(parseFloat(tx.tokenSold.amount))} {tx.tokenSold.symbol}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ ...amountStyle, color: '#4CAF50' }}>
                      {formatNumber(parseFloat(tx.ethReceived.amount))} {chain === 'abstract' ? 'ETH' : 'VIRTUAL'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <a 
                        href={getExplorerUrl(tx.hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={linkStyle}
                      >
                        {tx.hash.slice(0, 8)}...
                      </a>
                      <button
                        onClick={() => copyToClipboard(tx.hash, 'Transaction hash')}
                        style={{
                          background: 'none',
                          border: '1px solid #444',
                          borderRadius: '3px',
                          color: '#aaa',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          fontSize: '10px',
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
                        title="Copy transaction hash"
                      >
                        📋
                      </button>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => handleRecheckMiner(tx)}
                      disabled={recheckingTx === tx.hash}
                      style={{
                        padding: '4px 12px',
                        backgroundColor: recheckingTx === tx.hash ? '#333' : '#444',
                        color: recheckingTx === tx.hash ? '#666' : '#fff',
                        border: '1px solid #555',
                        borderRadius: '4px',
                        cursor: recheckingTx === tx.hash ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        transition: 'all 0.2s'
                      }}
                    >
                      {recheckingTx === tx.hash ? 'Checking...' : 'Recheck'}
                    </button>
                  </td>
                  </tr>
                  {recheckLogs[tx.hash] && (
                    <tr>
                    <td colSpan="7" style={{ 
                      padding: '12px', 
                      backgroundColor: '#0f0f0f',
                      borderBottom: '1px solid #222'
                    }}>
                      <details>
                        <summary style={{ 
                          cursor: 'pointer', 
                          color: '#888',
                          fontSize: '13px',
                          marginBottom: '8px'
                        }}>
                          View trace logs ({recheckLogs[tx.hash].length} entries)
                        </summary>
                        <pre style={{ 
                          fontSize: '11px', 
                          color: '#666',
                          whiteSpace: 'pre-wrap',
                          marginTop: '8px',
                          padding: '8px',
                          backgroundColor: '#080808',
                          borderRadius: '4px',
                          maxHeight: '300px',
                          overflow: 'auto'
                        }}>
                          {recheckLogs[tx.hash].join('\n')}
                        </pre>
                      </details>
                    </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button 
            onClick={handleLoadMore}
            disabled={loadingMore}
            style={{
              padding: '12px 24px',
              backgroundColor: loadingMore ? '#333' : (chain === 'abstract' ? '#00ff88' : '#00aaff'),
              color: loadingMore ? '#666' : '#000',
              border: 'none',
              borderRadius: '6px',
              cursor: loadingMore ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            {loadingMore ? 'Loading...' : 'Load More Transactions'}
          </button>
        </div>
      )}
    </div>
  );
}