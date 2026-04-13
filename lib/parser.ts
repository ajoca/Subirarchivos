import * as XLSX from 'xlsx';
import { randomUUID } from 'crypto';
import type { NormalizedRecord } from '@/lib/types';

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function excelDateToJsDate(value: number): Date {
  const utcDays = Math.floor(value - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  const fractionalDay = value - Math.floor(value) + 0.0000001;
  let totalSeconds = Math.floor(86400 * fractionalDay);
  const seconds = totalSeconds % 60;
  totalSeconds -= seconds;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  return new Date(Date.UTC(dateInfo.getUTCFullYear(), dateInfo.getUTCMonth(), dateInfo.getUTCDate(), hours, minutes, seconds));
}

function toStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function tryParseDate(value: unknown): Date | null {
  if (value == null || value === '') return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toStartOfDay(value);
  }

  if (typeof value === 'number' && Number.isFinite(value) && value > 20000 && value < 60000) {
    return toStartOfDay(excelDateToJsDate(value));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if (ddmmyyyy) {
      const day = Number(ddmmyyyy[1]);
      const month = Number(ddmmyyyy[2]) - 1;
      let year = Number(ddmmyyyy[3]);
      if (year < 100) year += 2000;
      const parsed = new Date(year, month, day);
      if (!Number.isNaN(parsed.getTime())) return toStartOfDay(parsed);
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return toStartOfDay(parsed);
  }

  return null;
}

function diffInDays(target: Date, today = new Date()): number {
  const ms = toStartOfDay(target).getTime() - toStartOfDay(today).getTime();
  return Math.round(ms / 86400000);
}

function extractBestName(row: unknown[]): string | null {
  const preferredIndexes = [1, 0, 2, 3];
  for (const index of preferredIndexes) {
    const value = row[index];
    if (typeof value === 'string' && value.trim().length >= 3 && !EMAIL_REGEX.test(value) && !tryParseDate(value)) {
      return value.trim();
    }
  }

  for (const value of row) {
    if (typeof value === 'string' && value.trim().length >= 3 && !EMAIL_REGEX.test(value) && !tryParseDate(value)) {
      return value.trim();
    }
  }

  return null;
}

function extractEmail(row: unknown[]): string | null {
  for (const value of row) {
    if (typeof value === 'string') {
      const match = value.match(EMAIL_REGEX);
      if (match) return match[0].trim().toLowerCase();
    }
  }
  return null;
}

function extractExpirationDate(row: unknown[]): Date | null {
  let best: Date | null = null;
  for (let i = row.length - 1; i >= 0; i -= 1) {
    const parsed = tryParseDate(row[i]);
    if (parsed) {
      best = parsed;
      break;
    }
  }
  return best;
}

function normalizeRow(sheetName: string, row: unknown[], alertThresholdDays: number): NormalizedRecord | null {
  const personName = extractBestName(row);
  const expiresAt = extractExpirationDate(row);
  if (!personName || !expiresAt) return null;

  const daysLeft = diffInDays(expiresAt);
  const status = daysLeft < 0 ? 'VENCIDO' : daysLeft <= alertThresholdDays ? 'VENCE_PRONTO' : 'OK';

  return {
    id: randomUUID(),
    sourceSheet: sheetName,
    personName,
    email: extractEmail(row),
    expiresAt: expiresAt.toISOString(),
    daysLeft,
    status,
    rawRow: row.map((cell) => (cell == null ? '' : String(cell))),
  };
}

export function parseWorkbook(buffer: Buffer, fileName: string, alertThresholdDays = 3): NormalizedRecord[] {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    raw: false,
  });

  const allRecords: NormalizedRecord[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      blankrows: false,
      defval: '',
      raw: false,
    });

    const dataRows = rows
      .map((row) => (Array.isArray(row) ? row : []))
      .filter((row, index) => index >= 5 && row.some((cell) => String(cell ?? '').trim() !== ''));

    for (const row of dataRows) {
      const normalized = normalizeRow(sheetName, row, alertThresholdDays);
      if (normalized) {
        allRecords.push(normalized);
      }
    }
  }

  const deduped = new Map<string, NormalizedRecord>();
  for (const record of allRecords) {
    const key = `${fileName}|${record.sourceSheet}|${record.personName}|${record.expiresAt}`;
    deduped.set(key, record);
  }

  return [...deduped.values()].sort((a, b) => a.daysLeft - b.daysLeft);
}
