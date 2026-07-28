import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';

interface AgreementEmployee {
  id: number; name: string; salary: number; id_number: string | null; join_date: string | null;
  medium: string | null; job_level: string | null; site_name: string | null; work_permit_number: string | null;
  nationality: string | null; current_address: string | null; job_title: string | null; job_description: string | null;
  employment_status: string | null; fixed_term_end: string | null; probation_applicable: boolean; probation_months: number | null;
  hours_per_day: number | null; hours_per_week: number | null; allowances_benefits: string | null;
  accommodation_provided: boolean; meals_provided: boolean; transport_provided: boolean; return_airfare_provided: boolean;
  benefit_details: string | null; notice_period: string | null; employer_signatory: string | null;
}

interface AgreementSection {
  heading?: string;
  text?: string;
  details?: Array<[string, string]>;
}

const employer = 'CLOVE CAFE & BISTRO (ST00060328)';
const employerAddress = 'SUNNY BEEM, ORCHID MAGU, S. Maradhoo, Maldives';
const pageWidth = 595;
const pageHeight = 842;
const margin = 46;
const contentWidth = pageWidth - margin * 2;
const footerY = 808;
const defaultDescriptions: Record<string, string> = {
  Waiter: 'Welcome guests, take orders, serve food and beverages, and keep the dining area clean and ready for service.',
  'Assistant, kitchen': 'Support food preparation, ingredient handling, storage, cleaning, and kitchen hygiene under the cook\'s direction.',
  'Steward, kitchen': 'Clean and sanitize kitchen areas, equipment and utensils, manage waste, and maintain hygiene standards.',
  Cook: 'Prepare and cook menu items, control portions and quality, store food safely, and maintain kitchen hygiene.',
  'Washer, hand: dishes': 'Wash, sanitize, dry and organize dishes, cookware and utensils, and keep the washing area clean.',
  'Maker, pastry': 'Prepare, bake and finish pastries and desserts while maintaining quality, stock control and food safety.',
  'Cleaner, restaurant': 'Clean and sanitize dining, service and common areas and maintain a safe, tidy restaurant environment.',
  'Hand, kitchen': 'Assist cooks with basic preparation, stock movement, cleaning and other routine kitchen support duties.',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const employeeId = Number(Array.isArray(req.query.employee_id) ? req.query.employee_id[0] : req.query.employee_id);
  if (!Number.isInteger(employeeId) || employeeId <= 0) return res.status(400).json({ error: 'Employee is required' });
  try {
    await query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_description TEXT');
    const result = await query(`SELECT e.*, e.salary::float AS salary,
      to_char(e.join_date, 'YYYY-MM-DD') AS join_date, to_char(e.fixed_term_end, 'YYYY-MM-DD') AS fixed_term_end,
      e.hours_per_day::float AS hours_per_day, e.hours_per_week::float AS hours_per_week, s.name AS site_name
      FROM employees e LEFT JOIN sites s ON s.id = e.site_id WHERE e.id = $1`, [employeeId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Employee not found' });
    const employee = result.rows[0] as AgreementEmployee;
    const pdf = createAgreementPdf(employee);
    const safeName = sanitize(employee.name).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || `employee-${employee.id}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Employment-Agreement-${safeName}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(pdf);
  } catch (error) {
    console.error('Agreement PDF error:', error);
    return res.status(500).json({ error: 'Could not generate employment agreement' });
  }
}

export function createAgreementPdf(employee: AgreementEmployee) {
  const title = value(employee.job_title || jobLevelLabel(employee.job_level));
  const description = value(employee.job_description || defaultDescriptions[employee.job_title || ''], 'Duties will be assigned according to the employee position.');
  const employmentTerm = employee.employment_status === 'fixed_term' ? `[X] Fixed-term ending on ${value(employee.fixed_term_end)}` : '[X] Indefinite/permanent';
  const probation = employee.probation_applicable ? `[X] Probation applicable for ${value(employee.probation_months)} month(s)` : '[X] Probation not applicable';
  const payment = employee.medium === 'account transfer' ? '[X] Bank transfer' : employee.medium === 'cash' ? '[X] Cash' : `[X] ${value(employee.medium, 'Other')}`;
  const benefits = [
    `[X] Accommodation ${employee.accommodation_provided ? 'provided' : 'not provided'}`,
    `[X] Meals ${employee.meals_provided ? 'provided' : 'not provided'}`,
    `[X] Local transport ${employee.transport_provided ? 'provided' : 'not provided'}`,
    `[X] Return airfare/repatriation ${employee.return_airfare_provided ? 'provided' : 'not provided'}`,
  ].join('; ');
  const sections: AgreementSection[] = [
    { text: `This Employment Agreement is made between ${employer}, of ${employerAddress} (the Employer), and ${value(employee.name)}, passport no. ${value(employee.id_number)}, work permit no. ${value(employee.work_permit_number)} (the Employee).` },
    {
      heading: 'EMPLOYEE DETAILS',
      details: [
        ['Employee name', value(employee.name)],
        ['Passport number', value(employee.id_number)],
        ['Work permit number', value(employee.work_permit_number)],
        ['Nationality', value(employee.nationality)],
        ['Current address', value(employee.current_address)],
        ['Job title', title],
        ['Place of employment', `${employee.site_name || employer}, ${employerAddress}`],
        ['Commencement date', value(employee.join_date)],
      ],
    },
    { heading: '1. APPOINTMENT AND DUTIES', text: `The Employer appoints the Employee as ${title}.\n\nShort job description: ${description}\n\nThe Employee shall comply with lawful and reasonable instructions, maintain hygiene and food-safety standards, protect the Employer's property and reputation, and carry out related duties reasonably assigned by the Employer.` },
    { heading: '2. EMPLOYMENT STATUS AND TERM', text: `${employmentTerm}. Any fixed term and renewal shall comply with the Employment Act of the Maldives. Continuous service commences on the date stated above.` },
    { heading: '3. PROBATION', text: `${probation}, not exceeding the maximum period permitted by Maldivian law.` },
    { heading: '4. WORKING HOURS, ROSTER AND BREAKS', text: `Normal working hours shall be ${value(employee.hours_per_day)} hours per day and ${value(employee.hours_per_week)} hours per week, according to a roster issued by the Employer. Statutory meal/rest breaks and weekly rest apply.` },
    { heading: '5. SALARY AND PAYMENT', text: `Basic salary: MVR ${money(employee.salary)} per month.${employee.allowances_benefits ? ` Allowances/benefits: ${value(employee.allowances_benefits)}.` : ''} Salary shall be paid monthly by ${payment}.` },
    { heading: '6. OVERTIME AND REST DAYS/PUBLIC HOLIDAYS', text: 'Overtime must be authorized in advance and shall be recorded and compensated at not less than the rate required by the Employment Act. Work on weekly rest days and public holidays shall be compensated or replaced with leave as required by law.' },
    { heading: '7. LEAVE', text: 'The Employee is entitled to statutory annual, sick, family responsibility, maternity/paternity and public-holiday leave under the Employment Act and amendments in force.' },
    { heading: '8. ACCOMMODATION, MEALS, TRANSPORT AND PERMITS', text: `${benefits}.${employee.benefit_details ? ` Details: ${value(employee.benefit_details)}.` : ''}` },
    { heading: '9. CONDUCT, SAFETY AND CONFIDENTIALITY', text: 'The Employee shall follow workplace rules, safety instructions, anti-harassment requirements, cash-control procedures, customer-service standards and food hygiene rules. Confidential business and personnel information shall not be disclosed except as required for work or by law.' },
    { heading: '10. DISCIPLINE AND GRIEVANCES', text: 'Disciplinary action shall be based on reasonable cause and fair procedure. The Employee may raise a grievance without retaliation and may use any statutory complaint or tribunal process.' },
    { heading: '11. TERMINATION AND NOTICE', text: `After probation, either party may terminate this Agreement by written notice, or payment in lieu where lawful, using at least the statutory notice period or any longer period written here: ${value(employee.notice_period, 'As required by law')}.` },
    { heading: '12. GOVERNING LAW AND ENTIRE AGREEMENT', text: 'This Agreement is governed by the laws of the Republic of Maldives, including the Employment Act and applicable regulations. Any less favorable term shall be replaced by the applicable mandatory statutory right. Changes must be in writing and signed by both parties.' },
    { heading: 'SIGNATURES', text: `For the Employer\nName: ${value(employee.employer_signatory)}\n\nSignature: ______________________________    Date: _______________\n\nEmployee\nName: ${value(employee.name)}\n\nSignature: ______________________________    Date: _______________` },
  ];
  return renderDocument(sections);
}

function renderDocument(sections: AgreementSection[]) {
  const pages: string[] = [];
  let content = '';
  let y = 44;
  const newPage = () => {
    if (content) pages.push(content);
    content = drawText(margin, 38, employer, 10, true);
    content += drawText(margin, 52, employerAddress, 8.5, false, '0.35 0.35 0.35');
    content += drawLine(margin, 62, pageWidth - margin, 62, '0.82 0.82 0.82');
    y = 78;
  };
  const ensureSpace = (height: number) => { if (y + height > footerY - 34) newPage(); };
  const addWrapped = (text: string, fontSize: number, bold = false, gapAfter = 8) => {
    for (const paragraph of text.split('\n')) {
      if (!paragraph) { y += fontSize * 0.75; continue; }
      for (const line of wrapText(paragraph, fontSize, contentWidth)) {
        ensureSpace(fontSize + 4); content += drawText(margin, y, line, fontSize, bold); y += fontSize + 3;
      }
    }
    y += gapAfter;
  };
  const addDetailsTable = (rows: Array<[string, string]>) => {
    const labelWidth = 132;
    const fontSize = 9;
    const lineHeight = 12;
    const padding = 6;
    const preparedRows = rows.map(([label, detail]) => ({
      label: wrapText(label, fontSize, labelWidth - padding * 2),
      detail: wrapText(detail, fontSize, contentWidth - labelWidth - padding * 2),
    }));
    const rowHeights = preparedRows.map((row) => Math.max(row.label.length, row.detail.length) * lineHeight + padding * 2);
    const tableHeight = rowHeights.reduce((sum, height) => sum + height, 0);
    ensureSpace(tableHeight + 10);
    const tableTop = y;
    let rowTop = tableTop;
    preparedRows.forEach((row, index) => {
      row.label.forEach((line, lineIndex) => { content += drawText(margin + padding, rowTop + padding + fontSize + lineIndex * lineHeight, line, fontSize, true); });
      row.detail.forEach((line, lineIndex) => { content += drawText(margin + labelWidth + padding, rowTop + padding + fontSize + lineIndex * lineHeight, line, fontSize); });
      rowTop += rowHeights[index];
      content += drawLine(margin, rowTop, pageWidth - margin, rowTop, '0.72 0.72 0.72');
    });
    content += drawLine(margin, tableTop, pageWidth - margin, tableTop, '0.72 0.72 0.72');
    content += drawLine(margin, tableTop, margin, rowTop, '0.72 0.72 0.72');
    content += drawLine(margin + labelWidth, tableTop, margin + labelWidth, rowTop, '0.72 0.72 0.72');
    content += drawLine(pageWidth - margin, tableTop, pageWidth - margin, rowTop, '0.72 0.72 0.72');
    y = rowTop + 12;
  };
  newPage();
  content += drawCentered('EMPLOYMENT AGREEMENT', 82, 17, true);
  y = 108;
  sections.forEach((section) => {
    if (section.heading) { ensureSpace(34); addWrapped(section.heading, 10.5, true, 4); }
    if (section.details) addDetailsTable(section.details);
    if (section.text) addWrapped(section.text, 9.5, false, 10);
  });
  pages.push(content);
  return buildPdf(pages.map((page, index) => page + drawLine(margin, footerY - 10, pageWidth - margin, footerY - 10, '0.84 0.84 0.84')
    + drawText(margin, footerY + 4, 'Clove Cafe & Bistro - Employment Agreement', 8, false, '0.40 0.40 0.40')
    + drawText(pageWidth - margin - 55, footerY + 4, `Page ${index + 1} of ${pages.length}`, 8, false, '0.40 0.40 0.40')));
}

function buildPdf(pageContents: string[]) {
  const objects: string[] = [];
  const pageRefs = pageContents.map((_, index) => `${5 + index * 2} 0 R`).join(' ');
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>'; objects[1] = `<< /Type /Pages /Kids [${pageRefs}] /Count ${pageContents.length} >>`;
  objects[2] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'; objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  pageContents.forEach((content, index) => { const pageObject = 5 + index * 2; const contentObject = pageObject + 1;
    objects[pageObject - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`;
    objects[contentObject - 1] = `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`; });
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((body, index) => { offsets[index + 1] = Buffer.byteLength(pdf, 'latin1'); pdf += `${index + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, 'latin1'); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; return Buffer.from(pdf, 'latin1');
}

function drawText(x: number, top: number, text: string, size: number, bold = false, color = '0.08 0.08 0.08') { return `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color} rg ${num(x)} ${num(pageHeight - top)} Td (${escapePdf(text)}) Tj ET\n`; }
function drawCentered(text: string, top: number, size: number, bold = false) { return drawText(Math.max(margin, (pageWidth - sanitize(text).length * size * 0.52) / 2), top, text, size, bold); }
function drawLine(x1: number, top1: number, x2: number, top2: number, color: string) { return `0.6 w ${color} RG ${num(x1)} ${num(pageHeight - top1)} m ${num(x2)} ${num(pageHeight - top2)} l S\n`; }
function wrapText(text: string, fontSize: number, width: number) { const maxChars = Math.max(20, Math.floor(width / (fontSize * 0.5))); const lines: string[] = []; let line = ''; sanitize(text).split(' ').forEach((word) => { const candidate = line ? `${line} ${word}` : word; if (candidate.length > maxChars && line) { lines.push(line); line = word; } else line = candidate; }); if (line) lines.push(line); return lines; }
function value(input: unknown, fallback = '____________________________') { return sanitize(String(input || fallback)); }
function money(input: number) { return Number(input || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function sanitize(input: string) { return String(input || '').normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim(); }
function escapePdf(input: string) { return sanitize(input).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
function num(input: number) { return Number(input.toFixed(2)).toString(); }
function jobLevelLabel(level: string | null) { return ({ labour: 'Labour', mason: 'Mason', carpenter: 'Carpenter', supervisor: 'Supervisor' } as Record<string, string>)[level || ''] || 'Employee'; }
