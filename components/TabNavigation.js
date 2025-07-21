'use client';

import { useState } from 'react';

export default function TabNavigation({ tabs, defaultTab = 0, activeTab: controlledActiveTab, onTabChange }) {
  const [internalActiveTab, setInternalActiveTab] = useState(defaultTab);
  
  // Use controlled state if provided, otherwise use internal state
  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;
  const setActiveTab = (tab) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalActiveTab(tab);
    }
  };

  return (
    <div>
      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '0',
        marginBottom: '30px',
        borderBottom: '2px solid #333',
        background: '#1a1a1a',
        borderRadius: '12px 12px 0 0',
        padding: '4px',
        paddingBottom: '0'
      }}>
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            style={{
              padding: '12px 24px',
              background: activeTab === index ? '#262626' : 'transparent',
              color: activeTab === index ? '#ffffff' : '#6b7280',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              fontSize: '16px',
              fontWeight: activeTab === index ? 'bold' : 'normal',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              borderBottom: activeTab === index ? '2px solid #10b981' : '2px solid transparent',
              marginBottom: '-2px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{
        background: '#1a1a1a',
        padding: '30px',
        borderRadius: '0 0 12px 12px',
        border: '1px solid #333',
        borderTop: 'none'
      }}>
        {tabs[activeTab].content}
      </div>
    </div>
  );
}