/**
 * Envío del correo de respaldo con los QR de confirmación, vía Resend
 * (https://resend.com — tiene nivel gratuito, sin trámites de negocio).
 *
 * Igual que con Google Sheets: esto es un "espejo" de entrega, nunca la
 * fuente de verdad. Si el correo falla (o no está configurado, o el
 * invitado no dejó email), el RSVP ya quedó guardado y su QR ya se le
 * mostró en pantalla — este correo es solo un respaldo por si lo perdió.
 *
 * Variables de entorno requeridas:
 * - RESEND_API_KEY
 * - RESEND_FROM_EMAIL   (debe ser de un dominio verificado en Resend;
 *                        mientras no verifiques uno, usa "onboarding@resend.dev",
 *                        que Resend acepta sin verificación pero solo para
 *                        pruebas — no lo uses para invitados reales).
 */

interface QrGuest {
  fullName: string;
  qrUrl: string;
}

function isEmailConfigured(): boolean {
  return Boolean(
    import.meta.env.RESEND_API_KEY && import.meta.env.RESEND_FROM_EMAIL,
  );
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
      error: 'Email no configurado (faltan RESEND_API_KEY / RESEND_FROM_EMAIL).',
    };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${import.meta.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: import.meta.env.RESEND_FROM_EMAIL,
        to: params.to,
        subject: `Tu confirmación para ${params.eventName}`,
        html: buildHtml(params.eventName, params.guests),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Resend respondió ${res.status}: ${body}` };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    console.error('Error enviando correo de confirmación:', message);
    return { ok: false, error: message };
  }
}
