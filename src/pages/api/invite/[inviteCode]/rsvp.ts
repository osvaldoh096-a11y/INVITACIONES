import type { APIRoute } from 'astro';
import prisma from '../../../../lib/prisma';
import { rsvpSubmitSchema } from '../../../../lib/validations';
import { createRsvpWithGuests } from '../../../../lib/rsvp';

/**
 * Endpoint PÚBLICO para el link personalizado de un invitado precargado
 * (/invite/[inviteCode]). A diferencia del formulario abierto
 * (/api/rsvp/[eventCode]), aquí:
 * - No hace falta contraseña de evento: el propio inviteCode (imposible de
 *   adivinar) ya es el control de acceso de ESTA persona/familia.
 * - El número de personas (titular + acompañantes) no puede pasar del
 *   límite de pases que se le asignó — así nadie se "cuela" con más gente
 *   de la que le corresponde.
 * - Solo se puede confirmar una vez por invitación.
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

export const POST: APIRoute = async ({ params, request }) => {
  const headers = { 'Content-Type': 'application/json', ...corsHeaders() };

  try {
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

    if (invitee.status === 'confirmed') {
      return new Response(
        JSON.stringify({ error: 'Esta invitación ya fue confirmada anteriormente' }),
        { status: 409, headers },
      );
    }

    const body = await request.json();
    const parsed = rsvpSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }),
        { status: 400, headers },
      );
    }

    const data = parsed.data;
    const totalPeople = data.attending ? 1 + data.companionsCount : 0;

    if (totalPeople > invitee.maxPasses) {
      return new Response(
        JSON.stringify({
          error: `Tu invitación es para máximo ${invitee.maxPasses} persona(s) (contándote a ti). Ajusta el número de acompañantes.`,
        }),
        { status: 400, headers },
      );
    }

    const origin = new URL(request.url).origin;
    const { rsvp, guests } = await createRsvpWithGuests(invitee.event, data, origin);

    await prisma.invitee.update({
      where: { id: invitee.id },
      data: { status: data.attending ? 'confirmed' : 'declined', rsvpId: rsvp.id },
    });

    return new Response(JSON.stringify({ success: true, rsvp, guests }), {
      status: 201,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo enviar el RSVP';
    console.error('Error en RSVP de invitación:', error);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers });
  }
};
