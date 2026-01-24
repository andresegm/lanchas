-- CreateEnum
CREATE TYPE "LiveRideStatus" AS ENUM ('REQUESTED', 'OFFERED', 'ACCEPTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "LiveRideOfferStatus" AS ENUM ('OFFERED', 'REJECTED', 'ACCEPTED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'LIVE_RIDE_OFFER';

-- AlterTable
ALTER TABLE "Captain" ADD COLUMN     "liveRidesOn" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "liveRideRequestId" TEXT;

-- CreateTable
CREATE TABLE "LiveRideRequest" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "pickupPoint" TEXT NOT NULL,
    "rumbo" "Rumbo" NOT NULL,
    "passengerCount" INTEGER NOT NULL,
    "hours" INTEGER NOT NULL,
    "hourlyRateCents" INTEGER NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "commissionCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "LiveRideStatus" NOT NULL DEFAULT 'REQUESTED',
    "offeredToCaptainId" TEXT,
    "tripId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveRideRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveRideOffer" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "captainId" TEXT NOT NULL,
    "boatId" TEXT NOT NULL,
    "status" "LiveRideOfferStatus" NOT NULL DEFAULT 'OFFERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveRideOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveRideRequest_tripId_key" ON "LiveRideRequest"("tripId");

-- CreateIndex
CREATE INDEX "LiveRideRequest_createdById_idx" ON "LiveRideRequest"("createdById");

-- CreateIndex
CREATE INDEX "LiveRideRequest_status_idx" ON "LiveRideRequest"("status");

-- CreateIndex
CREATE INDEX "LiveRideRequest_offeredToCaptainId_idx" ON "LiveRideRequest"("offeredToCaptainId");

-- CreateIndex
CREATE INDEX "LiveRideRequest_createdAt_idx" ON "LiveRideRequest"("createdAt");

-- CreateIndex
CREATE INDEX "LiveRideOffer_captainId_idx" ON "LiveRideOffer"("captainId");

-- CreateIndex
CREATE INDEX "LiveRideOffer_status_idx" ON "LiveRideOffer"("status");

-- CreateIndex
CREATE INDEX "LiveRideOffer_createdAt_idx" ON "LiveRideOffer"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiveRideOffer_requestId_captainId_key" ON "LiveRideOffer"("requestId", "captainId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_liveRideRequestId_fkey" FOREIGN KEY ("liveRideRequestId") REFERENCES "LiveRideRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveRideRequest" ADD CONSTRAINT "LiveRideRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveRideRequest" ADD CONSTRAINT "LiveRideRequest_offeredToCaptainId_fkey" FOREIGN KEY ("offeredToCaptainId") REFERENCES "Captain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveRideRequest" ADD CONSTRAINT "LiveRideRequest_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveRideOffer" ADD CONSTRAINT "LiveRideOffer_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "LiveRideRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveRideOffer" ADD CONSTRAINT "LiveRideOffer_captainId_fkey" FOREIGN KEY ("captainId") REFERENCES "Captain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveRideOffer" ADD CONSTRAINT "LiveRideOffer_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "Boat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
