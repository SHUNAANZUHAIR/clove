// pages/admin/users.tsx — minimal admin-only user-account manager.
// Deliberately self-contained (inline styles) so it doesn't depend on the
// existing dashboard's CSS classes and can be dropped in without touching
// pages/index.tsx. Link to it from wherever you'd like in the main nav,
// e.g. <a href="/admin/users">Users</a> for admin accounts.
import Head from 'next/head';
import { useEffect, useState, FormEvent } from 'react';

interface UserRow {
  id: number;
  email: string;
  role: 'admin' | 'employee';
  employee_id: number | null;
  employee_name: string | null;
  managed_site_id: number | null;
  managed_site_name: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

interface Employee { id: number; name: string; }
interface Site { id: number; name: string; }

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '', role: 'employee', employee_id: '', managed_site_id: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [usersRes, employeesRes, sitesRes] = await Promise.all([
      fetch('/api/users'),
      fetch('/api/employees'),
      fetch('/api/sites'),
    ]);
    if (usersRes.status === 403) { setError('Only admins can manage user accounts.'); setLoading(false); return; }
    setUsers(usersRes.ok ? await usersRes.json() : []);
    setEmployees(employeesRes.ok ? await employeesRes.json() : []);
    setSites(sitesRes.ok ? await sitesRes.json() : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createUser = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.email,
        password: form.password,
        role: form.role,
        employee_id: form.employee_id || null,
        managed_site_id: form.managed_site_id || null,
      }),
    });
    setSaving(false);
    if (!res.ok) { const body = await res.json().catch(() => ({})); setError(body.error || 'Could not create user.'); return; }
    setForm({ email: '', password: '', role: 'employee', employee_id: '', managed_site_id: '' });
    load();
  };

  const toggleActive = async (user: UserRow) => {
    await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, role: user.role, employee_id: user.employee_id, managed_site_id: user.managed_site_id, is_active: !user.is_active }),
    });
    load();
  };

  const resetPassword = async (user: UserRow) => {
    const password = window.prompt(`New password for ${user.email} (min 8 characters):`);
    if (!password) return;
    const res = await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, role: user.role, employee_id: user.employee_id, managed_site_id: user.managed_site_id, is_active: user.is_active, password }),
    });
    if (!res.ok) { const body = await res.json().catch(() => ({})); alert(body.error || 'Could not reset password.'); return; }
    load();
  };

  return <>
    <Head><title>User accounts | CloveHR</title></Head>
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>User accounts</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>Create and manage individual logins. Admins see everything; employee accounts can optionally be linked to their own employee record (self-service) or flagged as a site manager (attendance for one site).</p>

      {error && <p style={{ color: '#b91c1c', marginBottom: 16 }}>{error}</p>}

      <form onSubmit={createUser} style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', alignItems: 'end', marginBottom: 28, padding: 16, border: '1px solid #e5e5e5', borderRadius: 10 }}>
        <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>Email
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>Temporary password
          <input type="text" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={inputStyle} />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>Role
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={inputStyle}>
            <option value="employee">Employee</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>Linked employee (self-service)
          <select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} style={inputStyle}>
            <option value="">None</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>Site manager for
          <select value={form.managed_site_id} onChange={(e) => setForm({ ...form, managed_site_id: e.target.value })} style={inputStyle}>
            <option value="">None</option>
            {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
          </select>
        </label>
        <button type="submit" disabled={saving} style={buttonStyle}>{saving ? 'Creating…' : 'Create account'}</button>
      </form>

      {loading ? <p>Loading…</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e5e5' }}>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Role</th>
              <th style={thStyle}>Linked employee</th>
              <th style={thStyle}>Manages site</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Last login</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={tdStyle}>{user.email}</td>
                <td style={tdStyle}>{user.role}</td>
                <td style={tdStyle}>{user.employee_name || '—'}</td>
                <td style={tdStyle}>{user.managed_site_name || '—'}</td>
                <td style={tdStyle}>{user.is_active ? 'Active' : 'Deactivated'}</td>
                <td style={tdStyle}>{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}</td>
                <td style={{ ...tdStyle, display: 'flex', gap: 8 }}>
                  <button onClick={() => toggleActive(user)} style={linkButtonStyle}>{user.is_active ? 'Deactivate' : 'Reactivate'}</button>
                  <button onClick={() => resetPassword(user)} style={linkButtonStyle}>Reset password</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  </>;
}

const inputStyle: React.CSSProperties = { padding: '8px 10px', border: '1px solid #d4d4d4', borderRadius: 6, fontSize: 14 };
const buttonStyle: React.CSSProperties = { padding: '9px 16px', borderRadius: 6, border: 'none', background: '#111', color: '#fff', fontSize: 14, cursor: 'pointer' };
const linkButtonStyle: React.CSSProperties = { padding: '4px 8px', borderRadius: 6, border: '1px solid #d4d4d4', background: '#fff', fontSize: 12, cursor: 'pointer' };
const thStyle: React.CSSProperties = { padding: '8px 6px', fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: '8px 6px' };
