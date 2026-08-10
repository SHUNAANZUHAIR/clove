import Head from 'next/head';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, CalendarClock, CircleDollarSign, Coffee, Hotel, LockKeyhole, MapPin, UserPlus, UsersRound } from 'lucide-react';

interface LoginSite { id: number; name: string; location?: string; }

interface QuickLogin {
  id: string;
  siteName: string;
  title: string;
  buttonLabel: string;
  icon: typeof Coffee;
}

const quickLogins: QuickLogin[] = [
  { id: 'clove_cafe', siteName: 'Clove Cafe & Bistro', title: 'Clove Cafe', buttonLabel: 'Clove Cafe login', icon: Coffee },
  { id: 'clove_guesthouse', siteName: 'Clove Guesthouse', title: 'Clove Guesthouse', buttonLabel: 'Clove Guesthouse login', icon: Hotel },
];

type LoginMode = 'none' | 'manage' | 'salary' | string;

export default function Login() {
  const [sites, setSites] = useState<LoginSite[]>([]);
  const [siteId, setSiteId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<LoginMode>('none');

  useEffect(() => { fetch('/api/auth/sites').then((res) => res.ok ? res.json() : []).then(setSites); }, []);

  const activeQuickLogin = quickLogins.find((quickLogin) => quickLogin.id === mode);
  const activeSite = activeQuickLogin ? sites.find((site) => site.name === activeQuickLogin.siteName) : undefined;
  const siteLocked = mode === 'salary' || Boolean(activeQuickLogin);

  const openLoginForm = (nextMode: 'manage' | 'salary') => {
    setError('');
    setSiteId(nextMode === 'salary' ? 'super_admin' : '');
    setMode(nextMode);
  };

  const openQuickLogin = (quickLogin: QuickLogin) => {
    setError('');
    const site = sites.find((candidate) => candidate.name === quickLogin.siteName);
    setSiteId(site ? String(site.id) : '');
    setMode(quickLogin.id);
  };

  const closeForm = () => {
    setMode('none');
    setError('');
    setSiteId('');
    setPassword('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setSubmitting(true);
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ site_id: siteId, password }) });
    setSubmitting(false);
    if (!res.ok) return setError('Incorrect site or password. Please try again.');
    window.location.assign(mode === 'salary' ? '/?tab=salary' : '/');
  };

  const renderLoginForm = () => (
    <>
      {activeQuickLogin && sites.length > 0 && !activeSite ? (
        <p className="login-copy">
          No work site named &quot;{activeQuickLogin.siteName}&quot; exists yet. Ask a super admin to create it under Sites, or{' '}
          <button className="text-link" type="button" onClick={() => setMode('manage')}>choose a work site</button> instead.
        </p>
      ) : (
        <>
          <p className="login-copy">{mode === 'salary' ? 'Sign in as super admin to process salary.' : activeQuickLogin ? `Sign in to ${activeQuickLogin.siteName}.` : 'Select your work site and enter the password to continue.'}</p>
          <form onSubmit={submit}>
            <label><span>Work site / username</span><div className="login-input"><MapPin size={17} /><select name="username" autoComplete="username" required value={siteId} onChange={(event) => setSiteId(event.target.value)} disabled={siteLocked}><option value="">Select site</option><option value="super_admin">Super Admin</option>{!siteLocked && sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}{activeSite && <option value={activeSite.id}>{activeSite.name}</option>}</select></div></label>
            <label><span>Password</span><div className="login-input"><LockKeyhole size={17} /><input name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div></label>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="dark-button" type="submit" disabled={submitting || !siteId}>{submitting ? 'Signing in...' : 'Sign in to CloveHR'}</button>
          </form>
        </>
      )}
      <button className="text-link login-collapse" type="button" onClick={closeForm}><ArrowLeft size={14} /> Back</button>
    </>
  );

  return <>
    <Head><title>Sign in | CloveHR</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
    <main className="login-page">
      <div className="login-stack">
        <section className="login-card">
          <div className="login-brand"><span><BriefcaseBusiness size={25} /></span><div><p>CLOVE HR</p><h1>Welcome back</h1></div></div>

          {mode === 'none' ? (
            <>
              <p className="login-copy">Submit your attendance, or sign in to manage a work site, the team, or payroll.</p>
              <div className="login-links login-links-primary">
                <Link className="soft-button submit-attendance-button" href="/submit-ot"><CalendarClock size={16} /> Submit Attendance</Link>
                <button className="soft-button" type="button" onClick={() => openLoginForm('manage')}><UsersRound size={16} /> Manage people</button>
                <Link className="soft-button" href="/onboard-employee"><UserPlus size={16} /> New staff onboarding</Link>
                <button className="soft-button" type="button" onClick={() => openLoginForm('salary')}><CircleDollarSign size={16} /> Process Salary</button>
              </div>
            </>
          ) : activeQuickLogin ? (
            <p className="login-copy">Signing in to {activeQuickLogin.siteName} below.</p>
          ) : renderLoginForm()}
        </section>

        {quickLogins.map((quickLogin) => (
          <section className="login-card" key={quickLogin.id}>
            <div className="login-brand"><span><quickLogin.icon size={25} /></span><div><h1>{quickLogin.title}</h1></div></div>
            {mode !== quickLogin.id ? (
              <>
                <p className="login-copy">Sign in to {quickLogin.siteName}.</p>
                <button className="soft-button" type="button" onClick={() => openQuickLogin(quickLogin)}>
                  <quickLogin.icon size={16} /> {quickLogin.buttonLabel}
                </button>
              </>
            ) : renderLoginForm()}
          </section>
        ))}
      </div>
    </main>
  </>;
}
