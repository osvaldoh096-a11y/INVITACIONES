-- Agrega la URL publicada en Framer de cada evento, para que los links
-- personalizados de la lista de invitados apunten al diseño real en vez
-- de a la página de respaldo interna.
ALTER TABLE "EventProject" ADD COLUMN "framerUrl" TEXT;
