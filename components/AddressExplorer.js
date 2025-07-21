'use client';

import { useState } from 'react';

export default function AddressExplorer({ chain, onAddressSelect }) {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [maxMiners, setMaxMiners] = useState(500);

  const scanAddresses = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/scan-addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chain, maxMiners })
      });

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      setAddresses(data.addresses);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ color: '#a3a3a3', fontSize: '14px' }}>Scan limit:</label>
          <select
            value={maxMiners}
            onChange={(e) => setMaxMiners(parseInt(e.target.value))}
            style={{
              padding: '6px 12px',
              border: '1px solid #333',
              borderRadius: '6px',
              background: '#262626',
              color: '#ffffff',
              fontSize: '14px'
            }}
            disabled={loading}
          >
            <option value={100}>100 miners</option>
            <option value={500}>500 miners</option>
            <option value={1000}>1000 miners</option>
            <option value={2000}>2000 miners</option>
          </select>
        </div>

        <button
          onClick={scanAddresses}
          disabled={loading}
          style={{
            padding: '8px 20px',
            background: loading ? '#404040' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Scanning...' : 'Scan for Addresses'}
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

      {addresses.length > 0 && (
        <div>
          <h3 style={{ color: '#ffffff', margin: '20px 0 15px 0' }}>
            Found Addresses ({addresses.length})
          </h3>
          
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
                onClick={() => onAddressSelect(address)}
                style={{
                  padding: '12px',
                  background: '#262626',
                  borderRadius: '8px',
                  border: '1px solid #333',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#333';
                  e.target.style.borderColor = '#555';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#262626';
                  e.target.style.borderColor = '#333';
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
                <span style={{ 
                  color: '#ffffff',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all'
                }}>
                  {address}
                </span>
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
              💡 <strong>Tip:</strong> Click on any address above to automatically query their miner stats and metrics!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}