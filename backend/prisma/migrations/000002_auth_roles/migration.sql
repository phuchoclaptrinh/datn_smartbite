CREATE TYPE "UserRole" AS ENUM ('Customer', 'Manager');

ALTER TABLE "User"
ADD COLUMN "passwordHash" TEXT NOT NULL DEFAULT '',
ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'Customer';
