import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { query } from '../../lib/db';

interface VerificationProps {
  employee: null | {
    name: string; idNumber: string; workPermit: string; nationality: string;
    jobTitle: string; siteName: string; joinDate: string; reference: string;
    terminated: boolean; terminationDate: string;
  };
}

export default function VerifyAgreement({ employee }: VerificationProps) {
  return (
    <>
      <Head><title>Agreement verification - CloveHR</title></Head>
      <main className="verify-page">
        <section className="verify-card">
          <div className={`verify-mark ${employee ? employee.terminated ? 'terminated' : 'valid' : 'invalid'}`}>{employee ? employee.terminated ? '!' : '✓' : '!'}</div>
          <p className="eyebrow">CLOVE CAFE &amp; BISTRO</p>
          <h1>{employee ? employee.terminated ? 'EMPLOYMENT TERMINATED' : 'Agreement verified' : 'Agreement not found'}</h1>
          {employee ? (
            <>
              <p className="lead">{employee.terminated
                ? `This employee record was terminated${employee.terminationDate !== '-' ? ` on ${employee.terminationDate}` : ''}. The agreement remains available for verification.`
                : 'This employment agreement matches an active CloveHR employee record.'}</p>
              <dl>
                <div><dt>Employee</dt><dd>{employee.name}</dd></div>
                <div><dt>Passport / ID</dt><dd>{employee.idNumber}</dd></div>
                <div><dt>Work permit</dt><dd>{employee.workPermit}</dd></div>
                <div><dt>Nationality</dt><dd>{employee.nationality}</dd></div>
                <div><dt>Job title</dt><dd>{employee.jobTitle}</dd></div>
                <div><dt>Work site</dt><dd>{employee.siteName}</dd></div>
                <div><dt>Commencement date</dt><dd>{employee.joinDate}</dd></div>
                <div><dt>Employment status</dt><dd className={employee.terminated ? 'terminated-text' : ''}>{employee.terminated ? 'TERMINATED' : 'ACTIVE'}</dd></div>
                {employee.terminated && <div><dt>Termination date</dt><dd>{employee.terminationDate}</dd></div>}
                <div><dt>Verification reference</dt><dd>{employee.reference}</dd></div>
              </dl>
              <p className="privacy">Attendance records and salary payout history are not disclosed on this public verification page.</p>
            </>
          ) : <p className="lead">The QR reference is invalid or is no longer associated with an employee agreement.</p>}
        </section>
      </main>
      <style jsx global>{`html,body,#__next{margin:0;min-height:100%}`}</style>
      <style jsx>{`
        *{box-sizing:border-box}.verify-page{min-height:100vh;display:grid;place-items:center;padding:24px;background:#f3f6f7;font-family:Arial,sans-serif;color:#172126}.verify-card{width:min(620px,100%);padding:34px;border:1px solid #d8e0e3;border-radius:18px;background:#fff;box-shadow:0 18px 50px rgba(27,49,59,.10)}.verify-mark{display:grid;place-items:center;width:54px;height:54px;border-radius:50%;font-size:30px;font-weight:700}.verify-mark.valid{color:#17663a;background:#e4f5ea}.verify-mark.invalid,.verify-mark.terminated{color:#9b302d;background:#fde8e6}.terminated-text{color:#a61b1b}.eyebrow{margin:22px 0 6px;color:#476671;font-size:12px;font-weight:700;letter-spacing:.12em}.verify-card h1{margin:0;font-size:30px}.lead{color:#52636a;line-height:1.55}dl{margin:26px 0;border:1px solid #dce3e5;border-radius:12px;overflow:hidden}dl div{display:grid;grid-template-columns:160px 1fr;gap:16px;padding:12px 14px;border-bottom:1px solid #e7ecee}dl div:last-child{border:0}dt{color:#60727a;font-size:13px;font-weight:700}dd{margin:0;font-size:14px;font-weight:600}.privacy{margin:0;color:#6b7b82;font-size:12px;line-height:1.5}@media(max-width:520px){.verify-card{padding:24px 18px}.verify-card h1{font-size:25px}dl div{grid-template-columns:1fr;gap:4px}}
      `}</style>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<VerificationProps> = async ({ params }) => {
  const token = String(params?.token || '');
  if (!/^[a-f0-9]{32}$/.test(token)) return { props: { employee: null } };
  await query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS agreement_verification_token VARCHAR(64) UNIQUE');
  await query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_terminated BOOLEAN NOT NULL DEFAULT FALSE');
  await query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS terminated_at DATE');
  const result = await query(`SELECT e.name, e.id_number, e.work_permit_number, e.nationality,
    e.job_title, to_char(e.join_date, 'YYYY-MM-DD') AS join_date, s.name AS site_name,
    e.is_terminated, to_char(e.terminated_at, 'YYYY-MM-DD') AS terminated_at
    FROM employees e LEFT JOIN sites s ON s.id = e.site_id
    WHERE e.agreement_verification_token = $1`, [token]);
  if (result.rowCount === 0) return { props: { employee: null } };
  const row = result.rows[0];
  return { props: { employee: {
    name: row.name || '-', idNumber: row.id_number || '-', workPermit: row.work_permit_number || '-',
    nationality: row.nationality || '-', jobTitle: row.job_title || '-', siteName: row.site_name || '-',
    joinDate: row.join_date || '-', reference: `CLOVE-${token.slice(-8).toUpperCase()}`,
    terminated: Boolean(row.is_terminated), terminationDate: row.terminated_at || '-',
  } } };
};
