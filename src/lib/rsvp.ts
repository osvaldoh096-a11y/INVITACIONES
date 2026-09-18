import prisma from './prisma';
import { appendRsvpToSheet } from './sheets';
import { sendRsvpConfirmationEmail } from './email';
import type { RsvpSubmitFormData } from './validations';

/**
 * Crea una respuesta RSVP completa: guarda el registro, intenta reflejarlo
 * en Sheets, genera un QR por cada persona confirmada (titular +
 * acompañantes) y manda el correo de respaldo si dejaron email.
 *
 * Compartido entre el formulario abierto (/api/rsvp/[eventCode]) y el de
 * invitación personalizada (/api/invite/[inviteCode]/rsvp) para no
 * duplicar esta lógica en dos lados.
 */
export async function createRsvpWithGuests(
  event: { id: string; eventCode: string; eventName: string },
  data: RsvpSubmitFormData,
  origin: string,
) {
  const rsvp = await prisma.rSVP.create({
    data: {
      eventId: event.id,
      fullName: data.fullName,
      phone: data.phone || null,
      email: data.email || null,
      attending: data.attending,
      companionsCount: data.companionsCount,
      companionNames: data.companionNames || null,
      dietaryRestrictions: data.dietaryRestrictions || null,
      message: data.message || null,
    },
  });

  // La respuesta ya quedó guardada en la base de datos (fuente de verdad).
  // Intentamos reflejarla en Google Sheets, pero si falla NO se le informa
  // error al invitado: solo queda registrado para reintentar después.
  const syncResult = await appendRsvpToSheet(rsvp, event);

  await prisma.rSVP.update({
    where: { id: rsvp.id },
    data: {
      syncedToSheets: syncResult.ok,
      syncedAt: syncResult.ok ? new Date() : null,
      syncError: syncResult.ok ? null : syncResult.error,
    },
  });

  // Un QR único por persona confirmada (titular + cada acompañante), solo
  // si sí va a asistir — no tiene sentido generar código de acceso para
  // quien avisó que no viene.
  const guestNames = data.attending
    ? [
        data.fullName,
        ...(data.companionNames
          ? data.companionNames.split(',').map((n) => n.trim()).filter(Boolean)
          : []),
      ]
    : [];

  let guests: { fullName: string; qrUrl: string }[] = [];

  if (guestNames.length > 0) {
    const created = await prisma.$transaction(
      guestNames.map((fullName) =>
        prisma.rsvpGuest.create({
          data: { rsvpId: rsvp.id, fullName, qrToken: crypto.randomUUID() },
        }),
      ),
    );
    guests = created.map((g) => ({
      fullName: g.fullName,
      qrUrl: `${origin}/api/qr/${g.qrToken}`,
    }));

    // Igual que Sheets: el correo es un respaldo, nunca la fuente de
    // verdad. Si el invitado no dejó email o el envío falla, el RSVP y
    // sus QR ya quedaron guardados y se le mostraron en pantalla.
    if (data.email) {
      await sendRsvpConfirmationEmail({
        to: data.email,
        eventName: event.eventName,
        guests,
      });
    }
  }

  return { rsvp, guests };
}
