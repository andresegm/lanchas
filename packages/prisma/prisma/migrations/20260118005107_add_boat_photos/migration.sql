-- CreateTable
CREATE TABLE "BoatPhoto" (
    "id" TEXT NOT NULL,
    "boatId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoatPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoatPhoto_boatId_idx" ON "BoatPhoto"("boatId");

-- AddForeignKey
ALTER TABLE "BoatPhoto" ADD CONSTRAINT "BoatPhoto_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "Boat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
