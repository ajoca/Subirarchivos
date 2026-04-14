import { createHash } from 'crypto';
import type { NormalizedRecord } from '@/lib/types';

type FingerprintInput = {
  uploadedFileName: string;
  defaultRecipient: string;
  daysBeforeAlert: number;
  records: NormalizedRecord[];
};

export function buildPayloadFingerprint(input: FingerprintInput): string {
  // No incluir "id" porque cambia en cada carga aunque el contenido sea igual.
  const normalizedRecords = [...input.records]
    .map((record) => ({
      sourceSheet: record.sourceSheet,
      personName: record.personName,
      email: record.email ?? null,
      expiresAt: record.expiresAt,
      daysLeft: record.daysLeft,
      status: record.status,
      rawRow: record.rawRow,
    }))
    .sort((a, b) => {
      const keyA = `${a.sourceSheet}|${a.personName}|${a.expiresAt}`;
      const keyB = `${b.sourceSheet}|${b.personName}|${b.expiresAt}`;
      return keyA.localeCompare(keyB);
    });

  const payloadForHash = {
    uploadedFileName: input.uploadedFileName,
    defaultRecipient: input.defaultRecipient,
    daysBeforeAlert: input.daysBeforeAlert,
    records: normalizedRecords,
  };

  return createHash('sha256').update(JSON.stringify(payloadForHash)).digest('hex');
}
