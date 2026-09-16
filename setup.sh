#!/bin/bash

echo "🎉 Invitaciones digitales — Setup rápido"
echo "========================================"
echo ""

if [ ! -f .env ]; then
    echo "📝 Creando archivo .env desde .env.example..."
    cp .env.example .env
    SECRET=$(openssl rand -hex 32)
    # Reemplaza el SESSION_SECRET de ejemplo por uno generado de verdad.
    sed -i.bak "s#SESSION_SECRET=.*#SESSION_SECRET=\"$SECRET\"#" .env && rm -f .env.bak
    echo "✅ .env creado."
    echo ""
    echo "⚠️  IMPORTANTE: completa en .env → DATABASE_URL, y (cuando estés listo) las variables GOOGLE_* y FRAMER_ALLOWED_ORIGIN."
    echo ""
    read -p "Presiona Enter cuando hayas actualizado DATABASE_URL en .env..."
fi

echo ""
echo "📦 Instalando dependencias..."
npm install

echo ""
echo "🔨 Generando cliente de Prisma..."
npx prisma generate

echo ""
echo "🗄️  Aplicando migraciones..."
npx prisma migrate deploy

echo ""
echo "👤 Crea tu cuenta de administrador (no hay registro público):"
read -p "   Correo: " ADMIN_EMAIL
read -s -p "   Contraseña (mínimo 8 caracteres): " ADMIN_PASSWORD
echo ""
npm run seed:admin -- --email="$ADMIN_EMAIL" --password="$ADMIN_PASSWORD"

echo ""
echo "✅ Listo."
echo ""
echo "🚀 Para arrancar el servidor de desarrollo:"
echo "   npm run dev"
echo ""
echo "📖 Más detalles en README.md (sección 'Conectar Framer' y 'Conectar Google Sheets')."
