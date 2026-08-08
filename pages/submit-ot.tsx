import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, Check, ChevronLeft, ChevronRight, Clock3, Download, Save, UserCheck } from 'lucide-react';

interface RosterEmployee {
  id: number;
  name: string;
}

interface DayRow {
  date: string;
  weekday: string;
  isFriday: boolean;
  status: 'present' | 'absent' | 'leave' | 'off';
  in_time: string;
  out_time: string;
  ot_in_time: string;
  ot_out_time: string;
}

interface SavedRecord {
  date: string;
  status: string;
  in_time: string | null;
  out_time: string | null;
  ot_in_time: string | null;
  ot_out_time: string | null;
}

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const defaultInTime = '07:00';
const defaultOutTime = '18:00';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

const otWindowStart = '18:00';
const otWindowEnd = '23:59';

function clampOtTime(value: string) {
  if (!value) return value;
  if (value < otWindowStart) return otWindowStart;
  if (value > otWindowEnd) return otWindowEnd;
  return value;
}

interface DraftState {
  employeeId: string;
  step: 1 | 2;
  viewMonth: number;
  viewYear: number;
  rows: DayRow[];
  lastActivity: number;
}

const draftStorageKey = 'clovehr-ot-draft';
const draftExpiryMs = 5 * 60 * 1000;

function readDraft(): DraftState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) return null;
    const draft = JSON.parse(raw) as DraftState;
    if (Date.now() - draft.lastActivity > draftExpiryMs) {
      window.localStorage.removeItem(draftStorageKey);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

function writeDraft(draft: Omit<DraftState, 'lastActivity'>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(draftStorageKey, JSON.stringify({ ...draft, lastActivity: Date.now() }));
  } catch {
    // Storage can be unavailable (private browsing, quota); the in-page state still works, it just won't survive a refresh.
  }
}

function touchDraftActivity() {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) return;
    const draft = JSON.parse(raw) as DraftState;
    window.localStorage.setItem(draftStorageKey, JSON.stringify({ ...draft, lastActivity: Date.now() }));
  } catch {
    // Ignore — activity ping is best-effort.
  }
}

function clearDraft() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(draftStorageKey);
  } catch {
    // Ignore.
  }
}

function buildMonthDays(month: number, year: number, saved: Map<string, SavedRecord>): DayRow[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  const isOngoingMonth = month === today.getMonth() + 1 && year === today.getFullYear();
  const lastDay = isOngoingMonth ? Math.min(daysInMonth, today.getDate()) : daysInMonth;
  const rows: DayRow[] = [];
  for (let day = 1; day <= lastDay; day += 1) {
    const date = `${year}-${pad(month)}-${pad(day)}`;
    const weekday = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    const isFriday = weekday === 'Fri';
    const existing = saved.get(date);
    rows.push({
      date,
      weekday,
      isFriday,
      status: isFriday ? 'off' : ((existing?.status as DayRow['status']) || 'present'),
      in_time: isFriday ? '' : (existing?.in_time || defaultInTime),
      out_time: isFriday ? '' : (existing?.out_time || defaultOutTime),
      ot_in_time: isFriday ? '' : clampOtTime(existing?.ot_in_time || ''),
      ot_out_time: isFriday ? '' : clampOtTime(existing?.ot_out_time || ''),
    });
  }
  return rows;
}

export default function SubmitOt() {
  // Plain SSR-safe defaults — a saved draft (localStorage isn't available on
  // the server) is restored client-side after mount, in the effect below.
  const [step, setStep] = useState<1 | 2>(1);
  const [employees, setEmployees] = useState<RosterEmployee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState('');
  const [rows, setRows] = useState<DayRow[]>([]);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const today = useMemo(() => new Date(), []);
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const [viewMonth, setViewMonth] = useState(currentMonth);
  const [viewYear, setViewYear] = useState(currentYear);
  const monthLabel = `${monthNames[viewMonth - 1]} ${viewYear}`;
  const isOngoingMonth = viewMonth === currentMonth && viewYear === currentYear;
  const selectedEmployee = employees.find((employee) => employee.id.toString() === employeeId) || null;

  useEffect(() => {
    const draft = readDraft();
    if (draft) {
      setStep(draft.step);
      setEmployeeId(draft.employeeId);
      setRows(draft.rows);
      setViewMonth(draft.viewMonth);
      setViewYear(draft.viewYear);
    }

    fetch('/api/public/employees')
      .then((res) => (res.ok ? res.json() : []))
      .then(setEmployees)
      .catch(() => setEmployees([]))
      .finally(() => setEmployeesLoading(false));
  }, []);

  // Persist the in-progress timesheet so a refresh doesn't lose it, and keep
  // extending the 5-minute activity window while the employee is on step 2.
  useEffect(() => {
    if (step !== 2 || !employeeId) return;
    writeDraft({ employeeId, step, viewMonth, viewYear, rows });
  }, [step, employeeId, viewMonth, viewYear, rows]);

  useEffect(() => {
    if (step !== 2 || !employeeId) return;
    const bumpActivity = () => touchDraftActivity();
    window.addEventListener('pointerdown', bumpActivity);
    window.addEventListener('keydown', bumpActivity);
    const watchdog = window.setInterval(() => {
      const current = readDraft();
      if (!current) {
        clearDraft();
        setStep(1);
        setEmployeeId('');
        setRows([]);
        setSessionExpired(true);
      }
    }, 15000);
    return () => {
      window.removeEventListener('pointerdown', bumpActivity);
      window.removeEventListener('keydown', bumpActivity);
      window.clearInterval(watchdog);
    };
  }, [step, employeeId]);

  const loadTimesheet = async (targetMonth = viewMonth, targetYear = viewYear) => {
    if (!employeeId) return;
    setError('');
    setLoadingSheet(true);
    try {
      const res = await fetch(`/api/public/ot?employee_id=${employeeId}&month=${targetMonth}&year=${targetYear}`);
      if (!res.ok) throw new Error('load-failed');
      const data = await res.json();
      const saved = new Map<string, SavedRecord>((data.records || []).map((record: SavedRecord) => [record.date, record]));
      setRows(buildMonthDays(targetMonth, targetYear, saved));
      setStep(2);
      setSessionExpired(false);
    } catch {
      setError('Could not load your timesheet. Please try again.');
    } finally {
      setLoadingSheet(false);
    }
  };

  // Regularizing past attendance only reaches back one month from today.
  const earliestMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const earliestYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const isEarliestMonth = viewMonth === earliestMonth && viewYear === earliestYear;

  const changeMonth = (delta: number) => {
    let nextMonth = viewMonth + delta;
    let nextYear = viewYear;
    if (nextMonth > 12) { nextMonth = 1; nextYear += 1; }
    if (nextMonth < 1) { nextMonth = 12; nextYear -= 1; }
    if (nextYear > currentYear || (nextYear === currentYear && nextMonth > currentMonth)) return;
    if (nextYear < earliestYear || (nextYear === earliestYear && nextMonth < earliestMonth)) return;
    setViewMonth(nextMonth);
    setViewYear(nextYear);
    loadTimesheet(nextMonth, nextYear);
  };

  const updateRow = (date: string, updates: Partial<DayRow>) => {
    setRows((current) => current.map((row) => (row.date === date ? { ...row, ...updates } : row)));
  };

  const downloadTimesheetPdf = () => {
    const link = document.createElement('a');
    link.href = `/api/public/ot-pdf?employee_id=${employeeId}&month=${viewMonth}&year=${viewYear}`;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const submitTimesheet = async () => {
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/public/ot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: Number(employeeId),
          records: rows.map((row) => ({
            date: row.date,
            status: row.status,
            in_time: row.isFriday || row.status !== 'present' ? null : row.in_time,
            out_time: row.isFriday || row.status !== 'present' ? null : row.out_time,
            ot_in_time: row.isFriday || row.status !== 'present' ? null : (row.ot_in_time || null),
            ot_out_time: row.isFriday || row.status !== 'present' ? null : (row.ot_out_time || null),
          })),
        }),
      });
      if (!res.ok) throw new Error('save-failed');
      clearDraft();
      setSubmitted(true);
    } catch {
      setError('Your timesheet could not be submitted. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return <>
    <Head><title>Submit Attendance | CloveHR</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
    <main className={`login-page ot-page${step === 2 ? ' ot-page-sheet' : ''}`}>
      <section className={`login-card ot-card${step === 2 ? ' ot-card-sheet' : ''}`}>
        <div className="login-brand"><span><CalendarClock size={25} /></span><div><p>CLOVE HR</p><h1>Submit Attendance</h1></div></div>

        {step === 1 && <>
          {sessionExpired && <p className="login-error" role="alert">Your session timed out after 5 minutes of inactivity. Please select your name again.</p>}
          <p className="login-copy">Select your name to submit your timesheet for {monthLabel}. No login is required.</p>
          <div className="form-grid compact-grid">
            <label><span>Your name</span>
              <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} disabled={employeesLoading}>
                <option value="">{employeesLoading ? 'Loading employees...' : 'Select employee'}</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
              </select>
            </label>
          </div>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="dark-button full" type="button" disabled={!employeeId || loadingSheet} onClick={() => loadTimesheet()}>
            {loadingSheet ? 'Loading...' : <>Continue <Clock3 size={16} /></>}
          </button>
          <Link className="text-link ot-back-link" href="/login"><ArrowLeft size={14} /> Back to sign in</Link>
        </>}

        {step === 2 && <>
          <div className="wizard-head ot-wizard-head">
            <div><h2>{selectedEmployee?.name}</h2><span>{monthLabel} timesheet</span></div>
            <button className="soft-button compact" type="button" onClick={() => { clearDraft(); setStep(1); setViewMonth(currentMonth); setViewYear(currentYear); }}><ChevronLeft size={14} /> Change employee</button>
          </div>
          <div className="ot-month-nav">
            <button className="icon-button small" type="button" title="Previous month" aria-label="Previous month" disabled={loadingSheet || isEarliestMonth} onClick={() => changeMonth(-1)}><ChevronLeft size={16} /></button>
            <span>{monthLabel}{!isOngoingMonth && <small> &middot; past month, regularize as needed</small>}</span>
            <button className="icon-button small" type="button" title="Next month" aria-label="Next month" disabled={loadingSheet || isOngoingMonth} onClick={() => changeMonth(1)}><ChevronRight size={16} /></button>
          </div>
          <p className="ot-hint">Default hours are 7:00 AM to 6:00 PM. Add OT in/out times for any day you worked overtime — OT must fall between 6:00 PM and 11:59 PM the same day. Adjust any day, then submit.</p>
          <div className="table-shell ot-table-shell">
            <table className="salary-table ot-timesheet-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>In</th>
                  <th>Out</th>
                  <th>OT in</th>
                  <th>OT out</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.date} className={row.isFriday || row.status === 'absent' ? 'ot-alert-row' : undefined}>
                    <td className="ot-row-date"><strong>{Number(row.date.slice(8, 10))}</strong> <small>{row.weekday}</small></td>
                    <td>
                      {row.isFriday ? <span className="status-pill off">off</span> : (
                        <select aria-label={`Status for ${row.date}`} value={row.status} onChange={(event) => updateRow(row.date, { status: event.target.value as DayRow['status'] })}>
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                          <option value="leave">Leave</option>
                        </select>
                      )}
                    </td>
                    <td><input aria-label={`In time for ${row.date}`} type="time" lang="en-GB" value={row.in_time} disabled={row.isFriday || row.status !== 'present'} onChange={(event) => updateRow(row.date, { in_time: event.target.value })} /></td>
                    <td><input aria-label={`Out time for ${row.date}`} type="time" lang="en-GB" value={row.out_time} disabled={row.isFriday || row.status !== 'present'} onChange={(event) => updateRow(row.date, { out_time: event.target.value })} /></td>
                    <td><input aria-label={`OT in time for ${row.date}`} type="time" lang="en-GB" min={otWindowStart} max={otWindowEnd} value={row.ot_in_time} disabled={row.isFriday || row.status !== 'present'} onChange={(event) => updateRow(row.date, { ot_in_time: clampOtTime(event.target.value) })} /></td>
                    <td><input aria-label={`OT out time for ${row.date}`} type="time" lang="en-GB" min={otWindowStart} max={otWindowEnd} value={row.ot_out_time} disabled={row.isFriday || row.status !== 'present'} onChange={(event) => updateRow(row.date, { ot_out_time: clampOtTime(event.target.value) })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && <p className="login-error" role="alert">{error}</p>}
          <div className="action-row">
            <button className="soft-button" type="button" onClick={() => setStep(1)}><ChevronLeft size={16} /> Back</button>
            <button className="dark-button" type="button" disabled={saving} onClick={submitTimesheet}><Save size={16} /> {saving ? 'Submitting...' : 'Submit timesheet'}</button>
          </div>
        </>}

      </section>
    </main>

    {submitted && (
      <div className="quick-view-backdrop" role="dialog" aria-modal="true" aria-label="Attendance submitted">
        <div className="ot-success-modal">
          <UserCheck size={30} />
          <h3>Attendance is submitted</h3>
          <p>{selectedEmployee?.name}'s {monthLabel} timesheet has been recorded and is now available for payroll.</p>
          <button className="text-link ot-success-download" type="button" onClick={downloadTimesheetPdf}><Download size={15} /> Click here to download PDF</button>
          <div className="action-row">
            <button className="soft-button" type="button" onClick={() => window.location.assign('/login')}>Close</button>
            <button className="dark-button" type="button" onClick={() => { clearDraft(); setSubmitted(false); setStep(1); setEmployeeId(''); setRows([]); setViewMonth(currentMonth); setViewYear(currentYear); }}><Check size={16} /> Submit another</button>
          </div>
        </div>
      </div>
    )}
  </>;
}
