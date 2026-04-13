import { NextResponse } from 'next/server';
import { loadPayload } from '@/lib/storage';

export const runtime = 'nodejs';

export async function GET() {
  const payload = await loadPayload();
  if (!payload) {
    return NextResponse.json({ ok: true, payload: null });
  }

  return NextResponse.json({
    ok: true,
    payload: {
      uploadedAt: payload.uploadedAt,
      uploadedFileName: payload.uploadedFileName,
      defaultRecipient: payload.defaultRecipient,
      daysBeforeAlert: payload.daysBeforeAlert,
      totalRecords: payload.records.length,
      urgentCount: payload.records.filter((record) => record.status !== 'OK').length,
      preview: payload.records.slice(0, 50),
    },
  });
}
