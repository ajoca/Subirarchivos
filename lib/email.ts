import { Resend } from 'resend';
import type { NormalizedRecord } from '@/lib/types';

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

export async function sendAlertEmail(to: string, records: NormalizedRecord[], uploadedFileName: string) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.MAIL_FROM;

  if (!from) {
    throw new Error('Falta MAIL_FROM en las variables de entorno.');
  }

  const urgent = records.filter((record) => record.status !== 'OK');

  const subject = urgent.some((record) => record.status === 'VENCIDO')
    ? `Alerta de vencimientos: hay items vencidos en ${uploadedFileName}`
    : `Alerta de vencimientos: items por vencer en ${uploadedFileName}`;

  const result = await resend.emails.send({
    from,
    to,
    subject,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:900px;margin:0 auto;padding:24px;color:#111827;">
        <h1 style="margin:0 0 12px;">Alerta de vencimientos</h1>
        <p style="margin:0 0 18px;line-height:1.6;">Se encontraron <strong>${urgent.length}</strong> items vencidos o por vencer en el archivo <strong>${uploadedFileName}</strong>.</p>
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
            ${buildRows(urgent)}
          </tbody>
        </table>
      </div>
    `,
  });

  if (result.error) {
    throw new Error(`Resend rechazo el envio: ${result.error.message}`);
  }

  return result;
}
