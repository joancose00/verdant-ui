'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import TabNavigation from '../../components/TabNavigation';
import AddressExplorer from '../../components/AddressExplorer';
import WalletQueryInterface from '../../components/WalletQueryInterface';
import RatioOfShame from '../../components/RatioOfShame';

export default function AbstractPage() {
  const chain = 'abstract';
  const [selectedAddress, setSelectedAddress] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  // Check localStorage for selected address and tab on mount
  useEffect(() => {
    const storedAddress = localStorage.getItem('selectedAddress');
    const storedTab = localStorage.getItem('selectedTab');
    
    if (storedAddress) {
      setSelectedAddress(storedAddress);
      localStorage.removeItem('selectedAddress'); // Clean up
    }
    
    if (storedTab) {
      setActiveTab(parseInt(storedTab));
      localStorage.removeItem('selectedTab'); // Clean up
    }
  }, []);
  
  const handleAddressSelect = (address) => {
    setSelectedAddress(address);
    setActiveTab(1); // Switch to Wallet Query tab
  };
  
  const tabs = [
    {
      label: 'Address Explorer',
      icon: '🔍',
      content: <AddressExplorer chain={chain} onAddressSelect={handleAddressSelect} />
    },
    {
      label: 'Wallet Query',
      icon: '💰',
      content: <WalletQueryInterface chain={chain} prefilledAddress={selectedAddress} />
    },
    {
      label: 'Ratio of Shame',
      icon: '📊',
      content: <RatioOfShame chain={chain} onAddressSelect={handleAddressSelect} />
    }
  ];

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
          color: '#10b981', 
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
          background: 'linear-gradient(45deg, #10b981, #34d399)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          ⚡ Abstract Network
        </h1>
        
        <p style={{ color: '#a3a3a3', fontSize: '18px', margin: 0 }}>
          Explore miners, query wallets, and view withdrawal ratios on Abstract
        </p>
      </div>

      {/* Tabs */}
      <TabNavigation 
        tabs={tabs} 
        activeTab={activeTab}
        onTabChange={setActiveTab}
        defaultTab={0} 
      />
    </div>
  );
}