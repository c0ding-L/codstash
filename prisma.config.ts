// Prisma 7 reads CLI configuration from here rather than from the schema's
// datasource block. `.env` is no longer loaded automatically, hence dotenv.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    path: "./prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
