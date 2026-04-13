import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import type { NormalizedRecord } from '@/lib/types';

type EmailSendResult = {
  data: {
    id: string | null;
  };
};

function buildRows(records: NormalizedRecord[]) {
  return records
    .map((record) => {
      const badge =
        record.status === 'VENCIDO'
          ? 'VENCIDO'
          : record.status === 'VENCE_PRONTO'
            ? `VENCE EN ${record.daysLeft} DÍAS`
            : 'OK';

      return `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${record.personName}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${record.sourceSheet}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${new Date(record.expiresAt).toLocaleDateString('es-UY')}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${record.daysLeft}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${badge}</td>
        </tr>
      `;
    })
    .join('');
}

function buildSubject(records: NormalizedRecord[], uploadedFileName: string): string {
  return records.some((record) => record.status === 'VENCIDO')
    ? `Alerta de vencimientos: hay items vencidos en ${uploadedFileName}`
    : `Alerta de vencimientos: items por vencer en ${uploadedFileName}`;
}

function buildHtml(records: NormalizedRecord[], uploadedFileName: string): string {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:900px;margin:0 auto;padding:24px;color:#111827;">
      <h1 style="margin:0 0 12px;">Alerta de vencimientos</h1>
      <p style="margin:0 0 18px;line-height:1.6;">Se encontraron <strong>${records.length}</strong> items vencidos o por vencer en el archivo <strong>${uploadedFileName}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e7eb;">Persona</th>
            <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e7eb;">Hoja</th>
            <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e7eb;">Vence</th>
            <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e7eb;">Días</th>
            <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e7eb;">Estado</th>
          </tr>
        </thead>
        <tbody>
          ${buildRows(records)}
        </tbody>
      </table>
    </div>
  `;
}

async function sendWithSmtp(from: string, to: string, records: NormalizedRecord[], uploadedFileName: string): Promise<EmailSendResult> {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    throw new Error('Faltan SMTP_USER o SMTP_PASS para enviar por SMTP.');
  }

  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  const smtpSecure = String(process.env.SMTP_SECURE || smtpPort === 465).toLowerCase() === 'true';

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const info = await transporter.sendMail({
    from,
    to,
    subject: buildSubject(records, uploadedFileName),
    html: buildHtml(records, uploadedFileName),
  });

  return {
    data: {
      id: info.messageId ?? null,
    },
  };
}

async function sendWithResend(from: string, to: string, records: NormalizedRecord[], uploadedFileName: string): Promise<EmailSendResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    throw new Error('Falta RESEND_API_KEY en las variables de entorno.');
  }

  const resend = new Resend(resendApiKey);
  const result = await resend.emails.send({
    from,
    to,
    subject: buildSubject(records, uploadedFileName),
    html: buildHtml(records, uploadedFileName),
  });

  if (result.error) {
    throw new Error(`Resend rechazo el envio: ${result.error.message}`);
  }

  return {
    data: {
      id: result.data?.id ?? null,
    },
  };
}

export async function sendAlertEmail(to: string, records: NormalizedRecord[], uploadedFileName: string): Promise<EmailSendResult> {
  const from = process.env.MAIL_FROM;

  if (!from) {
    throw new Error('Falta MAIL_FROM en las variables de entorno.');
  }

  const urgent = records.filter((record) => record.status !== 'OK');

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return sendWithSmtp(from, to, urgent, uploadedFileName);
  }

  return sendWithResend(from, to, urgent, uploadedFileName);
}
