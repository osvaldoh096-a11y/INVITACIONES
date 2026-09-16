import type { APIRoute } from 'astro';
import { requireAuth } from '../../../lib/auth';
import prisma from '../../../lib/prisma';

const HEADERS = [
  'ID_EVENTO',
  'ID_RESPUESTA',
  'FECHA_HORA',
  'NOMBRE_EVENTO',
  'NOMBRE_INVITADO',
  'ASISTIRA',
  'NUM_ACOMPANANTES',
  'NOMBRES_ACOMPANANTES',
  'TELEFONO',
  'MENSAJE',
  'RESTRICCIONES_ALIMENTARIAS',
];

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

// GET /api/rsvp/export             -> CSV de todos los eventos (tabla maestra)
// GET /api/rsvp/export?eventCode=X -> CSV solo de ese evento
export const GET: APIRoute = async (context) => {
  try {
    await requireAuth(context);

    const eventCode = context.url.searchParams.get('eventCode');
    const where = eventCode ? { event: { eventCode } } : {};

    const rsvps = await prisma.rSVP.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { event: { select: { eventCode: true, eventName: true } } },
    });

    const rows = rsvps.map((r) =>
      [
        r.event.eventCode,
        r.id,
        r.createdAt.toISOString(),
        r.event.eventName,
        r.fullName,
        r.attending ? 'Sí' : 'No',
        String(r.companionsCount ?? 0),
        r.companionNames || '',
        r.phone || '',
        r.message || '',
        r.dietaryRestrictions || '',
      ]
        .map(csvEscape)
        .join(','),
    );

    const csv = [HEADERS.join(','), ...rows].join('\n');

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="rsvps${eventCode ? '-' + eventCode : ''}.csv"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    return new Response(message, { status: 401 });
  }
};
