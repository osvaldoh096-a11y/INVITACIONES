import type { APIRoute } from 'astro';
import { login, createSessionToken } from '../../../lib/auth';
import { loginSchema } from '../../../lib/validations';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { email, password } = parsed.data;
    const user = await login(email, password);

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Correo o contraseña incorrectos' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const sessionToken = await createSessionToken(user.userId, user.email);

    cookies.set('session', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días, igual que la expiración interna del token
    });

    return new Response(JSON.stringify({ success: true, user }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al iniciar sesión';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
