'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatNumber } from '../utils/formatters';

export default function Home() {
  const [addressCounts, setAddressCounts] = useState({
    abstract: 0,
    base: 0,
    loading: true
  });

  useEffect(() => {
    fetchAddressCounts();
  }, []);

  const fetchAddressCounts = async () => {
    try {
      // Fetch counts from both chains in parallel
      const [abstractResponse, baseResponse] = await Promise.all([
        fetch('/api/scan-addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chain: 'abstract', scanType: 'cached' })
        }),
        fetch('/api/scan-addresses', {
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chain: 'base', scanType: 'cached' })
        })
      ]);

      const [abstractData, baseData] = await Promise.all([
        abstractResponse.json(),
        baseResponse.json()
      ]);

      setAddressCounts({
        abstract: abstractData.totalAddresses || 0,
        base: baseData.totalAddresses || 0,
        loading: false
      });
    } catch (error) {
      console.error('Error fetching address counts:', error);
      // Fall back to hardcoded values if API fails
      setAddressCounts({
        abstract: 54,
        base: 543,
        loading: false
      });
    }
  };
  return (
    <main style={{ 
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px'
    }}>
      <div style={{ textAlign: 'center', maxWidth: '800px' }}>
        {/* Logo/Header */}
        <h1 style={{ 
          fontSize: '56px', 
          fontWeight: 'bold', 
          marginBottom: '20px',
          background: 'linear-gradient(45deg, #10b981, #3b82f6, #dc2626)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          🌿 Verdant Explorer
        </h1>
        
        <p style={{ 
          color: '#a3a3a3', 
          fontSize: '20px', 
          marginBottom: '60px',
          lineHeight: '1.6'
        }}>
          Query miner stats, discover addresses, and analyze withdrawal ratios<br/>
          across Abstract and Base networks
        </p>

        {/* Network Selection Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '30px',
          marginBottom: '40px'
        }}>
          {/* Abstract Network Card */}
          <Link href="/abstract" style={{ textDecoration: 'none' }}>
            <div style={{
              background: '#1a1a1a',
              border: '2px solid #10b981',
              borderRadius: '16px',
              padding: '40px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)';
              e.currentTarget.style.boxShadow = '0 12px 40px rgba(16, 185, 129, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}>
              {/* Background gradient */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '100px',
                background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.1) 0%, transparent 100%)',
                pointerEvents: 'none'
              }} />
              
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚡</div>
                <h2 style={{ 
                  color: '#ffffff', 
                  fontSize: '32px', 
                  marginBottom: '12px',
                  fontWeight: 'bold'
                }}>
                  Abstract
                </h2>
                <p style={{ color: '#10b981', fontSize: '18px', marginBottom: '24px' }}>
                  {addressCounts.loading ? 'Loading...' : `${formatNumber(addressCounts.abstract)} addresses discovered`}
                </p>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  gap: '12px',
                  flexWrap: 'wrap'
                }}>
                  <span style={{ 
                    background: '#064e3b', 
                    color: '#10b981', 
                    padding: '6px 12px', 
                    borderRadius: '20px',
                    fontSize: '14px'
                  }}>
                    Address Explorer
                  </span>
                  <span style={{ 
                    background: '#064e3b', 
                    color: '#10b981', 
                    padding: '6px 12px', 
                    borderRadius: '20px',
                    fontSize: '14px'
                  }}>
                    Wallet Query
                  </span>
                  <span style={{ 
                    background: '#064e3b', 
                    color: '#10b981', 
                    padding: '6px 12px', 
                    borderRadius: '20px',
                    fontSize: '14px'
                  }}>
                    Ratio of Shame
                  </span>
                </div>
              </div>
            </div>
          </Link>

          {/* Base Network Card */}
          <Link href="/base" style={{ textDecoration: 'none' }}>
            <div style={{
              background: '#1a1a1a',
              border: '2px solid #3b82f6',
              borderRadius: '16px',
              padding: '40px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)';
              e.currentTarget.style.boxShadow = '0 12px 40px rgba(59, 130, 246, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}>
              {/* Background gradient */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '100px',
                background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.1) 0%, transparent 100%)',
                pointerEvents: 'none'
              }} />
              
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔷</div>
                <h2 style={{ 
                  color: '#ffffff', 
                  fontSize: '32px', 
                  marginBottom: '12px',
                  fontWeight: 'bold'
                }}>
                  Base
                </h2>
                <p style={{ color: '#3b82f6', fontSize: '18px', marginBottom: '24px' }}>
                  {formatNumber(543)} addresses discovered
                </p>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  gap: '12px',
                  flexWrap: 'wrap'
                }}>
                  <span style={{ 
                    background: '#1e3a8a', 
                    color: '#3b82f6', 
                    padding: '6px 12px', 
                    borderRadius: '20px',
                    fontSize: '14px'
                  }}>
                    Address Explorer
                  </span>
                  <span style={{ 
                    background: '#1e3a8a', 
                    color: '#3b82f6', 
                    padding: '6px 12px', 
                    borderRadius: '20px',
                    fontSize: '14px'
                  }}>
                    Wallet Query
                  </span>
                  <span style={{ 
                    background: '#1e3a8a', 
                    color: '#3b82f6', 
                    padding: '6px 12px', 
                    borderRadius: '20px',
                    fontSize: '14px'
                  }}>
                    Ratio of Shame
                  </span>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Footer Links */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '30px',
          marginTop: '60px'
        }}>
          <Link href="/ratio-of-shame" style={{
            color: '#dc2626',
            textDecoration: 'none',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'color 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#dc2626'}>
            📊 Global Ratio of Shame
          </Link>
        </div>
      </div>
    </main>
  );
}