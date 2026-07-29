import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requestSiteId, isSuperAdmin } from '../../../lib/request-auth';

interface SalaryReportRow {
  employee_name: string;
  base_salary: number;
  medium: string | null;
  month: number;
  year: number;
  worked_days: number;
  absent_deduction: number;
  cash_advance: number;
  net_salary: number;
  status: string;
}

interface PdfColumn {
  label: string;
  width: number;
  align?: 'left' | 'right';
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
  { label: '#', width: 25 },
  { label: 'Employee', width: 160 },
  { label: 'Period', width: 70 },
  { label: 'Days', width: 45, align: 'right' },
  { label: 'Basic', width: 75, align: 'right' },
  { label: 'Absent ded.', width: 80, align: 'right' },
  { label: 'Advance', width: 70, align: 'right' },
  { label: 'Net salary', width: 85, align: 'right' },
  { label: 'Status', width: 60 },
  { label: 'Payment', width: 100 },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const siteId = requestSiteId(req);
    if (!isSuperAdmin(siteId)) return res.status(403).json({ error: 'Only super admin can access payroll.' });
    const month = singleValue(req.query.month);
    const status = singleValue(req.query.status);
    const params: Array<string | number> = [siteId];
    let where = 'WHERE ($1 = -1 OR e.site_id = $1)';

    if (month && month !== 'all') {
      const parsedMonth = Number(month);
      if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
        return res.status(400).json({ error: 'Invalid salary month' });
      }
      params.push(parsedMonth);
      where += ` AND s.month = $${params.length}`;
    }

    if (status && status !== 'all') {
      params.push(status);
      where += ` AND s.status = $${params.length}`;
    }

    const result = await query(`
      SELECT
        e.name AS employee_name,
        e.salary::float AS base_salary,
        e.medium,
        s.month,
        s.year,
        s.worked_days,
        s.absent_deduction::float AS absent_deduction,
        s.cash_advance::float AS cash_advance,
        s.net_salary::float AS net_salary,
        s.status
      FROM salary_transactions s
      JOIN employees e ON e.id = s.employee_id
      ${where}
      ORDER BY s.year DESC, s.month DESC, e.name ASC
    `, params);

    const rows = result.rows as SalaryReportRow[];
    const pdf = createSalaryReportPdf(rows, month, status);
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="CloveHR-salary-sheet-${today}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(pdf);
  } catch (error) {
    console.error('Salary report error:', error);
    return res.status(500).json({ error: 'Could not generate salary sheet' });
  }
}

function createSalaryReportPdf(rows: SalaryReportRow[], month?: string, status?: string) {
  const chunks = chunkRows(rows);
  const generatedAt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
  const filterDescription = [
    month && month !== 'all' ? monthNames[Number(month) - 1] : 'All months',
    status && status !== 'all' ? capitalize(status) : 'All statuses',
  ].join(' / ');
  const totalNet = rows.reduce((sum, row) => sum + Number(row.net_salary || 0), 0);
  return buildPdf(chunks.map((pageRows, index) => renderPage(
    pageRows,
    rows.length,
    totalNet,
    index + 1,
    chunks.length,
    generatedAt,
    filterDescription
  )));
}

function renderPage(rows: SalaryReportRow[], totalRows: number, totalNet: number, pageNumber: number, pageCount: number, generatedAt: string, filters: string) {
  let content = '';
  content += drawText(margin, 42, 'CLOVE HR - EMPLOYEE SALARY SHEET', 18, '0.12 0.12 0.12');
  content += drawText(margin, 64, `Generated ${generatedAt}`, 9, '0.42 0.42 0.40');
  content += drawText(margin, 79, `${filters} / ${totalRows} records`, 9, '0.42 0.42 0.40');
  content += drawText(pageWidth - margin - 185, 79, `Total net: ${money(totalNet)}`, 10, '0.12 0.12 0.12');
  content += drawLine(margin, 92, pageWidth - margin, 92, '0.86 0.86 0.84');
  content += drawRect(margin, tableTop, tableWidth, rowHeight, '0.94 0.94 0.92');
  content += drawRowText(columns.map((column) => column.label), tableTop, true);

  if (rows.length === 0) {
    content += drawText(margin + 10, tableTop + rowHeight + 16, 'No salary records found', 10, '0.42 0.42 0.40');
  } else {
    rows.forEach((row, index) => {
      const top = tableTop + rowHeight + index * rowHeight;
      if (index % 2 === 1) content += drawRect(margin, top, tableWidth, rowHeight, '0.98 0.98 0.97');
      content += drawRowText([
        String(index + 1 + (pageNumber - 1) * rowsPerPage),
        row.employee_name,
        `${monthNames[row.month - 1].slice(0, 3)} ${row.year}`,
        String(row.worked_days),
        money(row.base_salary),
        money(row.absent_deduction),
        money(row.cash_advance),
        money(row.net_salary),
        capitalize(row.status),
        row.medium === 'account transfer' ? 'Bank transfer' : 'Cash',
      ], top, false);
      content += drawLine(margin, top + rowHeight, pageWidth - margin, top + rowHeight, '0.90 0.90 0.88');
    });
  }

  content += drawLine(margin, footerTop - 12, pageWidth - margin, footerTop - 12, '0.86 0.86 0.84');
  content += drawText(margin, footerTop, 'CloveHR payroll report', 9, '0.22 0.22 0.20');
  content += drawText(pageWidth - margin - 58, footerTop + 24, `Page ${pageNumber} of ${pageCount}`, 8, '0.55 0.55 0.52');
  return content;
}

function drawRowText(values: string[], top: number, isHeader: boolean) {
  let x = margin;
  let content = '';
  const fontSize = isHeader ? 7.5 : 8;
  const color = isHeader ? '0.30 0.30 0.28' : '0.12 0.12 0.12';
  columns.forEach((column, index) => {
    const value = truncateText(values[index] || '', column.width, fontSize);
    const textWidth = value.length * fontSize * 0.48;
    const textX = column.align === 'right' ? x + column.width - textWidth - 7 : x + 7;
    content += drawText(Math.max(x + 3, textX), top + 14, value, fontSize, color);
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
  for (let index = 1; index <= objectBodies.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objectBodies.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

function chunkRows(rows: SalaryReportRow[]) {
  if (rows.length === 0) return [[]];
  const chunks: SalaryReportRow[][] = [];
  for (let index = 0; index < rows.length; index += rowsPerPage) chunks.push(rows.slice(index, index + rowsPerPage));
  return chunks;
}

function drawText(x: number, top: number, text: string, size: number, color: string) {
  return `BT /F1 ${size} Tf ${color} rg ${formatNumber(x)} ${formatNumber(pageHeight - top)} Td (${escapePdfText(text)}) Tj ET\n`;
}

function drawRect(x: number, top: number, width: number, height: number, fill: string) {
  return `${fill} rg ${formatNumber(x)} ${formatNumber(pageHeight - top - height)} ${formatNumber(width)} ${formatNumber(height)} re f\n`;
}

function drawLine(x1: number, top1: number, x2: number, top2: number, color: string) {
  return `0.6 w ${color} RG ${formatNumber(x1)} ${formatNumber(pageHeight - top1)} m ${formatNumber(x2)} ${formatNumber(pageHeight - top2)} l S\n`;
}

function truncateText(value: string, width: number, fontSize: number) {
  const text = sanitizeText(value);
  const maxLength = Math.max(3, Math.floor((width - 10) / (fontSize * 0.48)));
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}...`;
}

function escapePdfText(value: string) {
  return sanitizeText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function sanitizeText(value: string) {
  return String(value || '').normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
}

function money(value: number) {
  return `MVR ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatNumber(value: number) {
  return Number(value.toFixed(2)).toString();
}

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
