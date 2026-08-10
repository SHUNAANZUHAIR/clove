import Head from 'next/head';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { ArrowLeft, CircleDollarSign, LockKeyhole, LucideIcon, UsersRound } from 'lucide-react';
import SubmitAttendanceButton from './SubmitAttendanceButton';

interface BusinessLoginPageProps {
  title: string;
  siteName: string;
  icon: LucideIcon;
  cardClass: string;
}

type RedirectTarget = '' | 'salary';

export default function BusinessLoginPage({ title, siteName, icon: Icon, cardClass }: BusinessLoginPageProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (redirectTarget: RedirectTarget) => {
    setError(''); setSubmitting(true);
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ site_id: 'super_admin', password }) });
    setSubmitting(false);
    if (!res.ok) return setError('Incorrect password. Please try again.');
    window.location.assign(redirectTarget ? `/?tab=${redirectTarget}` : '/');
  };

  return <>
    <Head><title>Sign in | {title}</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
    <main className="login-page">
      <section className={`login-card ${cardClass}`}>
        <div className="login-brand"><span><Icon size={25} /></span><div><h1>{title}</h1></div></div>
        <p className="login-copy">Sign in as super admin to manage {siteName}.</p>
        <form onSubmit={(event: FormEvent) => { event.preventDefault(); submit(''); }}>
          <label><span>Password</span><div className="login-input"><LockKeyhole size={17} /><input name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div></label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="dark-button" type="button" disabled={submitting || !password} onClick={() => submit('')}>
            <UsersRound size={16} /> {submitting ? 'Signing in...' : 'Manage staff'}
          </button>
          <button className="dark-button" type="button" disabled={submitting || !password} onClick={() => submit('salary')}>
            <CircleDollarSign size={16} /> {submitting ? 'Signing in...' : 'Give salary'}
          </button>
        </form>
        <div className="login-links">
          <SubmitAttendanceButton />
        </div>
        <Link className="text-link login-collapse" href="/login"><ArrowLeft size={14} /> Back to CloveHR</Link>
      </section>
    </main>
  </>;
}
