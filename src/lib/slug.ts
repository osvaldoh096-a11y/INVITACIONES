/**
 * Genera un "eventCode" legible y único para un evento nuevo.
 * Este código es el slug público (la URL/identificador que se conecta
 * desde Framer) y también el ID_EVENTO que se escribe en Google Sheets.
 *
 * Ej: generateEventCode("Boda de Ana & Luis") -> "boda-de-ana-luis-k3f8x2"
 */
export function generateEventCode(eventName: string): string {
  const base = eventName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  const random = Math.random().toString(36).slice(2, 8);
  return `${base || 'evento'}-${random}`;
}
