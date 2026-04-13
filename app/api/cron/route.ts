import { NextResponse } from 'next/server';
import { loadPayload } from '@/lib/storage';
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

async function runJob() {
  try {
    const payload = await loadPayload();
    if (!payload) {
      return NextResponse.json({ ok: true, message: 'No hay archivo cargado todavía.' });
    }

    const urgent = payload.records.filter((record) => record.status !== 'OK');
    if (urgent.length === 0) {
      return NextResponse.json({ ok: true, message: 'No hay vencimientos para reportar hoy.' });
    }

    const result = await sendAlertEmail(payload.defaultRecipient, urgent, payload.uploadedFileName);

    return NextResponse.json({
      ok: true,
      message: `Se envió la alerta a ${payload.defaultRecipient}.`,
      emailId: result.data?.id ?? null,
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


export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  return runJob();
}

export async function POST() {
  return runJob();
}
