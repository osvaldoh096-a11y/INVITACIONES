import type { APIRoute } from 'astro';
import prisma from '../../../../lib/prisma';

// Endpoint PÚBLICO (sin login) para marcar la entrada de un invitado el día
// del evento. A propósito no pide contraseña: el negocio no controla el
// acceso al link (lo entrega el cliente a quien reciba en la puerta), y el
// dueño del negocio no está presente en el evento para autenticar nada —
// el propio link (que solo tiene quien lo necesita) es el control de acceso.
//
// Cada escaneo se valida contra ESTE evento específico: un token robado o
// reenviado de otro evento nunca marca entrada aquí, aunque exista en la
// base de datos.
export const POST: APIRoute = async ({ params, request }) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  const { eventCode } = params;
  if (!eventCode) {
    return new Response(JSON.stringify({ error: 'eventCode requerido' }), { status: 400, headers });
  }

  let body: { qrToken?: string } = {};
  try {
    body = await request.json();
  } catch {
    // body vacío/malformado se maneja abajo como qrToken faltante
  }

  if (!body.qrToken) {
    return new Response(JSON.stringify({ error: 'qrToken requerido' }), { status: 400, headers });
  }

  const event = await prisma.eventProject.findUnique({ where: { eventCode } });
  if (!event || !event.isPublished) {
    return new Response(JSON.stringify({ error: 'Evento no encontrado' }), { status: 404, headers });
  }

  const guest = await prisma.rsvpGuest.findUnique({
    where: { qrToken: body.qrToken },
    include: { rsvp: { select: { eventId: true } } },
  });

  if (!guest || guest.rsvp.eventId !== event.id) {
    return new Response(
      JSON.stringify({ error: 'Este código no corresponde a este evento' }),
      { status: 404, headers },
    );
  }

  // Cada escaneo cuenta como una entrada más — un invitado que sale y
  // regresa (al coche, a fumar, etc.) puede volver a entrar sin problema;
  // esto solo lleva la cuenta de cuántas veces y a qué hora, no bloquea.
  const updated = await prisma.rsvpGuest.update({
    where: { id: guest.id },
    data: {
      checkedIn: true,
      checkedInAt: new Date(),
      checkInCount: { increment: 1 },
    },
  });

  return new Response(
    JSON.stringify({
      success: true,
      alreadyCheckedIn: updated.checkInCount > 1,
      guest: {
        fullName: updated.fullName,
        checkedInAt: updated.checkedInAt,
        checkInCount: updated.checkInCount,
      },
    }),
    { status: 200, headers },
  );
};
