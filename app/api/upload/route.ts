import { NextResponse } from 'next/server';
import { parseWorkbook } from '@/lib/parser';
import { savePayload } from '@/lib/storage';
import type { UploadPayload } from '@/lib/types';

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

    const payload: UploadPayload = {
      uploadedAt: new Date().toISOString(),
      uploadedFileName: file.name,
      defaultRecipient,
      daysBeforeAlert,
      records,
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
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error inesperado al subir el archivo.' },
      { status: 500 },
    );
  }
}
