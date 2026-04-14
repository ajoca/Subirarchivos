'use client';

import { useEffect, useMemo, useState } from 'react';

type PreviewRecord = {
  id: string;
  sourceSheet: string;
  personName: string;
  email?: string | null;
  expiresAt: string;
  daysLeft: number;
  status: 'OK' | 'VENCE_PRONTO' | 'VENCIDO';
};

type PreviewPayload = {
  uploadedAt: string;
  uploadedFileName: string;
  defaultRecipient: string;
  daysBeforeAlert: number;
  totalRecords: number;
  urgentCount: number;
  preview: PreviewRecord[];
  lastEmailSentAt: string | null;
  emailIntervalDays: number;
  daysUntilNextEmail: number | null;
};

function statusClass(status: PreviewRecord['status']) {
  if (status === 'VENCIDO') return 'status danger';
  if (status === 'VENCE_PRONTO') return 'status warn';
  return 'status ok';
}

function statusText(record: PreviewRecord) {
  if (record.status === 'VENCIDO') return 'VENCIDO';
  if (record.status === 'VENCE_PRONTO') return `VENCE EN ${record.daysLeft} DÍAS`;
  return 'OK';
}

export function UploadDashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [defaultRecipient, setDefaultRecipient] = useState('');
  const [daysBeforeAlert, setDaysBeforeAlert] = useState(3);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<PreviewPayload | null>(null);
  const [sameFileWarning, setSameFileWarning] = useState(false);

  async function loadCurrentPreview() {
    const response = await fetch('/api/preview', { cache: 'no-store' });
    const data = await response.json();
    setPayload(data.payload ?? null);
  }

  useEffect(() => {
    void loadCurrentPreview();
  }, []);

  const urgentPreview = useMemo(
    () => (payload?.preview ?? []).filter((record) => record.status !== 'OK'),
    [payload],
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      if (!file) throw new Error('Seleccioná un archivo primero.');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('defaultRecipient', defaultRecipient);
      formData.append('daysBeforeAlert', String(daysBeforeAlert));

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo subir el archivo.');
      }

      setMessage(`Archivo cargado. Se detectaron ${data.totalRecords} registros y ${data.urgentCount} alertas.`);
      if (data.sameVersionAsLastSent && (data.daysUntilNextEmail ?? 0) > 0) {
        setSameFileWarning(true);
      } else {
        setSameFileWarning(false);
      }
      await loadCurrentPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setLoading(false);
    }
  }

  async function runCronNow(force = false) {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch('/api/cron', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ force }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo ejecutar la alerta manual.');
      setMessage(data.message || 'Alerta ejecutada correctamente.');
      await loadCurrentPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <section className="hero">
        <span className="badge">Next.js + Vercel Blob + Resend</span>
        <h1 className="title">Alerta de vencimientos</h1>
        <p className="subtitle">
          Subí tu Excel, elegí a qué correo querés avisar y la app te manda alertas automáticas
          cuando algo vence o está a punto de vencer.
        </p>
      </section>

      <div className="grid">
        <section className="card">
          <h2>Subir archivo</h2>
          <form className="stack" onSubmit={onSubmit}>
            <div>
              <label className="label">Archivo Excel o CSV</label>
              <input
                className="file"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null;
                  setFile(selected);
                  // Avisar si el archivo ya fue enviado hace menos de emailIntervalDays días
                  if (
                    selected &&
                    payload?.lastEmailSentAt &&
                    payload.uploadedFileName === selected.name &&
                    (payload.daysUntilNextEmail ?? 0) > 0
                  ) {
                    setSameFileWarning(true);
                  } else {
                    setSameFileWarning(false);
                  }
                }}
              />
            </div>

            <div className="row">
              <div>
                <label className="label">Mail que recibe la alerta</label>
                <input
                  className="input"
                  type="email"
                  placeholder="alertas@empresa.com"
                  value={defaultRecipient}
                  onChange={(event) => setDefaultRecipient(event.target.value)}
                />
              </div>

              <div>
                <label className="label">Avisar con cuántos días</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={30}
                  value={daysBeforeAlert}
                  onChange={(event) => setDaysBeforeAlert(Number(event.target.value || 0))}
                />
              </div>
            </div>

            <button className="button" type="submit" disabled={loading}>
              {loading ? 'Procesando...' : 'Subir y guardar'}
            </button>
          </form>

          {sameFileWarning && payload?.lastEmailSentAt ? (
            <div className="warning-banner">
              <p className="warning-text">
                <strong>Este archivo ya fue enviado</strong> el{' '}
                {new Date(payload.lastEmailSentAt).toLocaleDateString('es-UY')} a{' '}
                <strong>{payload.defaultRecipient}</strong>. El próximo envío automático es en{' '}
                <strong>{payload.daysUntilNextEmail} día(s)</strong>.
              </p>
              <p className="warning-text" style={{ marginTop: 4 }}>
                ¿El archivo sufrió cambios y querés enviar la nueva versión ahora?
              </p>
              <div className="warning-actions">
                <button
                  className="warning-btn-primary"
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setSameFileWarning(false);
                    void runCronNow(true);
                  }}
                >
                  Sí, enviar ahora
                </button>
                <button
                  className="warning-btn-secondary"
                  type="button"
                  onClick={() => setSameFileWarning(false)}
                >
                  No, solo guardar
                </button>
              </div>
            </div>
          ) : null}

          {message ? <p className="note">✅ {message}</p> : null}
          {error ? <p className="note">❌ {error}</p> : null}
        </section>

        <aside className="card">
          <h2>Cómo trabaja</h2>
          <div className="stack">
            <p className="note">1. Subís el archivo.</p>
            <p className="note">2. La app detecta personas y fechas de vencimiento.</p>
            <p className="note">3. Guarda el archivo procesado para que el cron lo revise todos los días.</p>
            <p className="note">4. Cuando encuentra vencidos o próximos a vencer, manda el mail.</p>
            <button className="button secondary" type="button" onClick={() => { void runCronNow(); }} disabled={loading}>
              Probar alerta ahora
            </button>
            <p className="note">
              El cron real de Vercel entra por GET y queda protegido con <strong>CRON_SECRET</strong>. Este botón respeta el intervalo (15 días) por defecto.
            </p>
          </div>
        </aside>
      </div>

      <section className="card" style={{ marginTop: 20 }}>
        <h2>Última carga</h2>
        {!payload ? (
          <p className="note">Todavía no hay ningún archivo cargado.</p>
        ) : (
          <>
            <div className="kpis">
              <div className="kpi">
                <span>Archivo</span>
                <strong style={{ fontSize: 18 }}>{payload.uploadedFileName}</strong>
              </div>
              <div className="kpi">
                <span>Total de registros</span>
                <strong>{payload.totalRecords}</strong>
              </div>
              <div className="kpi">
                <span>Alertas activas</span>
                <strong>{payload.urgentCount}</strong>
              </div>
            </div>

            <p className="note">
              Destino: <strong>{payload.defaultRecipient}</strong> · Anticipación: <strong>{payload.daysBeforeAlert}</strong> días · Última carga:{' '}
              <strong>{new Date(payload.uploadedAt).toLocaleString('es-UY')}</strong>
            </p>
            <p className="note">
              {payload.lastEmailSentAt ? (
                <>
                  Último envío: <strong>{new Date(payload.lastEmailSentAt).toLocaleString('es-UY')}</strong>
                  {payload.daysUntilNextEmail !== null && payload.daysUntilNextEmail > 0
                    ? <> · Próximo envío automático en <strong>{payload.daysUntilNextEmail} día(s)</strong></>
                    : <> · <span style={{ color: '#16a34a' }}>Listo para enviar en el próximo cron</span></>
                  }
                </>
              ) : (
                <span style={{ color: '#6b7280' }}>Aún no se envió ninguna alerta</span>
              )}
            </p>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th>Hoja</th>
                    <th>Vencimiento</th>
                    <th>Días</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(urgentPreview.length > 0 ? urgentPreview : payload.preview).map((record) => (
                    <tr key={record.id}>
                      <td>{record.personName}</td>
                      <td>{record.sourceSheet}</td>
                      <td>{new Date(record.expiresAt).toLocaleDateString('es-UY')}</td>
                      <td>{record.daysLeft}</td>
                      <td>
                        <span className={statusClass(record.status)}>{statusText(record)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

    </div>
  );
}
