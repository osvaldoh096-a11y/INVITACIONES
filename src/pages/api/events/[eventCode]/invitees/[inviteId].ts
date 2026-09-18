import type { APIRoute } from 'astro';
import { requireAuth } from '../../../../../lib/auth';
import prisma from '../../../../../lib/prisma';

// DELETE: quita un invitado de la lista precargada (para corregir errores
// de captura antes de mandarle su link).
export const DELETE: APIRoute = async (context) => {
  try {
    await requireAuth(context);
    const { inviteId } = context.params;

    await prisma.invitee.delete({ where: { id: inviteId! } });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo eliminar';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// PATCH: marca que ya se le mandó el link (para llevar control de envíos).
export const PATCH: APIRoute = async (context) => {
  try {
    await requireAuth(context);
    const { inviteId } = context.params;

    const invitee = await prisma.invitee.update({
      where: { id: inviteId! },
      data: { status: 'sent', sentAt: new Date() },
    });

    return new Response(JSON.stringify({ invitee }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
