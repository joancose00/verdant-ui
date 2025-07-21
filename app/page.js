'use client';

import { useState } from 'react';
import WalletQueryInterface from '../components/WalletQueryInterface';
import AddressExplorer from '../components/AddressExplorer';

export default function Home() {
  const [chain, setChain] = useState('abstract');
  const [selectedAddress, setSelectedAddress] = useState('');

  return (
    <main style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '40px', color: '#ffffff' }}>Verdant Wallet Query Interface</h1>
      
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px' }}>
        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          padding: '8px', 
          background: '#1a1a1a', 
          borderRadius: '8px',
          border: '1px solid #333'
        }}>
          <button
            onClick={() => setChain('abstract')}
            style={{
              padding: '10px 20px',
              border: '1px solid #333',
              borderRadius: '6px',
              cursor: 'pointer',
              background: chain === 'abstract' ? '#3b82f6' : '#262626',
              color: '#ffffff',
              fontWeight: 'bold',
              transition: 'all 0.2s'
            }}
          >
            Abstract
          </button>
          <button
            onClick={() => setChain('base')}
            style={{
              padding: '10px 20px',
              border: '1px solid #333',
              borderRadius: '6px',
              cursor: 'pointer',
              background: chain === 'base' ? '#3b82f6' : '#262626',
              color: '#ffffff',
              fontWeight: 'bold',
              transition: 'all 0.2s'
            }}
          >
            Base
          </button>
        </div>
      </div>

      <AddressExplorer 
        chain={chain} 
        onAddressSelect={(address) => setSelectedAddress(address)} 
      />
      
      <WalletQueryInterface 
        chain={chain} 
        prefilledAddress={selectedAddress}
      />
    </main>
  );
}