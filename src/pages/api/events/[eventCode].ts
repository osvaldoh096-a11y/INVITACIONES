import type { APIRoute } from 'astro';
import { requireAuth } from '../../../lib/auth';
import { eventProjectSchema } from '../../../lib/validations';
import prisma from '../../../lib/prisma';

// GET público: para que Framer pueda (opcionalmente) pedir los datos del
// evento -nombre, fecha, lugar- y mostrarlos dinámicamente en la invitación.
// No requiere sesión porque el invitado nunca inicia sesión.
export const GET: APIRoute = async ({ params }) => {
  const { eventCode } = params;
  if (!eventCode) {
    return new Response(JSON.stringify({ error: 'eventCode requerido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const event = await prisma.eventProject.findUnique({
    where: { eventCode },
    include: { sessions: { orderBy: { order: 'asc' } } },
  });

  if (!event || !event.isPublished) {
    return new Response(JSON.stringify({ error: 'Evento no encontrado' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // No exponer accessPassword ni createdById en la respuesta pública.
  const { accessPassword, createdById, ...publicEvent } = event;

  return new Response(JSON.stringify({ event: publicEvent }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
};

// PATCH admin: editar un evento existente.
export const PATCH: APIRoute = async (context) => {
  try {
    await requireAuth(context);
    const { eventCode } = context.params;

    const body = await context.request.json();
    const parsed = eventProjectSchema.partial().safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { sessions, ...data } = parsed.data;

    const event = await prisma.eventProject.update({
      where: { eventCode },
      data,
      include: { sessions: { orderBy: { order: 'asc' } } },
    });

    return new Response(JSON.stringify({ event }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar el evento';
    const status = message === 'Unauthorized' ? 401 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// DELETE admin: eliminar un evento (y en cascada sus sesiones/RSVPs).
export const DELETE: APIRoute = async (context) => {
  try {
    await requireAuth(context);
    const { eventCode } = context.params;

    await prisma.eventProject.delete({ where: { eventCode } });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo eliminar el evento';
    const status = message === 'Unauthorized' ? 401 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
