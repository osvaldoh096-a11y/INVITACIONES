-- Plantilla de mensaje personalizable por evento, para el mensaje que el
-- cliente copia/manda a sus invitados (Plata: mensaje genérico con link;
-- Oro/Diamante: mensaje por invitado con nombre y pases).
ALTER TABLE "EventProject" ADD COLUMN "inviteMessageTemplate" TEXT;
