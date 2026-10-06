/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import GoogleDriveManager from './components/GoogleDriveManager';

interface DMSUser {
  userId: string;
  fullName: string;
  email: string;
  role: 'SUPER_ADMIN' | 'USER' | string;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<DMSUser | null>(() => {
    try {
      // Clear any legacy parent sessionStorage that might pin the user as Super Admin
      sessionStorage.removeItem('dms_user');
      const raw = localStorage.getItem('dms_user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<'portal' | 'drive'>('portal');

  // Strict role check: Only explicitly verified SUPER_ADMIN has super admin rights.
  // For USER category, guest, or unauthenticated, isSuperAdmin is strictly false.
  const isSuperAdmin = Boolean(
    currentUser &&
    currentUser.role &&
    String(currentUser.role).trim().toUpperCase() === 'SUPER_ADMIN'
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'DMS_AUTH_STATE_CHANGE') {
        const user = event.data.user;
        setCurrentUser(user);
        if (!user || String(user.role).trim().toUpperCase() !== 'SUPER_ADMIN') {
          setActiveTab('portal');
        }
      }
    };

    const syncStorage = () => {
      try {
        const raw = localStorage.getItem('dms_user');
        const parsed = raw ? JSON.parse(raw) : null;
        setCurrentUser(parsed);
        if (!parsed || String(parsed.role).trim().toUpperCase() !== 'SUPER_ADMIN') {
          setActiveTab('portal');
        }
      } catch (e) {}
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', syncStorage);
    const interval = setInterval(syncStorage, 1000);

    // Initial request to iframe
    const iframe = document.getElementById('dms-portal-iframe') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'DMS_REQUEST_AUTH_STATE' }, '*');
    }

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', syncStorage);
      clearInterval(interval);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{
        minHeight: '46px',
        height: 'auto',
        backgroundColor: '#0A192F',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 1rem',
        borderBottom: '1px solid #1E293B',
        fontSize: '12px',
        flexShrink: 0,
        zIndex: 50,
        flexWrap: 'wrap',
        gap: '6px'
      }}>
        {/* Left: Spacer */}
        <div style={{ display: 'flex', alignItems: 'center' }}></div>

        {/* Center: View Switcher - Only shows Live Google Drive Explorer if Super Admin */}
        {isSuperAdmin ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#1E293B',
            padding: '3px',
            borderRadius: '6px',
            border: '1px solid #334155'
          }}>
            <button
              onClick={() => setActiveTab('portal')}
              style={{
                padding: '4px 12px',
                backgroundColor: activeTab === 'portal' ? '#004F8C' : 'transparent',
                color: activeTab === 'portal' ? '#FFFFFF' : '#94A3B8',
                border: 'none',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <span>🖥️</span>
              <span>Unit Taskforce B2B2C DMS</span>
            </button>
            <button
              onClick={() => setActiveTab('drive')}
              style={{
                padding: '4px 12px',
                backgroundColor: activeTab === 'drive' ? '#004F8C' : 'transparent',
                color: activeTab === 'drive' ? '#FFFFFF' : '#94A3B8',
                border: 'none',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <span>📁</span>
              <span>Live Google Drive Explorer</span>
              <span style={{
                fontSize: '9px',
                backgroundColor: '#059669',
                color: '#FFFFFF',
                padding: '1px 5px',
                borderRadius: '3px',
                fontWeight: 700,
                letterSpacing: '0.3px'
              }}>SUPER ADMIN</span>
            </button>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#1E293B',
            padding: '4px 14px',
            borderRadius: '6px',
            border: '1px solid #334155',
            fontSize: '11px',
            color: '#94A3B8'
          }}>
            <span>🖥️</span>
            <span style={{ color: '#F1F5F9', fontWeight: 600 }}>Unit Taskforce B2B2C DMS</span>
            {currentUser ? (
              <span style={{
                fontSize: '9px',
                backgroundColor: '#334155',
                color: '#CBD5E1',
                padding: '1px 6px',
                borderRadius: '3px',
                fontWeight: 600
              }}>USER (Read-Only)</span>
            ) : (
              <span style={{
                fontSize: '9px',
                backgroundColor: 'rgba(51, 65, 85, 0.6)',
                color: '#64748B',
                padding: '1px 6px',
                borderRadius: '3px'
              }}>Akses Terbatas</span>
            )}
          </div>
        )}

        {/* Right: Actions - Download All ZIP only accessible to Super Admin */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isSuperAdmin && (
            <a
              href="/enterprise-dms-appsscript.zip"
              download="enterprise-dms-appsscript.zip"
              style={{
                backgroundColor: '#059669',
                color: '#FFFFFF',
                padding: '6px 12px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '11px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }}
            >
              <span>📦</span>
              <span>Download All (.ZIP)</span>
            </a>
          )}
        </div>
      </header>

      {/* Main View Area */}
      <main style={{ flex: 1, width: '100%', overflow: 'hidden', position: 'relative' }}>
        {activeTab === 'drive' && isSuperAdmin ? (
          <GoogleDriveManager />
        ) : (
          <iframe
            id="dms-portal-iframe"
            src="/Index.html"
            title="Enterprise Document Management System"
            onLoad={(e) => {
              const iframe = e.currentTarget;
              if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({ type: 'DMS_REQUEST_AUTH_STATE' }, '*');
              }
            }}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block'
            }}
          />
        )}
      </main>
    </div>
  );
}
