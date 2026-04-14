import { NextResponse } from 'next/server';
import { loadPayload } from '@/lib/storage';

export const runtime = 'nodejs';

export async function GET() {
  const payload = await loadPayload();
  if (!payload) {
    return NextResponse.json({ ok: true, payload: null });
  }

  const intervalDays = payload.emailIntervalDays ?? 15;
  let daysUntilNextEmail: number | null = null;
  if (payload.lastEmailSentAt) {
    const daysSinceLast = Math.floor(
      (Date.now() - new Date(payload.lastEmailSentAt).getTime()) / 86_400_000,
    );
    daysUntilNextEmail = Math.max(0, intervalDays - daysSinceLast);
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
      lastEmailSentAt: payload.lastEmailSentAt ?? null,
      emailIntervalDays: intervalDays,
      daysUntilNextEmail,
    },
  });
}
