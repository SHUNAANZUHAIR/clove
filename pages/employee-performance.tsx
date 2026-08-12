import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Award, Star } from 'lucide-react';

interface PerformanceEmployee {
  id: number;
  name: string;
  passport_number: string | null;
  rating: number | null;
}

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export default function EmployeePerformance() {
  const [month, setMonth] = useState(currentMonth);
  const [employees, setEmployees] = useState<PerformanceEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetch(`/api/public/employee-performance?month=${encodeURIComponent(month)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Could not load employee performance.');
        return res.json();
      })
      .then((data) => { if (active) setEmployees(data); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load employee performance.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month]);

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

        <label className="performance-month"><span>Performance month</span><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
        {error && <p className="login-error" role="alert">{error}</p>}

        {loading ? <p className="login-copy">Loading employees...</p> : error ? null : employees.length === 0 ? <p className="login-copy">No active construction employees found.</p> : (
          <div className="performance-list">
            {employees.map((employee, index) => (
              <article className={`performance-row ${employee.rating ? 'is-rated' : ''}`} key={employee.id}>
                <span className="performance-rank">{index + 1}</span>
                <div className="performance-person"><strong>{employee.name}</strong><small>Passport: {employee.passport_number || 'Not provided'}</small></div>
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
