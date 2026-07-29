import Head from 'next/head';
import { FormEvent, useEffect, useState } from 'react';
import { BriefcaseBusiness, LockKeyhole, MapPin } from 'lucide-react';

interface LoginSite { id: number; name: string; location?: string; }

export default function Login() {
  const [sites, setSites] = useState<LoginSite[]>([]);
  const [siteId, setSiteId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetch('/api/auth/sites').then((res) => res.ok ? res.json() : []).then(setSites); }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setSubmitting(true);
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ site_id: siteId, password }) });
    setSubmitting(false);
    if (!res.ok) return setError('Incorrect site or password. Please try again.');
    window.location.assign('/');
  };

  return <>
    <Head><title>Sign in | CloveHR</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand"><span><BriefcaseBusiness size={25} /></span><div><p>CLOVE HR</p><h1>Welcome back</h1></div></div>
        <p className="login-copy">Select your work site and enter the password to continue.</p>
        <form onSubmit={submit}>
          <label><span>Work site / username</span><div className="login-input"><MapPin size={17} /><select name="username" autoComplete="username" required value={siteId} onChange={(event) => setSiteId(event.target.value)}><option value="">Select site</option><option value="super_admin">Super Admin</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></div></label>
          <label><span>Password</span><div className="login-input"><LockKeyhole size={17} /><input name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div></label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="dark-button" type="submit" disabled={submitting || !siteId}>{submitting ? 'Signing in...' : 'Sign in to CloveHR'}</button>
        </form>
      </section>
    </main>
  </>;
}
