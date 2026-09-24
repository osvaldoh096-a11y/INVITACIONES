import prisma from './prisma';
import { appendRsvpToSheet } from './sheets';
import { sendRsvpConfirmationEmail, sendOwnerNotificationEmail } from './email';
import { hasQrCheckin } from './packages';
import type { RsvpSubmitFormData } from './validations';

/**
 * Los nombres de acompañantes (texto libre separado por coma) son la
 * única fuente de verdad de cuántas personas confirmadas hay — no un
 * número aparte que el invitado podría dejar sin coincidir con los
 * nombres que realmente escribió (ej. dice "3 acompañantes" pero solo
 * escribe un nombre). Un QR se genera por cada nombre en esta lista, así
 * que si no coinciden, es esta lista la que manda.
 */
export function parseCompanionNames(raw?: string | null): string[] {
  return raw ? raw.split(',').map((n) => n.trim()).filter(Boolean) : [];
}

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
  event: { id: string; eventCode: string; eventName: string; packageTier: string },
  data: RsvpSubmitFormData,
  origin: string,
) {
  const companionNamesList = parseCompanionNames(data.companionNames);
  // El companionsCount que se guarda siempre refleja los nombres reales
  // dados, nunca un número declarado aparte que podría no coincidir.
  const companionsCount = data.companionNames !== undefined ? companionNamesList.length : data.companionsCount;

  const rsvp = await prisma.rSVP.create({
    data: {
      eventId: event.id,
      fullName: data.fullName,
      phone: data.phone || null,
      email: data.email || null,
      attending: data.attending,
      companionsCount,
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

  // Aviso a ti (el negocio) de que llegó una respuesta nueva — es solo un
  // aviso, así que si falla no afecta el RSVP ya guardado.
  await sendOwnerNotificationEmail({
    eventName: event.eventName,
    fullName: data.fullName,
    attending: data.attending,
    companionsCount,
    phone: data.phone,
    email: data.email,
    message: data.message,
  });

  // Un QR único por persona confirmada (titular + cada acompañante) es
  // exclusivo de Oro/Diamante — Plata no genera códigos de acceso, así que
  // tampoco tiene sentido mandarles el correo con QR.
  const guestNames = data.attending && hasQrCheckin(event.packageTier)
    ? [data.fullName, ...companionNamesList]
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
