/**
 * Rellena la plantilla de mensaje de un evento con los datos disponibles.
 * Tokens soportados: {evento}, {nombre}, {pases}, {link}. Si la plantilla
 * no incluye {link} en ningún lado, se agrega solo al final — así nunca
 * se manda un mensaje sin el link aunque el admin lo olvide al editarlo.
 */
function fillTemplate(template: string, vars: Record<string, string>): string {
  let filled = template;
  for (const [key, value] of Object.entries(vars)) {
    filled = filled.split(`{${key}}`).join(value);
  }
  if (!template.includes('{link}') && vars.link) {
    filled = `${filled}\n${vars.link}`;
  }
  return filled;
}

const DEFAULT_GENERIC_TEMPLATE =
  '¡Hola! Queremos invitarte a {evento} :) Por favor confirma tu asistencia o tu no asistencia, ¡muchas gracias!!\n{link}';

const DEFAULT_PERSONALIZED_TEMPLATE =
  '¡Hola {nombre}! Aquí está tu invitación, tienen {pases} pase(s) asignado(s): {link}';

/** Mensaje genérico (Plata): un solo link para todos, sin datos por persona. */
export function buildGenericInviteMessage(
  eventName: string,
  link: string,
  template?: string | null,
): string {
  return fillTemplate(template || DEFAULT_GENERIC_TEMPLATE, { evento: eventName, link });
}

/** Mensaje personalizado (Oro/Diamante): uno por invitado, con su nombre y pases. */
export function buildPersonalizedInviteMessage(
  params: { eventName: string; displayName: string; maxPasses: number; link: string },
  template?: string | null,
): string {
  return fillTemplate(template || DEFAULT_PERSONALIZED_TEMPLATE, {
    evento: params.eventName,
    nombre: params.displayName,
    pases: String(params.maxPasses),
    link: params.link,
  });
}
