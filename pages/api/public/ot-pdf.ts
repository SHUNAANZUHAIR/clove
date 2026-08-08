// Auto-downloaded after a self-service timesheet submission so the employee
// keeps a copy of exactly what was recorded. Public/unauthenticated, same as
// the rest of the /api/public/* surface.
import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';

interface TimesheetRow {
  date: string;
  status: string;
  in_time: string | null;
  out_time: string | null;
  ot_in_time: string | null;
  ot_out_time: string | null;
}

interface PdfColumn {
  label: string;
  width: number;
}

const pageWidth = 595;
const pageHeight = 842;
const margin = 36;
const tableWidth = pageWidth - margin * 2;
const rowHeight = 20;
const tableTop = 150;
const footerTop = pageHeight - 46;
const rowsPerPage = Math.floor((footerTop - 34 - tableTop - rowHeight) / rowHeight);
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const columns: PdfColumn[] = [
  { label: '#', width: 24 },
  { label: 'Date', width: 68 },
  { label: 'Day', width: 40 },
  { label: 'Status', width: 55 },
  { label: 'In', width: 48 },
  { label: 'Out', width: 48 },
  { label: 'OT In', width: 48 },
  { label: 'OT Out', width: 48 },
  { label: 'Work hrs', width: 55 },
  { label: 'OT hrs', width: 89 },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const employeeId = Number(singleValue(req.query.employee_id));
    const month = Number(singleValue(req.query.month));
    const year = Number(singleValue(req.query.year));
    if (!Number.isInteger(employeeId) || employeeId <= 0) return res.status(400).json({ error: 'A valid employee is required.' });
    if (!Number.isInteger(month) || month < 1 || month > 12) return res.status(400).json({ error: 'A valid month is required.' });
    if (!Number.isInteger(year) || year < 2000) return res.status(400).json({ error: 'A valid year is required.' });

    const employee = await query('SELECT id, name, id_number FROM employees WHERE id = $1', [employeeId]);
    if (employee.rowCount === 0) return res.status(404).json({ error: 'Employee not found.' });

    const result = await query(
      `SELECT to_char(attendance_date, 'YYYY-MM-DD') AS date, status,
         to_char(in_time, 'HH24:MI') AS in_time, to_char(out_time, 'HH24:MI') AS out_time,
         to_char(ot_in_time, 'HH24:MI') AS ot_in_time, to_char(ot_out_time, 'HH24:MI') AS ot_out_time
       FROM attendance
       WHERE employee_id = $1 AND EXTRACT(MONTH FROM attendance_date) = $2 AND EXTRACT(YEAR FROM attendance_date) = $3
       ORDER BY attendance_date ASC`,
      [employeeId, month, year]
    );

    const pdf = createTimesheetPdf(employee.rows[0], result.rows as TimesheetRow[], month, year);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(employee.rows[0].name)}-timesheet-${year}-${String(month).padStart(2, '0')}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(pdf);
  } catch (error) {
    console.error('OT timesheet PDF error:', error);
    return res.status(500).json({ error: 'Could not generate the timesheet PDF.' });
  }
}

function createTimesheetPdf(employee: { name: string; id_number: string | null }, rows: TimesheetRow[], month: number, year: number) {
  const chunks = chunkRows(rows);
  const generatedAt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
  const totals = rows.reduce((sum, row) => {
    const friday = isFridayDate(row.date);
    const work = !friday && row.status === 'present' ? hoursBetween(row.in_time, row.out_time) : 0;
    const ot = !friday ? hoursBetween(row.ot_in_time, row.ot_out_time) : 0;
    return {
      workHours: sum.workHours + work,
      otHours: sum.otHours + ot,
      daysPresent: sum.daysPresent + (row.status === 'present' ? 1 : 0),
      daysAbsent: sum.daysAbsent + (row.status === 'absent' ? 1 : 0),
    };
  }, { workHours: 0, otHours: 0, daysPresent: 0, daysAbsent: 0 });

  return buildPdf(chunks.map((pageRows, index) => renderPage(
    employee, pageRows, month, year, generatedAt, totals, index + 1, chunks.length
  )));
}

function renderPage(
  employee: { name: string; id_number: string | null },
  rows: TimesheetRow[],
  month: number,
  year: number,
  generatedAt: string,
  totals: { workHours: number; otHours: number; daysPresent: number; daysAbsent: number },
  pageNumber: number,
  pageCount: number
) {
  let content = '';
  content += drawText(margin, 42, 'CLOVE HR - EMPLOYEE TIMESHEET', 18, '0.12 0.12 0.12');
  content += drawText(margin, 64, `${employee.name}${employee.id_number ? ` / ${employee.id_number}` : ''}`, 11, '0.22 0.22 0.20');
  content += drawText(margin, 80, `${monthNames[month - 1]} ${year}`, 10, '0.42 0.42 0.40');
  content += drawText(margin, 95, `Generated ${generatedAt}`, 8.5, '0.55 0.55 0.52');

  if (pageNumber === 1) {
    content += drawText(margin, 116, `Days present: ${totals.daysPresent}   Days absent: ${totals.daysAbsent}   Work hours: ${totals.workHours.toFixed(1)}   OT hours: ${totals.otHours.toFixed(1)}`, 9, '0.12 0.12 0.12');
  }

  content += drawLine(margin, 128, pageWidth - margin, 128, '0.86 0.86 0.84');
  content += drawRect(margin, tableTop, tableWidth, rowHeight, '0.94 0.94 0.92');
  content += drawRowText(columns.map((column) => column.label), tableTop, true);

  if (rows.length === 0) {
    content += drawText(margin + 10, tableTop + rowHeight + 16, 'No timesheet entries recorded', 10, '0.42 0.42 0.40');
  } else {
    rows.forEach((row, index) => {
      const top = tableTop + rowHeight + index * rowHeight;
      const friday = isFridayDate(row.date);
      const status = friday ? 'off' : row.status;
      const isAlert = status === 'absent' || status === 'leave';
      const work = !friday && status === 'present' ? hoursBetween(row.in_time, row.out_time) : 0;
      const ot = !friday ? hoursBetween(row.ot_in_time, row.ot_out_time) : 0;
      if (isAlert) content += drawRect(margin, top, tableWidth, rowHeight, '1 0.90 0.90');
      else if (friday) content += drawRect(margin, top, tableWidth, rowHeight, '1 0.94 0.82');
      else if (index % 2 === 1) content += drawRect(margin, top, tableWidth, rowHeight, '0.98 0.98 0.97');
      content += drawRowText([
        String(index + 1 + (pageNumber - 1) * rowsPerPage),
        row.date,
        weekdayShort(row.date),
        titleCase(status),
        friday ? '-' : row.in_time || '-',
        friday ? '-' : row.out_time || '-',
        friday ? '-' : row.ot_in_time || '-',
        friday ? '-' : row.ot_out_time || '-',
        work > 0 ? work.toFixed(1) : '-',
        ot > 0 ? ot.toFixed(1) : '-',
      ], top, false, isAlert ? '0.72 0.08 0.08' : undefined);
      content += drawLine(margin, top + rowHeight, pageWidth - margin, top + rowHeight, '0.90 0.90 0.88');
    });
  }

  content += drawLine(margin, footerTop - 12, pageWidth - margin, footerTop - 12, '0.86 0.86 0.84');
  content += drawText(margin, footerTop, 'CloveHR self-service timesheet', 9, '0.22 0.22 0.20');
  content += drawText(pageWidth - margin - 58, footerTop + 18, `Page ${pageNumber} of ${pageCount}`, 8, '0.55 0.55 0.52');
  return content;
}

function hoursBetween(start: string | null, end: string | null) {
  if (!start || !end) return 0;
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return 0;
  let minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  if (minutes < 0) minutes += 24 * 60;
  return minutes / 60;
}

function drawRowText(values: string[], top: number, isHeader: boolean, colorOverride?: string) {
  let x = margin;
  let content = '';
  const fontSize = isHeader ? 7.5 : 8;
  const color = colorOverride || (isHeader ? '0.30 0.30 0.28' : '0.12 0.12 0.12');
  columns.forEach((column, index) => {
    content += drawText(x + 6, top + 14, truncateText(values[index] || '', column.width, fontSize), fontSize, color);
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

function chunkRows(rows: TimesheetRow[]) {
  if (rows.length === 0) return [[]];
  const chunks: TimesheetRow[][] = [];
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
  const maxLength = Math.max(3, Math.floor((width - 8) / (fontSize * 0.48)));
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}...`;
}

function escapePdfText(value: string) {
  return sanitize(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function sanitize(value: string) {
  return String(value || '').normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
}

function sanitizeFilename(value: string) {
  return sanitize(value).replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'employee';
}

function titleCase(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

function weekdayShort(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

function isFridayDate(value: string) {
  return new Date(`${value}T00:00:00Z`).getUTCDay() === 5;
}

function number(value: number) {
  return Number(value.toFixed(2)).toString();
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
