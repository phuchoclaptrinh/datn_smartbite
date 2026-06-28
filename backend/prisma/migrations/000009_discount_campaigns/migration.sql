CREATE TYPE "DiscountType" AS ENUM ('Percent', 'Fixed');

CREATE TABLE "DiscountCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "minOrderAmount" INTEGER NOT NULL DEFAULT 0,
    "maxDiscount" INTEGER,
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountCampaign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscountCampaign_code_key" ON "DiscountCampaign"("code");
CREATE INDEX "DiscountCampaign_isActive_startsAt_endsAt_idx" ON "DiscountCampaign"("isActive", "startsAt", "endsAt");
