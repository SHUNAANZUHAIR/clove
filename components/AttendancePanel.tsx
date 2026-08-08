import { useState, type ReactNode } from 'react';
import { Time24Select } from './Time24Select';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Save,
  Trash2,
  UserCheck,
  X,
  Download,
} from 'lucide-react';

export interface AttendanceSite {
  id: number;
  name: string;
  location: string;
}

export interface AttendanceRecord {
  id: number | null;
  employee_id: number;
  employee_name: string;
  id_number: string | null;
  site_id: number | null;
  site_name: string | null;
  status: 'present' | 'absent' | 'leave' | 'off';
  in_time: string | null;
  out_time: string | null;
  ot_in_time: string | null;
  ot_out_time: string | null;
  notes: string;
}

export interface AttendanceHistoryEntry {
  id: number;
  start_date: string;
  end_date: string;
  site_id: number | null;
  site_name: string;
  employee_count: number;
  created_at: string;
}

function isFridayDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).getUTCDay() === 5;
}

function localDateValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function AttendancePanel({
  date,
  endDate,
  records,
  history,
  sites,
  search,
  loading,
  saving,
  onDateChange,
  onEndDateChange,
  onChange,
  onSave,
  onDeleteHistory,
}: {
  date: string;
  endDate: string;
  records: AttendanceRecord[];
  history: AttendanceHistoryEntry[];
  sites: AttendanceSite[];
  search: string;
  loading: boolean;
  saving: boolean;
  onDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onChange: (records: AttendanceRecord[]) => void;
  onSave: (records: AttendanceRecord[], endDate?: string, siteId?: string) => void;
  onDeleteHistory: (entry: AttendanceHistoryEntry) => void;
}) {
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [journeyStep, setJourneyStep] = useState(1);
  const [attendanceScope, setAttendanceScope] = useState<'employee' | 'site'>('site');
  const [journeyEmployeeId, setJourneyEmployeeId] = useState('');
  const [journeySiteId, setJourneySiteId] = useState('');
  const [journeyIncludedIds, setJourneyIncludedIds] = useState<number[] | null>(null);
  const [visibleDateCount, setVisibleDateCount] = useState(5);
  const [journeyInTime, setJourneyInTime] = useState('07:00');
  const [journeyOutTime, setJourneyOutTime] = useState('17:00');
  const [journeyOtInTime, setJourneyOtInTime] = useState('');
  const [journeyOtOutTime, setJourneyOtOutTime] = useState('');
  const [attendanceConfirmation, setAttendanceConfirmation] = useState('');
  const [selectedAttendanceSite, setSelectedAttendanceSite] = useState('all');
  const friday = isFridayDate(date);
  const siteRecords = records.filter((record) => (
    selectedAttendanceSite === 'all' || record.site_id?.toString() === selectedAttendanceSite
  ));
  const visibleRecords = siteRecords.filter((record) => (
    !search ||
    record.employee_name.toLowerCase().includes(search) ||
    record.id_number?.toLowerCase().includes(search) ||
    record.site_name?.toLowerCase().includes(search)
  ));
  const counts = siteRecords.reduce((summary, record) => {
    summary[record.status] += 1;
    return summary;
  }, { present: 0, absent: 0, leave: 0, off: 0 });

  const updateRecord = (employeeId: number, updates: Partial<AttendanceRecord>) => {
    onChange(records.map((record) => record.employee_id === employeeId ? { ...record, ...updates } : record));
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const journeyDates = Array.from({ length: visibleDateCount }, (_, index) => {
    const item = new Date(today);
    item.setDate(today.getDate() - (visibleDateCount - 1 - index));
    return item;
  });
  const scopeRecords = attendanceScope === 'site'
    ? records.filter((record) => record.site_id?.toString() === journeySiteId)
    : records.filter((record) => record.employee_id.toString() === journeyEmployeeId);
  const targetRecords = journeyIncludedIds === null
    ? scopeRecords
    : scopeRecords.filter((record) => journeyIncludedIds.includes(record.employee_id));
  const targetLabel = attendanceScope === 'site'
    ? sites.find((site) => site.id.toString() === journeySiteId)?.name || ''
    : records.find((record) => record.employee_id.toString() === journeyEmployeeId)?.employee_name || '';
  const hasTarget = scopeRecords.length > 0;

  const submitJourneyAttendance = async () => {
    const fridaySelection = isFridayDate(date);
    const submittedRecords = targetRecords.map((record) => ({
      ...record,
      status: fridaySelection ? 'off' as const : 'present' as const,
      in_time: fridaySelection ? null : journeyInTime,
      out_time: fridaySelection ? null : journeyOutTime,
      ot_in_time: fridaySelection ? null : (journeyOtInTime || null),
      ot_out_time: fridaySelection ? null : (journeyOtOutTime || null),
    }));
    await Promise.resolve(onSave(submittedRecords, date, attendanceScope === 'site' ? journeySiteId : 'all'));
    setAttendanceConfirmation(`${targetRecords.map((record) => record.employee_name).join(', ')} — attendance recorded.`);
    setJourneyStep(4);
  };

  void endDate;
  void onEndDateChange;
  void visibleRecords;
  void counts;
  void updateRecord;
  void friday;

  return (
    <section className="attendance-panel" aria-label="Employee attendance tracking">
      {!journeyOpen ? (
        <button className="give-salary-button attendance-start-button" type="button" disabled={sites.length === 0 || records.length === 0} onClick={() => {
          const isSingleSiteLogin = sites.length === 1;
          const loggedSiteId = isSingleSiteLogin ? sites[0].id.toString() : '';
          setJourneyOpen(true);
          setAttendanceScope('site');
          setJourneySiteId(loggedSiteId);
          setJourneyIncludedIds(isSingleSiteLogin ? records.map((record) => record.employee_id) : null);
          setJourneyStep(isSingleSiteLogin ? 2 : 1);
          setVisibleDateCount(5);
          setAttendanceConfirmation('');
          setJourneyOtInTime('');
          setJourneyOtOutTime('');
        }}>
          <ClipboardCheck size={20} />
          SUBMIT ATTENDANCE
        </button>
      ) : (
        <section className="attendance-journey">
          <div className="wizard-head">
            <div><h2>Submit attendance</h2><span>{targetLabel || 'Choose employees'}</span></div>
            <button className="soft-button compact" type="button" onClick={() => setJourneyOpen(false)}><X size={14} /> Close</button>
          </div>
          <div className="wizard-steps" aria-label="Attendance steps">
            {['Site team', 'Date', 'Hours', 'Done'].map((label, index) => (
              <button key={label} className={`wizard-step ${journeyStep === index + 1 ? 'is-current' : journeyStep > index + 1 ? 'is-complete' : 'is-upcoming'}`} type="button" disabled={(index === 0 && sites.length === 1) || index + 1 > journeyStep || index === 3} onClick={() => setJourneyStep(index + 1)}>
                <span className="wizard-step-node">{journeyStep > index + 1 ? <Check size={17} /> : index + 1}</span>
                <span className="wizard-step-label">{label}</span>
              </button>
            ))}
          </div>
          {journeyStep === 1 && <div className="wizard-panel">
            <div className="form-grid compact-grid">
              <label><span>Submit attendance by</span><select value={attendanceScope} onChange={(event) => { setAttendanceScope(event.target.value as 'employee' | 'site'); setJourneyIncludedIds(null); }}><option value="site">Work site</option><option value="employee">Employee</option></select></label>
              {attendanceScope === 'site' ? (
                <label><span>Work site</span><select value={journeySiteId} onChange={(event) => { setJourneySiteId(event.target.value); setJourneyIncludedIds(null); }}><option value="">Select work site</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
              ) : (
                <label><span>Employee</span><select value={journeyEmployeeId} onChange={(event) => { setJourneyEmployeeId(event.target.value); setJourneyIncludedIds(null); }}><option value="">Select employee</option>{records.map((record) => <option key={record.employee_id} value={record.employee_id}>{record.employee_name}</option>)}</select></label>
              )}
            </div>
            {hasTarget && <p className="journey-selection-note">{targetRecords.length} employee{targetRecords.length === 1 ? '' : 's'} selected</p>}
            <div className="action-row"><button className="dark-button" type="button" disabled={!hasTarget} onClick={() => { setJourneyIncludedIds(scopeRecords.map((record) => record.employee_id)); setJourneyStep(2); }}>Next <ChevronRight size={16} /></button></div>
          </div>}
          {journeyStep === 2 && <div className="wizard-panel">
            {sites.length === 1 && <div className="form-grid compact-grid attendance-person-scope">
              <label>
                <span>Attendance for</span>
                <select value={attendanceScope} onChange={(event) => {
                  const scope = event.target.value as 'employee' | 'site';
                  setAttendanceScope(scope);
                  setJourneyEmployeeId('');
                  setJourneyIncludedIds(scope === 'site' ? records.map((record) => record.employee_id) : []);
                }}>
                  <option value="site">All site employees</option>
                  <option value="employee">Individual employee</option>
                </select>
              </label>
              {attendanceScope === 'employee' && <label>
                <span>Select employee</span>
                <select value={journeyEmployeeId} onChange={(event) => {
                  setJourneyEmployeeId(event.target.value);
                  setJourneyIncludedIds(event.target.value ? [Number(event.target.value)] : []);
                }}>
                  <option value="">Choose employee</option>
                  {records.map((record) => <option key={record.employee_id} value={record.employee_id}>{record.employee_name}</option>)}
                </select>
              </label>}
            </div>}
            <div className="attendance-date-strip" aria-label="Select attendance date">
              {journeyDates.map((item) => {
                const value = localDateValue(item);
                const isToday = value === localDateValue(today);
                return <button key={value} className={`${isToday ? 'is-today' : 'is-past'}${date === value ? ' is-selected' : ''}`} type="button" onClick={() => onDateChange(value)}><small>{item.toLocaleDateString('en-US', { weekday: 'short' })}</small><strong>{item.getDate()}</strong><span>{item.toLocaleDateString('en-US', { month: 'short' })}</span></button>;
              })}
            </div>
            <button className="text-link attendance-load-more" type="button" onClick={() => setVisibleDateCount((count) => count + 5)}>Load previous 5 days</button>
            <div className="action-row"><button className="dark-button" type="button" disabled={targetRecords.length === 0} onClick={() => setJourneyStep(3)}>Continue <ChevronRight size={16} /></button></div>
          </div>}
          {journeyStep === 3 && <div className="wizard-panel">
            {isFridayDate(date) ? (
              <p className="friday-attendance-note">Friday is an off day. No in or out time will be recorded.</p>
            ) : (
              <div className="form-grid compact-grid attendance-time-grid">
                <label>
                  <span>In time</span>
                  <Time24Select ariaLabel="Attendance in time" value={journeyInTime} onChange={setJourneyInTime} />
                </label>
                <label>
                  <span>Out time</span>
                  <Time24Select ariaLabel="Attendance out time" value={journeyOutTime} onChange={setJourneyOutTime} />
                </label>
                <label>
                  <span>OT in time</span>
                  <Time24Select ariaLabel="Overtime in time" value={journeyOtInTime} onChange={setJourneyOtInTime} />
                </label>
                <label>
                  <span>OT out time</span>
                  <Time24Select ariaLabel="Overtime out time" value={journeyOtOutTime} onChange={setJourneyOtOutTime} />
                </label>
              </div>
            )}
            <div className="attendance-confirm-list">
              <div className="attendance-confirm-title"><UserCheck size={18} /><strong>{targetRecords.length} attending</strong><span>Untick anyone to remove</span></div>
              {scopeRecords.map((record) => {
                const included = journeyIncludedIds?.includes(record.employee_id) ?? true;
                return <label className={included ? 'is-included' : ''} key={record.employee_id}><input type="checkbox" checked={included} onChange={(event) => setJourneyIncludedIds((current) => event.target.checked ? Array.from(new Set([...(current || []), record.employee_id])) : (current || scopeRecords.map((item) => item.employee_id)).filter((id) => id !== record.employee_id))} /><UserCheck size={16} /><span>{record.employee_name}</span><small>{record.site_name || 'Unassigned'}</small></label>;
              })}
            </div>
            <div className="action-row"><button className="soft-button" type="button" onClick={() => setJourneyStep(2)}><ChevronLeft size={16} /> Back</button><button className="dark-button" type="button" disabled={saving || loading || targetRecords.length === 0} onClick={submitJourneyAttendance}><Save size={16} /> {saving ? 'Submitting...' : 'Submit attendance'}</button></div>
          </div>}
          {journeyStep === 4 && <div className="wizard-panel attendance-success"><UserCheck size={30} /><h3>Attendance recorded</h3><p>{attendanceConfirmation}</p><button className="dark-button" type="button" onClick={() => { setJourneyOpen(false); setJourneyStep(1); }}>Done</button></div>}
        </section>
      )}

      <SectionHeader title="Attendance history" action={`${history.length} saved`} />
      <div className="table-shell">
        <table className="salary-table attendance-history-table">
          <thead>
            <tr>
              <th>Saved</th>
              <th>Date range</th>
              <th>Work site</th>
              <th>Employees</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr className="empty-table-row"><td colSpan={5}>No saved attendance history yet</td></tr>
            ) : history.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.created_at}</td>
                <td>{entry.start_date === entry.end_date ? entry.start_date : `${entry.start_date} to ${entry.end_date}`}</td>
                <td>{entry.site_name}</td>
                <td>{entry.employee_count}</td>
                <td>
                  <span className="row-actions">
                    <a className="icon-button small" title="Download saved attendance PDF" aria-label={`Download attendance history ${entry.id}`} href={`/api/reports/attendance?date=${entry.start_date}&end_date=${entry.end_date}&site_id=${entry.site_id || 'all'}`}><Download size={15} /></a>
                    <button className="icon-button small danger" title="Delete attendance history" aria-label={`Delete attendance history ${entry.id}`} type="button" onClick={() => onDeleteHistory(entry)}><Trash2 size={15} /></button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {action && <div className="section-action">{action}</div>}
    </div>
  );
}
