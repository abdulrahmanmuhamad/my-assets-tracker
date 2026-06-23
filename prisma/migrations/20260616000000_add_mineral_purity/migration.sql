ALTER TABLE "mineral_transactions"
ADD COLUMN "karat" DECIMAL(5,2),
ADD COLUMN "purity_percent" DECIMAL(6,3);

UPDATE "mineral_transactions"
SET "karat" = 24
WHERE "mineral_type" = 'Gold' AND "karat" IS NULL;

UPDATE "mineral_transactions"
SET "purity_percent" = 100
WHERE "mineral_type" <> 'Gold' AND "purity_percent" IS NULL;

