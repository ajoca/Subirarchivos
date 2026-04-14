import { NextResponse } from 'next/server';
import { loadPayload, savePayload } from '@/lib/storage';
import { sendAlertEmail } from '@/lib/email';
import { buildPayloadFingerprint } from '@/lib/payloadFingerprint';

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
 * @param force true: permitir envío anticipado solo si el contenido cambió.
 */
async function runJob(force: boolean) {
  try {
    const payload = await loadPayload();
    if (!payload) {
      return NextResponse.json({ ok: true, message: 'No hay archivo cargado todavía.' });
    }

    const intervalDays = payload.emailIntervalDays ?? 15;
    const currentFingerprint =
      payload.contentFingerprint ??
      buildPayloadFingerprint({
        uploadedFileName: payload.uploadedFileName,
        defaultRecipient: payload.defaultRecipient,
        daysBeforeAlert: payload.daysBeforeAlert,
        records: payload.records,
      });
    const sameVersionAsLastSent = Boolean(
      payload.lastSentFingerprint && payload.lastSentFingerprint === currentFingerprint,
    );

    let forcedEarly = false;

    if (payload.lastEmailSentAt) {
      const daysSinceLast = Math.floor(
        (Date.now() - new Date(payload.lastEmailSentAt).getTime()) / 86_400_000,
      );

      if (daysSinceLast < intervalDays) {
        const daysUntilNext = intervalDays - daysSinceLast;

        // Nunca reenviar la misma version antes del intervalo.
        if (sameVersionAsLastSent) {
          return NextResponse.json({
            ok: true,
            skipped: true,
            message: `Envío omitido. Ya se envió esta misma versión hace ${daysSinceLast} día(s). Próximo envío automático en ${daysUntilNext} día(s).`,
          });
        }

        // Si el contenido cambió, solo permitir anticipar cuando se fuerza explícitamente.
        if (!force) {
          return NextResponse.json({
            ok: true,
            skipped: true,
            message: `Envío omitido por política de ${intervalDays} días. Si el archivo cambió, podés forzar el envío de la nueva versión. Faltan ${daysUntilNext} día(s).`,
          });
        }

        forcedEarly = true;
      }
    }

    const urgent = payload.records.filter((record) => record.status !== 'OK');
    if (urgent.length === 0) {
      return NextResponse.json({ ok: true, message: 'No hay vencimientos para reportar hoy.' });
    }

    const result = await sendAlertEmail(payload.defaultRecipient, urgent, payload.uploadedFileName);

    // Guardar timestamp del envío en el payload almacenado
    await savePayload({
      ...payload,
      lastEmailSentAt: new Date().toISOString(),
      emailIntervalDays: intervalDays,
      contentFingerprint: currentFingerprint,
      lastSentFingerprint: currentFingerprint,
    });

    return NextResponse.json({
      ok: true,
      message: forcedEarly
        ? `Se envió la nueva versión a ${payload.defaultRecipient} antes del intervalo de ${intervalDays} días porque se forzó manualmente.`
        : `Se envió la alerta a ${payload.defaultRecipient}.`,
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

/** POST manual: por defecto respeta intervalo. force=true solo si cambió el contenido. */
export async function POST(request: Request) {
  let force = false;
  try {
    const body = await request.json();
    force = Boolean(body?.force);
  } catch {
    force = false;
  }

  return runJob(force);
}
