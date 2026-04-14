import { NextResponse } from 'next/server';
import { parseWorkbook } from '@/lib/parser';
import { loadPayload, savePayload } from '@/lib/storage';
import type { UploadPayload } from '@/lib/types';
import { buildPayloadFingerprint } from '@/lib/payloadFingerprint';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    const defaultRecipient = String(form.get('defaultRecipient') || '').trim().toLowerCase();
    const daysBeforeAlert = Number(form.get('daysBeforeAlert') || 3);

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 });
    }

    if (!defaultRecipient) {
      return NextResponse.json({ error: 'Tenés que indicar un mail de destino.' }, { status: 400 });
    }

    if (!EMAIL_REGEX.test(defaultRecipient)) {
      return NextResponse.json({ error: 'El mail de destino no tiene un formato válido.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const records = parseWorkbook(buffer, file.name, daysBeforeAlert);

    const previousPayload = await loadPayload();
    const intervalDays = previousPayload?.emailIntervalDays ?? 15;
    const contentFingerprint = buildPayloadFingerprint({
      uploadedFileName: file.name,
      defaultRecipient,
      daysBeforeAlert,
      records,
    });

    const sameRecipientAsPrevious = previousPayload?.defaultRecipient === defaultRecipient;
    const lastEmailSentAt = sameRecipientAsPrevious ? previousPayload?.lastEmailSentAt : undefined;
    const lastSentFingerprint = sameRecipientAsPrevious ? previousPayload?.lastSentFingerprint : undefined;
    const sameVersionAsLastSent = Boolean(lastSentFingerprint && lastSentFingerprint === contentFingerprint);

    let daysUntilNextEmail: number | null = null;
    if (lastEmailSentAt) {
      const daysSinceLast = Math.floor(
        (Date.now() - new Date(lastEmailSentAt).getTime()) / 86_400_000,
      );
      daysUntilNextEmail = Math.max(0, intervalDays - daysSinceLast);
    }

    const payload: UploadPayload = {
      uploadedAt: new Date().toISOString(),
      uploadedFileName: file.name,
      defaultRecipient,
      daysBeforeAlert,
      records,
      emailIntervalDays: intervalDays,
      lastEmailSentAt,
      contentFingerprint,
      lastSentFingerprint,
    };

    const blob = await savePayload(payload);

    return NextResponse.json({
      ok: true,
      blobUrl: blob.url,
      uploadedAt: payload.uploadedAt,
      uploadedFileName: payload.uploadedFileName,
      defaultRecipient: payload.defaultRecipient,
      daysBeforeAlert: payload.daysBeforeAlert,
      totalRecords: payload.records.length,
      urgentCount: payload.records.filter((record) => record.status !== 'OK').length,
      preview: payload.records.slice(0, 20),
      sameVersionAsLastSent,
      daysUntilNextEmail,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error inesperado al subir el archivo.' },
      { status: 500 },
    );
  }
}
