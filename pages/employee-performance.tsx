import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Award, Star } from 'lucide-react';

interface PerformanceEmployee {
  id: number;
  name: string;
  passport_number: string | null;
  site_id: number | null;
  site_name: string | null;
  rating: number | null;
}

interface PerformanceSite { id: number; name: string; }

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export default function EmployeePerformance() {
  const [month, setMonth] = useState(currentMonth);
  const [employees, setEmployees] = useState<PerformanceEmployee[]>([]);
  const [sites, setSites] = useState<PerformanceSite[]>([]);
  const [siteId, setSiteId] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ month });
    if (siteId) params.set('site_id', siteId);
    fetch(`/api/public/employee-performance?${params}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Could not load employee performance.');
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setEmployees(data.employees || []);
        setSites(data.sites || []);
      })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load employee performance.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month, siteId]);

  const rateEmployee = async (employeeId: number, rating: number) => {
    setSavingId(employeeId);
    setError('');
    try {
      const res = await fetch('/api/public/employee-performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId, rating, month }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Could not save this rating.');
      setEmployees((current) => current
        .map((employee) => employee.id === employeeId ? { ...employee, rating } : employee)
        .sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name)));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this rating.');
    } finally {
      setSavingId(null);
    }
  };

  return <>
    <Head><title>Employee Performance | CloveHR</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
    <main className="login-page performance-page">
      <section className="login-card performance-card">
        <div className="login-brand"><span><Award size={25} /></span><div><p>CLOVE HR</p><h1>Employee Performance</h1></div></div>
        <p className="login-copy">Rate Clove Construction employees for the selected month. The best performers automatically move to the top.</p>

        <div className="performance-filters">
          <label><span>Performance month</span><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
          <label><span>Work site</span><select value={siteId} onChange={(event) => setSiteId(event.target.value)}><option value="">All construction sites</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
        </div>
        {error && <p className="login-error" role="alert">{error}</p>}

        {loading ? <p className="login-copy">Loading employees...</p> : error ? null : employees.length === 0 ? <p className="login-copy">No active construction employees found.</p> : (
          <div className="performance-list">
            {employees.map((employee, index) => (
              <article className={`performance-row ${employee.rating ? 'is-rated' : ''}`} key={employee.id}>
                <span className="performance-rank">{index + 1}</span>
                <div className="performance-person"><strong>{employee.name}</strong><small>Passport: {employee.passport_number || 'Not provided'} · {employee.site_name || 'No site'}</small></div>
                <div className="star-rating" aria-label={`Rate ${employee.name}`}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      className={star <= (employee.rating || 0) ? 'active' : ''}
                      aria-label={`${star} star${star === 1 ? '' : 's'}`}
                      aria-pressed={employee.rating === star}
                      disabled={savingId === employee.id}
                      onClick={() => rateEmployee(employee.id, star)}
                    ><Star size={22} fill="currentColor" /></button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}

        <Link className="text-link ot-back-link" href="/login"><ArrowLeft size={14} /> Back to sign in</Link>
      </section>
    </main>
  </>;
}
