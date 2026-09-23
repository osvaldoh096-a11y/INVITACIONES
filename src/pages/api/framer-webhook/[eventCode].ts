import type { APIRoute } from 'astro';
import prisma from '../../../lib/prisma';
import { rsvpSubmitSchema } from '../../../lib/validations';
import { createRsvpWithGuests } from '../../../lib/rsvp';

/**
 * Endpoint para el "Send To: Webhook" del Form NATIVO de Framer (no el
 * formulario de código). Framer nombra las llaves del JSON según el
 * atributo "Name" de cada campo en el diseño — que en este formulario en
 * particular no sabemos con certeza cómo quedó, así que en vez de exigir
 * llaves exactas se buscan por coincidencia aproximada del texto visible
 * (Nombre/Acompañarás/Mensaje). Si Framer llega a enviar algo que no
 * calza con ningún patrón, queda registrado en los logs de Vercel para
 * ajustar el matching sin tener que tocar el diseño en Framer.
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

async function parseIncomingBody(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return (await request.json()) as Record<string, string>;
  }

  const form = await request.formData();
  const result: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    result[key] = String(value);
  }
  return result;
}

function findValue(fields: Record<string, string>, pattern: RegExp): string | undefined {
  const key = Object.keys(fields).find((k) => pattern.test(k));
  return key ? fields[key] : undefined;
}

function parseAttending(raw: string | undefined): boolean {
  if (!raw) return false;
  return /^s(í|i)\b/i.test(raw.trim());
}

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

    const fields = await parseIncomingBody(request);

    // Log crudo para poder ajustar el matching viendo el payload real que
    // manda el Form nativo de Framer, sin tener que adivinar a ciegas.
    console.log(`[framer-webhook] ${eventCode} payload:`, JSON.stringify(fields));

    const fullName =
      fields.fullName || findValue(fields, /nombre/i) || findValue(fields, /^name$/i);
    const attendingRaw =
      fields.attending || findValue(fields, /acompañ|asist/i);
    const message = fields.message || findValue(fields, /mensaje|palabras/i);

    const normalized = {
      fullName: fullName || '',
      attending: parseAttending(attendingRaw),
      message: message || undefined,
      companionsCount: 0,
    };

    const parsed = rsvpSubmitSchema.safeParse(normalized);
    if (!parsed.success) {
      console.error('[framer-webhook] No se pudo interpretar el payload:', fields);
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }),
        { status: 400, headers },
      );
    }

    const origin = new URL(request.url).origin;
    await createRsvpWithGuests(event, parsed.data, origin);

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo enviar el RSVP';
    console.error('Error en framer-webhook:', error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers,
    });
  }
};
