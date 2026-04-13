# Alerta Vencimientos

Mini app en Next.js para subir un Excel/CSV, detectar vencimientos y enviar alertas por correo.

## Qué hace

- Subís un archivo `.xlsx`, `.xls` o `.csv`
- Detecta registros con fecha de vencimiento
- Guarda la última carga en Vercel Blob
- Un cron diario revisa los registros
- Si hay items vencidos o por vencer, envía un mail con Resend

## Stack

- Next.js App Router
- Vercel Blob
- Resend
- SheetJS (`xlsx`)

## Variables de entorno

Copiá `.env.example` a `.env.local` y completá:

```bash
BLOB_READ_WRITE_TOKEN=
RESEND_API_KEY=
MAIL_FROM="Alerta Vencimientos <onboarding@tu-dominio.com>"
CRON_SECRET=un-secreto-largo
```

## Correr local

```bash
npm install
npm run dev
```

## Deploy en Vercel

1. Subí este proyecto a GitHub.
2. Importalo en Vercel.
3. En **Storage**, creá un Blob store y asociarlo al proyecto.
4. Vercel te va a crear `BLOB_READ_WRITE_TOKEN`.
5. En Resend, creá una API key y verificá tu dominio remitente.
6. Agregá `RESEND_API_KEY`, `MAIL_FROM` y `CRON_SECRET` en las variables del proyecto.
7. Deploy.

## Cron

El cron diario está definido en `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 9 * * *"
    }
  ]
}
```

Eso ejecuta la revisión todos los días a las 09:00 UTC.

## Probar el envío manualmente

Podés abrir en el navegador:

```bash
https://tu-app.vercel.app/api/cron?secret=TU_CRON_SECRET
```

O usar header:

```bash
Authorization: Bearer TU_CRON_SECRET
```

## Mejora recomendada

Para tu caso real, después conviene adaptar el parser exacto a las columnas de tus planillas de Buenimar/Belater, así queda 100% afinado.
