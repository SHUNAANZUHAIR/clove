import Head from 'next/head';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, CalendarClock, CircleDollarSign, Coffee, LockKeyhole, MapPin, UserPlus, UsersRound } from 'lucide-react';

interface LoginSite { id: number; name: string; location?: string; }

const cloveCafeSiteName = 'Clove Cafe & Bistro';

export default function Login() {
  const [sites, setSites] = useState<LoginSite[]>([]);
  const [siteId, setSiteId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [managePeopleOpen, setManagePeopleOpen] = useState(false);
  const [redirectTab, setRedirectTab] = useState<'salary' | ''>('');
  const [siteLocked, setSiteLocked] = useState(false);

  useEffect(() => { fetch('/api/auth/sites').then((res) => res.ok ? res.json() : []).then(setSites); }, []);

  const cloveCafeSite = sites.find((site) => site.name === cloveCafeSiteName);

  const openLoginForm = (tab: 'salary' | '') => {
    setRedirectTab(tab);
    setSiteId(tab === 'salary' ? 'super_admin' : '');
    setSiteLocked(tab === 'salary');
    setManagePeopleOpen(true);
  };

  const openCloveCafeLogin = () => {
    setRedirectTab('');
    setSiteId(cloveCafeSite ? String(cloveCafeSite.id) : '');
    setSiteLocked(true);
    setManagePeopleOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setSubmitting(true);
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ site_id: siteId, password }) });
    setSubmitting(false);
    if (!res.ok) return setError('Incorrect site or password. Please try again.');
    window.location.assign(redirectTab ? `/?tab=${redirectTab}` : '/');
  };

  return <>
    <Head><title>Sign in | CloveHR</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand"><span><BriefcaseBusiness size={25} /></span><div><p>CLOVE HR</p><h1>Welcome back</h1></div></div>

        {!managePeopleOpen ? (
          <>
            <p className="login-copy">Submit your attendance, or sign in to manage a work site, the team, or payroll.</p>
            <div className="login-links login-links-primary">
              <Link className="soft-button submit-attendance-button" href="/submit-ot"><CalendarClock size={16} /> Submit Attendance</Link>
              <button className="soft-button" type="button" onClick={openCloveCafeLogin}><Coffee size={16} /> Clove Cafe login</button>
              <button className="soft-button" type="button" onClick={() => openLoginForm('')}><UsersRound size={16} /> Manage people</button>
              <Link className="soft-button" href="/onboard-employee"><UserPlus size={16} /> New staff onboarding</Link>
              <button className="soft-button" type="button" onClick={() => openLoginForm('salary')}><CircleDollarSign size={16} /> Process Salary</button>
            </div>
          </>
        ) : (
          <>
            {siteLocked && redirectTab === '' && sites.length > 0 && !cloveCafeSite ? (
              <p className="login-copy">
                No work site named &quot;{cloveCafeSiteName}&quot; exists yet. Ask a super admin to create it under Sites, or{' '}
                <button className="text-link" type="button" onClick={() => setSiteLocked(false)}>choose a work site</button> instead.
              </p>
            ) : (
              <>
                <p className="login-copy">{redirectTab === 'salary' ? 'Sign in as super admin to process salary.' : siteLocked ? `Sign in to ${cloveCafeSiteName}.` : 'Select your work site and enter the password to continue.'}</p>
                <form onSubmit={submit}>
                  <label><span>Work site / username</span><div className="login-input"><MapPin size={17} /><select name="username" autoComplete="username" required value={siteId} onChange={(event) => setSiteId(event.target.value)} disabled={siteLocked}><option value="">Select site</option><option value="super_admin">Super Admin</option>{!siteLocked && sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}{siteLocked && cloveCafeSite && <option value={cloveCafeSite.id}>{cloveCafeSite.name}</option>}</select></div></label>
                  <label><span>Password</span><div className="login-input"><LockKeyhole size={17} /><input name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div></label>
                  {error && <p className="login-error" role="alert">{error}</p>}
                  <button className="dark-button" type="submit" disabled={submitting || !siteId}>{submitting ? 'Signing in...' : 'Sign in to CloveHR'}</button>
                </form>
              </>
            )}
            <button className="text-link login-collapse" type="button" onClick={() => { setManagePeopleOpen(false); setError(''); setRedirectTab(''); setSiteId(''); setSiteLocked(false); }}><ArrowLeft size={14} /> Back</button>
          </>
        )}
      </section>
    </main>
  </>;
}
