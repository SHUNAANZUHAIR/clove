import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, UserPlus } from 'lucide-react';

interface OnboardingSite {
  id: number;
  name: string;
  location?: string;
}

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
  salary: '5400',
  medium: 'cash',
};

export default function OnboardEmployee() {
  const [sites, setSites] = useState<OnboardingSite[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [onboardedName, setOnboardedName] = useState('');

  useEffect(() => {
    fetch('/api/auth/sites')
      .then((res) => (res.ok ? res.json() : []))
      .then(setSites)
      .catch(() => setSites([]));
  }, []);

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
          salary: Number(form.salary) || 5400,
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

  return <>
    <Head><title>New Staff Onboarding | CloveHR</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
    <main className="login-page ot-page">
      <section className="login-card ot-card">
        <div className="login-brand"><span><UserPlus size={25} /></span><div><p>CLOVE HR</p><h1>New Staff Onboarding</h1></div></div>

        {!onboardedName ? (
          <>
            <p className="login-copy">Add a new employee&rsquo;s basic details below. No login is required.</p>
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
              <label><span>Monthly salary (MVR)</span>
                <input type="number" min="0" step="0.01" value={form.salary} onChange={(event) => setForm({ ...form, salary: event.target.value })} />
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
            <Link className="text-link ot-back-link" href="/login"><ArrowLeft size={14} /> Back to sign in</Link>
          </>
        ) : (
          <div className="wizard-panel attendance-success">
            <UserPlus size={30} />
            <h3>Employee onboarded</h3>
            <p>{onboardedName} has been added and is now visible to the super admin.</p>
            <button className="dark-button" type="button" onClick={() => { setOnboardedName(''); setForm(emptyForm); }}><Check size={16} /> Onboard another</button>
            <Link className="text-link ot-back-link" href="/login"><ArrowLeft size={14} /> Back to sign in</Link>
          </div>
        )}
      </section>
    </main>
  </>;
}
