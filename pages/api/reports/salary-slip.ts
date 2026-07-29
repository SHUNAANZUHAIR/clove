import { randomBytes } from 'crypto';
import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { createQrMatrix } from '../../../lib/qr';
import { requestSiteId } from '../../../lib/request-auth';

export interface SalarySlipRow {
  id: number;
  employee_id: number;
  employee_name: string;
  id_number: string | null;
  site_name: string | null;
  base_salary: number;
  medium: string | null;
  month: number;
  year: number;
  worked_days: number;
  daily_rate: number;
  absent_days: number;
  absent_deduction: number;
  cash_advance: number;
  net_salary: number;
  status: string;
  agreement_verification_token: string | null;
}

const pageWidth = 595;
const pageHeight = 842;
const margin = 50;
const contentWidth = pageWidth - margin * 2;
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const transactionIds = normalizeTransactionIds(req.query.transaction_ids, req.query.transaction_id);
  if (transactionIds.length === 0) return res.status(400).json({ error: 'At least one salary transaction is required' });
  if (transactionIds.length > 100) return res.status(400).json({ error: 'A maximum of 100 salary slips can be downloaded together' });

  try {
    const siteId = requestSiteId(req);
    await query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS agreement_verification_token VARCHAR(64) UNIQUE');
    const result = await query(`
      SELECT s.id, e.id AS employee_id, e.name AS employee_name, e.id_number, site.name AS site_name,
        e.salary::float AS base_salary, e.medium, s.month, s.year, s.worked_days,
        s.daily_rate::float AS daily_rate, s.absent_days,
        s.absent_deduction::float AS absent_deduction, s.cash_advance::float AS cash_advance,
        s.net_salary::float AS net_salary, s.status, e.agreement_verification_token
      FROM salary_transactions s
      JOIN employees e ON e.id = s.employee_id
      LEFT JOIN sites site ON site.id = e.site_id
      WHERE s.id = ANY($1::int[]) AND ($2 = -1 OR e.site_id = $2)
      ORDER BY LOWER(e.name), s.year, s.month
    `, [transactionIds, siteId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Salary transactions not found' });

    const rows = result.rows as SalarySlipRow[];
    for (const row of rows) {
      if (!row.agreement_verification_token) row.agreement_verification_token = await ensureVerificationToken(row.employee_id);
    }

    const pdf = createSalarySlipsPdf(rows);
    const single = rows.length === 1;
    const safeName = single ? sanitize(rows[0].employee_name).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') : 'Selected-Employees';
    const period = single ? `-${rows[0].year}-${String(rows[0].month).padStart(2, '0')}` : '';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Salary-Slips-${safeName || 'Employee'}${period}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(pdf);
  } catch (error) {
    console.error('Salary slip error:', error);
    return res.status(500).json({ error: 'Could not generate salary slips' });
  }
}

async function ensureVerificationToken(employeeId: number) {
  const candidate = randomBytes(16).toString('hex');
  const updated = await query(`UPDATE employees SET agreement_verification_token = $1
    WHERE id = $2 AND agreement_verification_token IS NULL RETURNING agreement_verification_token`, [candidate, employeeId]);
  if (updated.rowCount > 0) return updated.rows[0].agreement_verification_token as string;
  const existing = await query('SELECT agreement_verification_token FROM employees WHERE id = $1', [employeeId]);
  return existing.rows[0]?.agreement_verification_token || candidate;
}

export function createSalarySlipPdf(row: SalarySlipRow) {
  return createSalarySlipsPdf([row]);
}

export function createSalarySlipsPdf(rows: SalarySlipRow[]) {
  return buildPdf(rows.map((row) => renderSalarySlip(row)));
}

function renderSalarySlip(row: SalarySlipRow) {
  let content = '';
  const verificationUrl = row.agreement_verification_token
    ? `https://clovehr.vercel.app/verify-agreement/${row.agreement_verification_token}`
    : '';
  content += drawText(margin, 52, 'CLOVE HR', 11, true, '0.35 0.35 0.35');
  content += drawText(margin, 78, 'EMPLOYEE SALARY SLIP', 21, true);
  content += drawText(margin, 100, `${monthNames[row.month - 1] || row.month} ${row.year}`, 11, false, '0.35 0.35 0.35');
  if (verificationUrl) {
    content += drawText(pageWidth - margin - 122, 42, 'SCAN TO VERIFY', 7, true, '0.24 0.32 0.36');
    content += drawQrCode(createQrMatrix(verificationUrl), pageWidth - margin - 63, 20, 1.08);
  }
  content += drawLine(margin, 116, pageWidth - margin, 116, '0.76 0.76 0.76');

  const details: Array<[string, string]> = [
    ['Employee name', row.employee_name],
    ['Passport/ID', row.id_number || '-'],
    ['Work site', row.site_name || '-'],
    ['Payment method', row.medium === 'account transfer' ? 'Bank transfer' : 'Cash'],
    ['Status', capitalize(row.status)],
  ];
  let y = 136;
  details.forEach(([label, value]) => {
    content += drawText(margin, y, label, 9, true, '0.30 0.30 0.30');
    content += drawText(margin + 150, y, value, 9.5);
    y += 24;
  });

  y += 10;
  content += drawRect(margin, y, contentWidth, 28, '0.93 0.93 0.92');
  content += drawText(margin + 10, y + 18, 'PAYROLL CALCULATION', 9, true, '0.25 0.25 0.25');
  y += 28;
  const calculationRows: Array<[string, string]> = [
    ['Monthly basic salary', money(row.base_salary)],
    ['Paid working days', String(row.worked_days)],
    ['Daily rate (30-day basis)', money(row.daily_rate)],
    ['Absent days', String(row.absent_days)],
    ['Absent deduction', `- ${money(row.absent_deduction)}`],
    ['Other deduction / cash advance', `- ${money(row.cash_advance)}`],
  ];
  calculationRows.forEach(([label, value], index) => {
    if (index % 2 === 1) content += drawRect(margin, y, contentWidth, 30, '0.98 0.98 0.97');
    content += drawText(margin + 10, y + 19, label, 9.5);
    content += drawRightText(pageWidth - margin - 10, y + 19, value, 9.5);
    content += drawLine(margin, y + 30, pageWidth - margin, y + 30, '0.87 0.87 0.86');
    y += 30;
  });

  y += 16;
  content += drawRect(margin, y, contentWidth, 48, '0.15 0.15 0.14');
  content += drawText(margin + 14, y + 30, 'NET SALARY PAID', 11, true, '1 1 1');
  content += drawRightText(pageWidth - margin - 14, y + 31, money(row.net_salary), 15, true, '1 1 1');
  y += 82;
  content += drawRect(margin, y, contentWidth, 58, '0.94 0.97 0.98');
  content += drawText(margin + 12, y + 22, 'EMPLOYEE VERIFICATION', 9, true, '0.12 0.30 0.38');
  content += drawText(margin + 12, y + 41, 'Scan the QR code to verify this employee and employment record.', 8.5, false, '0.30 0.38 0.42');

  content += drawLine(margin, 786, pageWidth - margin, 786, '0.82 0.82 0.82');
  content += drawText(margin, 802, 'CloveHR payroll document', 8, false, '0.45 0.45 0.45');
  content += drawRightText(pageWidth - margin, 802, `Transaction #${row.id}`, 8, false, '0.45 0.45 0.45');
  return content;
}

function buildPdf(pageContents: string[]) {
  const objects: string[] = [];
  const pageRefs = pageContents.map((_, index) => `${5 + index * 2} 0 R`).join(' ');
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = `<< /Type /Pages /Kids [${pageRefs}] /Count ${pageContents.length} >>`;
  objects[2] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  pageContents.forEach((content, index) => {
    const pageObject = 5 + index * 2;
    const contentObject = pageObject + 1;
    objects[pageObject - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`;
    objects[contentObject - 1] = `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`;
  });
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => { offsets[index + 1] = Buffer.byteLength(pdf, 'latin1'); pdf += `${index + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

function normalizeTransactionIds(multiple: string | string[] | undefined, single: string | string[] | undefined) {
  const value = Array.isArray(multiple) ? multiple.join(',') : multiple || (Array.isArray(single) ? single[0] : single) || '';
  return Array.from(new Set(value.split(',').map(Number).filter((id) => Number.isInteger(id) && id > 0)));
}

function drawText(x: number, top: number, text: string, size: number, bold = false, color = '0.10 0.10 0.10') { return `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color} rg ${number(x)} ${number(pageHeight - top)} Td (${escapePdf(text)}) Tj ET\n`; }
function drawRightText(right: number, top: number, text: string, size: number, bold = false, color = '0.10 0.10 0.10') { const clean = sanitize(text); return drawText(right - clean.length * size * 0.51, top, clean, size, bold, color); }
function drawRect(x: number, top: number, width: number, height: number, fill: string) { return `${fill} rg ${number(x)} ${number(pageHeight - top - height)} ${number(width)} ${number(height)} re f\n`; }
function drawLine(x1: number, top1: number, x2: number, top2: number, color: string) { return `0.6 w ${color} RG ${number(x1)} ${number(pageHeight - top1)} m ${number(x2)} ${number(pageHeight - top2)} l S\n`; }
function drawQrCode(matrix: boolean[][], x: number, top: number, cell: number) { const quiet = 4; let output = drawRect(x, top, (matrix.length + quiet * 2) * cell, (matrix.length + quiet * 2) * cell, '1 1 1'); matrix.forEach((row, rowIndex) => row.forEach((dark, columnIndex) => { if (dark) output += drawRect(x + (columnIndex + quiet) * cell, top + (rowIndex + quiet) * cell, cell, cell, '0 0 0'); })); return output; }
function money(value: number) { return `MVR ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function capitalize(value: string) { return value ? value.charAt(0).toUpperCase() + value.slice(1) : ''; }
function sanitize(value: string) { return String(value || '').normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim(); }
function escapePdf(value: string) { return sanitize(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
function number(value: number) { return Number(value.toFixed(2)).toString(); }
