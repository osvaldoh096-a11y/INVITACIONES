import type { APIRoute } from 'astro';
import { requireAuth } from '../../../lib/auth';
import prisma from '../../../lib/prisma';

// GET /api/rsvp/list            -> todas las respuestas, de todos los eventos
// GET /api/rsvp/list?eventCode=X -> solo las respuestas de ese evento
export const GET: APIRoute = async (context) => {
  try {
    await requireAuth(context);

    const eventCode = context.url.searchParams.get('eventCode');

    const where = eventCode
      ? { event: { eventCode } }
      : {};

    const rsvps = await prisma.rSVP.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { event: { select: { eventCode: true, eventName: true, clientName: true } } },
    });

    const totalAttending = rsvps.filter((r) => r.attending).length;
    const totalDeclined = rsvps.filter((r) => !r.attending).length;
    const totalCompanions = rsvps
      .filter((r) => r.attending)
      .reduce((sum, r) => sum + (r.companionsCount || 0), 0);
    // Total de personas confirmadas = invitados que asisten + sus acompañantes
    const totalGuestsConfirmed = totalAttending + totalCompanions;

    return new Response(
      JSON.stringify({
        rsvps,
        analytics: {
          total: rsvps.length,
          totalAttending,
          totalDeclined,
          totalCompanions,
          totalGuestsConfirmed,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    return new Response(JSON.stringify({ error: message }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
