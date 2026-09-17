import type { APIRoute } from 'astro';
import prisma from '../../../lib/prisma';
import { rsvpSubmitSchema } from '../../../lib/validations';
import { appendRsvpToSheet } from '../../../lib/sheets';
import { sendRsvpConfirmationEmail } from '../../../lib/email';

/**
 * Endpoint PÚBLICO que el formulario embebido/conectado desde Framer llama
 * directamente. No requiere sesión: cualquier invitado con el enlace de
 * su evento puede enviar su RSVP. La validación es: el evento debe existir,
 * estar publicado, y (si tiene accessPassword) coincidir.
 *
 * CORS: como Framer sirve el sitio desde otro dominio, hay que permitir
 * explícitamente las peticiones cross-origin. Configura FRAMER_ALLOWED_ORIGIN
 * en producción para restringirlo a tu dominio de Framer en vez de "*".
 */

function corsHeaders() {
  const origin = import.meta.env.FRAMER_ALLOWED_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: corsHeaders() });
};

export const POST: APIRoute = async ({ params, request }) => {
  const headers = { 'Content-Type': 'application/json', ...corsHeaders() };

  try {
    const { eventCode } = params;
    if (!eventCode) {
      return new Response(JSON.stringify({ error: 'eventCode requerido' }), {
        status: 400,
        headers,
      });
    }

    const event = await prisma.eventProject.findUnique({ where: { eventCode } });

    if (!event || !event.isPublished) {
      return new Response(JSON.stringify({ error: 'Evento no encontrado' }), {
        status: 404,
        headers,
      });
    }

    const body = await request.json();

    if (event.accessPassword && body.accessPassword !== event.accessPassword) {
      return new Response(JSON.stringify({ error: 'Contraseña incorrecta' }), {
        status: 403,
        headers,
      });
    }

    const parsed = rsvpSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }),
        { status: 400, headers },
      );
    }

    const data = parsed.data;

    const rsvp = await prisma.rSVP.create({
      data: {
        eventId: event.id,
        fullName: data.fullName,
        phone: data.phone || null,
        email: data.email || null,
        attending: data.attending,
        companionsCount: data.companionsCount,
        companionNames: data.companionNames || null,
        dietaryRestrictions: data.dietaryRestrictions || null,
        message: data.message || null,
      },
    });

    // La respuesta ya quedó guardada en la base de datos (fuente de verdad).
    // Intentamos reflejarla en Google Sheets, pero si falla NO se le informa
    // error al invitado: solo queda registrado para reintentar después.
    const syncResult = await appendRsvpToSheet(rsvp, event);

    await prisma.rSVP.update({
      where: { id: rsvp.id },
      data: {
        syncedToSheets: syncResult.ok,
        syncedAt: syncResult.ok ? new Date() : null,
        syncError: syncResult.ok ? null : syncResult.error,
      },
    });

    // Un QR único por persona confirmada (titular + cada acompañante), solo
    // si sí va a asistir — no tiene sentido generar código de acceso para
    // quien avisó que no viene.
    const guestNames = data.attending
      ? [
          data.fullName,
          ...(data.companionNames
            ? data.companionNames.split(',').map((n) => n.trim()).filter(Boolean)
            : []),
        ]
      : [];

    const origin = new URL(request.url).origin;
    let guests: { fullName: string; qrUrl: string }[] = [];

    if (guestNames.length > 0) {
      const created = await prisma.$transaction(
        guestNames.map((fullName) =>
          prisma.rsvpGuest.create({
            data: { rsvpId: rsvp.id, fullName, qrToken: crypto.randomUUID() },
          }),
        ),
      );
      guests = created.map((g) => ({
        fullName: g.fullName,
        qrUrl: `${origin}/api/qr/${g.qrToken}`,
      }));

      // Igual que Sheets: el correo es un respaldo, nunca la fuente de
      // verdad. Si el invitado no dejó email o el envío falla, el RSVP y
      // sus QR ya quedaron guardados y se le mostraron en pantalla.
      if (data.email) {
        await sendRsvpConfirmationEmail({
          to: data.email,
          eventName: event.eventName,
          guests,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, rsvp, guests }), {
      status: 201,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo enviar el RSVP';
    console.error('Error en RSVP:', error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers,
    });
  }
};
