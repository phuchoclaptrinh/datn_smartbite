CREATE TYPE "InventoryGroup" AS ENUM ('Main', 'Auxiliary', 'Vegetable', 'Fruit', 'Staple', 'Sauce', 'Other');

ALTER TABLE "Ingredient"
ADD COLUMN "inventoryGroup" "InventoryGroup" NOT NULL DEFAULT 'Other';
