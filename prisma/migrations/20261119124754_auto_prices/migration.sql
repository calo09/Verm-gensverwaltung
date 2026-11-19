-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "autoPrice" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priceError" TEXT,
ADD COLUMN     "priceSymbol" TEXT,
ADD COLUMN     "priceUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "quantity" DECIMAL(28,10);
