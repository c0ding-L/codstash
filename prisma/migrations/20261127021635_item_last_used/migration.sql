-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "lastUsedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Item_userId_lastUsedAt_idx" ON "Item"("userId", "lastUsedAt");
