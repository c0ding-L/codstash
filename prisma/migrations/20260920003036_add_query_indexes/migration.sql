-- CreateIndex
CREATE INDEX "Collection_userId_isFavorite_idx" ON "Collection"("userId", "isFavorite");

-- CreateIndex
CREATE INDEX "Item_collectionId_typeId_idx" ON "Item"("collectionId", "typeId");
