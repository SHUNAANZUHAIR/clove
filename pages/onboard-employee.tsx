import Head from 'next/head';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Check, LockKeyhole, MapPin, UserPlus } from 'lucide-react';

interface OnboardingSite {
  id: number;
  name: string;
  location?: string;
}

interface Candidate {
  id: number;
  name: string;
  nationality: string | null;
  passport_number: string | null;
  birth_date: string | null;
  profession: string | null;
  created_at: string;
}

const professionLabels: Record<string, string> = {
  mason: 'Mason',
  carpenter: 'Carpenter',
  bar_bender: 'Bar Bender',
  labour: 'Labour',
};

const jobLevels: Array<{ value: string; label: string }> = [
  { value: 'labour', label: 'Labour' },
  { value: 'mason', label: 'Mason' },
  { value: 'carpenter', label: 'Carpenter' },
  { value: 'supervisor', label: 'Supervisor' },
];

const emptyForm = {
  name: '',
  id_number: '',
  job_title: '',
  job_level: 'labour',
  site_id: '',
  medium: 'cash',
};

export default function OnboardEmployee() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  const [sites, setSites] = useState<OnboardingSite[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(true);
  const [selectedSite, setSelectedSite] = useState<Record<number, string>>({});
  const [approving, setApproving] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [candidateError, setCandidateError] = useState('');

  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [onboardedName, setOnboardedName] = useState('');

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setAuthenticated(Boolean(data?.is_super_admin)));
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    fetch('/api/auth/sites').then((res) => (res.ok ? res.json() : [])).then(setSites).catch(() => setSites([]));
    fetch('/api/recruitment')
      .then((res) => (res.ok ? res.json() : []))
      .then(setCandidates)
      .catch(() => setCandidates([]))
      .finally(() => setCandidatesLoading(false));
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

  const approveCandidate = async (candidateId: number) => {
    const siteId = selectedSite[candidateId];
    if (!siteId) return;
    setCandidateError('');
    setApproving(candidateId);
    try {
      const res = await fetch('/api/recruitment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: candidateId, site_id: Number(siteId) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Could not approve this candidate.');
      }
      setCandidates((current) => current.filter((candidate) => candidate.id !== candidateId));
    } catch (approveError) {
      setCandidateError(approveError instanceof Error ? approveError.message : 'Could not approve this candidate.');
    } finally {
      setApproving(null);
    }
  };

  const rejectCandidate = async (candidateId: number, candidateName: string) => {
    if (!confirm(`Reject ${candidateName}'s recruitment request? This cannot be undone.`)) return;
    setCandidateError('');
    setRejecting(candidateId);
    try {
      const res = await fetch(`/api/recruitment?id=${candidateId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Could not reject this candidate.');
      }
      setCandidates((current) => current.filter((candidate) => candidate.id !== candidateId));
    } catch (rejectError) {
      setCandidateError(rejectError instanceof Error ? rejectError.message : 'Could not reject this candidate.');
    } finally {
      setRejecting(null);
    }
  };

  const submit = async () => {
    setError('');
    if (!form.name.trim()) return setError('Employee name is required.');
    if (!form.site_id) return setError('Select a work site.');
    setSubmitting(true);
    try {
      const res = await fetch('/api/public/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          id_number: form.id_number.trim(),
          job_title: form.job_title.trim(),
          job_level: form.job_level,
          site_id: Number(form.site_id),
          medium: form.medium,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'onboard-failed');
      }
      const data = await res.json();
      setOnboardedName(data.name || form.name.trim());
    } catch (submitError) {
      setError(submitError instanceof Error && submitError.message !== 'onboard-failed' ? submitError.message : 'Could not onboard this employee. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!authenticated) {
    return <>
      <Head><title>Sign in | New Staff Onboarding</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
      <main className="login-page">
        <section className="login-card">
          <div className="login-brand"><span><LockKeyhole size={25} /></span><div><p>CLOVE HR</p><h1>New Staff Onboarding</h1></div></div>
          <p className="login-copy">Sign in as super admin to review incoming recruitment requests and onboard staff.</p>
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
    <Head><title>New Staff Onboarding | CloveHR</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
    <main className="login-page ot-page">
      <section className="login-card ot-card">
        <div className="login-brand"><span><UserPlus size={25} /></span><div><p>CLOVE HR</p><h1>New Staff Onboarding</h1></div></div>

        <div className="content-stack">
          <div>
            <h2>Incoming recruitment requests</h2>
            {candidatesLoading ? (
              <p className="login-copy">Loading candidates...</p>
            ) : candidates.length === 0 ? (
              <p className="login-copy">No pending recruitment candidates.</p>
            ) : (
              <>
                {candidateError && <p className="login-error" role="alert">{candidateError}</p>}
                <div className="table-shell">
                  <table className="salary-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Nationality</th>
                        <th>Passport</th>
                        <th>Profession</th>
                        <th>Approve to site</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidates.map((candidate) => (
                        <tr key={candidate.id}>
                          <td>{candidate.name}</td>
                          <td>{candidate.nationality || '—'}</td>
                          <td>{candidate.passport_number || '—'}</td>
                          <td>{professionLabels[candidate.profession || ''] || '—'}</td>
                          <td>
                            <div className="action-row">
                              <select
                                value={selectedSite[candidate.id] || ''}
                                onChange={(event) => setSelectedSite((current) => ({ ...current, [candidate.id]: event.target.value }))}
                              >
                                <option value="">Select site</option>
                                {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
                              </select>
                              <button
                                className="soft-button compact"
                                type="button"
                                disabled={!selectedSite[candidate.id] || approving === candidate.id || rejecting === candidate.id}
                                onClick={() => approveCandidate(candidate.id)}
                              >
                                {approving === candidate.id ? 'Approving...' : 'Approve'}
                              </button>
                              <button
                                className="soft-button compact danger"
                                type="button"
                                disabled={approving === candidate.id || rejecting === candidate.id}
                                onClick={() => rejectCandidate(candidate.id, candidate.name)}
                              >
                                {rejecting === candidate.id ? 'Rejecting...' : 'Reject'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {!onboardedName ? (
            <div>
              <h2>Onboard staff directly</h2>
              <p className="login-copy">Add a new employee&rsquo;s basic details below.</p>
              <div className="form-grid compact-grid">
                <label><span>Full name</span>
                  <input type="text" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                </label>
                <label><span>Passport / ID number</span>
                  <input type="text" value={form.id_number} onChange={(event) => setForm({ ...form, id_number: event.target.value })} />
                </label>
                <label><span>Work site</span>
                  <select value={form.site_id} onChange={(event) => setForm({ ...form, site_id: event.target.value })}>
                    <option value="">Select site</option>
                    {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
                  </select>
                </label>
                <label><span>Job title</span>
                  <input type="text" value={form.job_title} onChange={(event) => setForm({ ...form, job_title: event.target.value })} />
                </label>
                <label><span>Job level</span>
                  <select value={form.job_level} onChange={(event) => setForm({ ...form, job_level: event.target.value })}>
                    {jobLevels.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
                  </select>
                </label>
                <label><span>Payment method</span>
                  <select value={form.medium} onChange={(event) => setForm({ ...form, medium: event.target.value })}>
                    <option value="cash">Cash</option>
                    <option value="account transfer">Bank transfer</option>
                  </select>
                </label>
              </div>
              {error && <p className="login-error" role="alert">{error}</p>}
              <button className="dark-button full" type="button" disabled={submitting} onClick={submit}>
                {submitting ? 'Onboarding...' : <>Onboard employee <UserPlus size={16} /></>}
              </button>
            </div>
          ) : (
            <div className="wizard-panel attendance-success">
              <UserPlus size={30} />
              <h3>Employee onboarded</h3>
              <p>{onboardedName} has been added with the default MVR 5,400 salary and is now visible to the super admin, who can adjust the salary and other details anytime.</p>
              <button className="dark-button" type="button" onClick={() => { setOnboardedName(''); setForm(emptyForm); }}><Check size={16} /> Onboard another</button>
            </div>
          )}

          <Link className="text-link ot-back-link" href="/login"><ArrowLeft size={14} /> Back to sign in</Link>
        </div>
      </section>
    </main>
  </>;
}
