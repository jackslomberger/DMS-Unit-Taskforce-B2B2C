/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export default function App() {
  const remoteUrl = (import.meta.env.VITE_APPS_SCRIPT_URL || '').trim();
  const iframeSrc = remoteUrl ? `/Index.html?apiUrl=${encodeURIComponent(remoteUrl)}` : '/Index.html';

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', margin: 0, padding: 0 }}>
      <iframe
        id="dms-portal-iframe"
        src={iframeSrc}
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
