CREATE TYPE "InventoryMovementType" AS ENUM ('Import', 'Export', 'Adjustment');

CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryClosing" (
    "id" TEXT NOT NULL,
    "closingDate" DATE NOT NULL,
    "createdById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryClosing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryClosingItem" (
    "id" TEXT NOT NULL,
    "closingId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "expectedQuantity" INTEGER NOT NULL,
    "actualQuantity" INTEGER NOT NULL,
    "variance" INTEGER NOT NULL,
    "unit" "FridgeUnit" NOT NULL,
    CONSTRAINT "InventoryClosingItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryClosing_closingDate_key" ON "InventoryClosing"("closingDate");
CREATE INDEX "InventoryMovement_ingredientId_createdAt_idx" ON "InventoryMovement"("ingredientId", "createdAt");
CREATE INDEX "InventoryMovement_type_createdAt_idx" ON "InventoryMovement"("type", "createdAt");
CREATE INDEX "InventoryClosing_createdById_closingDate_idx" ON "InventoryClosing"("createdById", "closingDate");
CREATE UNIQUE INDEX "InventoryClosingItem_closingId_ingredientId_key" ON "InventoryClosingItem"("closingId", "ingredientId");
CREATE INDEX "InventoryClosingItem_ingredientId_idx" ON "InventoryClosingItem"("ingredientId");

ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryClosing" ADD CONSTRAINT "InventoryClosing_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryClosingItem" ADD CONSTRAINT "InventoryClosingItem_closingId_fkey" FOREIGN KEY ("closingId") REFERENCES "InventoryClosing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryClosingItem" ADD CONSTRAINT "InventoryClosingItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
