import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Cliente Prisma sin motor nativo de Rust ("engineType = client" en el
// schema): usa el driver `pg` estándar de Node vía un adaptador. Esto es
// más liviano, no depende de descargar binarios en el build/deploy, y
// funciona bien en plataformas serverless (Vercel/Railway/Render).
//
// `import.meta.env` solo existe dentro de Astro/Vite; si este módulo se
// importa desde un script plano (ej. scripts/seed-admin.ts vía tsx), se
// usa `process.env` como respaldo.
const env: Record<string, string | undefined> =
  (import.meta as unknown as { env?: Record<string, string | undefined> })
    .env ?? process.env;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (env.DEV) globalForPrisma.prisma = prisma;

export default prisma;
