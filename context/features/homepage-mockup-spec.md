# CodStash Homepage Spec

Create a marketing homepage for CodStash - a developer knowledge hub for code snippets, AI prompts, commands, notes, files, images, and links.

**Output:** the `/` route of the Next.js app (`src/app/page.tsx`), built with Tailwind CSS v4, shadcn/ui and lucide-react icons. No standalone HTML/CSS/JS prototype.

---

## Routing

- `/` shows the landing page to **everyone**, signed in or not. The current `redirect("/dashboard")` in `src/app/page.tsx` is removed.
- Signing in (email or GitHub) still lands on `/dashboard` (`DEFAULT_REDIRECT` in `src/actions/auth.ts`, unchanged).
- `/` stays outside the proxy matcher, so it remains public.

---

## Visual Direction

- Dark only, matching the app (`colorScheme: "dark"`, shadcn neutral greys). Sober and minimal, in the spirit of Linear / Raycast.
- Bright colours are reserved for item type accents and the headline gradient.
- Font: Geist (sans) and Geist Mono (code), as in the app.

## Color Palette

Item type accents, identical to the app (`src/lib/item-type-ui.ts`, Tailwind `-400` shades):

- Snippet: `#34d399` (Emerald)
- Prompt: `#fbbf24` (Amber)
- Note: `#60a5fa` (Blue)
- Command: `#22d3ee` (Cyan)
- File: `#fb7185` (Rose)
- Image: `#a78bfa` (Violet)
- Link: `#a3e635` (Lime)

Use the same Tailwind classes as the app (`text-emerald-400`, etc.), not new hex tokens.

---

## Hero Section (Main Focus)

The hero shows a "chaos to order" concept with three elements side by side:

### Chaos Container (Left)

A box labeled "Your knowledge today..." containing 8 floating icons representing where developers currently scatter their knowledge:

- Notion, GitHub, Slack, VS Code logos (inline SVGs — lucide-react v1 has no brand icons)
- Browser tabs, Terminal, Text file, Bookmark icons (lucide-react)

**The icons should animate:**

- Float around randomly, bouncing off walls
- Subtle rotation and scale pulsing
- Move away from mouse cursor on hover (pointer devices only)

### Transform Arrow (Center)

A pulsing arrow pointing from chaos to order.

### Dashboard Preview (Right)

A box labeled "...with CodStash" showing a simplified mockup of the real dashboard (see `context/screenshots/dashboard-ui-main.png`):

- Sidebar with the item types (icon + name, in their accent colour) and a few collections
- Grid of item cards styled like the app's cards: a faint background tint of the type colour (~6%) and the type's lucide icon in its accent colour — not coloured top borders

---

## Other Sections

1. **Navigation** - Fixed top nav with the CodStash logo, "Features" / "Pricing" anchor links, "Sign In" (→ `/sign-in`) and "Get Started" (→ `/register`) buttons.

2. **Hero Text** - Above the visual: "Stop Losing Your Developer Knowledge" headline with gradient text, subheadline about scattered knowledge (snippets in VS Code, prompts in chats, commands in bash history...), CTA buttons ("Get Started Free" → `/register`, "See Features" → `#features`).

3. **Features** (`#features`) - 6 cards in a grid. Each card uses an accent colour:
   - Code Snippets — Snippet emerald
   - AI Prompts — Prompt amber
   - Commands — Command cyan
   - Notes & Links — Note blue
   - Files & Images — File rose
   - Collections & Instant Search — neutral (white/grey accent)

4. **AI Section** - Two columns. Left: "Pro Feature" badge and a checklist of the planned AI capabilities: auto-tagging, AI summaries, Explain Code, prompt optimization. Right: a code editor mockup with an "AI Generated Tags" demo.

5. **Pricing** (`#pricing`) - Monthly / yearly toggle.
   - **Free** — $0: 50 items, 3 collections, basic search, no AI (images are a Pro type).
   - **Pro** — $8/mo or $72/yr ("Save 25%" on yearly): unlimited items and collections, file and image uploads, custom item types, AI features, export (JSON / ZIP).
   - Pro card highlighted with a "Most Popular" badge.
   - Both buttons link to `/register` (Stripe is not wired up yet).

6. **CTA** - "Ready to Organize Your Knowledge?" with a button → `/register`.

7. **Footer** - Logo, link columns using only existing destinations (page anchors, `/sign-in`, `/register`), copyright with the current year.

---

## Animations

- **Chaos icons**: client component using `requestAnimationFrame`. Icons drift, bounce off walls, repel from the mouse cursor.
- **Arrow**: CSS pulse animation
- **Scroll**: elements fade in when scrolling into view
- **Navbar**: gets more opaque on scroll
- **Reduced motion**: with `prefers-reduced-motion`, icons stay still and fade-ins are disabled.

---

## Implementation Notes

- The page is a server component; only the animated parts (chaos container, scroll fade-ins, navbar opacity, pricing toggle) are client components.
- Static content, no database access.
- Page metadata title: "CodStash — Developer Knowledge Hub".

---

## Responsive

- Mobile: stack chaos / arrow / dashboard vertically, single-column grids
- Arrow rotates 90° on mobile to point down
- Nav links collapse on mobile (Sign In / Get Started stay visible)
