ALTER TABLE "Ingredient"
ADD COLUMN "normalizedName" TEXT,
ADD COLUMN "nameEn" TEXT,
ADD COLUMN "category" TEXT,
ADD COLUMN "isStockManaged" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Recipe"
ADD COLUMN "sourceId" TEXT,
ADD COLUMN "normalizedName" TEXT,
ADD COLUMN "category" TEXT;

CREATE UNIQUE INDEX "Recipe_sourceId_key" ON "Recipe"("sourceId");
