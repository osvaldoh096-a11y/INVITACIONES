import type { APIRoute } from 'astro';
import { requireAuth } from '../../../lib/auth';
import { generateEventCode } from '../../../lib/slug';
import { eventProjectSchema } from '../../../lib/validations';
import prisma from '../../../lib/prisma';

// GET /api/events -> lista TODOS los eventos (vista de equipo compartida:
// tú y tu empleada ven y administran los mismos clientes/eventos).
export const GET: APIRoute = async (context) => {
  try {
    await requireAuth(context);

    const events = await prisma.eventProject.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        sessions: { orderBy: { order: 'asc' } },
        _count: { select: { rsvps: true } },
      },
    });

    return new Response(JSON.stringify({ events }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    return new Response(JSON.stringify({ error: message }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// POST /api/events -> crea un nuevo evento/cliente. Genera automáticamente
// el eventCode (ID_EVENTO / slug público) que se usará en el endpoint de
// RSVP público y en la hoja de Google Sheets.
export const POST: APIRoute = async (context) => {
  try {
    const session = await requireAuth(context);

    const body = await context.request.json();
    const parsed = eventProjectSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { sessions, ...data } = parsed.data;
    const eventCode = generateEventCode(data.eventName);

    const event = await prisma.eventProject.create({
      data: {
        ...data,
        eventCode,
        createdById: session.userId,
        sessions: sessions?.length
          ? {
              create: sessions.map((s, index) => ({
                title: s.title,
                date: s.date,
                time: s.time,
                location: s.location,
                address: s.address,
                order: index,
              })),
            }
          : undefined,
      },
      include: { sessions: { orderBy: { order: 'asc' } } },
    });

    return new Response(JSON.stringify({ event }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo crear el evento';
    console.error('Error creando evento:', error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
