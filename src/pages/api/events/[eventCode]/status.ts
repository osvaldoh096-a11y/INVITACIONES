import type { APIRoute } from 'astro';
import prisma from '../../../../lib/prisma';

// Endpoint PÚBLICO de solo lectura para que el CLIENTE (quien te contrató,
// no tú) vea el estado de confirmaciones de SU evento, sin necesitar una
// cuenta en el panel de administración. No requiere sesión, pero si el
// evento tiene `accessPassword`, hay que mandarla en el body para ver los
// datos — mismo mecanismo que ya usa el envío de RSVP.
//
// A propósito NO se exponen teléfono ni email de los invitados aquí: esta
// ruta puede compartirse más ampliamente que el panel interno.
export const POST: APIRoute = async ({ params, request }) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  const { eventCode } = params;
  if (!eventCode) {
    return new Response(JSON.stringify({ error: 'eventCode requerido' }), { status: 400, headers });
  }

  const event = await prisma.eventProject.findUnique({ where: { eventCode } });
  if (!event || !event.isPublished) {
    return new Response(JSON.stringify({ error: 'Evento no encontrado' }), { status: 404, headers });
  }

  let body: { accessPassword?: string } = {};
  try {
    body = await request.json();
  } catch {
    // sin body es válido si el evento no tiene contraseña
  }

  if (event.accessPassword && body.accessPassword !== event.accessPassword) {
    return new Response(JSON.stringify({ error: 'Contraseña incorrecta' }), { status: 403, headers });
  }

  const rsvps = await prisma.rSVP.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fullName: true,
      attending: true,
      companionsCount: true,
      companionNames: true,
      dietaryRestrictions: true,
      message: true,
      createdAt: true,
    },
  });

  const totalAttending = rsvps.filter((r) => r.attending).length;
  const totalDeclined = rsvps.filter((r) => !r.attending).length;
  const totalCompanions = rsvps
    .filter((r) => r.attending)
    .reduce((sum, r) => sum + (r.companionsCount || 0), 0);

  return new Response(
    JSON.stringify({
      event: {
        eventCode: event.eventCode,
        eventName: event.eventName,
        eventType: event.eventType,
        eventDate: event.eventDate,
        location: event.location,
        packageTier: event.packageTier,
      },
      analytics: {
        total: rsvps.length,
        totalAttending,
        totalDeclined,
        totalCompanions,
        totalGuestsConfirmed: totalAttending + totalCompanions,
      },
      rsvps,
    }),
    { status: 200, headers },
  );
};
