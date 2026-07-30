import Head from 'next/head';
import { FormEvent, useState } from 'react';
import { BriefcaseBusiness, LockKeyhole, Mail } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return setError(body.error || 'Incorrect email or password. Please try again.');
    }
    window.location.assign('/');
  };

  return <>
    <Head><title>Sign in | CloveHR</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand"><span><BriefcaseBusiness size={25} /></span><div><p>CLOVE HR</p><h1>Welcome back</h1></div></div>
        <p className="login-copy">Sign in with your email and password to continue.</p>
        <form onSubmit={submit}>
          <label><span>Email</span><div className="login-input"><Mail size={17} /><input name="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></div></label>
          <label><span>Password</span><div className="login-input"><LockKeyhole size={17} /><input name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div></label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="dark-button" type="submit" disabled={submitting || !email || !password}>{submitting ? 'Signing in...' : 'Sign in to CloveHR'}</button>
        </form>
      </section>
    </main>
  </>;
}
