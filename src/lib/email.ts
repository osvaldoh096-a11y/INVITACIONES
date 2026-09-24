import nodemailer from 'nodemailer';

/**
 * Envío del correo de respaldo con los QR de confirmación, directo desde
 * tu cuenta de Gmail (vía SMTP + "contraseña de aplicación").
 *
 * Igual que con Google Sheets: esto es un "espejo" de entrega, nunca la
 * fuente de verdad. Si el correo falla (o no está configurado, o el
 * invitado no dejó email), el RSVP ya quedó guardado y su QR ya se le
 * mostró en pantalla — este correo es solo un respaldo por si lo perdió.
 *
 * Variables de entorno requeridas:
 * - GMAIL_USER            (tu cuenta de Gmail, ej. tunegocio@gmail.com)
 * - GMAIL_APP_PASSWORD    (contraseña de aplicación de 16 caracteres, NO
 *                          tu contraseña normal de Gmail — ver .env.example
 *                          para cómo generarla)
 */

interface QrGuest {
  fullName: string;
  qrUrl: string;
}

function isEmailConfigured(): boolean {
  return Boolean(
    import.meta.env.GMAIL_USER && import.meta.env.GMAIL_APP_PASSWORD,
  );
}

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: import.meta.env.GMAIL_USER,
      pass: import.meta.env.GMAIL_APP_PASSWORD,
    },
  });
}

function buildHtml(eventName: string, guests: QrGuest[]): string {
  const cards = guests
    .map(
      (g) => `
        <tr>
          <td style="padding:16px 0;text-align:center;border-bottom:1px solid #e5e7eb;">
            <p style="margin:0 0 8px;font-family:sans-serif;font-size:15px;font-weight:600;color:#111827;">${g.fullName}</p>
            <img src="${g.qrUrl}" width="220" height="220" alt="Código QR de ${g.fullName}" style="display:block;margin:0 auto;" />
          </td>
        </tr>`,
    )
    .join('');

  return `
    <div style="font-family:sans-serif;max-width:420px;margin:0 auto;">
      <h2 style="color:#111827;">¡Confirmación recibida!</h2>
      <p style="color:#374151;">Guarda este correo o toma captura de tu(s) código(s) QR — te lo(s) pedirán en el acceso a <strong>${eventName}</strong>.</p>
      <table width="100%" cellpadding="0" cellspacing="0">${cards}</table>
    </div>`;
}

export async function sendRsvpConfirmationEmail(params: {
  to: string;
  eventName: string;
  guests: QrGuest[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isEmailConfigured()) {
    return {
      ok: false,
      error: 'Email no configurado (faltan GMAIL_USER / GMAIL_APP_PASSWORD).',
    };
  }

  try {
    await getTransporter().sendMail({
      from: `"${params.eventName}" <${import.meta.env.GMAIL_USER}>`,
      to: params.to,
      subject: `Tu confirmación para ${params.eventName}`,
      html: buildHtml(params.eventName, params.guests),
    });

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    console.error('Error enviando correo de confirmación:', message);
    return { ok: false, error: message };
  }
}

/**
 * Aviso a TI (el negocio) cada vez que alguien confirma o cancela, para no
 * tener que estar viendo el panel a cada rato. Usa la misma cuenta de
 * Gmail que el correo de respaldo al invitado; se manda a
 * OWNER_NOTIFICATION_EMAIL si la configuras, o si no, a la misma cuenta
 * GMAIL_USER (tu propia bandeja de entrada).
 *
 * Es un aviso, no la fuente de verdad: si falla o no está configurado el
 * correo, el RSVP ya quedó guardado igual — nunca bloquea ni le informa
 * error al invitado.
 */
export async function sendOwnerNotificationEmail(params: {
  eventName: string;
  fullName: string;
  attending: boolean;
  companionsCount: number;
  phone?: string | null;
  email?: string | null;
  message?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isEmailConfigured()) {
    return { ok: false, error: 'Email no configurado.' };
  }

  const to = import.meta.env.OWNER_NOTIFICATION_EMAIL || import.meta.env.GMAIL_USER;

  const statusLine = params.attending
    ? `Confirmó asistencia${params.companionsCount > 0 ? ` + ${params.companionsCount} acompañante(s)` : ''}`
    : 'No podrá asistir';

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#111827;">Nueva respuesta en ${params.eventName}</h2>
      <p style="color:#374151;margin:4px 0;"><strong>${params.fullName}</strong> — ${statusLine}</p>
      ${params.phone ? `<p style="color:#6b7280;margin:4px 0;">Tel: ${params.phone}</p>` : ''}
      ${params.email ? `<p style="color:#6b7280;margin:4px 0;">Email: ${params.email}</p>` : ''}
      ${params.message ? `<p style="color:#6b7280;margin:4px 0;">Mensaje: "${params.message}"</p>` : ''}
    </div>`;

  try {
    await getTransporter().sendMail({
      from: `"Invitaciones" <${import.meta.env.GMAIL_USER}>`,
      to,
      subject: `${params.attending ? '✅' : '❌'} ${params.fullName} — ${params.eventName}`,
      html,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    console.error('Error enviando aviso al dueño:', message);
    return { ok: false, error: message };
  }
}
