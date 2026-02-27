import { Router } from 'express';
import nodemailer from 'nodemailer';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, '../data/changes.json');

const ALLOWED_DAYS = [30, 180, 365];
const DEFAULT_DAYS = 30;

function parseDays(value) {
  const n = parseInt(value, 10);
  return ALLOWED_DAYS.includes(n) ? n : DEFAULT_DAYS;
}

function periodLabel(days) {
  if (days === 30) return '30 days';
  if (days === 180) return '6 months';
  if (days === 365) return '1 year';
  return `${days} days`;
}

function normalizeDatesForDemo(data) {
  if (!Array.isArray(data) || data.length === 0) return data;
  const now = new Date();
  const latest = new Date(Math.max(...data.map((c) => new Date(c.date).getTime())));
  const daysAgo = (now - latest) / (24 * 60 * 60 * 1000);
  if (daysAgo <= 400) return data;
  const shiftDays = Math.min(daysAgo - 7, 365);
  return data.map((c) => {
    const d = new Date(c.date);
    d.setDate(d.getDate() + shiftDays);
    return { ...c, date: d.toISOString().slice(0, 10) };
  });
}

function buildHtml(changes, periodLabelText) {
  const title = periodLabelText || 'Regulation Changes';
  const rows = changes
    .map(
      (c) => `
    <tr>
      <td><strong>${c.framework}</strong></td>
      <td>${c.date}</td>
      <td>${c.category}</td>
    </tr>
    <tr>
      <td colspan="3"><strong>${c.title}</strong></td>
    </tr>
    <tr>
      <td colspan="3">${c.fullText.replace(/\n/g, '<br>')}</td>
    </tr>
    <tr><td colspan="3" style="height:16px"></td></tr>
  `
    )
    .join('');
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Regulation Changes</title></head>
<body style="font-family: sans-serif; max-width: 700px; margin: 0 auto;">
  <h1>${title}</h1>
  <p>Please find below the requested regulatory/framework changes.</p>
  <table style="width:100%; border-collapse: collapse;">
    ${rows}
  </table>
  <p style="color:#666; font-size:12px;">Sent from GRC Dashboard.</p>
</body>
</html>
  `;
}

export const emailRouter = Router();

emailRouter.post('/', async (req, res) => {
  try {
    const { to, ids, framework, days: daysParam } = req.body || {};
    if (!to || typeof to !== 'string' || !to.includes('@')) {
      return res.status(400).json({ error: 'Valid email address (to) is required' });
    }

    const days = parseDays(daysParam);
    const raw = await readFile(dataPath, 'utf-8');
    const all = normalizeDatesForDemo(JSON.parse(raw));
    let changes = all;

    if (ids && Array.isArray(ids) && ids.length > 0) {
      changes = all.filter((c) => ids.includes(c.id));
    } else if (framework) {
      changes = all.filter((c) => c.framework === framework);
    }

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    changes = changes.filter((c) => new Date(c.date) >= fromDate);

    const periodLabelText = `Regulation Changes (last ${periodLabel(days)})`;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Regulation Dashboard" <noreply@example.com>',
      to,
      subject: `Regulation Changes – Last ${periodLabel(days)}`,
      html: buildHtml(changes, periodLabelText),
    });

    res.json({ success: true, message: 'Email sent successfully' });
  } catch (e) {
    console.error('Email error:', e);
    res.status(500).json({ error: 'Failed to send email. Check server SMTP configuration.' });
  }
});
