/**
 * Crea la primera cuenta de administrador (tú). Úsalo una sola vez al
 * desplegar el sistema por primera vez, o para recuperar acceso.
 *
 * Uso:
 *   npm run seed:admin -- --email=tu@correo.com --password=algo-seguro --name="Osvaldo"
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/lib/auth';

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found?.slice(prefix.length);
}

async function main() {
  const email = getArg('email');
  const password = getArg('password');
  const name = getArg('name');

  if (!email || !password) {
    console.error(
      'Uso: npm run seed:admin -- --email=tu@correo.com --password=algo-seguro [--name="Tu nombre"]',
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('La contraseña debe tener al menos 8 caracteres.');
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.error(`Ya existe una cuenta con el correo ${email}.`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const hashed = await hashPassword(password);
  const user = await prisma.adminUser.create({
    data: { email, password: hashed, name },
  });

  console.log(`✅ Cuenta de administrador creada: ${user.email} (id: ${user.id})`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
