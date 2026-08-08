// pages/index.tsx
import Head from 'next/head';
import { Fragment, type ChangeEvent, type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  BriefcaseBusiness,
  CalendarDays,
  ClipboardCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Copy,
  Download,
  LogOut,
  MapPin,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  SlidersHorizontal,
  Trash2,
  UserCheck,
  UserX,
  UsersRound,
  X,
} from 'lucide-react';
import { Time24Select } from '../components/Time24Select';

interface Employee {
  id: number;
  name: string;
  salary: number;
  id_number: string;
  birth_date: string | null;
  join_date: string | null;
  photo: string | null;
  medium: string;
  employee_type: EmployeeType;
  job_level: JobLevel;
  site_id: number | null;
  site_name?: string;
  created_at?: string;
  work_permit_number?: string;
  nationality?: string;
  current_address?: string;
  job_title?: string;
  job_description?: string;
  employment_status?: 'indefinite' | 'fixed_term';
  fixed_term_end?: string | null;
  probation_applicable?: boolean;
  probation_months?: number | null;
  hours_per_day?: number | null;
  hours_per_week?: number | null;
  allowances_benefits?: string;
  accommodation_provided?: boolean;
  meals_provided?: boolean;
  transport_provided?: boolean;
  return_airfare_provided?: boolean;
  benefit_details?: string;
  notice_period?: string;
  employer_signatory?: string;
  is_terminated?: boolean;
  terminated_at?: string | null;
}

interface Site {
  id: number;
  name: string;
  location: string;
  has_password?: boolean;
}

interface SalaryTransaction {
  id: number;
  employee_id: number;
  employee_name: string;
  base_salary: number;
  medium: string;
  month: number;
  year: number;
  worked_days: number;
  daily_rate: number;
  absent_days: number;
  absent_deduction: number;
  cash_advance: number;
  ot_hours: number;
  ot_rate: number;
  ot_amount: number;
  net_salary: number;
  status: string;
}

interface AttendanceSummaryRow {
  employee_id: number;
  employee_name: string;
  days_worked: number;
  days_absent: number;
  work_hours: number;
  ot_hours: number;
  less_work_days_deduction: number | null;
  other_deductions: number | null;
  total_payout: number | null;
  payout_status: string | null;
}

interface SiteTeam {
  id: number;
  site_id: number;
  employee_id: number;
  employee_name: string;
}

interface AttendanceRecord {
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

interface AttendanceHistoryEntry {
  id: number;
  start_date: string;
  end_date: string;
  site_id: number | null;
  site_name: string;
  employee_count: number;
  created_at: string;
}

type Tab = 'profile' | 'salary' | 'attendance' | 'site';
type SalaryScope = 'employee' | 'site';
type EmployeeType = string;
type JobLevel = 'labour' | 'mason' | 'carpenter' | 'supervisor';

const defaultEmployeeGroups: Array<{ value: EmployeeType; label: string }> = [
  { value: 'local', label: 'Local Employee' },
  { value: 'clove_expats', label: 'Clove Expats' },
  { value: 'full_time_expats', label: 'Full Time Expats' },
];

const jobLevels: Array<{ value: JobLevel; label: string }> = [
  { value: 'labour', label: 'Labour' },
  { value: 'mason', label: 'Mason' },
  { value: 'carpenter', label: 'Carpenter' },
  { value: 'supervisor', label: 'Supervisor' },
];

const agreementNationalities = ['Bangladeshi', 'Indian', 'Nepali', 'Sri Lankan'];
const agreementJobTitles = [
  'Waiter',
  'Assistant, kitchen',
  'Steward, kitchen',
  'Cook',
  'Washer, hand: dishes',
  'Maker, pastry',
  'Cleaner, restaurant',
  'Hand, kitchen',
];

const agreementJobDescriptions: Record<string, string> = {
  Waiter: 'Welcome guests, take orders, serve food and beverages, and keep the dining area clean and ready for service.',
  'Assistant, kitchen': 'Support food preparation, ingredient handling, storage, cleaning, and kitchen hygiene under the cook’s direction.',
  'Steward, kitchen': 'Clean and sanitize kitchen areas, equipment and utensils, manage waste, and maintain hygiene standards.',
  Cook: 'Prepare and cook menu items, control portions and quality, store food safely, and maintain kitchen hygiene.',
  'Washer, hand: dishes': 'Wash, sanitize, dry and organize dishes, cookware and utensils, and keep the washing area clean.',
  'Maker, pastry': 'Prepare, bake and finish pastries and desserts while maintaining quality, stock control and food safety.',
  'Cleaner, restaurant': 'Clean and sanitize dining, service and common areas and maintain a safe, tidy restaurant environment.',
  'Hand, kitchen': 'Assist cooks with basic preparation, stock movement, cleaning and other routine kitchen support duties.',
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const maxProfilePhotoBytes = 5 * 1024 * 1024;
const profilePhotoMaxSize = 512;
const collapsedEmployeeLimit = 5;
const defaultEmployeeSalary = 5400;
const salaryPeriodDays = 30;
const salaryWizardSteps = ['Employee', 'Salary', 'Days', 'Net pay'];
const getBusinessYear = () => new Date().getFullYear();
const cloveCafeEmployer = 'CLOVE CAFE & BISTRO (ST00060328)';
const cloveCafeAddress = 'SUNNY BEEM, ORCHID MAGU, S. Maradhoo, Maldives';

const escapeAgreementValue = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

function printEmploymentAgreement(employee: Employee) {
  const value = (input: unknown, fallback = '____________________________') => escapeAgreementValue(input || fallback);
  const title = value(employee.job_title || jobLevelLabel(employee.job_level));
  const jobDescription = value(
    employee.job_description || agreementJobDescriptions[employee.job_title || ''],
    'Duties will be assigned according to the employee’s position.'
  );
  const employmentStatus = employee.employment_status || 'indefinite';
  const selected = (label: string) => `&#9745; ${label}`;
  const employmentTerm = employmentStatus === 'fixed_term'
    ? selected(`Fixed-term ending on ${value(employee.fixed_term_end)}`)
    : selected('Indefinite/permanent');
  const probationTerm = employee.probation_applicable
    ? selected(`Probation applicable for ${value(employee.probation_months)} month(s)`)
    : selected('Probation not applicable');
  const paymentMethod = employee.medium === 'account transfer'
    ? selected('Bank transfer')
    : employee.medium === 'cash'
      ? selected('Cash')
      : selected(value(employee.medium, 'Other'));
  const benefitSelection = [
    selected(employee.accommodation_provided ? 'Accommodation provided' : 'Accommodation not provided'),
    selected(employee.meals_provided ? 'Meals provided' : 'Meals not provided'),
    selected(employee.transport_provided ? 'Local transport provided' : 'Local transport not provided'),
    selected(employee.return_airfare_provided ? 'Return airfare/repatriation provided' : 'Return airfare/repatriation not provided'),
  ].join('; ');
  const allowancesText = employee.allowances_benefits
    ? ` Allowances/benefits: ${value(employee.allowances_benefits)}.`
    : '';
  const benefitDetailsText = employee.benefit_details
    ? ` Details: ${value(employee.benefit_details)}.`
    : '';
  const agreement = `<!doctype html><html><head><meta charset="utf-8"><title>Employment Agreement - ${value(employee.name)}</title>
  <style>body{font:12px/1.45 Arial,sans-serif;color:#111;max-width:820px;margin:28px auto;padding:0 28px}h1{text-align:center;font-size:20px;margin:14px 0}h2{font-size:14px;margin:18px 0 6px}header{text-align:center;font-weight:700}.details{width:100%;border-collapse:collapse;margin:14px 0}.details td{border:1px solid #bbb;padding:6px}.details td:first-child{font-weight:700;width:32%}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:34px}.line{margin-top:20px;border-bottom:1px solid #111}@media print{body{margin:0;max-width:none}.no-print{display:none}}</style></head><body>
  <button class="no-print" onclick="window.print()">Print / Save as PDF</button><header>${cloveCafeEmployer}<br>${cloveCafeAddress}</header><h1>EMPLOYMENT AGREEMENT</h1>
  <p>This Employment Agreement is made between ${cloveCafeEmployer}, of ${cloveCafeAddress} (the “Employer”), and <strong>${value(employee.name)}</strong>, passport no. <strong>${value(employee.id_number)}</strong>, work permit no. <strong>${value(employee.work_permit_number)}</strong> (the “Employee”).</p>
  <table class="details"><tr><td>Employee name</td><td>${value(employee.name)}</td></tr><tr><td>Passport number</td><td>${value(employee.id_number)}</td></tr><tr><td>Work permit number</td><td>${value(employee.work_permit_number)}</td></tr><tr><td>Job title</td><td>${title}</td></tr><tr><td>Place of employment</td><td>${cloveCafeEmployer}, ${cloveCafeAddress}</td></tr><tr><td>Employment commencement date</td><td>${value(employee.join_date)}</td></tr><tr><td>Employee nationality</td><td>${value(employee.nationality)}</td></tr><tr><td>Permanent / current address</td><td>${value(employee.current_address, '____________________________________________________________')}</td></tr></table>
  <h2>1. Appointment and duties</h2><p>The Employer appoints the Employee as ${title}.</p><p><strong>Short job description:</strong> ${jobDescription}</p><p>The Employee shall comply with lawful and reasonable instructions, maintain hygiene and food-safety standards, protect the Employer’s property and reputation, and carry out related duties reasonably assigned by the Employer.</p>
  <h2>2. Employment status and term</h2><p>${employmentTerm}. Any fixed term and renewal shall comply with the Employment Act of the Maldives. Continuous service commences on the date stated above.</p>
  <h2>3. Probation</h2><p>${probationTerm}, not exceeding the maximum period permitted by Maldivian law.</p>
  <h2>4. Working hours, roster and breaks</h2><p>Normal working hours shall be ${value(employee.hours_per_day)} hours per day and ${value(employee.hours_per_week)} hours per week, according to a roster issued by the Employer. Statutory meal/rest breaks and weekly rest apply.</p>
  <h2>5. Salary and payment</h2><p>Basic salary: MVR ${value(employee.salary)} per month.${allowancesText} Salary shall be paid monthly by ${paymentMethod}.</p>
  <h2>6. Overtime and work on rest days/public holidays</h2><p>Overtime must be authorized in advance and shall be recorded and compensated at not less than the rate required by the Employment Act. Work on weekly rest days and public holidays shall be compensated or replaced with leave as required by law.</p>
  <h2>7. Leave</h2><p>The Employee is entitled to statutory annual, sick, family responsibility, maternity/paternity and public-holiday leave under the Employment Act and amendments in force.</p>
  <h2>8. Accommodation, meals, transport and permits</h2><p>${benefitSelection}.${benefitDetailsText}</p>
  <h2>9. Conduct, safety and confidentiality</h2><p>The Employee shall follow workplace rules, safety instructions, anti-harassment requirements, cash-control procedures, customer-service standards and food hygiene rules. Confidential business and personnel information shall not be disclosed except as required for work or by law.</p>
  <h2>10. Discipline and grievances</h2><p>Disciplinary action shall be based on reasonable cause and fair procedure. The Employee may raise a grievance without retaliation and may use any statutory complaint or tribunal process.</p>
  <h2>11. Termination and notice</h2><p>After probation, either party may terminate this Agreement by written notice, or payment in lieu where lawful, using at least the statutory notice period or any longer period written here: ${value(employee.notice_period)}.</p>
  <h2>12. Governing law and entire agreement</h2><p>This Agreement is governed by the laws of the Republic of Maldives, including the Employment Act and applicable regulations. Any less favorable term shall be replaced by the applicable mandatory statutory right. Changes must be in writing and signed by both parties.</p>
  <div class="signatures"><div><strong>For the Employer</strong><p>Name: ${value(employee.employer_signatory)}</p><div class="line">Signature</div><div class="line">Date</div></div><div><strong>Employee</strong><p>Name: ${value(employee.name)}</p><div class="line">Signature</div><div class="line">Date</div></div></div></body></html>`;
  const popup = window.open('', '_blank');
  if (!popup) {
    alert('Allow pop-ups to generate the employment agreement.');
    return;
  }
  popup.document.write(agreement);
  popup.document.close();
}

const emptyProfileForm = {
  id: 0,
  name: '',
  salary: defaultEmployeeSalary.toString(),
  id_number: '',
  birth_date: '',
  join_date: '',
  photo: '',
  medium: 'cash',
  employee_type: 'local' as EmployeeType,
  job_level: 'labour' as JobLevel,
  site_id: '',
  work_permit_number: '',
  nationality: '',
  current_address: '',
  job_title: '',
  job_description: '',
  employment_status: 'indefinite' as 'indefinite' | 'fixed_term',
  fixed_term_end: '',
  probation_applicable: false,
  probation_months: '',
  hours_per_day: '8',
  hours_per_week: '48',
  allowances_benefits: '',
  accommodation_provided: false,
  meals_provided: false,
  transport_provided: false,
  return_airfare_provided: false,
  benefit_details: '',
  notice_period: '',
  employer_signatory: '',
};

function employeeToProfileForm(employee: Employee, duplicate = false): typeof emptyProfileForm {
  return {
    id: duplicate ? 0 : employee.id,
    name: duplicate ? '' : employee.name,
    salary: employee.salary.toString(),
    id_number: duplicate ? '' : employee.id_number,
    birth_date: duplicate ? '' : employee.birth_date || '',
    join_date: duplicate ? '' : employee.join_date || '',
    photo: duplicate ? '' : employee.photo || '',
    medium: employee.medium || 'cash',
    employee_type: employee.employee_type || 'local',
    job_level: employee.job_level || 'labour',
    site_id: employee.site_id?.toString() || '',
    work_permit_number: duplicate ? '' : employee.work_permit_number || '',
    nationality: duplicate ? '' : employee.nationality || '',
    current_address: duplicate ? '' : employee.current_address || '',
    job_title: employee.job_title || '',
    job_description: employee.job_description || agreementJobDescriptions[employee.job_title || ''] || '',
    employment_status: employee.employment_status || 'indefinite',
    fixed_term_end: employee.fixed_term_end || '',
    probation_applicable: Boolean(employee.probation_applicable),
    probation_months: employee.probation_months?.toString() || '',
    hours_per_day: employee.hours_per_day?.toString() || '8',
    hours_per_week: employee.hours_per_week?.toString() || '48',
    allowances_benefits: employee.allowances_benefits || '',
    accommodation_provided: Boolean(employee.accommodation_provided),
    meals_provided: Boolean(employee.meals_provided),
    transport_provided: Boolean(employee.transport_provided),
    return_airfare_provided: Boolean(employee.return_airfare_provided),
    benefit_details: employee.benefit_details || '',
    notice_period: employee.notice_period || '',
    employer_signatory: employee.employer_signatory || '',
  };
}

// Payroll always runs for the last completed month — never the current one.
const getLastCompletedMonth = () => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  return currentMonth === 1 ? 12 : currentMonth - 1;
};

const freshSalaryForm = () => ({
  scope: 'employee' as SalaryScope,
  employee_id: '',
  employee_ids: [] as string[],
  site_id: '',
  month: getLastCompletedMonth(),
  year: getBusinessYear(),
  worked_days: salaryPeriodDays,
  daily_rate: 0,
  absent_days: 0,
  absent_deduction: 0,
  cash_advance: 0,
  ot_hours: 0,
  ot_rate: 0,
  net_salary: 0,
  status: 'paid',
});

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [employeeGroups, setEmployeeGroups] = useState(defaultEmployeeGroups);
  const [sites, setSites] = useState<Site[]>([]);
  const [salaryTransactions, setSalaryTransactions] = useState<SalaryTransaction[]>([]);
  const [siteTeam, setSiteTeam] = useState<SiteTeam[]>([]);
  const [salarySiteMemberIds, setSalarySiteMemberIds] = useState<number[]>([]);
  const [selectedSite, setSelectedSite] = useState<number | null>(null);
  const [selectedSalaryIds, setSelectedSalaryIds] = useState<number[]>([]);
  const [selectedAgreementIds, setSelectedAgreementIds] = useState<number[]>([]);
  const [quickViewEmployee, setQuickViewEmployee] = useState<Employee | null>(null);
  const [teamSelections, setTeamSelections] = useState<Record<number, string>>({});
  // Starts true (not false) so the tab-default effect below doesn't fire on
  // the very first render with stale isSuperAdmin=false, before the actual
  // session has loaded — that race previously locked super admin onto
  // Attendance and prevented the Salary default from ever taking effect.
  const [loading, setLoading] = useState(true);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceEndDate, setAttendanceEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceHistoryEntry[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);

  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [employeeFormExpanded, setEmployeeFormExpanded] = useState(false);
  const [employeeSaveStatus, setEmployeeSaveStatus] = useState('');
  const [salaryForm, setSalaryForm] = useState(freshSalaryForm);
  const [salaryFilter, setSalaryFilter] = useState({ month: 'all', status: 'all' });
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummaryRow[]>([]);
  const [attendanceSummaryLoading, setAttendanceSummaryLoading] = useState(false);
  const [attendanceSummaryMonth, setAttendanceSummaryMonth] = useState(getLastCompletedMonth());
  const [attendanceSummaryYear, setAttendanceSummaryYear] = useState(() => {
    const now = new Date();
    return now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  });
  const [salaryJourneyOpen, setSalaryJourneyOpen] = useState(false);
  const autoOpenedSalaryJourney = useRef(false);
  const [salaryStep, setSalaryStep] = useState(1);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [expandedEmployeeGroups, setExpandedEmployeeGroups] = useState<Record<EmployeeType, boolean>>({
    local: false,
    clove_expats: false,
    full_time_expats: false,
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!isSuperAdmin && (activeTab === 'profile' || activeTab === 'salary')) {
      setActiveTab('attendance');
    }
    // Team (the 'profile' tab) is super admin's default — Manage people
    // leads there. Only the Process Salary shortcut below overrides it.
  }, [loading, isSuperAdmin, activeTab]);

  // Arriving via the login screen's "Process Salary" shortcut (?tab=salary)
  // lands on Salary with the Give Salary card open immediately, instead of
  // the usual Team default.
  useEffect(() => {
    if (loading || !isSuperAdmin || autoOpenedSalaryJourney.current || typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('tab') === 'salary') {
      autoOpenedSalaryJourney.current = true;
      setActiveTab('salary');
      startSalaryJourney();
    }
  }, [loading, isSuperAdmin]);

  useEffect(() => {
    if (activeTab !== 'attendance') return;
    fetchAttendance(attendanceDate);
    fetchAttendanceHistory();
  }, [activeTab, attendanceDate]);

  useEffect(() => {
    if (activeTab !== 'salary' || !isSuperAdmin) return;
    fetchAttendanceSummary(attendanceSummaryMonth, attendanceSummaryYear);
  }, [activeTab, isSuperAdmin, attendanceSummaryMonth, attendanceSummaryYear]);

  useEffect(() => {
    if (salaryForm.scope !== 'site' || !salaryForm.site_id) {
      setSalarySiteMemberIds([]);
      return;
    }

    let isCurrent = true;
    fetch(`/api/site-team?siteId=${salaryForm.site_id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: SiteTeam[]) => {
        if (isCurrent) setSalarySiteMemberIds(data.map((member) => member.employee_id));
      })
      .catch(() => {
        if (isCurrent) setSalarySiteMemberIds([]);
      });

    return () => {
      isCurrent = false;
    };
  }, [salaryForm.scope, salaryForm.site_id]);

  useEffect(() => {
    setSalaryForm((current) => withSalaryCalculations(current, getSalaryTargets(current, employees, salarySiteMemberIds)));
  }, [employees, salarySiteMemberIds]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchSession(), fetchEmployees(), fetchEmployeeGroups(), fetchSites(), fetchSalaryTransactions()]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    const res = await fetch('/api/employees');
    if (res.ok) {
      const data = await res.json();
      setEmployees(data);
    }
  };

  const fetchSites = async () => {
    const res = await fetch('/api/sites');
    if (res.ok) {
      const data = await res.json();
      setSites(data);
    }
  };

  const fetchSalaryTransactions = async () => {
    const res = await fetch('/api/salary');
    if (res.ok) {
      const data = await res.json();
      setSalaryTransactions(data);
    }
  };

  const fetchAttendanceSummary = async (month: number, year: number) => {
    setAttendanceSummaryLoading(true);
    try {
      const res = await fetch(`/api/reports/attendance-summary?month=${month}&year=${year}`);
      if (!res.ok) throw new Error('Could not load attendance summary');
      setAttendanceSummary(await res.json());
    } catch (error) {
      console.error(error);
      setAttendanceSummary([]);
    } finally {
      setAttendanceSummaryLoading(false);
    }
  };

  const deleteAttendanceSummaryRow = async (row: AttendanceSummaryRow) => {
    if (!confirm(`Delete ${row.employee_name}'s submitted attendance for ${monthNames[attendanceSummaryMonth - 1]} ${attendanceSummaryYear}?`)) return;
    const res = await fetch(`/api/reports/attendance-summary?employee_id=${row.employee_id}&month=${attendanceSummaryMonth}&year=${attendanceSummaryYear}`, { method: 'DELETE' });
    if (!res.ok) return alert('Could not delete this attendance summary.');
    await fetchAttendanceSummary(attendanceSummaryMonth, attendanceSummaryYear);
  };

  const fetchAttendance = async (date: string) => {
    setAttendanceLoading(true);
    try {
      const res = await fetch(`/api/attendance?date=${date}`);
      if (!res.ok) throw new Error('Could not load attendance');
      const records = await res.json() as AttendanceRecord[];
      const friday = isFridayDate(date);
      setAttendanceRecords(records.map((record) => ({
        ...record,
        status: friday ? 'off' : record.status,
        in_time: friday ? null : record.in_time || '07:00',
        out_time: friday ? null : record.out_time || '17:00',
        ot_in_time: friday ? null : record.ot_in_time || null,
        ot_out_time: friday ? null : record.ot_out_time || null,
      })));
    } catch (error) {
      console.error(error);
      setAttendanceRecords([]);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const fetchSession = async () => {
    const res = await fetch('/api/auth/session');
    if (res.ok) setIsSuperAdmin(Boolean((await res.json()).is_super_admin));
  };

  const fetchEmployeeGroups = async () => {
    const res = await fetch('/api/employee-groups');
    if (res.ok) setEmployeeGroups(await res.json());
  };

  const addEmployeeGroup = async () => {
    const label = prompt('New team group name');
    if (!label?.trim()) return;
    const res = await fetch('/api/employee-groups', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label }),
    });
    if (!res.ok) return alert('Could not add the team group.');
    const group = await res.json();
    setEmployeeGroups((current) => [...current, group]);
    setProfileForm((current) => ({ ...current, employee_type: group.value }));
  };

  const renameEmployeeGroup = async (value: string) => {
    const group = employeeGroups.find((item) => item.value === value);
    if (!group) return;
    const label = prompt('Rename team group', group.label);
    if (!label?.trim() || label.trim() === group.label) return;
    const res = await fetch('/api/employee-groups', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value, label }),
    });
    if (!res.ok) return alert('Could not rename the team group.');
    const updated = await res.json();
    setEmployeeGroups((current) => current.map((item) => item.value === value ? updated : item));
  };

  const fetchAttendanceHistory = async () => {
    const res = await fetch('/api/attendance?history=1');
    if (res.ok) setAttendanceHistory(await res.json());
  };

  const deleteAttendanceHistory = async (entry: AttendanceHistoryEntry) => {
    if (!confirm(`Delete the saved attendance history for ${entry.start_date === entry.end_date ? entry.start_date : `${entry.start_date} to ${entry.end_date}`}?`)) return;
    const res = await fetch(`/api/attendance?id=${entry.id}`, { method: 'DELETE' });
    if (!res.ok) return alert('Could not delete this attendance history record.');
    await fetchAttendanceHistory();
  };

  const saveAttendance = async (recordsToSave: AttendanceRecord[], endDate?: string, siteId?: string, startDate?: string) => {
    setAttendanceSaving(true);
    try {
      const rangeStart = startDate || attendanceDate;
      const dates = getAttendanceDateRange(rangeStart, endDate || rangeStart);
      if (dates.length === 0) {
        alert('Select a valid date range. The end date must be on or after the start date.');
        return;
      }
      if (dates.length > 31) {
        alert('Please select a date range of 31 days or less.');
        return;
      }
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dates, records: recordsToSave, site_id: siteId === 'all' ? null : Number(siteId) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Could not save attendance');
      }
      await fetchAttendance(attendanceDate);
      await fetchAttendanceHistory();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Attendance could not be saved. Please try again.');
    } finally {
      setAttendanceSaving(false);
    }
  };

  const fetchSiteTeam = async (siteId: number) => {
    const res = await fetch(`/api/site-team?siteId=${siteId}`);
    if (res.ok) {
      const data = await res.json();
      setSiteTeam(data);
    }
  };

  const handleSaveEmployee = async (event: FormEvent) => {
    event.preventDefault();

    const isEditingEmployee = profileForm.id > 0;
    const method = isEditingEmployee ? 'PUT' : 'POST';
    const salary = Number(profileForm.salary);

    const res = await fetch('/api/employees', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...profileForm,
        salary: Number.isFinite(salary) && salary > 0 ? salary : defaultEmployeeSalary,
        site_id: profileForm.site_id ? parseInt(profileForm.site_id) : null,
        fixed_term_end: profileForm.employment_status === 'fixed_term' && profileForm.fixed_term_end ? profileForm.fixed_term_end : null,
        probation_months: profileForm.probation_applicable && profileForm.probation_months ? Number(profileForm.probation_months) : null,
        hours_per_day: profileForm.hours_per_day ? Number(profileForm.hours_per_day) : null,
        hours_per_week: profileForm.hours_per_week ? Number(profileForm.hours_per_week) : null,
      }),
    });

    if (res.ok) {
      await fetchEmployees();
      if (isEditingEmployee) {
        setEmployeeSaveStatus('Saved');
      } else {
        setProfileForm(emptyProfileForm);
        setEmployeeSaveStatus('Employee created');
        setEmployeeFormExpanded(false);
      }
    } else {
      const data = await res.json().catch(() => null);
      alert(data?.error || 'Could not save employee.');
    }
  };

  const handleDeleteEmployee = async (id: number) => {
    if (confirm('Delete this employee?')) {
      await fetch(`/api/employees?id=${id}`, { method: 'DELETE' });
      await fetchEmployees();
    }
  };

  const handleEmployeeTermination = async (employee: Employee) => {
    const terminate = !employee.is_terminated;
    const action = terminate ? 'terminate' : 'reactivate';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${employee.name}?`)) return;
    const res = await fetch('/api/employees', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: employee.id, terminated: terminate }),
    });
    if (!res.ok) {
      alert(`Could not ${action} this employee.`);
      return;
    }
    await fetchEmployees();
  };

	  const handleSaveSalary = async () => {
	    const targetEmployees = getSalaryTargets(salaryForm, employees, salarySiteMemberIds);
	    const activeBusinessYear = getBusinessYear();

	    if (targetEmployees.length === 0) {
	      alert('Select at least one employee');
	      return;
	    }

	    const eligibleMonths = getCommonEligibleSalaryMonths(targetEmployees, activeBusinessYear);
	    if (!eligibleMonths.includes(salaryForm.month)) {
	      alert('Select a salary month from the selected employees join dates onward.');
	      setSalaryStep(2);
	      return;
	    }

	    const paidMonths = getPaidSalaryMonthsForEmployees(
	      salaryTransactions,
	      targetEmployees.map((employee) => employee.id),
	      activeBusinessYear
	    );
	    if (paidMonths.has(salaryForm.month)) {
	      alert(`${monthNames[salaryForm.month - 1]} ${activeBusinessYear} is already paid for one or more selected employees.`);
	      setSalaryStep(2);
	      return;
	    }

	    const selectedEmployeeIds = getSalaryEmployeeIds(salaryForm);

	    const res = await fetch('/api/salary', {
	      method: 'POST',
	      headers: { 'Content-Type': 'application/json' },
	      body: JSON.stringify({
	        scope: salaryForm.scope,
	        employee_ids: salaryForm.scope === 'employee' ? selectedEmployeeIds : undefined,
	        employee_id: salaryForm.scope === 'employee' && selectedEmployeeIds.length === 1 ? selectedEmployeeIds[0] : undefined,
	        site_id: salaryForm.scope === 'site' ? parseInt(salaryForm.site_id) : undefined,
        month: salaryForm.month,
        year: activeBusinessYear,
        worked_days: salaryForm.worked_days,
        absent_days: salaryForm.absent_days,
        cash_advance: salaryForm.cash_advance,
        status: salaryForm.status,
      }),
    });

    if (res.ok) {
      const saved = await res.json();
      const savedRows = Array.isArray(saved) ? saved : [saved];
      setSelectedSalaryIds(savedRows.map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0));
      await fetchSalaryTransactions();
      setSalaryForm(freshSalaryForm());
      setSalaryJourneyOpen(false);
      setSalaryStep(1);
    } else {
      const data = await res.json().catch(() => null);
      alert(data?.error || 'Could not save salary.');
    }
  };

  const handleBulkStatusUpdate = async (status: string) => {
    if (selectedSalaryIds.length === 0) {
      alert('Select at least one salary record');
      return;
    }

    for (const id of selectedSalaryIds) {
      await fetch('/api/salary', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
    }

    setSelectedSalaryIds([]);
    await fetchSalaryTransactions();
  };

  const handleDeleteSalaryTransaction = async (id: number, employeeName: string) => {
    if (!confirm(`Delete salary transaction for ${employeeName}?`)) {
      return;
    }

    const res = await fetch(`/api/salary?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('Could not delete this salary transaction.');
      return;
    }

    setSelectedSalaryIds((current) => current.filter((salaryId) => salaryId !== id));
    setExpandedRow((current) => (current === id ? null : current));
    await fetchSalaryTransactions();
  };

  const handleBulkDeleteSalaryTransactions = async () => {
    if (selectedSalaryIds.length === 0) {
      alert('Select at least one salary record');
      return;
    }

    const idsToDelete = [...selectedSalaryIds];
    const label = idsToDelete.length === 1 ? 'salary record' : 'salary records';
    if (!confirm(`Delete ${idsToDelete.length} selected ${label}?`)) {
      return;
    }

    const responses = await Promise.all(
      idsToDelete.map((id) => fetch(`/api/salary?id=${id}`, { method: 'DELETE' }))
    );

    if (responses.some((res) => !res.ok)) {
      alert('Some salary transactions could not be deleted.');
    }

    setSelectedSalaryIds([]);
    setExpandedRow((current) => (current && idsToDelete.includes(current) ? null : current));
    await fetchSalaryTransactions();
  };

  const handleSaveSite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.get('siteName'),
        location: formData.get('siteLocation'),
      }),
    });

    if (res.ok) {
      await fetchSites();
      form.reset();
    }
  };

  const handleDeleteSite = async (id: number, name: string) => {
    if (!confirm(`Delete site "${name}"? Employees assigned to this site will be unassigned.`)) {
      return;
    }

    const res = await fetch(`/api/sites?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('Could not delete this site.');
      return;
    }

    if (selectedSite === id) {
      setSelectedSite(null);
      setSiteTeam([]);
    }

    await Promise.all([fetchSites(), fetchEmployees()]);
  };

  const handleAddToTeam = async (siteId: number, employeeId: number) => {
    const res = await fetch('/api/site-team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site_id: siteId, employee_id: employeeId }),
    });

    if (res.ok) {
      setTeamSelections({ ...teamSelections, [siteId]: '' });
      await fetchSiteTeam(siteId);
    }
  };

  const handleRemoveFromTeam = async (teamId: number) => {
    await fetch(`/api/site-team?id=${teamId}`, { method: 'DELETE' });
    if (selectedSite) await fetchSiteTeam(selectedSite);
  };

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setEmployeeSaveStatus('');

    if (!file.type.startsWith('image/')) {
      alert('Choose an image file for the profile photo.');
      event.target.value = '';
      return;
    }

    if (file.size > maxProfilePhotoBytes) {
      alert('Profile photo must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }

    try {
      const photo = await resizeProfilePhoto(file);
      setProfileForm((current) => ({ ...current, photo }));
    } catch (error) {
      console.error('Photo upload error:', error);
      alert('Could not read this profile photo.');
    } finally {
      event.target.value = '';
    }
  };

  const handleSalaryFormChange = (next: ReturnType<typeof freshSalaryForm>) => {
    setSalaryForm(withSalaryCalculations(next, getSalaryTargets(next, employees, salarySiteMemberIds)));
  };

  const startSalaryJourney = () => {
    const next = freshSalaryForm();
    setSalaryForm(withSalaryCalculations(next, getSalaryTargets(next, employees, salarySiteMemberIds)));
    setSalaryStep(1);
    setSalaryJourneyOpen(true);
  };

  const startSalaryJourneyForEmployee = (employeeId: number) => {
    const next = { ...freshSalaryForm(), scope: 'employee' as SalaryScope, employee_id: String(employeeId), employee_ids: [String(employeeId)] };
    setSalaryForm(withSalaryCalculations(next, getSalaryTargets(next, employees, salarySiteMemberIds)));
    setSalaryStep(3);
    setSalaryJourneyOpen(true);
  };

  const closeSalaryJourney = () => {
    setSalaryJourneyOpen(false);
    setSalaryStep(1);
    setSalaryForm(freshSalaryForm());
  };

  const toggleSalarySelection = (id: number) => {
    setSelectedSalaryIds((current) => (
      current.includes(id) ? current.filter((salaryId) => salaryId !== id) : [...current, id]
    ));
  };

  const openSiteTeam = async (siteId: number) => {
    setSelectedSite(selectedSite === siteId ? null : siteId);
    if (selectedSite !== siteId) await fetchSiteTeam(siteId);
  };

  const handleRenameSite = async (site: Site) => {
    const name = prompt('Enter the new site name', site.name)?.trim();
    if (!name || name === site.name) return;
    const res = await fetch('/api/sites', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: site.id, name, location: site.location || '' }),
    });
    if (!res.ok) return alert('Could not rename this work site.');
    await Promise.all([fetchSites(), fetchEmployees()]);
  };

  const handleSetSitePassword = async (site: Site) => {
    const password = prompt(`Set a password for "${site.name}":`);
    if (!password) return;
    const res = await fetch('/api/site-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'site', site_id: site.id, password }),
    });
    if (!res.ok) return alert((await res.json().catch(() => null))?.error || `Could not set the password for "${site.name}".`);
    await fetchSites();
  };

  const handleChangeSuperAdminPassword = async () => {
    const currentPassword = prompt('Enter your current super admin password:');
    if (!currentPassword) return;
    const newPassword = prompt('Enter a new super admin password (min 4 characters):');
    if (!newPassword) return;
    const res = await fetch('/api/site-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'super_admin', current_password: currentPassword, password: newPassword }),
    });
    if (!res.ok) return alert((await res.json().catch(() => null))?.error || 'Could not change the super admin password.');
    alert('Super admin password updated.');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } finally {
      // A failed revocation request must not leave the UI looking signed in.
      // The middleware/session endpoint remains the authority on the next load.
      window.location.replace('/login');
    }
  };

  const filteredEmployees = employees;

  const employeeGroupsWithEmployees = useMemo(() => (
    employeeGroups.map((group) => ({
      ...group,
      employees: filteredEmployees
        .filter((employee) => employee.employee_type === group.value)
        .sort((first, second) => {
          if (!first.join_date && !second.join_date) return first.name.localeCompare(second.name);
          if (!first.join_date) return 1;
          if (!second.join_date) return -1;
          return first.join_date.localeCompare(second.join_date) || first.name.localeCompare(second.name);
        }),
    })).filter((group) => group.employees.length > 0)
  ), [filteredEmployees]);
  const orderedTeamEmployees = useMemo(
    () => employeeGroupsWithEmployees.flatMap((group) => group.employees),
    [employeeGroupsWithEmployees]
  );
  const editingEmployeeIndex = orderedTeamEmployees.findIndex((employee) => employee.id === profileForm.id);

  const filteredSites = sites;

  const filteredSalaryTransactions = useMemo(() => (
    salaryTransactions.filter((transaction) => {
      const monthMatch = salaryFilter.month === 'all' || transaction.month === parseInt(salaryFilter.month);
      const statusMatch = salaryFilter.status === 'all' || transaction.status === salaryFilter.status;
      return monthMatch && statusMatch;
    })
  ), [salaryTransactions, salaryFilter.month, salaryFilter.status]);

  const salaryTargets = getSalaryTargets(salaryForm, employees, salarySiteMemberIds);
  const submittedAttendanceEmployeeIds = useMemo(
    () => new Set(attendanceSummary.map((row) => row.employee_id)),
    [attendanceSummary]
  );

  const loggedSiteName = !isSuperAdmin && sites.length === 1 ? sites[0].name : '';
  const title = activeTab === 'profile' ? `Welcome, ${isSuperAdmin ? 'Super Admin' : loggedSiteName || 'Clove'}` : activeTab === 'salary' ? 'Payroll' : activeTab === 'attendance' ? 'Attendance' : 'Work Sites';
  const subtitle = activeTab === 'profile'
    ? isSuperAdmin ? `${sites.length} work sites` : loggedSiteName
    : activeTab === 'salary'
      ? `${filteredSalaryTransactions.length} salary records`
      : activeTab === 'attendance'
        ? `${attendanceRecords.length} employees for ${formatDate(attendanceDate)}`
      : `${sites.length} active locations`;

  return (
    <>
      <Head>
        <title>cloveHR</title>
        <meta name="description" content="cloveHR team, payroll, and site workspace" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="app-canvas">
        <section className="app-shell" aria-label="cloveHR workspace">
        <header className="app-header">
          <div>
            <p className="kicker">cloveHR</p>
            <h1>{title}</h1>
            <span>{subtitle}</span>
          </div>
          <div className="header-actions">
            {isSuperAdmin && <span className="employee-count-chip" title="Total employees">
              <UsersRound size={16} />
              {employees.length}
            </span>}
            {isSuperAdmin && <button
              className={`icon-button${activeTab === 'site' ? ' is-active' : ''}`}
              title="Sites"
              aria-label="Open Sites"
              type="button"
              onClick={() => setActiveTab('site')}
            >
              <MapPin size={18} />
            </button>}
            {isSuperAdmin && <button
              className="icon-button"
              title="Change super admin password"
              aria-label="Change super admin password"
              type="button"
              onClick={handleChangeSuperAdminPassword}
            >
              <KeyRound size={18} />
            </button>}
            <button className="icon-button danger" title="Log out" aria-label="Log out" type="button" onClick={handleLogout}>
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <nav className="quick-tabs" aria-label="Main sections">
          {isSuperAdmin && <button className={activeTab === 'profile' ? 'is-active' : ''} onClick={() => setActiveTab('profile')} type="button">
            <UsersRound size={17} />
            Team
          </button>}
          {isSuperAdmin && <button className={activeTab === 'salary' ? 'is-active' : ''} onClick={() => setActiveTab('salary')} type="button">
            <CircleDollarSign size={17} />
            Salary
          </button>}
          <button className={activeTab === 'attendance' ? 'is-active' : ''} onClick={() => setActiveTab('attendance')} type="button">
            <ClipboardCheck size={17} />
            Attendance
          </button>
        </nav>

        {loading ? (
          <div className="empty-state">Loading workspace...</div>
        ) : (
          <div className="content-stack">
            {activeTab === 'profile' && isSuperAdmin && (
              <>
                <button className="give-salary-button employee-onboarding-start" type="button" onClick={() => {
                  setEmployeeSaveStatus('');
                  setProfileForm(emptyProfileForm);
                  setEmployeeFormExpanded(true);
                  requestAnimationFrame(() => document.getElementById('employee-onboarding')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                }}>
                  <Plus size={20} />
                  NEW EMPLOYEE
                </button>
                <SectionHeader
                  title="Team"
                  action={(
                    <span className="section-actions">
                      <span>{selectedAgreementIds.length > 0 ? `${selectedAgreementIds.length} selected` : `${filteredEmployees.length} listed`}</span>
                      <a
                        className="soft-button compact"
                        href={selectedAgreementIds.length > 0
                          ? `/api/reports/employees?employee_ids=${selectedAgreementIds.join(',')}`
                          : '/api/reports/employees'}
                      >
                        <Download size={15} />
                        {selectedAgreementIds.length > 0 ? `PDF (${selectedAgreementIds.length})` : 'PDF'}
                      </a>
                      <button
                        className="soft-button compact"
                        type="button"
                        onClick={() => setSelectedAgreementIds((current) => {
                          const listedIds = filteredEmployees.map((employee) => employee.id);
                          const allListedSelected = listedIds.length > 0 && listedIds.every((id) => current.includes(id));
                          return allListedSelected
                            ? current.filter((id) => !listedIds.includes(id))
                            : Array.from(new Set([...current, ...listedIds]));
                        })}
                      >
                        {filteredEmployees.length > 0 && filteredEmployees.every((employee) => selectedAgreementIds.includes(employee.id)) ? 'Clear listed' : 'Select listed'}
                      </button>
                      {selectedAgreementIds.length > 0 && (
                        <a className="soft-button compact" href={`/api/reports/agreement?employee_ids=${selectedAgreementIds.join(',')}`}>
                          <Download size={15} />
                          Download {selectedAgreementIds.length} agreement{selectedAgreementIds.length === 1 ? '' : 's'}
                        </a>
                      )}
                    </span>
                  )}
                />
                <div className="team-groups">
                  {filteredEmployees.length === 0 ? (
                    <div className="empty-state">No employees found</div>
                  ) : (
                    employeeGroupsWithEmployees.map((group) => (
                      <TeamGroup
                        key={group.value}
                        title={group.label}
                        employees={group.employees}
                        expanded={expandedEmployeeGroups[group.value]}
                        selectedAgreementIds={selectedAgreementIds}
                        onToggle={() => setExpandedEmployeeGroups((current) => ({
                          ...current,
                          [group.value]: !current[group.value],
                        }))}
                        onEdit={(employee) => {
                          setEmployeeSaveStatus('');
                          setProfileForm(employeeToProfileForm(employee));
                          setEmployeeFormExpanded(true);
                          requestAnimationFrame(() => document.getElementById('employee-onboarding')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                        }}
                        onDuplicate={(employee) => {
                          setEmployeeSaveStatus('');
                          setProfileForm(employeeToProfileForm(employee, true));
                          setEmployeeFormExpanded(true);
                          requestAnimationFrame(() => document.getElementById('employee-onboarding')?.scrollIntoView({ behavior: 'smooth' }));
                        }}
                        onDelete={handleDeleteEmployee}
                        onView={setQuickViewEmployee}
                        onAgreementToggle={(employeeId) => setSelectedAgreementIds((current) => (
                          current.includes(employeeId)
                            ? current.filter((id) => id !== employeeId)
                            : [...current, employeeId]
                        ))}
                        onAgreementGroupToggle={(employeeIds) => setSelectedAgreementIds((current) => {
                          const allSelected = employeeIds.length > 0 && employeeIds.every((id) => current.includes(id));
                          return allSelected
                            ? current.filter((id) => !employeeIds.includes(id))
                            : Array.from(new Set([...current, ...employeeIds]));
                        })}
                      />
                    ))
                  )}
                </div>

                <EmployeeForm
                  employeesSites={sites}
                  allowSiteSelection={isSuperAdmin}
                  employeeGroups={employeeGroups}
                  form={profileForm}
                  expanded={employeeFormExpanded}
                  saveStatus={employeeSaveStatus}
                  previousEmployee={editingEmployeeIndex > 0 ? orderedTeamEmployees[editingEmployeeIndex - 1] : null}
                  nextEmployee={editingEmployeeIndex >= 0 && editingEmployeeIndex < orderedTeamEmployees.length - 1 ? orderedTeamEmployees[editingEmployeeIndex + 1] : null}
                  terminationEmployee={employees.find((employee) => employee.id === profileForm.id) || null}
                  onSubmit={handleSaveEmployee}
                  onChange={(form) => {
                    setEmployeeSaveStatus('');
                    setProfileForm(form);
                  }}
                  onNavigate={(employee) => {
                    setEmployeeSaveStatus('');
                    setProfileForm(employeeToProfileForm(employee));
                  }}
                  onPhotoChange={handlePhotoChange}
                  onPhotoClear={() => {
                    setEmployeeSaveStatus('');
                    setProfileForm((current) => ({ ...current, photo: '' }));
                  }}
                  onTerminate={handleEmployeeTermination}
                  onAddGroup={addEmployeeGroup}
                  onRenameGroup={renameEmployeeGroup}
                  onToggle={() => setEmployeeFormExpanded((current) => !current)}
                  onCancel={() => {
                    setEmployeeSaveStatus('');
                    setProfileForm(emptyProfileForm);
                    setEmployeeFormExpanded(false);
                  }}
                />
              </>
            )}

            {activeTab === 'salary' && isSuperAdmin && (
              <section className="salary-interface" aria-label="Salary interface">
	                <div className="salary-interface-content">
	                  <SalaryJourney
	                    employees={employees}
	                    sites={sites}
	                    salaryTransactions={salaryTransactions}
	                    targetEmployees={salaryTargets}
	                    form={salaryForm}
	                    isOpen={salaryJourneyOpen}
	                    step={salaryStep}
	                    submittedEmployeeIds={submittedAttendanceEmployeeIds}
	                    onStart={startSalaryJourney}
	                    onClose={closeSalaryJourney}
	                    onStepChange={setSalaryStep}
	                    onSubmit={handleSaveSalary}
	                    onChange={handleSalaryFormChange}
	                  />

	                  <AttendancePayoutSummary
	                    rows={attendanceSummary}
	                    loading={attendanceSummaryLoading}
	                    month={attendanceSummaryMonth}
	                    year={attendanceSummaryYear}
	                    onMonthChange={setAttendanceSummaryMonth}
	                    onYearChange={setAttendanceSummaryYear}
	                    onDelete={deleteAttendanceSummaryRow}
	                    onGiveSalary={startSalaryJourneyForEmployee}
	                  />

	                  <div className="filter-row">
	                    <label className="filter-control" title="Filter by month">
	                      <CalendarDays size={14} />
	                      <select
	                        aria-label="Filter by month"
	                        value={salaryFilter.month}
	                        onChange={(event) => setSalaryFilter({ ...salaryFilter, month: event.target.value })}
	                      >
	                        <option value="all">All</option>
	                        {monthNames.map((month, index) => (
	                          <option key={month} value={index + 1}>{month}</option>
	                        ))}
	                      </select>
	                    </label>
	                    <label className="filter-control" title="Filter by status">
	                      <SlidersHorizontal size={14} />
	                      <select
	                        aria-label="Filter by status"
	                        value={salaryFilter.status}
	                        onChange={(event) => setSalaryFilter({ ...salaryFilter, status: event.target.value })}
	                      >
	                        <option value="all">All</option>
	                        <option value="pending">Pending</option>
	                        <option value="paid">Paid</option>
	                      </select>
	                    </label>
	                  </div>

                  <SectionHeader
                    title="Payroll table"
                    action={(
                      <span className="section-actions">
                        <span>{selectedSalaryIds.length} selected</span>
                        <a
                          className="soft-button compact"
                          href={`/api/reports/salaries?month=${salaryFilter.month}&status=${salaryFilter.status}`}
                        >
                          <Download size={15} />
                          Salary PDF
                        </a>
                        {selectedSalaryIds.length > 0 && (
                          <a
                            className="soft-button compact"
                            href={`/api/reports/salary-slip?transaction_ids=${selectedSalaryIds.join(',')}`}
                          >
                            <Download size={15} />
                            Download selected slips
                          </a>
                        )}
                      </span>
                    )}
                  />
                  <div className="table-shell">
                    <table className="salary-table">
                      <thead>
                        <tr>
                          <th aria-label="Select salary record" />
                          <th>Employee</th>
                          <th>Period</th>
                          <th>Days</th>
                          <th>Daily</th>
                          <th>Deductions</th>
                          <th>Net</th>
                          <th>Status</th>
                          <th aria-label="Details" />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSalaryTransactions.length === 0 ? (
                          <tr className="empty-table-row">
                            <td colSpan={9}>No salary records found</td>
                          </tr>
                        ) : (
                          filteredSalaryTransactions.map((transaction) => (
                            <Fragment key={transaction.id}>
                              <tr>
                                <td>
                                  <label className="check-shell table-check">
                                    <input
                                      type="checkbox"
                                      checked={selectedSalaryIds.includes(transaction.id)}
                                      onChange={() => toggleSalarySelection(transaction.id)}
                                    />
                                    <span><Check size={12} /></span>
                                  </label>
                                </td>
                                <td>
                                  <strong>{transaction.employee_name}</strong>
                                  <small>{paymentLabel(transaction.medium)}</small>
                                </td>
                                <td>{monthNames[transaction.month - 1]} {transaction.year}</td>
                                <td>{transaction.worked_days}</td>
                                <td>{formatCurrency(transaction.daily_rate)}</td>
                                <td>{formatCurrency(Number(transaction.absent_deduction) + Number(transaction.cash_advance))}</td>
                                <td className="net-cell">{formatCurrency(transaction.net_salary)}</td>
                                <td>
                                  <span className={`status-pill ${transaction.status}`}>{transaction.status}</span>
                                </td>
                                <td>
                                  <div className="row-actions">
                                    <a
                                      className="icon-button small"
                                      title="Download employee salary slip PDF"
                                      aria-label={`Download salary slip for ${transaction.employee_name}`}
                                      href={`/api/reports/salary-slip?transaction_id=${transaction.id}`}
                                    >
                                      <Download size={15} />
                                    </a>
                                    <button
                                      className="icon-button small"
                                      title="View payroll details"
                                      type="button"
                                      onClick={() => setExpandedRow(expandedRow === transaction.id ? null : transaction.id)}
                                    >
                                      <MoreHorizontal size={15} />
                                    </button>
                                    <button
                                      className="icon-button small danger"
                                      title="Delete salary transaction"
                                      type="button"
                                      onClick={() => handleDeleteSalaryTransaction(transaction.id, transaction.employee_name)}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {expandedRow === transaction.id && (
                                <tr className="salary-detail-row">
                                  <td colSpan={9}>
                                    <dl className="detail-grid">
                                      <div><dt>Base salary</dt><dd>{formatCurrency(transaction.base_salary)}</dd></div>
                                      <div><dt>Absent days</dt><dd>{transaction.absent_days}</dd></div>
                                      <div><dt>Absent deduction</dt><dd>{formatCurrency(transaction.absent_deduction)}</dd></div>
                                      <div><dt>OT hours</dt><dd>{transaction.ot_hours || 0}</dd></div>
                                      <div><dt>OT rate / hour</dt><dd>{formatCurrency(transaction.ot_rate)}</dd></div>
                                      <div><dt>OT amount</dt><dd>{formatCurrency(transaction.ot_amount)}</dd></div>
                                      <div><dt>Other deduction</dt><dd>{formatCurrency(transaction.cash_advance)}</dd></div>
                                    </dl>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="action-row">
                    <button type="button" className="soft-button" onClick={() => handleBulkStatusUpdate('pending')}>
                      <Clock3 size={16} />
                      Pending
                    </button>
                    <button type="button" className="dark-button" onClick={() => handleBulkStatusUpdate('paid')}>
                      <Check size={16} />
                      Paid
                    </button>
                    <button type="button" className="soft-button danger" onClick={handleBulkDeleteSalaryTransactions}>
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>

                </div>
              </section>
            )}

            {activeTab === 'attendance' && (
              <AttendancePanel
                date={attendanceDate}
                endDate={attendanceEndDate}
                records={attendanceRecords}
                history={attendanceHistory}
                sites={sites}
                search=""
                loading={attendanceLoading}
                saving={attendanceSaving}
                onDateChange={(date) => {
                  setAttendanceDate(date);
                  if (attendanceEndDate < date) setAttendanceEndDate(date);
                }}
                onEndDateChange={setAttendanceEndDate}
                onChange={setAttendanceRecords}
                onSave={saveAttendance}
                onDeleteHistory={deleteAttendanceHistory}
              />
            )}

            {activeTab === 'site' && (
              <>
                <SiteForm onSubmit={handleSaveSite} />

                <SectionHeader title="Projects" action={`${filteredSites.length} locations`} />
                <div className="list-stack">
                  {filteredSites.length === 0 ? (
                    <div className="empty-state">No sites found</div>
                  ) : (
                    filteredSites.map((site) => {
                      const availableEmployees = employees.filter((employee) => !siteTeam.some((member) => member.employee_id === employee.id));
                      const selectedEmployee = Number(teamSelections[site.id] || 0);

                      return (
                        <article className="site-card" key={site.id}>
                          <div className="site-head">
                            <button className="site-open" type="button" onClick={() => openSiteTeam(site.id)}>
                              <span className="site-icon"><BriefcaseBusiness size={18} /></span>
                              <span>
                                <strong>{site.name}</strong>
                                <small>{site.location || 'No location'}</small>
                              </span>
                            </button>
                            <div className="row-actions">
                              <button className="icon-button small" title="Rename site" aria-label={`Rename ${site.name}`} type="button" onClick={() => handleRenameSite(site)}>
                                <Pencil size={15} />
                              </button>
                              <button className="icon-button small" title="Set/change password" aria-label={`Set password for ${site.name}`} type="button" onClick={() => handleSetSitePassword(site)}>
                                <KeyRound size={15} />
                              </button>
                              <span className="muted-chip">{site.has_password ? 'Password set' : 'Password required'}</span>
                              <button
                                className="icon-button small"
                                title="View team"
                                type="button"
                                onClick={() => openSiteTeam(site.id)}
                              >
                                <ChevronRight className={selectedSite === site.id ? 'rotate' : ''} size={16} />
                              </button>
                              <button
                                className="icon-button small danger"
                                title="Delete site"
                                type="button"
                                onClick={() => handleDeleteSite(site.id, site.name)}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>

                          {selectedSite === site.id && (
                            <div className="team-panel">
                              <div className="chip-row">
                                {siteTeam.length === 0 ? (
                                  <span className="muted-chip">No team members</span>
                                ) : (
                                  siteTeam.map((member) => (
                                    <span className="member-chip" key={member.id}>
                                      {member.employee_name}
                                      <button title="Remove member" type="button" onClick={() => handleRemoveFromTeam(member.id)}>
                                        <X size={13} />
                                      </button>
                                    </span>
                                  ))
                                )}
                              </div>
                              <div className="team-add-row">
                                <select
                                  value={teamSelections[site.id] || ''}
                                  onChange={(event) => setTeamSelections({ ...teamSelections, [site.id]: event.target.value })}
                                >
                                  <option value="">Add employee</option>
                                  {availableEmployees.map((employee) => (
                                    <option key={employee.id} value={employee.id}>{employee.name}</option>
                                  ))}
                                </select>
                                <button
                                  className="icon-button dark"
                                  title="Add employee"
                                  type="button"
                                  disabled={!selectedEmployee}
                                  onClick={() => selectedEmployee && handleAddToTeam(site.id, selectedEmployee)}
                                >
                                  <Plus size={17} />
                                </button>
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {quickViewEmployee && (
          <EmployeeQuickView employee={quickViewEmployee} onClose={() => setQuickViewEmployee(null)} />
        )}

        </section>
      </main>
    </>
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

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <article className="summary-card">
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </article>
  );
}

function Avatar({ employee }: { employee: Employee }) {
  return (
    <span className="avatar">
      {employee.photo ? <img src={employee.photo} alt="" /> : initials(employee.name)}
    </span>
  );
}

function TeamGroup({
  title,
  employees,
  expanded,
  selectedAgreementIds,
  onToggle,
  onEdit,
  onDuplicate,
  onDelete,
  onView,
  onAgreementToggle,
  onAgreementGroupToggle,
}: {
  title: string;
  employees: Employee[];
  expanded: boolean;
  selectedAgreementIds: number[];
  onToggle: () => void;
  onEdit: (employee: Employee) => void;
  onDuplicate: (employee: Employee) => void;
  onDelete: (id: number) => void;
  onView: (employee: Employee) => void;
  onAgreementToggle: (id: number) => void;
  onAgreementGroupToggle: (ids: number[]) => void;
}) {
  const [selectionVisible, setSelectionVisible] = useState(false);
  const visibleEmployees = expanded ? employees : employees.slice(0, collapsedEmployeeLimit);
  const hiddenCount = Math.max(0, employees.length - collapsedEmployeeLimit);
  const groupEmployeeIds = employees.map((employee) => employee.id);
  const groupSelected = groupEmployeeIds.length > 0 && groupEmployeeIds.every((id) => selectedAgreementIds.includes(id));

  return (
    <section className="team-group">
      <div className="team-group-head">
        <div>
          <h3>{title}</h3>
          <span>{employees.length} employee{employees.length === 1 ? '' : 's'}</span>
        </div>
        <div className="team-group-actions">
          {employees.length > 0 && (
            <button className="soft-button compact" type="button" onClick={() => {
              onAgreementGroupToggle(groupEmployeeIds);
              setSelectionVisible(!groupSelected);
            }}>
              {groupSelected ? 'Clear group' : 'Select group'}
            </button>
          )}
          {hiddenCount > 0 && (
            <button className="text-link" type="button" onClick={onToggle}>
              {expanded ? 'Show less' : `View all ${employees.length}`}
            </button>
          )}
        </div>
      </div>
      <div className="list-stack">
        {employees.length === 0 ? (
          <div className="empty-state compact">No employees</div>
        ) : (
          visibleEmployees.map((employee, index) => (
            <article className={`person-card${employee.is_terminated ? ' is-terminated' : ''}`} key={employee.id}>
              {selectionVisible && <label className="check-shell agreement-select-check" title={`Select agreement for ${employee.name}`}>
                <input
                  type="checkbox"
                  aria-label={`Select agreement for ${employee.name}`}
                  checked={selectedAgreementIds.includes(employee.id)}
                  onChange={() => onAgreementToggle(employee.id)}
                />
                <span><Check size={12} /></span>
              </label>}
              <button className="employee-quick-trigger avatar-trigger" type="button" onClick={() => onView(employee)} aria-label={`Quick view ${employee.name}`}>
                <Avatar employee={employee} />
              </button>
              <div className="card-main">
                <button className="employee-name-trigger" type="button" onClick={() => onView(employee)}>{employee.name}</button>
                <span>{employee.site_name || 'Unassigned'}</span>
                <small>Passport: {employee.id_number || 'Not provided'}</small>
              </div>
              <div className="row-actions">
                {index === 0 && (
                  <button
                    className="soft-button compact mobile-icon-action"
                    title="Duplicate work details for a new employee"
                    aria-label="Duplicate work details for a new employee"
                    type="button"
                    onClick={() => onDuplicate(employee)}
                  >
                    <Copy size={14} />
                    <span className="mobile-action-label">Duplicate</span>
                  </button>
                )}
                <a
                  className="soft-button compact mobile-icon-action"
                  title="Download employment agreement PDF"
                  aria-label={`Download employment agreement for ${employee.name}`}
                  href={`/api/reports/agreement?employee_id=${employee.id}`}
                >
                  <Download size={14} />
                  <span className="mobile-action-label">Agreement</span>
                </a>
                <button
                  className="icon-button small"
                  title="Edit employee"
                  type="button"
                  onClick={() => onEdit(employee)}
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="icon-button small danger"
                  title="Delete employee"
                  type="button"
                  onClick={() => onDelete(employee.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function EmployeeQuickView({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const details = [
    ['Passport / ID', employee.id_number || 'Not provided'],
    ['Work permit', employee.work_permit_number || 'Not provided'],
    ['Nationality', employee.nationality || 'Not provided'],
    ['Job title', employee.job_title || jobLevelLabel(employee.job_level)],
    ['Team group', employeeTypeLabel(employee.employee_type)],
    ['Work site', employee.site_name || 'Unassigned'],
    ['Join date', employee.join_date ? formatDate(employee.join_date) : 'Not provided'],
    ['Birthdate', employee.birth_date ? formatDate(employee.birth_date) : 'Not provided'],
    ['Monthly salary', formatCurrency(employee.salary)],
    ['Payment method', paymentLabel(employee.medium)],
    ['Employment', employee.is_terminated ? `Terminated${employee.terminated_at ? ` on ${formatDate(employee.terminated_at)}` : ''}` : employee.employment_status === 'fixed_term' ? `Fixed term${employee.fixed_term_end ? ` until ${formatDate(employee.fixed_term_end)}` : ''}` : 'Active / permanent'],
    ['Address', employee.current_address || 'Not provided'],
    ['Working hours', employee.hours_per_day ? `${employee.hours_per_day} hours per day${employee.hours_per_week ? ` / ${employee.hours_per_week} per week` : ''}` : 'Not provided'],
    ['Allowances / benefits', employee.allowances_benefits || employee.benefit_details || 'Not provided'],
    ['Job description', employee.job_description || 'Not provided'],
  ];

  return (
    <div className="quick-view-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="employee-quick-view" role="dialog" aria-modal="true" aria-label={`${employee.name} profile`}>
        <header className="quick-view-header">
          <Avatar employee={employee} />
          <div>
            <h2>{employee.name}</h2>
            <span>{employee.job_title || jobLevelLabel(employee.job_level)}</span>
          </div>
          <button className="icon-button" type="button" title="Close profile" aria-label="Close profile" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="quick-view-scroll">
          {employee.is_terminated && <div className="quick-view-status terminated">Employment terminated</div>}
          <dl className="quick-view-details">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
}

function EmployeeForm({
  employeesSites,
  allowSiteSelection,
  employeeGroups,
  form,
  expanded,
  saveStatus,
  previousEmployee,
  nextEmployee,
  terminationEmployee,
  onSubmit,
  onChange,
  onNavigate,
  onPhotoChange,
  onPhotoClear,
  onTerminate,
  onAddGroup,
  onRenameGroup,
  onToggle,
  onCancel,
}: {
  employeesSites: Site[];
  allowSiteSelection: boolean;
  employeeGroups: Array<{ value: EmployeeType; label: string }>;
  form: typeof emptyProfileForm;
  expanded: boolean;
  saveStatus: string;
  previousEmployee: Employee | null;
  nextEmployee: Employee | null;
  terminationEmployee: Employee | null;
  onSubmit: (event: FormEvent) => void;
  onChange: (form: typeof emptyProfileForm) => void;
  onNavigate: (employee: Employee) => void;
  onPhotoChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPhotoClear: () => void;
  onTerminate: (employee: Employee) => void;
  onAddGroup: () => void;
  onRenameGroup: (value: string) => void;
  onToggle: () => void;
  onCancel: () => void;
}) {
  const selectedWorkSite = employeesSites.find((site) => site.id.toString() === form.site_id)
    || (!allowSiteSelection ? employeesSites[0] : undefined);
  const isCloveCafeEmployee = selectedWorkSite?.name.toLowerCase().includes('clove cafe') ?? false;
  const onboarding = form.id === 0;

  return (
    <section className="form-panel" id="employee-onboarding">
      <SectionHeader
        title={form.id ? 'Edit employee' : 'Add employee'}
        action={(
          <span className="section-actions">
            {form.id > 0 && expanded && (
              <>
                <button className="soft-button compact" type="button" disabled={!previousEmployee} title={previousEmployee ? `Load ${previousEmployee.name}` : 'No previous employee'} onClick={() => previousEmployee && onNavigate(previousEmployee)}>
                  <ChevronLeft size={15} /> Back
                </button>
                <button className="soft-button compact" type="button" disabled={!nextEmployee} title={nextEmployee ? `Load ${nextEmployee.name}` : 'No next employee'} onClick={() => nextEmployee && onNavigate(nextEmployee)}>
                  Next <ChevronRight size={15} />
                </button>
              </>
            )}
            <button className="soft-button compact" type="button" onClick={onToggle}>
              {expanded ? 'Collapse' : form.id ? 'Open editor' : 'Open onboarding'}
            </button>
          </span>
        )}
      />
      {expanded && <form onSubmit={onSubmit}>
        <fieldset className="form-lock-fieldset">
          <div className="form-grid">
            <label>
              <span>Name</span>
              <input value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} required />
            </label>
            <label>
              <span>Salary</span>
              <input type="number" value={form.salary} onChange={(event) => onChange({ ...form, salary: event.target.value })} required />
            </label>
            <label>
              <span>Passport/ID</span>
              <input value={form.id_number} onChange={(event) => onChange({ ...form, id_number: event.target.value })} />
            </label>
            <label>
              <span>Birthdate</span>
              <input type="date" value={form.birth_date} onChange={(event) => onChange({ ...form, birth_date: event.target.value })} />
            </label>
            <label>
              <span>Join date</span>
              <input type="date" value={form.join_date} onChange={(event) => onChange({ ...form, join_date: event.target.value })} />
            </label>
            <label>
              <span>Medium</span>
              <select value={form.medium} onChange={(event) => onChange({ ...form, medium: event.target.value })}>
                <option value="cash">Cash</option>
                <option value="account transfer">Account transfer</option>
              </select>
            </label>
            <label>
              <span>Team group</span>
              <select value={form.employee_type} onChange={(event) => onChange({ ...form, employee_type: event.target.value as EmployeeType })}>
                {employeeGroups.map((group) => (
                  <option key={group.value} value={group.value}>{group.label}</option>
                ))}
              </select>
              <span className="inline-form-actions">
                <button className="text-link" type="button" onClick={onAddGroup}>+ Add group</button>
                <button className="text-link" type="button" onClick={() => onRenameGroup(form.employee_type)}>Rename group</button>
              </span>
            </label>
            <label>
              <span>Job level</span>
              <select value={form.job_level} onChange={(event) => onChange({ ...form, job_level: event.target.value as JobLevel })}>
                {jobLevels.map((level) => (
                  <option key={level.value} value={level.value}>{level.label}</option>
                ))}
              </select>
            </label>
            {allowSiteSelection ? (
              <label className="attendance-scope-field">
                <span>Work site</span>
                <select value={form.site_id} onChange={(event) => onChange({ ...form, site_id: event.target.value })}>
                  <option value="">Select work site</option>
                  {employeesSites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
                </select>
              </label>
            ) : (
              <label><span>Work site</span><input value={employeesSites[0]?.name || 'Logged-in site'} readOnly /></label>
            )}
            {isCloveCafeEmployee && (
              <>
            <label>
              <span>Job title on agreement</span>
              <select value={form.job_title} onChange={(event) => {
                const jobTitle = event.target.value;
                onChange({ ...form, job_title: jobTitle, job_description: agreementJobDescriptions[jobTitle] || '' });
              }}>
                <option value="">Select job title</option>
                {form.job_title && !agreementJobTitles.includes(form.job_title) && (
                  <option value={form.job_title}>{form.job_title}</option>
                )}
                {agreementJobTitles.map((jobTitle) => <option key={jobTitle} value={jobTitle}>{jobTitle}</option>)}
              </select>
            </label>
            <label className="wide">
              <span>Short job description</span>
              <textarea
                rows={3}
                value={form.job_description}
                onChange={(event) => onChange({ ...form, job_description: event.target.value })}
                placeholder="Brief duties shown in the agreement"
              />
            </label>
            <label>
              <span>Work permit number</span>
              <input value={form.work_permit_number} onChange={(event) => onChange({ ...form, work_permit_number: event.target.value })} />
            </label>
            <label>
              <span>Nationality</span>
              <select value={form.nationality} onChange={(event) => onChange({ ...form, nationality: event.target.value })}>
                <option value="">Select nationality</option>
                {form.nationality && !agreementNationalities.includes(form.nationality) && (
                  <option value={form.nationality}>{form.nationality}</option>
                )}
                {agreementNationalities.map((nationality) => <option key={nationality} value={nationality}>{nationality}</option>)}
              </select>
            </label>
            <label>
              <span>Permanent / current address</span>
              <input value={form.current_address} onChange={(event) => onChange({ ...form, current_address: event.target.value })} />
            </label>
            <label>
              <span>Employment status</span>
              <select value={form.employment_status} onChange={(event) => onChange({ ...form, employment_status: event.target.value as 'indefinite' | 'fixed_term' })}>
                <option value="indefinite">Indefinite / permanent</option>
                <option value="fixed_term">Fixed term</option>
              </select>
            </label>
            {form.employment_status === 'fixed_term' && (
              <label>
                <span>Fixed-term end date</span>
                <input type="date" value={form.fixed_term_end} onChange={(event) => onChange({ ...form, fixed_term_end: event.target.value })} />
              </label>
            )}
            <label className="checkbox-field">
              <input type="checkbox" checked={form.probation_applicable} onChange={(event) => onChange({ ...form, probation_applicable: event.target.checked })} />
              <span>Probation applies</span>
            </label>
            {form.probation_applicable && (
              <label>
                <span>Probation months</span>
                <input type="number" min="1" value={form.probation_months} onChange={(event) => onChange({ ...form, probation_months: event.target.value })} />
              </label>
            )}
            <label>
              <span>Hours per day</span>
              <input type="number" min="0" step="0.5" value={form.hours_per_day} onChange={(event) => onChange({ ...form, hours_per_day: event.target.value })} />
            </label>
            <label>
              <span>Hours per week</span>
              <input type="number" min="0" step="0.5" value={form.hours_per_week} onChange={(event) => onChange({ ...form, hours_per_week: event.target.value })} />
            </label>
            <label>
              <span>Allowances / benefits</span>
              <input value={form.allowances_benefits} onChange={(event) => onChange({ ...form, allowances_benefits: event.target.value })} />
            </label>
            <label>
              <span>Notice period</span>
              <input value={form.notice_period} onChange={(event) => onChange({ ...form, notice_period: event.target.value })} placeholder="As required by law" />
            </label>
            <label>
              <span>Employer signatory</span>
              <input value={form.employer_signatory} onChange={(event) => onChange({ ...form, employer_signatory: event.target.value })} />
            </label>
            <label className="checkbox-field"><input type="checkbox" checked={form.accommodation_provided} onChange={(event) => onChange({ ...form, accommodation_provided: event.target.checked })} /><span>Accommodation provided</span></label>
            <label className="checkbox-field"><input type="checkbox" checked={form.meals_provided} onChange={(event) => onChange({ ...form, meals_provided: event.target.checked })} /><span>Meals provided</span></label>
            <label className="checkbox-field"><input type="checkbox" checked={form.transport_provided} onChange={(event) => onChange({ ...form, transport_provided: event.target.checked })} /><span>Local transport provided</span></label>
            <label className="checkbox-field"><input type="checkbox" checked={form.return_airfare_provided} onChange={(event) => onChange({ ...form, return_airfare_provided: event.target.checked })} /><span>Return airfare / repatriation provided</span></label>
            <label>
              <span>Benefit details</span>
              <input value={form.benefit_details} onChange={(event) => onChange({ ...form, benefit_details: event.target.value })} />
            </label>
              </>
            )}
            <label className="photo-field">
              <span>Photo</span>
              <div className="photo-upload">
                <span className="photo-preview">
                  {form.photo ? <img src={form.photo} alt="" /> : initials(form.name || 'Employee')}
                </span>
                <span className="photo-controls">
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onPhotoChange} />
                  {form.photo && (
                    <button className="soft-button compact" type="button" onClick={onPhotoClear}>
                      <X size={14} />
                      Clear
                    </button>
                  )}
                </span>
              </div>
            </label>
          </div>
          <div className="action-row">
            {saveStatus && <span className="save-confirmation" role="status">{saveStatus}</span>}
            {terminationEmployee && (
              <button
                className={`soft-button${terminationEmployee.is_terminated ? '' : ' danger'}`}
                type="button"
                onClick={() => onTerminate(terminationEmployee)}
              >
                {terminationEmployee.is_terminated ? <UserCheck size={16} /> : <UserX size={16} />}
                {terminationEmployee.is_terminated ? 'Reactivate employee' : 'Terminate employee'}
              </button>
            )}
            {form.id > 0 && (
              <button className="soft-button" type="button" onClick={onCancel}>
                <X size={16} />
                Cancel
              </button>
            )}
            <button className="dark-button stretch" type="submit">
              <Save size={16} />
              {onboarding ? 'Create employee' : 'Save'}
            </button>
          </div>
        </fieldset>
      </form>}
    </section>
  );
}

function AttendancePanel({
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
  sites: Site[];
  search: string;
  loading: boolean;
  saving: boolean;
  onDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onChange: (records: AttendanceRecord[]) => void;
  onSave: (records: AttendanceRecord[], endDate?: string, siteId?: string, startDate?: string) => void;
  onDeleteHistory: (entry: AttendanceHistoryEntry) => void;
}) {
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [leaveJourneyOpen, setLeaveJourneyOpen] = useState(false);
  const [leaveStep, setLeaveStep] = useState(1);
  const [leaveEmployeeId, setLeaveEmployeeId] = useState('');
  const [leaveStartDate, setLeaveStartDate] = useState(date);
  const [leaveEndDate, setLeaveEndDate] = useState(date);
  const [leaveDateCount, setLeaveDateCount] = useState(10);
  const [leaveType, setLeaveType] = useState('sick');
  const [leaveNotes, setLeaveNotes] = useState('');
  const [leaveConfirmation, setLeaveConfirmation] = useState('');
  const [journeyStep, setJourneyStep] = useState(1);
  const [attendanceScope, setAttendanceScope] = useState<'employee' | 'site'>('site');
  const [journeyEmployeeId, setJourneyEmployeeId] = useState('');
  const [journeySiteId, setJourneySiteId] = useState('');
  const [journeyIncludedIds, setJourneyIncludedIds] = useState<number[] | null>(null);
  const [visibleDateCount, setVisibleDateCount] = useState(5);
  const [journeyInTime, setJourneyInTime] = useState('07:00');
  const [journeyOutTime, setJourneyOutTime] = useState('17:00');
  const [journeyOtEnabled, setJourneyOtEnabled] = useState(false);
  const [journeyOtInTime, setJourneyOtInTime] = useState('');
  const [journeyOtOutTime, setJourneyOtOutTime] = useState('');
  const [attendanceConfirmation, setAttendanceConfirmation] = useState('');
  const [selectedAttendanceSite, setSelectedAttendanceSite] = useState('all');
  const [dateSelectionMode, setDateSelectionMode] = useState<'single' | 'between'>('single');
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
  const leaveDates = Array.from({ length: leaveDateCount }, (_, index) => {
    const item = new Date(today);
    item.setDate(today.getDate() + index);
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
      ot_in_time: fridaySelection || !journeyOtEnabled ? null : (journeyOtInTime || null),
      ot_out_time: fridaySelection || !journeyOtEnabled ? null : (journeyOtOutTime || null),
    }));
    await Promise.resolve(onSave(submittedRecords, date, attendanceScope === 'site' ? journeySiteId : 'all'));
    setAttendanceConfirmation(`${targetRecords.map((record) => record.employee_name).join(', ')} — attendance recorded.`);
    setJourneyStep(4);
  };

  const submitLeave = async () => {
    const employee = records.find((record) => record.employee_id.toString() === leaveEmployeeId);
    if (!employee) return;
    const leaveLabels: Record<string, string> = {
      sick: 'Sick leave',
      annual: 'Annual leave',
      emergency: 'Emergency leave',
      unpaid: 'Unpaid leave',
    };
    await Promise.resolve(onSave([{
      ...employee,
      status: 'leave',
      in_time: null,
      out_time: null,
      ot_in_time: null,
      ot_out_time: null,
      notes: [leaveLabels[leaveType], leaveNotes.trim()].filter(Boolean).join(': '),
    }], leaveEndDate, employee.site_id?.toString() || 'all', leaveStartDate));
    setLeaveConfirmation(`${employee.employee_name} — ${leaveLabels[leaveType]} submitted.`);
    setLeaveStep(3);
  };

  return (
    <section className="attendance-panel" aria-label="Employee attendance tracking">
      {!journeyOpen && !leaveJourneyOpen ? (
        <div className="attendance-start-actions">
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
          setJourneyOtEnabled(false);
          setJourneyOtInTime('');
          setJourneyOtOutTime('');
        }}>
          <ClipboardCheck size={20} />
          SUBMIT ATTENDANCE
        </button>
        <button className="give-salary-button leave-start-button" type="button" disabled={records.length === 0} onClick={() => {
          setLeaveJourneyOpen(true);
          setLeaveStep(1);
          setLeaveEmployeeId('');
          setLeaveStartDate(localDateValue(today));
          setLeaveEndDate(localDateValue(today));
          setLeaveDateCount(10);
          setLeaveType('sick');
          setLeaveNotes('');
          setLeaveConfirmation('');
        }}>
          <CalendarDays size={20} />
          SUBMIT LEAVE
        </button>
        </div>
      ) : journeyOpen ? (
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
              {attendanceScope === 'employee' && <label className="attendance-employee-field">
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
            {isFridayDate(date) ? <p className="friday-attendance-note">Friday is an off day. No in or out time will be recorded.</p> : <>
              <div className="form-grid compact-grid attendance-time-grid">
                <label><span>In time</span><Time24Select ariaLabel="Attendance in time" value={journeyInTime} onChange={setJourneyInTime} /></label>
                <label><span>Out time</span><Time24Select ariaLabel="Attendance out time" value={journeyOutTime} onChange={setJourneyOutTime} /></label>
              </div>
              <label className="attendance-ot-toggle"><input type="checkbox" checked={journeyOtEnabled} onChange={(event) => {
                setJourneyOtEnabled(event.target.checked);
                if (!event.target.checked) { setJourneyOtInTime(''); setJourneyOtOutTime(''); }
              }} /><span>Enable OT</span></label>
              {journeyOtEnabled && <div className="form-grid compact-grid attendance-time-grid attendance-ot-fields">
                <label><span>OT in time</span><Time24Select ariaLabel="Overtime in time" value={journeyOtInTime} onChange={setJourneyOtInTime} /></label>
                <label><span>OT out time</span><Time24Select ariaLabel="Overtime out time" value={journeyOtOutTime} onChange={setJourneyOtOutTime} /></label>
              </div>}
            </>}
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
      ) : null}

      {leaveJourneyOpen && <section className="attendance-journey leave-journey">
        <div className="wizard-head">
          <div><h2>Submit leave</h2><span>{records.find((record) => record.employee_id.toString() === leaveEmployeeId)?.employee_name || 'Choose an employee'}</span></div>
          <button className="soft-button compact" type="button" onClick={() => setLeaveJourneyOpen(false)}><X size={14} /> Close</button>
        </div>
        <div className="wizard-steps" aria-label="Leave submission steps">
          {['Employee', 'Leave details', 'Done'].map((label, index) => (
            <button key={label} className={`wizard-step ${leaveStep === index + 1 ? 'is-current' : leaveStep > index + 1 ? 'is-complete' : 'is-upcoming'}`} type="button" disabled={index + 1 > leaveStep || index === 2} onClick={() => setLeaveStep(index + 1)}>
              <span className="wizard-step-node">{leaveStep > index + 1 ? <Check size={17} /> : index + 1}</span>
              <span className="wizard-step-label">{label}</span>
            </button>
          ))}
        </div>
        {leaveStep === 1 && <div className="wizard-panel">
          <div className="form-grid compact-grid">
            <label><span>Employee</span><select value={leaveEmployeeId} onChange={(event) => setLeaveEmployeeId(event.target.value)}><option value="">Select employee</option>{visibleRecords.map((record) => <option key={record.employee_id} value={record.employee_id}>{record.employee_name}{record.site_name ? ` — ${record.site_name}` : ''}</option>)}</select></label>
          </div>
          <div className="action-row"><button className="dark-button" type="button" disabled={!leaveEmployeeId} onClick={() => setLeaveStep(2)}>Next <ChevronRight size={16} /></button></div>
        </div>}
        {leaveStep === 2 && <div className="wizard-panel">
          <div className="form-grid compact-grid leave-form-grid">
            <label><span>Leave type</span><select value={leaveType} onChange={(event) => setLeaveType(event.target.value)}><option value="sick">Sick leave</option><option value="annual">Annual leave</option><option value="emergency">Emergency leave</option><option value="unpaid">Unpaid leave</option></select></label>
            <label className="leave-notes-field"><span>Note (optional)</span><textarea rows={3} value={leaveNotes} onChange={(event) => setLeaveNotes(event.target.value)} placeholder="Reason or supporting details" /></label>
          </div>
          <div className="leave-date-selection">
            <div className="leave-date-heading"><strong>Start date</strong><span>{leaveStartDate}</span></div>
            <div className="attendance-date-strip" aria-label="Select leave start date">
              {leaveDates.map((item) => {
                const value = localDateValue(item);
                const isToday = value === localDateValue(today);
                return <button key={`start-${value}`} className={`${isToday ? 'is-today' : 'is-upcoming'}${leaveStartDate === value ? ' is-selected' : ''}`} type="button" onClick={() => { setLeaveStartDate(value); if (leaveEndDate < value) setLeaveEndDate(value); }}><small>{item.toLocaleDateString('en-US', { weekday: 'short' })}</small><strong>{item.getDate()}</strong><span>{item.toLocaleDateString('en-US', { month: 'short' })}</span></button>;
              })}
            </div>
            <div className="leave-date-heading"><strong>End date</strong><span>{leaveEndDate}</span></div>
            <div className="attendance-date-strip" aria-label="Select leave end date">
              {leaveDates.filter((item) => localDateValue(item) >= leaveStartDate).map((item) => {
                const value = localDateValue(item);
                const isToday = value === localDateValue(today);
                return <button key={`end-${value}`} className={`${isToday ? 'is-today' : 'is-upcoming'}${leaveEndDate === value ? ' is-selected' : ''}`} type="button" onClick={() => setLeaveEndDate(value)}><small>{item.toLocaleDateString('en-US', { weekday: 'short' })}</small><strong>{item.getDate()}</strong><span>{item.toLocaleDateString('en-US', { month: 'short' })}</span></button>;
              })}
            </div>
            <button className="text-link attendance-load-more" type="button" onClick={() => setLeaveDateCount((count) => count + 5)}>Load next 5 days</button>
          </div>
          <div className="action-row"><button className="soft-button" type="button" onClick={() => setLeaveStep(1)}><ChevronLeft size={16} /> Back</button><button className="dark-button" type="button" disabled={saving || !leaveStartDate || !leaveEndDate || leaveEndDate < leaveStartDate} onClick={submitLeave}><Save size={16} /> {saving ? 'Submitting...' : 'Submit leave'}</button></div>
        </div>}
        {leaveStep === 3 && <div className="wizard-panel attendance-success"><Check size={30} /><h3>Leave submitted</h3><p>{leaveConfirmation}</p><button className="dark-button" type="button" onClick={() => { setLeaveJourneyOpen(false); setLeaveStep(1); }}>Done</button></div>}
      </section>}

      {false && <>
      <div className="attendance-toolbar">
        <div className={`attendance-date-controls${dateSelectionMode === 'between' ? ' is-range' : ''}`} aria-label="Attendance date range">
          <label className="filter-control">
            <CalendarDays size={15} />
            <span>Selection</span>
            <select aria-label="Attendance date selection" value={dateSelectionMode} onChange={(event) => setDateSelectionMode(event.target.value as 'single' | 'between')}>
              <option value="single">Single date</option>
              <option value="between">Date range</option>
            </select>
          </label>
          <label className="filter-control attendance-date-field">
            <span>{dateSelectionMode === 'between' ? 'From' : 'Date'}</span>
            <input aria-label="Attendance date" type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
          </label>
          {dateSelectionMode === 'between' && (
            <label className="filter-control attendance-date-field">
              <span>To</span>
              <input aria-label="Attendance end date" type="date" min={date} value={endDate} onChange={(event) => onEndDateChange(event.target.value)} />
            </label>
          )}
        </div>
        <label className="filter-control">
          <MapPin size={15} />
          <span>Site</span>
          <select aria-label="Attendance site" value={selectedAttendanceSite} onChange={(event) => setSelectedAttendanceSite(event.target.value)}>
            <option value="all">All sites</option>
            {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
          </select>
        </label>
        <a
          className="soft-button"
          href={`/api/reports/attendance?date=${date}&end_date=${dateSelectionMode === 'between' ? endDate : date}&site_id=${selectedAttendanceSite}`}
        >
          <Download size={16} />
          Attendance PDF
        </a>
        <button
          className="soft-button"
          type="button"
          onClick={() => onChange(records.map((record) => (
            selectedAttendanceSite === 'all' || record.site_id?.toString() === selectedAttendanceSite
              ? { ...record, status: 'present' }
              : record
          )))}
          disabled={friday || loading || siteRecords.length === 0}
        >
          <Check size={16} />
          Mark all present
        </button>
        <button className="dark-button" type="button" onClick={() => onSave(siteRecords, dateSelectionMode === 'between' ? endDate : date, selectedAttendanceSite)} disabled={loading || saving || siteRecords.length === 0}>
          <Save size={16} />
          {saving ? 'Saving...' : 'Save attendance'}
        </button>
      </div>

      <section className="metric-grid attendance-summary" aria-label="Attendance summary">
        <SummaryCard label="Present" value={counts.present.toString()} icon={<Check size={18} />} />
        <SummaryCard label="Absent" value={counts.absent.toString()} icon={<X size={18} />} />
        <SummaryCard label="Leave / Off" value={(counts.leave + counts.off).toString()} icon={<CalendarDays size={18} />} />
      </section>

      <SectionHeader title="Daily attendance" action={`${visibleRecords.length} employees`} />
      {friday && <p className="friday-attendance-note">Friday is a non-working day. In and out times are not recorded.</p>}
      <div className="table-shell">
        <table className="salary-table attendance-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Site</th>
              <th>Status</th>
              <th>In time</th>
              <th>Out time</th>
              <th>OT in time</th>
              <th>OT out time</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="empty-table-row"><td colSpan={8}>Loading attendance...</td></tr>
            ) : visibleRecords.length === 0 ? (
              <tr className="empty-table-row"><td colSpan={8}>No employees found</td></tr>
            ) : visibleRecords.map((record) => (
              <tr key={record.employee_id} className={`attendance-status-${friday ? 'off' : record.status}`}>
                <td><strong>{record.employee_name}</strong><small>{record.id_number || 'No ID'}</small></td>
                <td>{record.site_name || 'Unassigned'}</td>
                <td>
                  <select
                    aria-label={`Attendance status for ${record.employee_name}`}
                    value={record.status}
                    onChange={(event) => updateRecord(record.employee_id, { status: event.target.value as AttendanceRecord['status'] })}
                    disabled={friday}
                  >
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="leave">Leave</option>
                    <option value="off">Off day</option>
                  </select>
                </td>
                <td>
                  <Time24Select
                    ariaLabel={`In time for ${record.employee_name}`}
                    value={record.in_time || ''}
                    onChange={(value) => updateRecord(record.employee_id, { in_time: value || null })}
                    disabled={friday}
                  />
                </td>
                <td>
                  <Time24Select
                    ariaLabel={`Out time for ${record.employee_name}`}
                    value={record.out_time || ''}
                    onChange={(value) => updateRecord(record.employee_id, { out_time: value || null })}
                    disabled={friday}
                  />
                </td>
                <td>
                  <Time24Select
                    ariaLabel={`OT in time for ${record.employee_name}`}
                    value={record.ot_in_time || ''}
                    onChange={(value) => updateRecord(record.employee_id, { ot_in_time: value || null })}
                    disabled={friday}
                  />
                </td>
                <td>
                  <Time24Select
                    ariaLabel={`OT out time for ${record.employee_name}`}
                    value={record.ot_out_time || ''}
                    onChange={(value) => updateRecord(record.employee_id, { ot_out_time: value || null })}
                    disabled={friday}
                  />
                </td>
                <td>
                  <input
                    aria-label={`Attendance notes for ${record.employee_name}`}
                    value={record.notes}
                    onChange={(event) => updateRecord(record.employee_id, { notes: event.target.value })}
                    placeholder="Optional note"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>}

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

function AttendancePayoutSummary({
  rows,
  loading,
  month,
  year,
  onMonthChange,
  onYearChange,
  onDelete,
  onGiveSalary,
}: {
  rows: AttendanceSummaryRow[];
  loading: boolean;
  month: number;
  year: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  onDelete: (row: AttendanceSummaryRow) => void;
  onGiveSalary: (employeeId: number) => void;
}) {
  const currentYear = new Date().getFullYear();
  const years = Array.from(new Set([currentYear, currentYear - 1, year]));
  // Only employees still awaiting payout — once paid, there's nothing left
  // to action here (they remain visible in the Payroll table below).
  const pendingRows = rows.filter((row) => row.payout_status !== 'paid');

  return (
    <section className="attendance-summary-panel" aria-label="Attendance completed employees">
      <SectionHeader
        title="Attendance Completed Employees"
        action={(
          <span className="section-actions">
            <label className="filter-control" title="Summary month">
              <CalendarDays size={14} />
              <select aria-label="Summary month" value={month} onChange={(event) => onMonthChange(Number(event.target.value))}>
                {monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
              </select>
            </label>
            <label className="filter-control" title="Summary year">
              <select aria-label="Summary year" value={year} onChange={(event) => onYearChange(Number(event.target.value))}>
                {years.sort((first, second) => second - first).map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </span>
        )}
      />
      <div className="table-shell">
        <table className="salary-table attendance-summary-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Days worked</th>
              <th>Days absent</th>
              <th>Work hours</th>
              <th>OT hours</th>
              <th>Less work days ded.</th>
              <th>Other ded.</th>
              <th>Total payout</th>
              <th>Payout month</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="empty-table-row"><td colSpan={10}>Loading attendance summary...</td></tr>
            ) : pendingRows.length === 0 ? (
              <tr className="empty-table-row"><td colSpan={10}>No employees with regularized attendance are pending salary for this month</td></tr>
            ) : (
              pendingRows.map((row) => (
                <tr key={row.employee_id}>
                  <td><strong>{row.employee_name}</strong></td>
                  <td>{row.days_worked}</td>
                  <td>{row.days_absent}</td>
                  <td>{row.work_hours.toFixed(1)}</td>
                  <td>{row.ot_hours.toFixed(1)}</td>
                  <td>{row.less_work_days_deduction != null ? formatCurrency(row.less_work_days_deduction) : <span className="payout-pending">—</span>}</td>
                  <td>{row.other_deductions != null ? formatCurrency(row.other_deductions) : <span className="payout-pending">—</span>}</td>
                  <td className="net-cell">
                    {row.total_payout != null ? formatCurrency(row.total_payout) : <span className="payout-pending">Not yet paid</span>}
                    {row.payout_status && <span className={`status-pill ${row.payout_status}`}>{row.payout_status}</span>}
                  </td>
                  <td>{monthNames[month - 1]} {year}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-button small"
                        title="Give salary"
                        aria-label={`Give salary to ${row.employee_name}`}
                        type="button"
                        onClick={() => onGiveSalary(row.employee_id)}
                      >
                        <CreditCard size={15} />
                      </button>
                      <button
                        className="icon-button small danger"
                        title="Delete submitted attendance"
                        aria-label={`Delete submitted attendance for ${row.employee_name}`}
                        type="button"
                        onClick={() => onDelete(row)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SalaryJourney({
  employees,
  sites,
  salaryTransactions,
  targetEmployees,
  form,
  isOpen,
  step,
  submittedEmployeeIds,
  onStart,
  onClose,
  onStepChange,
  onSubmit,
  onChange,
}: {
  employees: Employee[];
  sites: Site[];
  salaryTransactions: SalaryTransaction[];
  targetEmployees: Employee[];
  form: ReturnType<typeof freshSalaryForm>;
  isOpen: boolean;
  step: number;
  submittedEmployeeIds: Set<number>;
  onStart: () => void;
  onClose: () => void;
  onStepChange: (step: number) => void;
  onSubmit: () => void;
  onChange: (form: ReturnType<typeof freshSalaryForm>) => void;
}) {
	  const [showAllSalaryMonths, setShowAllSalaryMonths] = useState(false);
	  const selectedEmployeeIds = getSalaryEmployeeIds(form);
	  const prioritizedEmployees = useMemo(() => (
	    [...employees].sort((first, second) => {
	      const firstSubmitted = submittedEmployeeIds.has(first.id) ? 0 : 1;
	      const secondSubmitted = submittedEmployeeIds.has(second.id) ? 0 : 1;
	      return firstSubmitted !== secondSubmitted ? firstSubmitted - secondSubmitted : first.name.localeCompare(second.name);
	    })
	  ), [employees, submittedEmployeeIds]);
	  const selectedEmployees = form.scope === 'site'
	    ? targetEmployees
	    : employees.filter((employee) => selectedEmployeeIds.includes(employee.id));
	  const targetBaseSalary = targetEmployees.reduce((sum, employee) => sum + Number(employee.salary || 0), 0);
	  const targetLabel = selectedEmployees.length > 1
	    ? `${selectedEmployees.length} employees selected`
	    : selectedEmployees[0]?.name || 'No employee selected';
	  const businessYear = getBusinessYear();
	  const targetEmployeeIds = selectedEmployees.map((employee) => employee.id);
	  const [regularizedAttendance, setRegularizedAttendance] = useState<AttendanceSummaryRow | null>(null);
	  const appliedAttendanceKey = useRef<string | null>(null);
	  const singleTargetId = selectedEmployees.length === 1 ? selectedEmployees[0].id : null;

	  // Pull the employee's own regularized attendance (worked/absent days,
	  // OT hours) for the selected salary month, so payroll reflects what was
	  // actually submitted rather than a blank manual entry.
	  useEffect(() => {
	    if (step !== 3 || !singleTargetId) {
	      setRegularizedAttendance(null);
	      return;
	    }
	    const key = `${singleTargetId}-${form.month}-${businessYear}`;
	    let cancelled = false;
	    fetch(`/api/reports/attendance-summary?month=${form.month}&year=${businessYear}`)
	      .then((res) => (res.ok ? res.json() : []))
	      .then((rows: AttendanceSummaryRow[]) => {
	        if (cancelled) return;
	        const row = rows.find((item) => item.employee_id === singleTargetId) || null;
	        setRegularizedAttendance(row);
	        if (row && appliedAttendanceKey.current !== key) {
	          appliedAttendanceKey.current = key;
	          onChange({
	            ...form,
	            absent_days: row.days_absent,
	            worked_days: Math.max(0, salaryPeriodDays - row.days_absent),
	            ot_hours: row.ot_hours,
	          });
	        }
	      })
	      .catch(() => { if (!cancelled) setRegularizedAttendance(null); });
	    return () => { cancelled = true; };
	    // eslint-disable-next-line react-hooks/exhaustive-deps
	  }, [step, singleTargetId, form.month, businessYear]);

	  const paidMonths = getPaidSalaryMonthsForEmployees(salaryTransactions, targetEmployeeIds, businessYear);
	  const eligibleMonths = getCommonEligibleSalaryMonths(selectedEmployees, businessYear);
	  const compactMonthWindow = getCompactSalaryMonthWindow(selectedEmployees, businessYear);
	  const compactEligibleMonths = eligibleMonths.filter((month) => compactMonthWindow.includes(month));
	  const displayedSalaryMonths = showAllSalaryMonths ? eligibleMonths : compactEligibleMonths;
	  const hasMoreSalaryMonths = displayedSalaryMonths.length < eligibleMonths.length;
	  const selectedMonthEligible = eligibleMonths.includes(form.month);
	  const selectedMonthPaid = selectedMonthEligible && paidMonths.has(form.month);
	  const hasEligibleMonth = eligibleMonths.length > 0;
	  const hasTarget = targetEmployees.length > 0;
	  const canSubmit = hasTarget && selectedMonthEligible && !selectedMonthPaid;
	  const canAdvance = hasTarget && (step === 1 ? hasEligibleMonth : canSubmit);
	  const totalOtherDeduction = Number(form.cash_advance || 0) * Math.max(targetEmployees.length, 1);
	  const defaultOtRate = targetEmployees.length > 0
	    ? roundMoney(targetEmployees.reduce((sum, employee) => sum + getDefaultOtRate(employee), 0) / targetEmployees.length)
	    : 0;
	  const effectiveOtRate = Number(form.ot_rate) > 0 ? Number(form.ot_rate) : defaultOtRate;
	  const totalOtAmount = targetEmployees.reduce((sum, employee) => sum + calculateEmployeeSalary(employee, form).ot_amount, 0);

  const setAbsentDays = (value: number) => {
    const absentDays = Math.max(0, Math.min(salaryPeriodDays, Number(value) || 0));
    onChange({
      ...form,
      absent_days: absentDays,
      worked_days: Math.max(0, salaryPeriodDays - absentDays),
    });
  };

  const setOtherDeduction = (value: number) => {
    onChange({
      ...form,
      cash_advance: Math.max(0, Number(value) || 0),
    });
  };

  const setOtHours = (value: number) => {
    onChange({ ...form, ot_hours: Math.max(0, Number(value) || 0) });
  };

  const setOtRate = (value: number) => {
    onChange({ ...form, ot_rate: Math.max(0, Number(value) || 0) });
  };

	  const handleEmployeeToggle = (employeeId: number, checked: boolean) => {
	    const employeeIdValue = employeeId.toString();
	    const nextEmployeeIds = checked
	      ? [...form.employee_ids, employeeIdValue]
	      : form.employee_ids.filter((id) => id !== employeeIdValue);
	    const uniqueEmployeeIds = Array.from(new Set(nextEmployeeIds));
	    const nextSelectedEmployees = employees.filter((employee) => uniqueEmployeeIds.includes(employee.id.toString()));
	    const nextPaidMonths = getPaidSalaryMonthsForEmployees(
	      salaryTransactions,
	      nextSelectedEmployees.map((employee) => employee.id),
	      businessYear
	    );
	    const nextEligibleMonths = getCommonEligibleSalaryMonths(nextSelectedEmployees, businessYear);
	    const nextCompactMonthWindow = getCompactSalaryMonthWindow(nextSelectedEmployees, businessYear);
	    const nextMonth = uniqueEmployeeIds.length > 0
	      ? getFirstUnpaidSalaryMonth(form.month, nextPaidMonths, nextEligibleMonths, nextCompactMonthWindow)
	      : form.month;
	    setShowAllSalaryMonths(false);

	    onChange({
	      ...form,
	      scope: 'employee',
	      employee_id: uniqueEmployeeIds[0] || '',
	      employee_ids: uniqueEmployeeIds,
	      month: nextMonth,
	      year: businessYear,
	    });
	  };

  useEffect(() => {
    if (!isOpen) setShowAllSalaryMonths(false);
  }, [isOpen]);

  return (
    <section className="salary-journey">
      {!isOpen ? (
        <button className="give-salary-button" type="button" onClick={onStart}>
          <CreditCard size={20} />
          GIVE SALARY
        </button>
      ) : (
        <form onSubmit={(event) => event.preventDefault()}>
          <div className="wizard-head">
            <div>
              <h2>Give salary</h2>
              <span>{targetEmployees.length} selected</span>
            </div>
            <button className="soft-button compact" type="button" onClick={onClose}>
              <X size={14} />
              Close
            </button>
          </div>

          <div className="wizard-steps" aria-label="Salary steps">
            {salaryWizardSteps.map((label, index) => {
              const item = index + 1;
              const isComplete = step > item;
              const isCurrent = step === item;
              const canVisit = item <= step || (item === 2 ? hasTarget && hasEligibleMonth : canSubmit);
              const stateClass = isComplete ? 'is-complete' : isCurrent ? 'is-current' : 'is-upcoming';

              return (
                <button
                  key={label}
                  className={`wizard-step ${stateClass}`}
                  type="button"
                  disabled={!canVisit}
                  aria-current={isCurrent ? 'step' : undefined}
                  onClick={() => onStepChange(item)}
                >
                  <span className="wizard-step-node" aria-hidden="true">
                    {isComplete ? <Check size={17} strokeWidth={2.5} /> : item}
                  </span>
                  <span className="wizard-step-label">{label}</span>
                </button>
              );
            })}
          </div>

	          {step === 1 && (
	            <div className="wizard-panel">
	              <div className="form-grid compact-grid">
	                <label>
	                  <span>Process salary by</span>
	                  <select
	                    value={form.scope}
	                    onChange={(event) => onChange({
	                      ...form,
	                      scope: event.target.value as SalaryScope,
	                      employee_id: '',
	                      employee_ids: [],
	                      site_id: '',
	                    })}
	                  >
	                    <option value="employee">Selected employees</option>
	                    <option value="site">Work site</option>
	                  </select>
	                </label>
	                {form.scope === 'site' && (
	                  <label>
	                    <span>Work site</span>
	                    <select value={form.site_id} onChange={(event) => onChange({ ...form, site_id: event.target.value })}>
	                      <option value="">Select work site</option>
	                      {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
	                    </select>
	                  </label>
	                )}
	                {form.scope === 'site' && form.site_id && (
	                  <div className="salary-site-selection wide">
	                    <strong>{targetEmployees.length} employees automatically selected</strong>
	                    <span>Everyone assigned to this site will be processed together.</span>
	                  </div>
	                )}
	                {form.scope === 'employee' && (
	                <div className="employee-multi-field wide">
	                  <span>Employee</span>
	                  <div className="employee-multi-list">
	                    {prioritizedEmployees.map((employee) => {
	                      const checked = selectedEmployeeIds.includes(employee.id);
	                      const hasSubmittedAttendance = submittedEmployeeIds.has(employee.id);

	                      return (
	                        <label key={employee.id} className={`employee-select-option${checked ? (hasSubmittedAttendance ? ' is-selected-attendance' : ' is-selected') : ''}`}>
	                          <input
	                            type="checkbox"
	                            checked={checked}
	                            onChange={(event) => handleEmployeeToggle(employee.id, event.target.checked)}
	                          />
		                          <span className="employee-option-name">{employee.name}</span>
		                          {hasSubmittedAttendance && <small className="employee-option-submitted">Attendance submitted</small>}
		                          <small className="employee-option-level">{jobLevelLabel(employee.job_level)}</small>
	                        </label>
	                      );
	                    })}
	                  </div>
	                </div>
	                )}
	              </div>
	              {hasTarget && !hasEligibleMonth && (
	                <p className="login-error" role="alert">No payroll month is available for the selected employee(s) yet — they joined after the last completed month. Salary can only be given once that period has passed.</p>
	              )}
	            </div>
          )}

          {step === 2 && (
            <div className="wizard-panel">
              <dl className="salary-review-grid">
                <div><dt>Target</dt><dd>{targetLabel}</dd></div>
                <div><dt>Employees</dt><dd>{targetEmployees.length}</dd></div>
                <div><dt>Basic salary</dt><dd>{formatCurrency(targetBaseSalary)}</dd></div>
                <div><dt>Payroll days</dt><dd>{salaryPeriodDays}</dd></div>
              </dl>
              <p className="salary-proration-note">Employees joining during the selected month are automatically paid only from their join date.</p>
              <div className="form-grid compact-grid">
                <div className="salary-month-field wide">
                  <span>Select salary month</span>
                  <div className="salary-month-grid" role="radiogroup" aria-label={`Salary month for ${businessYear}`}>
                    {eligibleMonths.length === 0 ? (
                      <div className="salary-month-empty">No salary month available for this business year</div>
                    ) : (
                      <>
                        {displayedSalaryMonths.map((monthNumber) => {
                          const month = monthNames[monthNumber - 1];
                          const isPaid = paidMonths.has(monthNumber);
                          const isSelected = form.month === monthNumber && !isPaid;

                          return (
                            <button
                              key={month}
                              className={`salary-month-option${isSelected ? ' is-selected' : ''}${isPaid ? ' is-paid' : ''}`}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              disabled={isPaid}
                              onClick={() => onChange({ ...form, month: monthNumber, year: businessYear })}
                            >
                              <span>{month}</span>
                              <small>{isPaid ? 'Paid' : isSelected ? 'Selected' : 'Open'}</small>
                            </button>
                          );
                        })}
                        {hasMoreSalaryMonths && (
                          <button
                            className="salary-month-more"
                            type="button"
                            title="Load more months"
                            aria-label="Load more months"
                            onClick={() => setShowAllSalaryMonths(true)}
                          >
                            <CalendarDays size={16} />
                          </button>
                        )}
                      </>
                    )}
	                  </div>
	                </div>
              </div>
              {hasTarget && selectedMonthEligible && selectedMonthPaid && (
                <p className="login-error" role="alert">Salary for {monthNames[form.month - 1]} {businessYear} has already been paid for the selected employee(s) — there is nothing left to process.</p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="wizard-panel">
              <div className="form-grid compact-grid">
                <label>
                  <span>Absent days</span>
                  <input type="number" min="0" max={salaryPeriodDays} value={form.absent_days} onChange={(event) => setAbsentDays(parseInt(event.target.value) || 0)} />
                </label>
                <label>
                  <span>Worked days</span>
                  <input type="number" value={form.worked_days} readOnly />
                </label>
                <label>
                  <span>Daily rate</span>
                  <input type="number" step="0.01" value={form.daily_rate} readOnly />
                </label>
                <label>
                  <span>Absent deduction</span>
                  <input type="number" step="0.01" value={form.absent_deduction} readOnly />
                </label>
                <label>
                  <span>OT hours</span>
                  <input type="number" min="0" step="0.5" value={form.ot_hours} onChange={(event) => setOtHours(parseFloat(event.target.value) || 0)} />
                </label>
                <label>
                  <span>OT rate / hour</span>
                  <input type="number" min="0" step="0.01" value={form.ot_rate > 0 ? form.ot_rate : defaultOtRate} onChange={(event) => setOtRate(parseFloat(event.target.value) || 0)} />
                </label>
              </div>
              <p className="salary-proration-note">OT rate defaults to each employee&rsquo;s basic-salary hourly rate ({formatCurrency(defaultOtRate)}/hr); edit it to apply a different rate to everyone selected.</p>
              {singleTargetId && regularizedAttendance && (
                <p className="salary-proration-note salary-attendance-note">
                  Pulled from {selectedEmployees[0]?.name}&rsquo;s regularized attendance: {regularizedAttendance.days_worked} days worked, {regularizedAttendance.days_absent} days absent, {regularizedAttendance.work_hours.toFixed(1)} work hours, {regularizedAttendance.ot_hours.toFixed(1)} OT hours. Adjust above if needed.
                </p>
              )}
              {singleTargetId && !regularizedAttendance && (
                <p className="salary-proration-note">No submitted attendance found for {selectedEmployees[0]?.name} in {monthNames[form.month - 1]} {businessYear} — enter absent days and OT hours manually.</p>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="wizard-panel">
              <div className="form-grid compact-grid">
                <label>
                  <span>{targetEmployees.length > 1 ? 'Other deduction each' : 'Other deduction'}</span>
                  <input type="number" min="0" step="0.01" value={form.cash_advance} onChange={(event) => setOtherDeduction(parseFloat(event.target.value) || 0)} />
                </label>
                <label>
                  <span>Total other deduction</span>
                  <input type="number" step="0.01" value={roundMoney(totalOtherDeduction)} readOnly />
                </label>
                <label>
                  <span>Net salary</span>
                  <input type="number" step="0.01" value={form.net_salary} readOnly />
                </label>
              </div>
              <dl className="salary-review-grid">
                <div><dt>Basic</dt><dd>{formatCurrency(targetBaseSalary)}</dd></div>
                <div><dt>Absent deduction</dt><dd>{formatCurrency(form.absent_deduction)}</dd></div>
                <div><dt>OT ({form.ot_hours || 0} hrs @ {formatCurrency(effectiveOtRate)})</dt><dd>{formatCurrency(totalOtAmount)}</dd></div>
                <div><dt>Other deduction</dt><dd>{formatCurrency(totalOtherDeduction)}</dd></div>
                <div><dt>Net salary</dt><dd>{formatCurrency(form.net_salary)}</dd></div>
              </dl>
            </div>
          )}

          <div className="wizard-actions">
            <button className="soft-button" type="button" disabled={step === 1} onClick={() => onStepChange(Math.max(1, step - 1))}>
              Back
            </button>
            {step < 4 ? (
              <button className="dark-button" type="button" disabled={!canAdvance} onClick={() => onStepChange(Math.min(4, step + 1))}>
                Next
              </button>
            ) : (
              <button className="dark-button" type="button" disabled={!canSubmit} onClick={onSubmit}>
                <CreditCard size={16} />
                Save salary
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

function SiteForm({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <section className="form-panel">
      <SectionHeader title="Add site" />
      <form onSubmit={onSubmit}>
        <div className="form-grid">
          <label>
            <span>Site name</span>
            <input name="siteName" required />
          </label>
          <label>
            <span>Location</span>
            <input name="siteLocation" />
          </label>
        </div>
        <button className="dark-button full" type="submit">
          <Plus size={16} />
          Add site
        </button>
      </form>
    </section>
  );
}

function formatCurrency(value: number) {
  const amount = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(Number(value || 0));

  return `MVR ${amount}`;
}

function getAttendanceDateRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  const dates: string[] = [];
  for (let current = new Date(start); current <= end && dates.length <= 31; current.setUTCDate(current.getUTCDate() + 1)) {
    dates.push(current.toISOString().slice(0, 10));
  }
  return dates;
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

function formatDate(value?: string | null) {
  if (!value) return 'Not set';

  const [datePart] = value.split('T');
  const date = new Date(`${datePart}T00:00:00`);
  if (Number.isNaN(date.getTime())) return datePart;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function paymentLabel(medium: string) {
  return medium === 'account transfer' ? 'Bank transfer' : 'Cash';
}

function employeeTypeLabel(value?: string | null) {
  return defaultEmployeeGroups.find((group) => group.value === value)?.label
    || String(value || 'local').split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function jobLevelLabel(value?: string | null) {
  return jobLevels.find((level) => level.value === value)?.label || 'Labour';
}

function resizeProfilePhoto(file: File) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      if (!image.width || !image.height) {
        reject(new Error('Invalid image dimensions'));
        return;
      }

      const scale = Math.min(profilePhotoMaxSize / image.width, profilePhotoMaxSize / image.height, 1);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        reject(new Error('Canvas is not available'));
        return;
      }

      canvas.width = width;
      canvas.height = height;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not load image'));
    };

    image.src = objectUrl;
  });
}

function getPaidSalaryMonths(transactions: SalaryTransaction[], employeeId: number, year: number) {
  return new Set(
    transactions
      .filter((transaction) => (
        transaction.employee_id === employeeId &&
        transaction.year === year &&
        transaction.status === 'paid'
      ))
      .map((transaction) => transaction.month)
  );
}

function getPaidSalaryMonthsForEmployees(transactions: SalaryTransaction[], employeeIds: number[], year: number) {
  const employeeIdSet = new Set(employeeIds);
  if (employeeIdSet.size === 0) return new Set<number>();

  return new Set(
    transactions
      .filter((transaction) => (
        employeeIdSet.has(transaction.employee_id) &&
        transaction.year === year &&
        transaction.status === 'paid'
      ))
      .map((transaction) => transaction.month)
  );
}

function getEligibleSalaryMonths(employee: Employee, businessYear: number) {
  const startMonth = getSalaryStartMonth(employee.join_date, businessYear);
  if (startMonth > monthNames.length) return [];

  return monthNames
    .map((_, index) => index + 1)
    .filter((month) => month >= startMonth);
}

// Payroll is only ever run for the last fully completed month — never the
// current (still in-progress) month, never further back, never a future one.
function getCommonEligibleSalaryMonths(employees: Employee[], businessYear: number) {
  if (employees.length === 0) return [];

  const latestStartMonth = Math.max(
    ...employees.map((employee) => getSalaryStartMonth(employee.join_date, businessYear))
  );
  if (latestStartMonth > monthNames.length) return [];

  const today = new Date();
  if (businessYear !== today.getFullYear()) return [];
  const currentMonth = today.getMonth() + 1;
  if (currentMonth === 1) return [];
  const lastMonth = currentMonth - 1;

  return lastMonth >= latestStartMonth ? [lastMonth] : [];
}

function getCompactSalaryMonthWindow(employees: Employee[], businessYear: number) {
  return getCommonEligibleSalaryMonths(employees, businessYear);
}

function getSalaryStartMonth(joinDate: string | null | undefined, businessYear: number) {
  if (!joinDate) return 1;

  const [datePart] = joinDate.split('T');
  const [yearValue, monthValue] = datePart.split('-').map(Number);
  if (!Number.isInteger(yearValue) || !Number.isInteger(monthValue)) return 1;

  if (yearValue > businessYear) return monthNames.length + 1;
  if (yearValue === businessYear) return Math.max(1, Math.min(monthValue, monthNames.length));

  return 1;
}

function getFirstUnpaidSalaryMonth(
  preferredMonth: number,
  paidMonths: Set<number>,
  eligibleMonths: number[],
  preferredMonths: number[] = []
) {
  if (eligibleMonths.length === 0) return preferredMonth;
  if (eligibleMonths.includes(preferredMonth) && !paidMonths.has(preferredMonth)) return preferredMonth;

  const firstPreferredMonth = preferredMonths
    .filter((month) => eligibleMonths.includes(month))
    .find((month) => !paidMonths.has(month));
  if (firstPreferredMonth) return firstPreferredMonth;

  const firstUnpaidMonth = eligibleMonths.find((month) => !paidMonths.has(month));
  if (firstUnpaidMonth) return firstUnpaidMonth;

  return eligibleMonths[0];
}

function getSalaryEmployeeIds(form: ReturnType<typeof freshSalaryForm>) {
  const employeeIds = form.employee_ids
    .map((employeeId) => Number(employeeId))
    .filter((employeeId) => Number.isInteger(employeeId) && employeeId > 0);
  const legacyEmployeeId = Number(form.employee_id || 0);

  if (employeeIds.length === 0 && Number.isInteger(legacyEmployeeId) && legacyEmployeeId > 0) {
    employeeIds.push(legacyEmployeeId);
  }

  return Array.from(new Set(employeeIds));
}

function getSalaryTargets(
  form: ReturnType<typeof freshSalaryForm>,
  employees: Employee[],
  salarySiteMemberIds: number[]
) {
  if (form.scope === 'site') {
    const siteId = Number(form.site_id || 0);
    if (!siteId) return [];

    return employees.filter((employee) => !employee.is_terminated && (employee.site_id === siteId || salarySiteMemberIds.includes(employee.id)));
  }

  const employeeIds = getSalaryEmployeeIds(form);
  return employees.filter((employee) => !employee.is_terminated && employeeIds.includes(employee.id));
}

function withSalaryCalculations(
  form: ReturnType<typeof freshSalaryForm>,
  employees: Employee[]
) {
  if (employees.length === 0) {
    return {
      ...form,
      daily_rate: 0,
      absent_deduction: 0,
      net_salary: 0,
    };
  }

  const rows = employees.map((employee) => calculateEmployeeSalary(employee, form));
  const totalAbsentDeduction = rows.reduce((sum, row) => sum + row.absent_deduction, 0);
  const totalNetSalary = rows.reduce((sum, row) => sum + row.net_salary, 0);
  const dailyRate = form.scope !== 'employee' || rows.length > 1
    ? rows.reduce((sum, row) => sum + row.daily_rate, 0) / rows.length
    : rows[0].daily_rate;

  return {
    ...form,
    daily_rate: roundMoney(dailyRate),
    absent_deduction: roundMoney(totalAbsentDeduction),
    net_salary: roundMoney(totalNetSalary),
  };
}

function calculateEmployeeSalary(employee: Employee, form: ReturnType<typeof freshSalaryForm>) {
  const eligibleDays = getEligiblePayrollDays(employee.join_date, form.month, form.year);
  const absentDays = Math.min(eligibleDays, Math.max(0, Number(form.absent_days) || 0));
  const workedDays = Math.max(0, eligibleDays - absentDays);
  const cashAdvance = Math.max(0, Number(form.cash_advance) || 0);
  const dailyRate = Number(employee.salary || 0) / salaryPeriodDays;
  const absentDeduction = dailyRate * absentDays;
  const otRate = Number(form.ot_rate) > 0 ? Number(form.ot_rate) : getDefaultOtRate(employee);
  const otHours = Math.max(0, Number(form.ot_hours) || 0);
  const otAmount = otHours * otRate;
  const netSalary = Math.max(0, dailyRate * workedDays - cashAdvance + otAmount);

  return {
    daily_rate: roundMoney(dailyRate),
    absent_deduction: roundMoney(absentDeduction),
    ot_rate: roundMoney(otRate),
    ot_amount: roundMoney(otAmount),
    net_salary: roundMoney(netSalary),
  };
}

function getDefaultOtRate(employee: Employee) {
  const dailyRate = Number(employee.salary || 0) / salaryPeriodDays;
  const hoursPerDay = Number(employee.hours_per_day) > 0 ? Number(employee.hours_per_day) : 8;
  return dailyRate / hoursPerDay;
}

function getEligiblePayrollDays(joinDate: string | null | undefined, salaryMonth: number, businessYear: number) {
  if (!joinDate) return salaryPeriodDays;
  const [joinYear, joinMonth, joinDay] = joinDate.slice(0, 10).split('-').map(Number);
  if (joinYear !== businessYear || joinMonth !== salaryMonth || !Number.isInteger(joinDay)) return salaryPeriodDays;
  return Math.max(0, salaryPeriodDays - Math.min(Math.max(joinDay, 1), salaryPeriodDays) + 1);
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}
