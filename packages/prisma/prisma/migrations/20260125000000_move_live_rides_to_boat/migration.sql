-- Add liveRidesOn column to Boat table
ALTER TABLE "Boat" ADD COLUMN "liveRidesOn" BOOLEAN NOT NULL DEFAULT false;

-- Migrate data: set liveRidesOn=true for all boats owned by captains who have liveRidesOn=true
UPDATE "Boat" 
SET "liveRidesOn" = true 
WHERE "captainId" IN (
    SELECT "id" FROM "Captain" WHERE "liveRidesOn" = true
);

-- Drop liveRidesOn column from Captain table
ALTER TABLE "Captain" DROP COLUMN "liveRidesOn";
