// pages/admin/audit-log.tsx — minimal admin-only audit trail viewer.
import Head from 'next/head';
import { useEffect, useState } from 'react';

interface AuditRow {
  id: number;
  occurred_at: string;
  user_id: number | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
}

export default function AuditLog() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const load = async (filter: string) => {
    setLoading(true);
    const res = await fetch(`/api/audit-logs${filter ? `?action=${encodeURIComponent(filter)}` : ''}`);
    if (res.status === 403) { setError('Only admins can view the audit log.'); setLoading(false); return; }
    setRows(res.ok ? await res.json() : []);
    setLoading(false);
  };

  useEffect(() => { load(''); }, []);

  return <>
    <Head><title>Audit log | CloveHR</title></Head>
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Audit log</h1>
      <p style={{ color: '#666', marginBottom: 20 }}>Every login attempt and data change, newest first.</p>

      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['', 'auth.', 'employee.', 'salary.', 'attendance.', 'site.', 'user.', 'report.'].map((prefix) => (
          <button
            key={prefix || 'all'}
            onClick={() => { setActionFilter(prefix); load(prefix); }}
            style={{
              padding: '6px 12px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
              border: '1px solid ' + (actionFilter === prefix ? '#111' : '#d4d4d4'),
              background: actionFilter === prefix ? '#111' : '#fff',
              color: actionFilter === prefix ? '#fff' : '#111',
            }}
          >
            {prefix ? prefix.replace('.', '') : 'All'}
          </button>
        ))}
      </div>

      {loading ? <p>Loading…</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e5e5' }}>
              <th style={thStyle}>When</th>
              <th style={thStyle}>Actor</th>
              <th style={thStyle}>Action</th>
              <th style={thStyle}>Target</th>
              <th style={thStyle}>IP</th>
              <th style={thStyle}>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={tdStyle}>{new Date(row.occurred_at).toLocaleString()}</td>
                <td style={tdStyle}>{row.actor_email || 'unknown'} {row.actor_role ? `(${row.actor_role})` : ''}</td>
                <td style={tdStyle}><code>{row.action}</code></td>
                <td style={tdStyle}>{row.target_type ? `${row.target_type}${row.target_id ? ` #${row.target_id}` : ''}` : '—'}</td>
                <td style={tdStyle}>{row.ip || '—'}</td>
                <td style={{ ...tdStyle, maxWidth: 320, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#555' }}>
                  {row.metadata ? JSON.stringify(row.metadata) : ''}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td style={tdStyle} colSpan={6}>No audit entries yet.</td></tr>}
          </tbody>
        </table>
      )}
    </main>
  </>;
}

const thStyle: React.CSSProperties = { padding: '8px 6px', fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: '8px 6px', verticalAlign: 'top' };
