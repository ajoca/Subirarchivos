# Alerta Vencimientos

Mini app en Next.js para subir un Excel/CSV, detectar vencimientos y enviar alertas por correo.

## Qué hace

- Subís un archivo `.xlsx`, `.xls` o `.csv`
- Detecta registros con fecha de vencimiento
- Guarda la última carga en Vercel Blob
- Un cron diario revisa los registros
- Si hay items vencidos o por vencer, envía un mail (SMTP Gmail o Resend)

## Stack

- Next.js App Router
- Vercel Blob
- Resend / SMTP (Gmail)
- SheetJS (`xlsx`)

## Variables de entorno

Copiá `.env.example` a `.env.local` y completá:

```bash
BLOB_READ_WRITE_TOKEN=
RESEND_API_KEY=
MAIL_FROM="Alerta Vencimientos <tu-cuenta@gmail.com>"
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASS=
CRON_SECRET=un-secreto-largo
```

Si `SMTP_USER` y `SMTP_PASS` estan configurados, la app envia por SMTP.
Si no, usa Resend.

## Correr local

```bash
npm install
npm run dev
```


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


