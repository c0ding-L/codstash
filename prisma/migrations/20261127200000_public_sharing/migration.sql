-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "shareId" TEXT,
ADD COLUMN     "shareIndexable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shareShowOwner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sharedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "shareId" TEXT,
ADD COLUMN     "shareIndexable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shareShowOwner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sharedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Collection_shareId_key" ON "Collection"("shareId");

-- CreateIndex
CREATE UNIQUE INDEX "Item_shareId_key" ON "Item"("shareId");

