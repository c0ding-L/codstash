/**
 * Seeds the database with sample data for development and demos.
 *
 * Run with: npm run db:seed
 *
 * Idempotent, but destructive for the demo user: the script deletes
 * demo@codstash.io first (which cascades their items, collections, tags,
 * accounts and sessions) and recreates everything. Rows belonging to any other
 * user are never touched.
 *
 * The system item types are upserted on a fixed id and never deleted:
 * `Item.typeId` is `onDelete: Restrict`, so removing a type any user still
 * references would fail.
 */
import "dotenv/config";

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

const DEMO_EMAIL = "demo@codstash.io";
const DEMO_PASSWORD = "12345678";
const BCRYPT_ROUNDS = 12;

/**
 * Explicit ids rather than an upsert on `@@unique([userId, slug])`: system
 * types have `userId: null`, and NULLs do not collide in a PostgreSQL unique
 * index, so that constraint would let a duplicate through on every run. The
 * ids match the ones in `src/lib/mock-data.ts`.
 *
 * `icon` holds a lucide-react component name and `color` a colour token; both
 * are the shapes `src/lib/item-type-ui.ts` maps to icons and Tailwind classes.
 */
const SYSTEM_ITEM_TYPES = [
  { id: "typ_snippet", slug: "snippet", name: "Snippet", icon: "Code2", color: "emerald" },
  { id: "typ_prompt", slug: "prompt", name: "Prompt", icon: "Sparkles", color: "amber" },
  { id: "typ_note", slug: "note", name: "Note", icon: "FileText", color: "blue" },
  { id: "typ_command", slug: "command", name: "Command", icon: "SquareTerminal", color: "cyan" },
  { id: "typ_file", slug: "file", name: "File", icon: "File", color: "rose" },
  { id: "typ_image", slug: "image", name: "Image", icon: "Image", color: "violet" },
  { id: "typ_link", slug: "link", name: "Link", icon: "Link", color: "yellow" },
] as const;

type TypeSlug = (typeof SYSTEM_ITEM_TYPES)[number]["slug"];

interface SeedItem {
  type: TypeSlug;
  title: string;
  description: string;
  content?: string;
  url?: string;
  language?: string;
  isPinned?: boolean;
  isFavorite?: boolean;
}

interface SeedCollection {
  name: string;
  description: string;
  isFavorite?: boolean;
  items: SeedItem[];
}

const COLLECTIONS: SeedCollection[] = [
  {
    name: "React Patterns",
    description: "Reusable React patterns and hooks",
    isFavorite: true,
    items: [
      {
        type: "snippet",
        title: "useDebounce",
        description: "Delays a value until it stops changing, for search inputs.",
        language: "typescript",
        isPinned: true,
        isFavorite: true,
        content: `import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}`,
      },
      {
        type: "snippet",
        title: "Theme context provider",
        description: "Context provider plus a hook that throws outside its provider.",
        language: "typescript",
        content: `"use client";

import { createContext, useContext, useMemo, useState } from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside a ThemeProvider");
  return context;
}`,
      },
      {
        type: "snippet",
        title: "cn — class name merger",
        description: "clsx plus tailwind-merge, so later utilities win.",
        language: "typescript",
        content: `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}`,
      },
    ],
  },
  {
    name: "AI Workflows",
    description: "AI prompts and workflow automations",
    items: [
      {
        type: "prompt",
        title: "Code review — correctness first",
        description: "Review prompt that ranks findings by severity instead of listing nits.",
        isPinned: true,
        content: `Review the diff below as a senior engineer on this codebase.

Rank every finding by severity: correctness bugs first, then security, then
performance, then style. For each one give the file and line, one sentence on
what breaks, and the concrete input or state that triggers it. Skip anything
you cannot tie to a failure. If the diff is correct, say so plainly.

Diff:
"""
{{diff}}
"""`,
      },
      {
        type: "prompt",
        title: "Generate docstrings",
        description: "Documents public API surface without restating the code.",
        content: `Write documentation comments for every exported symbol in the file below.

Explain why the code exists and the constraints callers must respect — not what
each line does. Document parameters, return values and thrown errors. Match the
comment style already present in the file. Change no code.

File:
"""
{{file}}
"""`,
      },
      {
        type: "prompt",
        title: "Refactor with a safety net",
        description: "Behaviour-preserving refactor, one change at a time.",
        isFavorite: true,
        content: `Refactor the code below for clarity, preserving behaviour exactly.

Rules:
- One conceptual change per step, each independently reviewable.
- No new dependencies and no API changes unless I ask.
- Flag any place where a refactor would change behaviour, and stop there.
- Finish with the command that proves nothing broke.

Code:
"""
{{code}}
"""`,
      },
    ],
  },
  {
    name: "DevOps",
    description: "Infrastructure and deployment resources",
    items: [
      {
        type: "snippet",
        title: "Multi-stage Dockerfile for Next.js",
        description: "Standalone output, non-root runtime user.",
        language: "dockerfile",
        content: `FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
USER app
EXPOSE 3000
CMD ["node", "server.js"]`,
      },
      {
        type: "command",
        title: "Deploy to production",
        description: "Migrate, then build and promote in one go.",
        language: "bash",
        content: `npx prisma migrate deploy && npm run build && vercel deploy --prod`,
      },
      {
        type: "link",
        title: "GitHub Actions workflow syntax",
        description: "Reference for every key allowed in a workflow file.",
        url: "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax",
      },
      {
        type: "link",
        title: "Dockerfile reference",
        description: "Every instruction, with the caching rules that go with it.",
        url: "https://docs.docker.com/reference/dockerfile/",
      },
    ],
  },
  {
    name: "Terminal Commands",
    description: "Useful shell commands for everyday development",
    items: [
      {
        type: "command",
        title: "Undo the last commit, keep the changes",
        description: "Soft reset — the work stays staged.",
        language: "bash",
        isFavorite: true,
        content: `git reset --soft HEAD~1`,
      },
      {
        type: "command",
        title: "Prune Docker disk usage",
        description: "Removes stopped containers, unused networks, dangling images and build cache.",
        language: "bash",
        content: `docker system prune -af --volumes`,
      },
      {
        type: "command",
        title: "Kill whatever holds port 3000",
        description: "The dev server that refuses to die.",
        language: "bash",
        content: `lsof -ti :3000 | xargs -r kill -9`,
      },
      {
        type: "command",
        title: "Find heavy production dependencies",
        description: "Sorts installed packages by size, biggest last.",
        language: "bash",
        content: `du -sh node_modules/* | sort -h | tail -20`,
      },
    ],
  },
  {
    name: "Design Resources",
    description: "UI/UX resources and references",
    items: [
      {
        type: "link",
        title: "Tailwind CSS documentation",
        description: "Utility reference and the v4 CSS-first configuration guide.",
        url: "https://tailwindcss.com/docs",
      },
      {
        type: "link",
        title: "shadcn/ui components",
        description: "The component source this project copies from.",
        url: "https://ui.shadcn.com/docs/components",
      },
      {
        type: "link",
        title: "Refactoring UI",
        description: "Practical design rules for developers building their own UI.",
        url: "https://www.refactoringui.com/",
      },
      {
        type: "link",
        title: "Lucide icons",
        description: "Searchable index of the icon set used across the app.",
        url: "https://lucide.dev/icons/",
      },
    ],
  },
];

async function main() {
  console.log("→ resetting demo data");
  // Deleting the user cascades their items, collections, tags, accounts and
  // sessions. It has to happen before the item types, which are Restrict.
  const { count: deletedUsers } = await prisma.user.deleteMany({
    where: { email: DEMO_EMAIL },
  });
  console.log(`  removed ${deletedUsers} user(s)`);
  // The system item types are deliberately not deleted: they are upserted on a
  // fixed id below, and deleting them would fail (Restrict) as soon as another
  // user owns an item of that type.

  console.log("\n→ user");
  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: "Demo User",
      password: await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS),
      isPro: false,
      emailVerified: new Date(),
    },
  });
  console.log(`  ${user.email}`);

  console.log("\n→ system item types");
  const typeIds = new Map<TypeSlug, string>();
  for (const type of SYSTEM_ITEM_TYPES) {
    const created = await prisma.itemType.upsert({
      where: { id: type.id },
      update: { name: type.name, icon: type.icon, color: type.color, isSystem: true },
      create: { ...type, isSystem: true },
    });
    typeIds.set(type.slug, created.id);
    console.log(`  ${created.slug.padEnd(8)} ${created.color}`);
  }

  console.log("\n→ collections and items");
  let itemTotal = 0;
  for (const collection of COLLECTIONS) {
    const created = await prisma.collection.create({
      data: {
        name: collection.name,
        description: collection.description,
        isFavorite: collection.isFavorite ?? false,
        userId: user.id,
        items: {
          create: collection.items.map((item) => ({
            title: item.title,
            description: item.description,
            content: item.content ?? null,
            url: item.url ?? null,
            language: item.language ?? null,
            isPinned: item.isPinned ?? false,
            isFavorite: item.isFavorite ?? false,
            userId: user.id,
            typeId: typeIds.get(item.type)!,
          })),
        },
      },
      include: { _count: { select: { items: true } } },
    });
    itemTotal += created._count.items;
    console.log(`  ${created.name.padEnd(18)} ${created._count.items} item(s)`);
  }

  console.log(
    `\nseeded ${SYSTEM_ITEM_TYPES.length} types, ${COLLECTIONS.length} collections, ${itemTotal} items`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error("\nseed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
