-- Data only: amber (Prompt) and yellow (Link) were too close to tell apart.
UPDATE "ItemType"
SET "color" = 'lime', "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'link' AND "isSystem" = true AND "userId" IS NULL AND "color" = 'yellow';
