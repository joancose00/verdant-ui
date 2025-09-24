'use client';

import { useState, useEffect } from 'react';
import TabNavigation from '../components/TabNavigation';
import AddressExplorer from '../components/AddressExplorer';
import WalletQueryInterface from '../components/WalletQueryInterface';
import RatioOfShameTab from '../components/RatioOfShameTab';
import MinerMap from '../components/MinerMap';

export default function Home() {
  const chain = 'base';
  const [selectedAddress, setSelectedAddress] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // State preservation for each tab
  const [tabStates, setTabStates] = useState({});

  // Check localStorage for selected address and tab on mount
  useEffect(() => {
    // Set mobile state
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    const storedAddress = localStorage.getItem('selectedAddress');
    const storedTab = localStorage.getItem('selectedTab');

    // Load saved tab states from localStorage
    const savedTabStates = localStorage.getItem('tabStates');
    if (savedTabStates) {
      try {
        setTabStates(JSON.parse(savedTabStates));
      } catch (e) {
        console.error('Failed to load tab states:', e);
      }
    }

    if (storedAddress) {
      setSelectedAddress(storedAddress);
      localStorage.removeItem('selectedAddress'); // Clean up
    }

    if (storedTab) {
      setActiveTab(parseInt(storedTab));
      localStorage.removeItem('selectedTab'); // Clean up
    }

    return () => {
      window.removeEventListener('resize', checkIsMobile);
    };
  }, []);

  // Save tab states whenever they change
  useEffect(() => {
    if (Object.keys(tabStates).length > 0) {
      localStorage.setItem('tabStates', JSON.stringify(tabStates));
    }
  }, [tabStates]);

  const handleAddressSelect = (address) => {
    setSelectedAddress(address);
    setActiveTab(1); // Switch to Wallet Query tab
  };

  // Callback for tabs to save their state
  const saveTabState = (tabIndex, state) => {
    setTabStates(prev => ({
      ...prev,
      [tabIndex]: state
    }));
  };

  const tabs = [
    {
      label: 'Address Explorer',
      icon: '🔍',
      content: <AddressExplorer
        chain={chain}
        onAddressSelect={handleAddressSelect}
        savedState={tabStates[0]}
        onStateChange={(state) => saveTabState(0, state)}
      />
    },
    {
      label: 'Wallet Query',
      icon: '💰',
      content: <WalletQueryInterface
        chain={chain}
        prefilledAddress={selectedAddress}
        savedState={tabStates[1]}
        onStateChange={(state) => saveTabState(1, state)}
      />
    },
    {
      label: 'Ratio of Shame',
      icon: '📊',
      content: <RatioOfShameTab
        savedState={tabStates[2]}
        onStateChange={(state) => saveTabState(2, state)}
      />
    },
    {
      label: 'Miner Map',
      icon: '⛏️',
      content: <MinerMap
        savedState={tabStates[3]}
        onStateChange={(state) => saveTabState(3, state)}
      />
    }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#ffffff',
      padding: isMobile ? '15px' : '30px'
    }}>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? '20px' : '40px' }}>
        <h1 style={{
          fontSize: isMobile ? '28px' : '42px',
          fontWeight: 'bold',
          margin: '0 0 10px 0',
          background: 'linear-gradient(45deg, #10b981, #3b82f6)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          🌿 Verdant Explorer
        </h1>

        <p style={{
          color: '#a3a3a3',
          fontSize: isMobile ? '14px' : '18px',
          margin: 0
        }}>
          Explore miners and query wallets on Base
        </p>
      </div>

      {/* Tabs */}
      <TabNavigation
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        defaultTab={0}
        isMobile={isMobile}
      />
    </div>
  );
}