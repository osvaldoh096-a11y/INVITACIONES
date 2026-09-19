import type { APIRoute } from 'astro';
import { requireAuth } from '../../../../../lib/auth';
import { generateInviteCode } from '../../../../../lib/slug';
import { hasInviteeList } from '../../../../../lib/packages';
import prisma from '../../../../../lib/prisma';

// GET: lista de invitados precargados de un evento (panel interno).
export const GET: APIRoute = async (context) => {
  try {
    await requireAuth(context);
    const { eventCode } = context.params;

    const event = await prisma.eventProject.findUnique({ where: { eventCode: eventCode! } });
    if (!event) {
      return new Response(JSON.stringify({ error: 'Evento no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const invitees = await prisma.invitee.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: 'asc' },
      include: { rsvp: { select: { companionsCount: true, attending: true } } },
    });

    return new Response(JSON.stringify({ invitees }), {
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

// POST: agrega uno o varios invitados a la lista precargada de un evento.
// Body: { invitees: [{ displayName, maxPasses, phone?, email?, isGeneric? }] }
export const POST: APIRoute = async (context) => {
  try {
    await requireAuth(context);
    const { eventCode } = context.params;

    const event = await prisma.eventProject.findUnique({ where: { eventCode: eventCode! } });
    if (!event) {
      return new Response(JSON.stringify({ error: 'Evento no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!hasInviteeList(event.packageTier)) {
      return new Response(
        JSON.stringify({ error: `El paquete de este evento (${event.packageTier}) no incluye lista de invitados precargada` }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const body = await context.request.json();
    const rows: Array<{
      displayName: string;
      maxPasses: number;
      phone?: string;
      email?: string;
      isGeneric?: boolean;
    }> = Array.isArray(body.invitees) ? body.invitees : [];

    const valid = rows.filter(
      (r) => r.displayName?.trim() && Number.isFinite(r.maxPasses) && r.maxPasses > 0,
    );

    if (valid.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No se recibió ningún invitado válido (nombre y pases requeridos)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const created = await prisma.$transaction(
      valid.map((r) =>
        prisma.invitee.create({
          data: {
            eventId: event.id,
            displayName: r.displayName.trim(),
            maxPasses: r.maxPasses,
            phone: r.phone?.trim() || null,
            email: r.email?.trim() || null,
            isGeneric: r.isGeneric ?? false,
            inviteCode: generateInviteCode(r.displayName),
          },
        }),
      ),
    );

    return new Response(JSON.stringify({ invitees: created }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo agregar la lista';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
