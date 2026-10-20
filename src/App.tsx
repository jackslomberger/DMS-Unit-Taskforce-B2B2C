/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';

// Default Google Apps Script Web App endpoint connected to jackslomberger@gmail.com
const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwZn6Gqu516waHP1DmPWwNSUPOT5qQ8WbrmoIVlHMbfvVlyfftRE9lGL9fFCXHV-LXeBA/exec';

export default function App() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 1. Check environment variable (configured in Vercel) or fallback to official Google Drive endpoint
  let remoteUrl = (import.meta.env.VITE_APPS_SCRIPT_URL || '').trim() || DEFAULT_APPS_SCRIPT_URL;

  // 2. Check query string in parent window (e.g., https://domain.vercel.app/?apiUrl=https://script.google.com/...)
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('apiUrl') || params.get('endpoint') || params.get('api');
    if (fromQuery && fromQuery.startsWith('https://script.google.com/macros/s/')) {
      remoteUrl = fromQuery.trim();
    }
  }

  const iframeSrc = `/Index.html?apiUrl=${encodeURIComponent(remoteUrl)}`;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'DMS_REQUEST_CONFIG' && remoteUrl) {
        iframeRef.current?.contentWindow?.postMessage({
          type: 'DMS_CONFIG_INIT',
          appsScriptUrl: remoteUrl
        }, '*');
      }
    };
    window.addEventListener('message', handleMessage);

    // Auto-fetch dms-config.json to sync any updated global endpoint config
    fetch('/dms-config.json')
      .then(res => (res.ok ? res.json() : null))
      .then(cfg => {
        const targetUrl = (cfg && cfg.appsScriptUrl && cfg.appsScriptUrl.startsWith('https://script.google.com/macros/s/'))
          ? cfg.appsScriptUrl.trim()
          : remoteUrl;
        if (targetUrl) {
          iframeRef.current?.contentWindow?.postMessage({
            type: 'DMS_CONFIG_INIT',
            appsScriptUrl: targetUrl
          }, '*');
        }
      })
      .catch(() => {});

    return () => window.removeEventListener('message', handleMessage);
  }, [remoteUrl]);

  const handleIframeLoad = () => {
    if (remoteUrl && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'DMS_CONFIG_INIT',
        appsScriptUrl: remoteUrl
      }, '*');
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', margin: 0, padding: 0 }}>
      <iframe
        ref={iframeRef}
        id="dms-portal-iframe"
        src={iframeSrc}
        onLoad={handleIframeLoad}
        title="Enterprise Document Management System"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          overflow: 'hidden'
        }}
      />
    </div>
  );
}
