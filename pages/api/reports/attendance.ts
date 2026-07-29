import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';

interface AttendanceReportRow {
  attendance_date: string;
  employee_name: string;
  id_number: string | null;
  site_name: string | null;
  status: string;
  in_time: string | null;
  out_time: string | null;
  notes: string;
}

interface PdfColumn {
  label: string;
  width: number;
}

const pageWidth = 842;
const pageHeight = 595;
const margin = 36;
const tableWidth = pageWidth - margin * 2;
const rowHeight = 22;
const tableTop = 108;
const footerTop = pageHeight - 48;
const rowsPerPage = Math.floor((footerTop - 18 - tableTop - rowHeight) / rowHeight);
const columns: PdfColumn[] = [
  { label: '#', width: 22 },
  { label: 'Date', width: 65 },
  { label: 'Employee', width: 135 },
  { label: 'Passport/ID', width: 80 },
  { label: 'Site', width: 125 },
  { label: 'Status', width: 60 },
  { label: 'In', width: 55 },
  { label: 'Out', width: 55 },
  { label: 'Notes', width: 173 },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await ensureAttendanceTable();
    const startDate = normalizeDate(req.query.date);
    const endDate = normalizeDate(req.query.end_date) || startDate;
    if (!startDate || !endDate) return res.status(400).json({ error: 'Valid attendance dates are required' });
    const rangeDays = inclusiveDayCount(startDate, endDate);
    if (rangeDays < 1 || rangeDays > 31) return res.status(400).json({ error: 'Date range must be between 1 and 31 days' });

    const requestedSite = singleValue(req.query.site_id);
    const siteId = requestedSite && requestedSite !== 'all' ? Number(requestedSite) : null;
    if (requestedSite && requestedSite !== 'all' && (!Number.isInteger(siteId) || Number(siteId) <= 0)) {
      return res.status(400).json({ error: 'Invalid site' });
    }

    const params: Array<string | number> = [startDate, endDate];
    let siteFilter = 'WHERE (COALESCE(e.is_terminated, FALSE) = FALSE OR d.attendance_date <= e.terminated_at)';
    if (siteId) {
      params.push(siteId);
      siteFilter += ` AND e.site_id = $${params.length}`;
    }

    const result = await query(`
      WITH report_dates AS (
        SELECT generate_series($1::date, $2::date, INTERVAL '1 day')::date AS attendance_date
      )
      SELECT
        to_char(d.attendance_date, 'YYYY-MM-DD') AS attendance_date,
        e.name AS employee_name,
        e.id_number,
        s.name AS site_name,
        CASE WHEN EXTRACT(ISODOW FROM d.attendance_date) = 5 THEN 'off' ELSE COALESCE(a.status, 'not marked') END AS status,
        CASE WHEN EXTRACT(ISODOW FROM d.attendance_date) = 5 THEN NULL ELSE to_char(a.in_time, 'HH24:MI') END AS in_time,
        CASE WHEN EXTRACT(ISODOW FROM d.attendance_date) = 5 THEN NULL ELSE to_char(a.out_time, 'HH24:MI') END AS out_time,
        COALESCE(a.notes, '') AS notes
      FROM report_dates d
      CROSS JOIN employees e
      LEFT JOIN sites s ON s.id = e.site_id
      LEFT JOIN attendance a ON a.employee_id = e.id AND a.attendance_date = d.attendance_date
      ${siteFilter}
      ORDER BY LOWER(e.name) ASC, d.attendance_date ASC
    `, params);

    const rows = result.rows as AttendanceReportRow[];
    const siteLabel = siteId ? rows[0]?.site_name || 'Selected site' : 'All sites';
    const pdf = createAttendancePdf(rows, startDate, endDate, siteLabel);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="CloveHR-attendance-${startDate}-to-${endDate}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(pdf);
  } catch (error) {
    console.error('Attendance report error:', error);
    return res.status(500).json({ error: 'Could not generate attendance sheet' });
  }
}

export function createAttendancePdf(rows: AttendanceReportRow[], startDate: string, endDate: string, siteLabel: string) {
  const employeeWiseRows = [...rows].sort((left, right) => (
    left.employee_name.localeCompare(right.employee_name, undefined, { sensitivity: 'base' })
    || left.attendance_date.localeCompare(right.attendance_date)
  ));
  const chunks = chunkRows(employeeWiseRows);
  const generatedAt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
  return buildPdf(chunks.map((pageRows, index) => renderPage(
    pageRows, employeeWiseRows.length, startDate, endDate, siteLabel, generatedAt, index + 1, chunks.length
  )));
}

function renderPage(rows: AttendanceReportRow[], totalRows: number, startDate: string, endDate: string, siteLabel: string, generatedAt: string, pageNumber: number, pageCount: number) {
  let content = '';
  content += drawText(margin, 42, 'CLOVE HR - EMPLOYEE ATTENDANCE SHEET', 18, '0.12 0.12 0.12');
  content += drawText(margin, 64, `Generated ${generatedAt}`, 9, '0.42 0.42 0.40');
  content += drawText(margin, 79, `${startDate}${startDate === endDate ? '' : ` to ${endDate}`} / ${siteLabel} / ${totalRows} entries`, 9, '0.42 0.42 0.40');
  content += drawLine(margin, 92, pageWidth - margin, 92, '0.86 0.86 0.84');
  content += drawRect(margin, tableTop, tableWidth, rowHeight, '0.94 0.94 0.92');
  content += drawRowText(columns.map((column) => column.label), tableTop, true);

  if (rows.length === 0) {
    content += drawText(margin + 10, tableTop + rowHeight + 16, 'No employees found', 10, '0.42 0.42 0.40');
  } else {
    rows.forEach((row, index) => {
      const top = tableTop + rowHeight + index * rowHeight;
      const startsEmployee = index === 0 || rows[index - 1].employee_name !== row.employee_name;
      const friday = isFridayDate(row.attendance_date);
      const status = friday ? 'off' : row.status.toLowerCase();
      const isAlert = status === 'absent' || status === 'leave';
      const isOff = status === 'off';
      if (isAlert) content += drawRect(margin, top, tableWidth, rowHeight, '1 0.90 0.90');
      else if (isOff) content += drawRect(margin, top, tableWidth, rowHeight, '1 0.94 0.82');
      else if (index % 2 === 1) content += drawRect(margin, top, tableWidth, rowHeight, '0.98 0.98 0.97');
      if (startsEmployee) content += drawLine(margin, top, pageWidth - margin, top, '0.48 0.66 0.75');
      content += drawRowText([
        String(index + 1 + (pageNumber - 1) * rowsPerPage),
        row.attendance_date,
        row.employee_name,
        row.id_number || 'Not set',
        row.site_name || 'Unassigned',
        friday ? 'Off' : titleCase(row.status),
        friday ? '-' : row.in_time || '-',
        friday ? '-' : row.out_time || '-',
        row.notes || '',
      ], top, false, isAlert ? '0.72 0.08 0.08' : isOff ? '0.72 0.34 0.04' : undefined);
      content += drawLine(margin, top + rowHeight, pageWidth - margin, top + rowHeight, '0.90 0.90 0.88');
    });
  }

  content += drawLine(margin, footerTop - 12, pageWidth - margin, footerTop - 12, '0.86 0.86 0.84');
  content += drawText(margin, footerTop, 'CloveHR attendance report', 9, '0.22 0.22 0.20');
  content += drawText(pageWidth - margin - 58, footerTop + 24, `Page ${pageNumber} of ${pageCount}`, 8, '0.55 0.55 0.52');
  return content;
}

function drawRowText(values: string[], top: number, isHeader: boolean, colorOverride?: string) {
  let x = margin;
  let content = '';
  const fontSize = isHeader ? 7.5 : 8;
  const color = colorOverride || (isHeader ? '0.30 0.30 0.28' : '0.12 0.12 0.12');
  columns.forEach((column, index) => {
    content += drawText(x + 7, top + 14, truncateText(values[index] || '', column.width, fontSize), fontSize, color);
    x += column.width;
  });
  return content;
}

function buildPdf(pageContents: string[]) {
  const objectBodies: string[] = [];
  const pageRefs = pageContents.map((_, index) => `${4 + index * 2} 0 R`).join(' ');
  objectBodies[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objectBodies[1] = `<< /Type /Pages /Kids [${pageRefs}] /Count ${pageContents.length} >>`;
  objectBodies[2] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  pageContents.forEach((content, index) => {
    const pageObject = 4 + index * 2;
    const contentObject = pageObject + 1;
    objectBodies[pageObject - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>`;
    objectBodies[contentObject - 1] = `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`;
  });
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objectBodies.forEach((body, index) => {
    offsets[index + 1] = Buffer.byteLength(pdf, 'latin1');
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objectBodies.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objectBodies.length; index += 1) pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objectBodies.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

function chunkRows(rows: AttendanceReportRow[]) {
  if (rows.length === 0) return [[]];
  const chunks: AttendanceReportRow[][] = [];
  for (let index = 0; index < rows.length; index += rowsPerPage) chunks.push(rows.slice(index, index + rowsPerPage));
  return chunks;
}

function drawText(x: number, top: number, text: string, size: number, color: string) {
  return `BT /F1 ${size} Tf ${color} rg ${number(x)} ${number(pageHeight - top)} Td (${escapePdfText(text)}) Tj ET\n`;
}

function drawRect(x: number, top: number, width: number, height: number, fill: string) {
  return `${fill} rg ${number(x)} ${number(pageHeight - top - height)} ${number(width)} ${number(height)} re f\n`;
}

function drawLine(x1: number, top1: number, x2: number, top2: number, color: string) {
  return `0.6 w ${color} RG ${number(x1)} ${number(pageHeight - top1)} m ${number(x2)} ${number(pageHeight - top2)} l S\n`;
}

function truncateText(value: string, width: number, fontSize: number) {
  const text = sanitize(value);
  const maxLength = Math.max(3, Math.floor((width - 10) / (fontSize * 0.48)));
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}...`;
}

function escapePdfText(value: string) {
  return sanitize(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function sanitize(value: string) {
  return String(value || '').normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeDate(value: unknown) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : '';
}

function inclusiveDayCount(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Math.floor((end - start) / 86400000) + 1;
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function titleCase(value: string) {
  return value.split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function isFridayDate(value: string) {
  return new Date(`${value}T00:00:00Z`).getUTCDay() === 5;
}

function number(value: number) {
  return Number(value.toFixed(2)).toString();
}

async function ensureAttendanceTable() {
  await query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_terminated BOOLEAN NOT NULL DEFAULT FALSE');
  await query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS terminated_at DATE');
  await query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      attendance_date DATE NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'present',
      in_time TIME,
      out_time TIME,
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(employee_id, attendance_date)
    )
  `);
  await query('ALTER TABLE attendance ADD COLUMN IF NOT EXISTS in_time TIME');
  await query('ALTER TABLE attendance ADD COLUMN IF NOT EXISTS out_time TIME');
}
