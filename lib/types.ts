export type NormalizedRecord = {
  id: string;
  sourceSheet: string;
  personName: string;
  email?: string | null;
  expiresAt: string;
  daysLeft: number;
  status: 'OK' | 'VENCE_PRONTO' | 'VENCIDO';
  rawRow: string[];
};

export type UploadPayload = {
  uploadedAt: string;
  uploadedFileName: string;
  defaultRecipient: string;
  daysBeforeAlert: number;
  records: NormalizedRecord[];
  /** ISO timestamp del último envío de alerta por correo */
  lastEmailSentAt?: string;
  /** Intervalo mínimo en días entre envíos automáticos (default 15) */
  emailIntervalDays?: number;
  /** Hash del contenido actual cargado (archivo + destinatario + registros normalizados) */
  contentFingerprint?: string;
  /** Hash del contenido que ya fue enviado por última vez */
  lastSentFingerprint?: string;
};
