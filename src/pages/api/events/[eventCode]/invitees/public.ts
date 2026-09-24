import type { APIRoute } from 'astro';
import { generateInviteCode } from '../../../../../lib/slug';
import { hasInviteeList } from '../../../../../lib/packages';
import prisma from '../../../../../lib/prisma';

/**
 * Versión PÚBLICA (sin login) del CRUD de lista de invitados, para que el
 * propio CLIENTE (quien te contrató) cargue su lista directamente desde su
 * página de estado, con campos individuales en vez de tener que escribirte
 * un mensaje o pegar texto con comas (donde se equivocan fácil).
 *
 * Misma protección que /status: si el evento tiene accessPassword, hay que
 * mandarla en el body. Todas las acciones están además acotadas a ESTE
 * evento — nunca se puede tocar la lista de otro evento aunque se adivine
 * un inviteId ajeno.
 */

function headers() {
  return { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
}

async function getAuthorizedEvent(eventCode: string, accessPassword?: string) {
  const event = await prisma.eventProject.findUnique({ where: { eventCode } });
  if (!event || !event.isPublished) return { error: 'Evento no encontrado', status: 404 as const };
  if (event.accessPassword && accessPassword !== event.accessPassword) {
    return { error: 'Contraseña incorrecta', status: 403 as const };
  }
  if (!hasInviteeList(event.packageTier)) {
    return { error: 'Este paquete no incluye lista de invitados precargada', status: 403 as const };
  }
  return { event };
}

// POST: lista los invitados ya cargados (mismo patrón que /status).
export const POST: APIRoute = async ({ params, request }) => {
  const { eventCode } = params;
  if (!eventCode) {
    return new Response(JSON.stringify({ error: 'eventCode requerido' }), { status: 400, headers: headers() });
  }

  let body: { accessPassword?: string } = {};
  try {
    body = await request.json();
  } catch {
    // sin body es válido si el evento no tiene contraseña
  }

  const authorized = await getAuthorizedEvent(eventCode, body.accessPassword);
  if ('error' in authorized) {
    return new Response(JSON.stringify({ error: authorized.error }), { status: authorized.status, headers: headers() });
  }

  const invitees = await prisma.invitee.findMany({
    where: { eventId: authorized.event.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      displayName: true,
      maxPasses: true,
      phone: true,
      inviteCode: true,
      status: true,
      isGeneric: true,
      rsvp: { select: { guests: { select: { fullName: true } } } },
    },
  });

  // Aplana los nombres de cada persona confirmada (titular + acompañantes)
  // para que el cliente vea quién exactamente viene, no solo el conteo.
  const result = invitees.map(({ rsvp, ...rest }) => ({
    ...rest,
    guestNames: rsvp?.guests.map((g) => g.fullName) ?? [],
  }));

  return new Response(JSON.stringify({ invitees: result }), { status: 200, headers: headers() });
};

// PUT: agrega UN invitado (un campo a la vez, para que el cliente lo llene
// directamente sin arriesgarse a equivocarse con texto separado por comas).
export const PUT: APIRoute = async ({ params, request }) => {
  const { eventCode } = params;
  if (!eventCode) {
    return new Response(JSON.stringify({ error: 'eventCode requerido' }), { status: 400, headers: headers() });
  }

  const body = await request.json().catch(() => ({}));
  const { accessPassword, displayName, maxPasses, phone } = body as {
    accessPassword?: string;
    displayName?: string;
    maxPasses?: number;
    phone?: string;
  };

  const authorized = await getAuthorizedEvent(eventCode, accessPassword);
  if ('error' in authorized) {
    return new Response(JSON.stringify({ error: authorized.error }), { status: authorized.status, headers: headers() });
  }

  if (!displayName?.trim() || !Number.isFinite(maxPasses) || (maxPasses as number) < 1) {
    return new Response(
      JSON.stringify({ error: 'Nombre y número de pases (mínimo 1) son requeridos' }),
      { status: 400, headers: headers() },
    );
  }

  const invitee = await prisma.invitee.create({
    data: {
      eventId: authorized.event.id,
      displayName: displayName.trim(),
      maxPasses: Math.min(Math.trunc(maxPasses as number), 20),
      phone: phone?.trim() || null,
      inviteCode: generateInviteCode(displayName),
    },
  });

  return new Response(JSON.stringify({ invitee }), { status: 201, headers: headers() });
};

// PATCH: marca que el cliente ya le mandó el link a ese invitado (para
// llevar control de a quién le falta enviar).
export const PATCH: APIRoute = async ({ params, request }) => {
  const { eventCode } = params;
  if (!eventCode) {
    return new Response(JSON.stringify({ error: 'eventCode requerido' }), { status: 400, headers: headers() });
  }

  const body = await request.json().catch(() => ({}));
  const { accessPassword, inviteId } = body as { accessPassword?: string; inviteId?: string };

  const authorized = await getAuthorizedEvent(eventCode, accessPassword);
  if ('error' in authorized) {
    return new Response(JSON.stringify({ error: authorized.error }), { status: authorized.status, headers: headers() });
  }

  if (!inviteId) {
    return new Response(JSON.stringify({ error: 'inviteId requerido' }), { status: 400, headers: headers() });
  }

  const invitee = await prisma.invitee.findUnique({ where: { id: inviteId } });
  if (!invitee || invitee.eventId !== authorized.event.id) {
    return new Response(JSON.stringify({ error: 'Invitado no encontrado' }), { status: 404, headers: headers() });
  }

  const updated = await prisma.invitee.update({
    where: { id: inviteId },
    data: invitee.status === 'pending' ? { status: 'sent', sentAt: new Date() } : {},
  });

  return new Response(JSON.stringify({ invitee: updated }), { status: 200, headers: headers() });
};

// DELETE: quita un invitado que el cliente cargó por error, antes de
// mandarle su link.
export const DELETE: APIRoute = async ({ params, request }) => {
  const { eventCode } = params;
  if (!eventCode) {
    return new Response(JSON.stringify({ error: 'eventCode requerido' }), { status: 400, headers: headers() });
  }

  const body = await request.json().catch(() => ({}));
  const { accessPassword, inviteId } = body as { accessPassword?: string; inviteId?: string };

  const authorized = await getAuthorizedEvent(eventCode, accessPassword);
  if ('error' in authorized) {
    return new Response(JSON.stringify({ error: authorized.error }), { status: authorized.status, headers: headers() });
  }

  if (!inviteId) {
    return new Response(JSON.stringify({ error: 'inviteId requerido' }), { status: 400, headers: headers() });
  }

  const invitee = await prisma.invitee.findUnique({ where: { id: inviteId } });
  if (!invitee || invitee.eventId !== authorized.event.id) {
    return new Response(JSON.stringify({ error: 'Invitado no encontrado' }), { status: 404, headers: headers() });
  }

  await prisma.invitee.delete({ where: { id: inviteId } });
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: headers() });
};
