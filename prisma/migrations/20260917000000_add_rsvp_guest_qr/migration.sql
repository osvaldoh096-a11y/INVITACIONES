-- CreateTable
CREATE TABLE "RsvpGuest" (
    "id" TEXT NOT NULL,
    "rsvpId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
    "checkedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RsvpGuest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RsvpGuest_qrToken_key" ON "RsvpGuest"("qrToken");

-- CreateIndex
CREATE INDEX "RsvpGuest_rsvpId_idx" ON "RsvpGuest"("rsvpId");

-- AddForeignKey
ALTER TABLE "RsvpGuest" ADD CONSTRAINT "RsvpGuest_rsvpId_fkey" FOREIGN KEY ("rsvpId") REFERENCES "RSVP"("id") ON DELETE CASCADE ON UPDATE CASCADE;
