import type { APIRoute } from 'astro';
import prisma from '../../../../lib/prisma';

// Endpoint PÚBLICO (mismo criterio que el check-in: sin login, el link ya
// es el control de acceso) para buscar invitados por nombre en el check-in
// — respaldo para quien llegue sin su QR a la mano (se le olvidó, se le
// borró el correo, etc.).
export const GET: APIRoute = async ({ params, url }) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  const { eventCode } = params;
  if (!eventCode) {
    return new Response(JSON.stringify({ error: 'eventCode requerido' }), { status: 400, headers });
  }

  const q = url.searchParams.get('q')?.trim() || '';
  if (q.length < 2) {
    return new Response(JSON.stringify({ guests: [] }), { status: 200, headers });
  }

  const event = await prisma.eventProject.findUnique({ where: { eventCode } });
  if (!event || !event.isPublished) {
    return new Response(JSON.stringify({ error: 'Evento no encontrado' }), { status: 404, headers });
  }

  const guests = await prisma.rsvpGuest.findMany({
    where: {
      fullName: { contains: q, mode: 'insensitive' },
      rsvp: { eventId: event.id },
    },
    select: {
      id: true,
      fullName: true,
      checkedIn: true,
      checkedInAt: true,
      checkInCount: true,
    },
    take: 10,
    orderBy: { fullName: 'asc' },
  });

  return new Response(JSON.stringify({ guests }), { status: 200, headers });
};
