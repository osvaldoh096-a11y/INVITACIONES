import type { APIRoute } from 'astro';
import prisma from '../../../lib/prisma';

// GET público: para que Framer muestre el saludo personalizado ("Hola,
// Familia Torres, tienen 4 pases") antes de llenar el formulario.
export const GET: APIRoute = async ({ params }) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  const { inviteCode } = params;
  if (!inviteCode) {
    return new Response(JSON.stringify({ error: 'inviteCode requerido' }), { status: 400, headers });
  }

  const invitee = await prisma.invitee.findUnique({
    where: { inviteCode },
    include: { event: true },
  });

  if (!invitee || !invitee.event.isPublished) {
    return new Response(JSON.stringify({ error: 'Invitación no encontrada' }), { status: 404, headers });
  }

  return new Response(
    JSON.stringify({
      invitee: {
        displayName: invitee.displayName,
        maxPasses: invitee.maxPasses,
        status: invitee.status,
      },
      event: {
        eventCode: invitee.event.eventCode,
        eventName: invitee.event.eventName,
        eventType: invitee.event.eventType,
        eventDate: invitee.event.eventDate,
        location: invitee.event.location,
      },
    }),
    { status: 200, headers },
  );
};
