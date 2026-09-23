/**
 * Definición central de los 3 paquetes de negocio (Plata / Oro / Diamante).
 * Todo lo que decide "qué ve el panel" o "qué genera el flujo público de
 * RSVP" según el paquete de un evento vive aquí — para no regar
 * comparaciones de string sueltas por endpoints y componentes.
 *
 * Los valores internos ('basico'/'medio'/'grande') se quedan como están en
 * la base de datos para no requerir otra migración — solo cambian las
 * etiquetas visibles y qué funciones desbloquea cada uno.
 *
 * Mapeo real de los 3 productos que se venden:
 * - Plata:    RSVP + panel + confirmaciones en vivo. Todo lo demás
 *             (portada, galería, música, mesa de regalos, etc.) es diseño
 *             en Framer, no depende de este backend.
 * - Oro:      + lista de invitados con pases limitados + boletos QR +
 *             emails personalizados + portal de envío. Es el primer nivel
 *             donde el backend genera códigos de acceso.
 * - Diamante: mismo backend que Oro — lo que agrega (navegación premium,
 *             más fotos, video de la boda, complementos de hospedaje/
 *             itinerario) es diseño y servicio, no código nuevo.
 */
export const PACKAGE_TIERS = ['basico', 'medio', 'grande'] as const;
export type PackageTier = (typeof PACKAGE_TIERS)[number];

export const PACKAGE_LABELS: Record<PackageTier, string> = {
  basico: 'Plata',
  medio: 'Oro',
  grande: 'Diamante',
};

export const PACKAGE_FEATURES: Record<PackageTier, string[]> = {
  basico: ['RSVP abierto', 'Panel + CSV', 'Página de estado'],
  medio: [
    'Todo lo de Plata',
    'Lista de invitados con pases limitados',
    'Boletos QR + emails personalizados',
    'Check-in con cámara',
    'Portal de envío por WhatsApp',
  ],
  grande: ['Todo lo de Oro (el resto de Diamante es diseño/servicio, no backend)'],
};

function isTier(value: string): value is PackageTier {
  return (PACKAGE_TIERS as readonly string[]).includes(value);
}

export function normalizeTier(value: string): PackageTier {
  return isTier(value) ? value : 'grande'; // valor por defecto si viene algo inesperado de la BD
}

/** Oro y Diamante incluyen la lista de invitados precargada con pases. */
export function hasInviteeList(tier: string): boolean {
  const t = normalizeTier(tier);
  return t === 'medio' || t === 'grande';
}

/** Oro y Diamante generan QR por invitado y habilitan el check-in. */
export function hasQrCheckin(tier: string): boolean {
  const t = normalizeTier(tier);
  return t === 'medio' || t === 'grande';
}
