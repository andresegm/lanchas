-- CreateEnum
CREATE TYPE "Rumbo" AS ENUM ('RUMBO_1', 'RUMBO_2', 'RUMBO_3');

-- CreateTable
CREATE TABLE "BoatRumboPricing" (
    "id" TEXT NOT NULL,
    "boatId" TEXT NOT NULL,
    "rumbo" "Rumbo" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "hourlyRateCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoatRumboPricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoatRumboPricing_boatId_idx" ON "BoatRumboPricing"("boatId");

-- CreateIndex
CREATE INDEX "BoatRumboPricing_rumbo_idx" ON "BoatRumboPricing"("rumbo");

-- CreateIndex
CREATE UNIQUE INDEX "BoatRumboPricing_boatId_rumbo_key" ON "BoatRumboPricing"("boatId", "rumbo");

-- AddForeignKey
ALTER TABLE "BoatRumboPricing" ADD CONSTRAINT "BoatRumboPricing_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "Boat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
