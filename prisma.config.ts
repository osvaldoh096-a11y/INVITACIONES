import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Nota: el CLIENTE de Prisma (usado por la app en tiempo de ejecución) usa
// el motor "client" + adaptador `pg` (ver prisma/schema.prisma y
// src/lib/prisma.ts) — no requiere binarios nativos y funciona en
// serverless/edge. Este archivo solo configura el "schema engine" clásico
// que usan los comandos `prisma migrate` / `prisma studio` en tu máquina.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  engine: 'classic',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
