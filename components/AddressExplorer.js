'use client';

import { useState, useEffect } from 'react';
import { formatNumber } from '../utils/formatters';

export default function AddressExplorer({ chain, onAddressSelect }) {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const maxMiners = 100;
  const [fromCache, setFromCache] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [scanProgress, setScanProgress] = useState(null);
  const [scanNotification, setScanNotification] = useState(null);

  const scanForMoreAddresses = async () => {
    setError('');
    setLoading(true);
    setScanNotification(null); // Clear previous notification

    try {
      const response = await fetch('/api/scan-addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chain, maxMiners, scanType: 'incremental' })
      });

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      setAddresses(data.addresses || []);
      setFromCache(data.fromCache);
      setLastUpdated(data.lastUpdated || new Date().toISOString());
      setScanProgress(data.scanProgress);

      // Show scan results notification
      const notification = {
        type: 'success',
        newAddresses: data.newAddressesFound || 0,
        scannedMiners: data.scannedMiners || 0,
        totalAddresses: data.totalAddresses || 0,
        scanDuration: data.scanDuration ? Math.round(data.scanDuration / 1000) : 0
      };
      setScanNotification(notification);

      // Auto-hide notification after 8 seconds
      setTimeout(() => setScanNotification(null), 8000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCachedAddresses = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`/api/scan-addresses?chain=${chain}`, {
        method: 'GET'
      });

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      setAddresses(data.addresses || []);
      setFromCache(data.fromCache);
      setLastUpdated(data.lastUpdated);
      setScanProgress(data.scanProgress);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load cached addresses on component mount and chain change
  useEffect(() => {
    loadCachedAddresses();
  }, [chain]);

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

  return (
    <div style={{ 
      background: '#1a1a1a', 
      padding: '30px', 
      borderRadius: '12px', 
      border: '1px solid #333',
      marginBottom: '30px'
    }}>
      <h2 style={{ color: '#ffffff', marginTop: 0 }}>Address Explorer</h2>
      <p style={{ color: '#a3a3a3', margin: '0 0 20px 0' }}>
        Discover addresses that own miners on the {chain} network
      </p>

      <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          onClick={scanForMoreAddresses}
          disabled={loading}
          style={{
            padding: '8px 16px',
            background: loading ? '#404040' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Scanning...' : 'Scan for More'}
        </button>
      </div>

      {scanNotification && (
        <div style={{ 
          margin: '0 0 20px 0',
          padding: '15px',
          background: '#0f3b0f',
          borderRadius: '8px',
          border: '2px solid #10b981',
          position: 'relative',
          animation: 'slideIn 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '18px' }}>✅</span>
                <h4 style={{ margin: 0, color: '#10b981', fontSize: '16px', fontWeight: 'bold' }}>
                  Scan Complete!
                </h4>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '8px' }}>
                <div>
                  <span style={{ color: '#6ee7b7', fontSize: '12px' }}>New Addresses Found</span>
                  <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '18px' }}>
                    {scanNotification.newAddresses}
                  </div>
                </div>
                
                <div>
                  <span style={{ color: '#6ee7b7', fontSize: '12px' }}>Miners Scanned</span>
                  <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '18px' }}>
                    {scanNotification.scannedMiners}
                  </div>
                </div>
                
                <div>
                  <span style={{ color: '#6ee7b7', fontSize: '12px' }}>Total Addresses</span>
                  <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '18px' }}>
                    {scanNotification.totalAddresses}
                  </div>
                </div>
                
                <div>
                  <span style={{ color: '#6ee7b7', fontSize: '12px' }}>Duration</span>
                  <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '18px' }}>
                    {scanNotification.scanDuration}s
                  </div>
                </div>
              </div>
              
              {scanNotification.newAddresses === 0 ? (
                <p style={{ margin: 0, color: '#a3a3a3', fontSize: '14px', fontStyle: 'italic' }}>
                  No new addresses found.
                </p>
              ) : (
                <p style={{ margin: 0, color: '#6ee7b7', fontSize: '14px' }}>
                  🎉 Great! Found {scanNotification.newAddresses} new addresses with miners.
                </p>
              )}
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
              title="Dismiss notification"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {scanProgress && (
        <div style={{ 
          margin: '15px 0',
          padding: '15px',
          background: '#0f0f0f',
          borderRadius: '8px',
          border: '1px solid #333'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 style={{ margin: 0, color: '#ffffff', fontSize: '14px' }}>Scan Progress</h4>
            {scanProgress.hasMore && (
              <span style={{ 
                color: '#f59e0b', 
                fontSize: '12px',
                padding: '2px 8px',
                background: '#7c2d12',
                borderRadius: '4px',
                border: '1px solid #f59e0b'
              }}>
                More available
              </span>
            )}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
            <div>
              <span style={{ color: '#a3a3a3', fontSize: '12px' }}>Last Checked ID</span>
              <div style={{ color: '#ffffff', fontWeight: 'bold' }}>
                {scanProgress.lastCheckedMinerId?.toLocaleString() || 0}
              </div>
            </div>
            
            <div>
              <span style={{ color: '#a3a3a3', fontSize: '12px' }}>Total in Contract</span>
              <div style={{ color: '#ffffff', fontWeight: 'bold' }}>
                {scanProgress.totalMinersInContract?.toLocaleString() || 'Unknown'}
              </div>
            </div>
            
            <div>
              <span style={{ color: '#a3a3a3', fontSize: '12px' }}>Coverage</span>
              <div style={{ color: '#10b981', fontWeight: 'bold' }}>
                {scanProgress.totalMinersInContract && scanProgress.lastCheckedMinerId 
                  ? `${Math.round((scanProgress.lastCheckedMinerId / scanProgress.totalMinersInContract) * 100)}%`
                  : '0%'}
              </div>
            </div>
          </div>
          
          {scanProgress.totalMinersInContract && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ 
                background: '#333', 
                height: '6px', 
                borderRadius: '3px', 
                overflow: 'hidden' 
              }}>
                <div style={{
                  background: '#10b981',
                  height: '100%',
                  width: `${Math.min((scanProgress.lastCheckedMinerId / scanProgress.totalMinersInContract) * 100, 100)}%`,
                  borderRadius: '3px',
                  transition: 'width 0.3s ease'
                }}></div>
              </div>
            </div>
          )}
        </div>
      )}

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

      {addresses.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 15px 0' }}>
            <h3 style={{ color: '#ffffff', margin: 0 }}>
              Found Addresses ({addresses.length})
            </h3>
            
            {fromCache && lastUpdated && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                padding: '6px 12px',
                background: '#0f3b0f',
                borderRadius: '6px',
                border: '1px solid #10b981'
              }}>
                <div style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  background: '#10b981' 
                }}></div>
                <span style={{ color: '#6ee7b7', fontSize: '12px' }}>
                  Cached: {new Date(lastUpdated).toLocaleDateString()}
                </span>
              </div>
            )}
            
            {!fromCache && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                padding: '6px 12px',
                background: '#1e3a8a',
                borderRadius: '6px',
                border: '1px solid #3b82f6'
              }}>
                <div style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  background: '#3b82f6' 
                }}></div>
                <span style={{ color: '#93bbfc', fontSize: '12px' }}>
                  Updated
                </span>
              </div>
            )}
          </div>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
            gap: '12px',
            maxHeight: '400px',
            overflowY: 'auto',
            padding: '10px',
            border: '1px solid #333',
            borderRadius: '8px',
            background: '#0f0f0f'
          }}>
            {addresses.map((address, index) => (
              <div 
                key={address}
                style={{
                  padding: '12px',
                  background: '#262626',
                  borderRadius: '8px',
                  border: '1px solid #333',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <div style={{
                  background: '#3b82f6',
                  color: 'white',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  flexShrink: 0
                }}>
                  {index + 1}
                </div>
                <div 
                  onClick={() => onAddressSelect(address)}
                  style={{ 
                    color: '#ffffff',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                    cursor: 'pointer',
                    flex: 1,
                    transition: 'color 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.color = '#3b82f6'}
                  onMouseLeave={(e) => e.target.style.color = '#ffffff'}
                >
                  {address}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(address, 'Address');
                  }}
                  style={{
                    background: 'none',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#aaa',
                    cursor: 'pointer',
                    padding: '4px 6px',
                    fontSize: '12px',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
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
            ))}
          </div>
          
          <div style={{ 
            marginTop: '15px', 
            padding: '12px', 
            background: '#0f3b0f', 
            borderRadius: '6px',
            border: '1px solid #10b981'
          }}>
            <p style={{ margin: 0, color: '#6ee7b7', fontSize: '14px' }}>
              💡 <strong>Tip:</strong> Click on any address above to automatically query their miner stats and metrics! Use "Scan for More" to discover additional addresses.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}