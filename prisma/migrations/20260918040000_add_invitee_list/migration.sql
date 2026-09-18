-- CreateTable
CREATE TABLE "Invitee" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "maxPasses" INTEGER NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "inviteCode" TEXT NOT NULL,
    "isGeneric" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rsvpId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "Invitee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invitee_inviteCode_key" ON "Invitee"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "Invitee_rsvpId_key" ON "Invitee"("rsvpId");

-- CreateIndex
CREATE INDEX "Invitee_eventId_idx" ON "Invitee"("eventId");

-- AddForeignKey
ALTER TABLE "Invitee" ADD CONSTRAINT "Invitee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "EventProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitee" ADD CONSTRAINT "Invitee_rsvpId_fkey" FOREIGN KEY ("rsvpId") REFERENCES "RSVP"("id") ON DELETE SET NULL ON UPDATE CASCADE;
