import type { APIRoute } from 'astro';
import prisma from '../../../lib/prisma';
import { generateQrPng } from '../../../lib/qr';

// Endpoint PÚBLICO de solo lectura: sirve la imagen PNG del QR de un
// invitado específico. Requiere el token exacto (no adivinable), pero no
// requiere sesión — así Framer y el correo de confirmación pueden mostrarlo
// con un simple <img src="...">.
export const GET: APIRoute = async ({ params }) => {
  const { token } = params;

  if (!token) {
    return new Response('Not found', { status: 404 });
  }

  const guest = await prisma.rsvpGuest.findUnique({ where: { qrToken: token } });
  if (!guest) {
    return new Response('Not found', { status: 404 });
  }

  const png = await generateQrPng(token);

  return new Response(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
