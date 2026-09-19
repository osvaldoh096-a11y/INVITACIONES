/**
 * Definición central de los 3 paquetes de negocio. Todo lo que decide "qué
 * ve el panel" o "qué genera el flujo público de RSVP" según el paquete
 * de un evento vive aquí — para no regar comparaciones de string sueltas
 * por endpoints y componentes.
 */
export const PACKAGE_TIERS = ['basico', 'medio', 'grande'] as const;
export type PackageTier = (typeof PACKAGE_TIERS)[number];

export const PACKAGE_LABELS: Record<PackageTier, string> = {
  basico: 'Básico',
  medio: 'Medio',
  grande: 'Grande',
};

export const PACKAGE_FEATURES: Record<PackageTier, string[]> = {
  basico: ['RSVP abierto', 'Panel + CSV', 'Página de estado'],
  medio: ['Todo lo de Básico', 'Lista de invitados con pases limitados', 'Envío por WhatsApp'],
  grande: ['Todo lo de Medio', 'QR por invitado', 'Check-in con cámara'],
};

function isTier(value: string): value is PackageTier {
  return (PACKAGE_TIERS as readonly string[]).includes(value);
}

export function normalizeTier(value: string): PackageTier {
  return isTier(value) ? value : 'grande'; // valor por defecto si viene algo inesperado de la BD
}

/** El paquete Medio y Grande incluyen la lista de invitados precargada. */
export function hasInviteeList(tier: string): boolean {
  const t = normalizeTier(tier);
  return t === 'medio' || t === 'grande';
}

/** Solo el paquete Grande genera QR por invitado y habilita el check-in. */
export function hasQrCheckin(tier: string): boolean {
  return normalizeTier(tier) === 'grande';
}
