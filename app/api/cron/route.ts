import { NextResponse } from 'next/server';
import { loadPayload, savePayload } from '@/lib/storage';
import { sendAlertEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  const authHeader = request.headers.get('authorization');
  const bearer = authHeader?.replace('Bearer ', '').trim();
  const querySecret = new URL(request.url).searchParams.get('secret');

  return bearer === cronSecret || querySecret === cronSecret;
}

/**
 * @param force - true = envía siempre (botón manual). false = respeta intervalo de 15 días (cron automático).
 */
async function runJob(force: boolean) {
  try {
    const payload = await loadPayload();
    if (!payload) {
      return NextResponse.json({ ok: true, message: 'No hay archivo cargado todavía.' });
    }

    const intervalDays = payload.emailIntervalDays ?? 15;

    // Si no es forzado, verificar si ya pasaron los días del intervalo
    if (!force && payload.lastEmailSentAt) {
      const daysSinceLast = Math.floor(
        (Date.now() - new Date(payload.lastEmailSentAt).getTime()) / 86_400_000,
      );
      if (daysSinceLast < intervalDays) {
        const daysUntilNext = intervalDays - daysSinceLast;
        return NextResponse.json({
          ok: true,
          skipped: true,
          message: `Envío omitido. Último envío: ${new Date(payload.lastEmailSentAt).toLocaleDateString('es-UY')}. Próximo envío automático en ${daysUntilNext} día(s).`,
        });
      }
    }

    const urgent = payload.records.filter((record) => record.status !== 'OK');
    if (urgent.length === 0) {
      return NextResponse.json({ ok: true, message: 'No hay vencimientos para reportar hoy.' });
    }

    const result = await sendAlertEmail(payload.defaultRecipient, urgent, payload.uploadedFileName);

    // Guardar timestamp del envío en el payload almacenado
    await savePayload({ ...payload, lastEmailSentAt: new Date().toISOString() });

    return NextResponse.json({
      ok: true,
      message: `Se envió la alerta a ${payload.defaultRecipient}.`,
      emailId: result.data?.id ?? null,
      recipient: payload.defaultRecipient,
      urgentCount: urgent.length,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error inesperado al ejecutar el cron.' },
      { status: 500 },
    );
  }
}

/** Cron automático de Vercel: respeta el intervalo de días */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  return runJob(false);
}

/** Botón manual "Probar alerta ahora": siempre envía */
export async function POST() {
  return runJob(true);
}
