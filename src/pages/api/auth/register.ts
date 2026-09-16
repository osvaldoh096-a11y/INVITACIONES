import type { APIRoute } from 'astro';
import { requireAuth, createAdminUser } from '../../../lib/auth';
import { createTeammateSchema } from '../../../lib/validations';

/**
 * IMPORTANTE: este endpoint NO es de auto-registro público (a diferencia
 * del repo original). Solo un admin YA autenticado puede crear una cuenta
 * nueva para un compañero de equipo. La primera cuenta se crea con el
 * script de seed (`npm run seed:admin`), no desde aquí.
 */
export const POST: APIRoute = async (context) => {
  try {
    await requireAuth(context); // lanza si no hay sesión válida

    const body = await context.request.json();
    const parsed = createTeammateSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { email, password, name } = parsed.data;
    const user = await createAdminUser(email, password, name);

    return new Response(JSON.stringify({ success: true, user }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo crear la cuenta';
    const status = message === 'Unauthorized' ? 401 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
