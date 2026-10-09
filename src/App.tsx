/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export default function App() {
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', margin: 0, padding: 0 }}>
      <iframe
        id="dms-portal-iframe"
        src="/Index.html"
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
