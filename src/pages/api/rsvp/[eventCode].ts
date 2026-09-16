import type { APIRoute } from 'astro';
import prisma from '../../../lib/prisma';
import { rsvpSubmitSchema } from '../../../lib/validations';
import { appendRsvpToSheet } from '../../../lib/sheets';

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

    return new Response(JSON.stringify({ success: true, rsvp }), {
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
