import Head from 'next/head';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, LockKeyhole, MapPin } from 'lucide-react';

interface Candidate {
  id: number;
  name: string;
  nationality: string | null;
  passport_number: string | null;
  birth_date: string | null;
  profession: string | null;
  created_at: string;
}

interface Site { id: number; name: string; location?: string; }

const professionLabels: Record<string, string> = {
  mason: 'Mason',
  carpenter: 'Carpenter',
  bar_bender: 'Bar Bender',
  labour: 'Labour',
};

export default function RecruitmentReview() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<Record<number, string>>({});
  const [moving, setMoving] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setAuthenticated(Boolean(data?.is_super_admin)));
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    Promise.all([
      fetch('/api/recruitment').then((res) => (res.ok ? res.json() : [])),
      fetch('/api/auth/sites').then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([candidateRows, siteRows]) => {
        setCandidates(candidateRows);
        setSites(siteRows);
      })
      .catch(() => setError('Could not load recruitment candidates.'))
      .finally(() => setLoading(false));
  }, [authenticated]);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setLoginError('');
    setSigningIn(true);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site_id: 'super_admin', password }),
    });
    setSigningIn(false);
    if (!res.ok) return setLoginError('Incorrect super admin password. Please try again.');
    setAuthenticated(true);
  };

  const moveToBusiness = async (candidateId: number) => {
    const siteId = selectedSite[candidateId];
    if (!siteId) return;
    setError('');
    setMoving(candidateId);
    try {
      const res = await fetch('/api/recruitment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: candidateId, site_id: Number(siteId) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Could not move this candidate.');
      }
      setCandidates((current) => current.filter((candidate) => candidate.id !== candidateId));
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : 'Could not move this candidate.');
    } finally {
      setMoving(null);
    }
  };

  if (!authenticated) {
    return <>
      <Head><title>Sign in | Recruitment</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
      <main className="login-page">
        <section className="login-card">
          <div className="login-brand"><span><LockKeyhole size={25} /></span><div><p>CLOVE HR</p><h1>Recruitment Candidates</h1></div></div>
          <p className="login-copy">Sign in as super admin to review submitted recruitment candidates.</p>
          <form onSubmit={signIn}>
            <label><span>Username</span><div className="login-input"><MapPin size={17} /><input type="text" value="Super Admin" disabled /></div></label>
            <label><span>Password</span><div className="login-input"><LockKeyhole size={17} /><input name="password" type="password" autoComplete="current-password" autoFocus required value={password} onChange={(event) => setPassword(event.target.value)} /></div></label>
            {loginError && <p className="login-error" role="alert">{loginError}</p>}
            <button className="dark-button" type="submit" disabled={signingIn || !password}>{signingIn ? 'Signing in...' : 'Sign in'}</button>
          </form>
          <Link className="text-link login-collapse" href="/login"><ArrowLeft size={14} /> Back to sign in</Link>
        </section>
      </main>
    </>;
  }

  return <>
    <Head><title>Recruitment Candidates | CloveHR</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
    <main className="app-canvas">
      <section className="app-shell" aria-label="Recruitment candidates">
        <header className="app-header">
          <div>
            <p className="kicker">CLOVE HR</p>
            <h1>Recruitment Candidates</h1>
            <span>{candidates.length} pending</span>
          </div>
          <div className="header-actions">
            <Link className="icon-button" href="/" aria-label="Back to CloveHR"><ArrowLeft size={18} /></Link>
          </div>
        </header>

        {loading ? (
          <div className="empty-state">Loading candidates...</div>
        ) : candidates.length === 0 ? (
          <div className="empty-state">No pending recruitment candidates.</div>
        ) : (
          <div className="content-stack">
            {error && <p className="login-error" role="alert">{error}</p>}
            <div className="table-shell">
              <table className="salary-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Nationality</th>
                    <th>Passport</th>
                    <th>Date of birth</th>
                    <th>Profession</th>
                    <th>Move to business</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((candidate) => (
                    <tr key={candidate.id}>
                      <td>{candidate.name}</td>
                      <td>{candidate.nationality || '—'}</td>
                      <td>{candidate.passport_number || '—'}</td>
                      <td>{candidate.birth_date || '—'}</td>
                      <td>{professionLabels[candidate.profession || ''] || '—'}</td>
                      <td>
                        <div className="action-row">
                          <select
                            value={selectedSite[candidate.id] || ''}
                            onChange={(event) => setSelectedSite((current) => ({ ...current, [candidate.id]: event.target.value }))}
                          >
                            <option value="">Select business</option>
                            {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
                          </select>
                          <button
                            className="soft-button compact"
                            type="button"
                            disabled={!selectedSite[candidate.id] || moving === candidate.id}
                            onClick={() => moveToBusiness(candidate.id)}
                          >
                            {moving === candidate.id ? 'Moving...' : 'Move'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  </>;
}
