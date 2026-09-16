import type { APIContext } from 'astro';
import prisma from './prisma';

export interface Session {
  userId: string;
  email: string;
  // Expiración del token (epoch ms). Limita el daño si una cookie se filtra.
  exp: number;
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 días

function getSessionSecret(): string {
  const secret = import.meta.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'SESSION_SECRET no está configurado (o es demasiado corto). ' +
        'Define una variable de entorno SESSION_SECRET de al menos 32 caracteres aleatorios.',
    );
  }
  return secret;
}

function toBase64Url(bytes: Uint8Array): string {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const str = atob(padded);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/**
 * Hashea una contraseña con PBKDF2 (Web Crypto, compatible con runtimes
 * edge y Node). Formato almacenado: pbkdf2$<iteraciones>$<saltB64>$<hashB64>
 */
export async function hashPassword(password: string): Promise<string> {
  const iterations = 210_000;
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256,
  );

  const hashB64 = toBase64Url(new Uint8Array(derived));
  const saltB64 = toBase64Url(salt);
  return `pbkdf2$${iterations}$${saltB64}$${hashB64}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
    // Compatibilidad hacia atrás: si alguna vez hay un hash en formato
    // antiguo (sha256 sin sal), rechazarlo explícitamente en vez de
    // intentar validarlo con un algoritmo inseguro.
    return false;
  }
  const [, iterationsStr, saltB64, expectedHashB64] = parts;
  const iterations = parseInt(iterationsStr, 10);
  const salt = fromBase64Url(saltB64);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256,
  );

  const actualHashB64 = toBase64Url(new Uint8Array(derived));

  // Comparación en tiempo constante
  if (actualHashB64.length !== expectedHashB64.length) return false;
  let diff = 0;
  for (let i = 0; i < actualHashB64.length; i++) {
    diff |= actualHashB64.charCodeAt(i) ^ expectedHashB64.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Crea una cookie de sesión FIRMADA (HMAC-SHA256). A diferencia de un
 * simple base64(JSON), esto impide que alguien fabrique una sesión válida
 * sin conocer el SESSION_SECRET del servidor.
 */
export async function createSessionToken(
  userId: string,
  email: string,
): Promise<string> {
  const session: Session = {
    userId,
    email,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const payload = toBase64Url(
    new TextEncoder().encode(JSON.stringify(session)),
  );
  const key = await hmacKey(getSessionSecret());
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload),
  );
  const sig = toBase64Url(new Uint8Array(signature));
  return `${payload}.${sig}`;
}

export async function verifySessionToken(
  token: string,
): Promise<Session | null> {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;

  try {
    const key = await hmacKey(getSessionSecret());
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64Url(sig),
      new TextEncoder().encode(payload),
    );
    if (!valid) return null;

    const session: Session = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payload)),
    );

    if (!session.exp || Date.now() > session.exp) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getSession(
  context: APIContext,
): Promise<Session | null> {
  const cookie = context.cookies.get('session')?.value;
  if (!cookie) return null;
  return verifySessionToken(cookie);
}

export async function requireAuth(
  context: APIContext,
): Promise<Session> {
  const session = await getSession(context);
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function login(
  email: string,
  password: string,
): Promise<{ userId: string; email: string } | null> {
  const user = await prisma.adminUser.findUnique({ where: { email } });
  if (!user) return null;

  const isValid = await verifyPassword(password, user.password);
  if (!isValid) return null;

  return { userId: user.id, email: user.email };
}

/**
 * Crea una nueva cuenta de administrador/equipo. NO es un endpoint público:
 * solo debe llamarse (a) desde el script de seed inicial, o (b) desde una
 * ruta ya protegida por requireAuth (un admin agregando a un compañero).
 */
export async function createAdminUser(
  email: string,
  password: string,
  name?: string,
) {
  const hashedPassword = await hashPassword(password);
  const user = await prisma.adminUser.create({
    data: { email, password: hashedPassword, name },
  });
  return { userId: user.id, email: user.email };
}
