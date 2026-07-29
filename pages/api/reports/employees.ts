import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requestSiteId } from '../../../lib/request-auth';


interface EmployeeReportRow {
  id: number;
  name: string;
  id_number: string | null;
  birth_date: string | null;
  join_date: string | null;
  medium: string | null;
  site_name: string | null;
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
const tableTop = 98;
const footerTop = pageHeight - 48;
const tableBottom = footerTop - 18;
const rowsPerPage = Math.floor((tableBottom - tableTop - rowHeight) / rowHeight);


const columns: PdfColumn[] = [
  { label: '#', width: 28 },
  { label: 'Name', width: 210 },
  { label: 'ID', width: 100 },
  { label: 'Site', width: 178 },
  { label: 'Payment', width: 100 },
  { label: 'Join Date', width: 86 },
  { label: 'Birthdate', width: 68 },
];


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }


  try {
    const siteId = requestSiteId(req);
    const employeeIds = normalizeEmployeeIds(req.query.employee_ids);
    if (employeeIds.length > 250) return res.status(400).json({ error: 'A maximum of 250 employees can be downloaded together' });
    const whereClause = employeeIds.length > 0 ? 'WHERE ($1 = -1 OR e.site_id = $1) AND e.id = ANY($2::int[])' : 'WHERE ($1 = -1 OR e.site_id = $1)';
    const result = await query(`
      SELECT
        e.id,
        e.name,
        e.id_number,
        to_char(e.birth_date, 'YYYY-MM-DD') AS birth_date,
        to_char(e.join_date, 'YYYY-MM-DD') AS join_date,
        e.medium,
        s.name AS site_name
      FROM employees e
      LEFT JOIN sites s ON e.site_id = s.id
      ${whereClause}
      ORDER BY e.name ASC
    `, employeeIds.length > 0 ? [siteId, employeeIds] : [siteId]);


    const employees = result.rows as EmployeeReportRow[];
    const pdf = createEmployeeReportPdf(employees);
    const today = new Date().toISOString().slice(0, 10);


    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="CLOVE-new-employee-report-${today}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(pdf);
  } catch (error) {
    console.error('Employee report error:', error);
    return res.status(500).json({ error: 'Could not generate employee report' });
  }
}

function normalizeEmployeeIds(value: string | string[] | undefined) {
  const joined = Array.isArray(value) ? value.join(',') : value || '';
  return Array.from(new Set(joined.split(',').map(Number).filter((id) => Number.isInteger(id) && id > 0)));
}


function createEmployeeReportPdf(employees: EmployeeReportRow[]) {
  const generatedAt = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());


  const chunks = chunkRows(employees);
  const pageContents = chunks.map((rows, pageIndex) => renderPage(rows, employees.length, pageIndex + 1, chunks.length, generatedAt));


  return buildPdf(pageContents);
}


function renderPage(
  employees: EmployeeReportRow[],
  totalEmployees: number,
  pageNumber: number,
  pageCount: number,
  generatedAt: string
) {
  let content = '';


  content += drawText(margin, 48, 'CLOVE - NEW EMPLOYEE', 18, '0.12 0.12 0.12');
  content += drawText(margin, 68, `Generated ${generatedAt}`, 9, '0.42 0.42 0.40');
  content += drawText(margin, 82, `${totalEmployees} employees`, 9, '0.42 0.42 0.40');
  content += drawLine(margin, 90, pageWidth - margin, 90, '0.86 0.86 0.84');


  content += drawRect(margin, tableTop, tableWidth, rowHeight, '0.94 0.94 0.92');
  content += drawRowText(columns.map((column) => column.label), tableTop, true);


  if (employees.length === 0) {
    content += drawText(margin + 10, tableTop + rowHeight + 16, 'No employees found', 10, '0.42 0.42 0.40');
  } else {
    employees.forEach((employee, index) => {
      const top = tableTop + rowHeight + index * rowHeight;
      if (index % 2 === 1) {
        content += drawRect(margin, top, tableWidth, rowHeight, '0.98 0.98 0.97');
      }


      content += drawRowText([
        String(index + 1 + (pageNumber - 1) * rowsPerPage),
        employee.name,
        employee.id_number || 'Not set',
        employee.site_name || 'Unassigned',
        paymentLabel(employee.medium),
        formatReportDate(employee.join_date),
        formatReportDate(employee.birth_date),
      ], top, false);
      content += drawLine(margin, top + rowHeight, pageWidth - margin, top + rowHeight, '0.90 0.90 0.88');
    });
  }


  content += drawLine(margin, footerTop - 12, pageWidth - margin, footerTop - 12, '0.86 0.86 0.84');
  content += drawText(margin, footerTop, 'Clove Construction', 9, '0.22 0.22 0.20');
  content += drawText(margin, footerTop + 12, 'Blue light, Orchid Magu 19040, S. Feydhoo, Maldives', 8, '0.45 0.45 0.42');
  content += drawText(margin, footerTop + 24, 'Tel: +960 9992919', 8, '0.45 0.45 0.42');
  content += drawText(pageWidth - margin - 58, footerTop + 24, `Page ${pageNumber} of ${pageCount}`, 8, '0.55 0.55 0.52');


  return content;
}


function drawRowText(values: string[], top: number, isHeader: boolean) {
  let x = margin;
  let content = '';
  const fontSize = isHeader ? 8 : 8.5;
  const color = isHeader ? '0.30 0.30 0.28' : '0.12 0.12 0.12';


  columns.forEach((column, index) => {
    const value = truncateText(values[index] || '', column.width, fontSize);
    const textWidth = value.length * fontSize * 0.48;
    const textX = column.align === 'right'
      ? x + column.width - textWidth - 8
      : x + 8;


    content += drawText(Math.max(x + 4, textX), top + 14, value, fontSize, color);
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


function chunkRows(employees: EmployeeReportRow[]) {
  if (employees.length === 0) return [[]];


  const chunks: EmployeeReportRow[][] = [];
  for (let index = 0; index < employees.length; index += rowsPerPage) {
    chunks.push(employees.slice(index, index + rowsPerPage));
  }
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
  const maxLength = Math.max(3, Math.floor((width - 12) / (fontSize * 0.48)));
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}...`;
}


function escapePdfText(value: string) {
  return sanitizeText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}


function sanitizeText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}


function formatReportDate(value?: string | null) {
  if (!value) return 'Not set';
  const [datePart] = value.split('T');
  return datePart || 'Not set';
}


function paymentLabel(medium?: string | null) {
  return medium === 'account transfer' ? 'Bank transfer' : 'Cash';
}


function formatNumber(value: number) {
  return Number(value.toFixed(2)).toString();
}
