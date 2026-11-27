# A6 — Secret detection

## Overview

Developers paste tokens and keys without noticing. Cortex will soon send content further
afield: AI calls already go to OpenRouter, MCP (C3) feeds assistants, and public collections
(D1) are open to anyone. Detection uses known patterns. It **warns and asks to confirm** on save
and before an AI call. It **hard-blocks only public sharing** (D1). Roadmap:
`docs/roadmap-v2.md` § A6. Must ship before C3 and D1.

## Requirements

### Detector (`src/lib/secrets.ts`, pure, client-safe)

`detectSecrets(text): SecretFinding[]`, where `SecretFinding = { kind, line, preview }`.
`preview` is masked: the first 4 characters, then `…`, never the whole value.

| Kind | Pattern (sketch) |
| --- | --- |
| `privateKey` | `-----BEGIN (RSA \|EC \|OPENSSH \|DSA \|PGP )?PRIVATE KEY-----` |
| `aws` | `\b(AKIA\|ASIA)[0-9A-Z]{16}\b` |
| `github` | `\bgh[pousr]_[A-Za-z0-9]{36,}\b`, `\bgithub_pat_[A-Za-z0-9_]{50,}\b` |
| `openai` / `anthropic` / `openrouter` | `\bsk-(proj-\|ant-\|or-v1-)?[A-Za-z0-9_-]{20,}\b` |
| `stripe` | `\b(sk\|rk)_(live\|test)_[A-Za-z0-9]{20,}\b` |
| `slack` | `\bxox[abprs]-[A-Za-z0-9-]{10,}\b` |
| `google` | `\bAIza[0-9A-Za-z_-]{35}\b` |
| `jwt` | `\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b` |
| `connectionString` | `\b(postgres(ql)?\|mysql\|mongodb(\+srv)?\|redis)://[^:\s]+:[^@\s]+@` |
| `envAssignment` | `^\s*(export\s+)?[A-Z0-9_]*(SECRET\|TOKEN\|PASSWORD\|PASSWD\|API_KEY\|PRIVATE_KEY)[A-Z0-9_]*\s*=\s*\S{8,}` |

- **Placeholders are ignored**, to avoid false alarms in tutorials:
  - values made only of `x`, `X`, `*` or `.`
  - `<...>`, `${...}`, `{{...}}`
  - values containing `your`, `example`, `changeme`, `placeholder`, `dummy` or `fake`
    (case-insensitive)
  - `sk-...` with fewer than 20 real characters
- Linear time: no nested quantifiers, and the input is capped (`ITEM_LIMITS.content`). Test a
  100,000-character input for speed (< 50 ms).
- `scanItem({ title, description, content, url })` scans each field (the URL too: tokens in
  query strings).

### Where it warns (client, confirm dialog)

- **Save** (New Item and the drawer's edit form):
  - On submit, scan the form.
  - If anything is found, open `SecretWarningDialog`:
    - It lists each kind and line, with the masked preview.
    - "This looks like a secret. Anyone you share it with, and the AI features, will see it."
    - Buttons: "Edit" (back to the form) and "Save anyway".
  - No server-side block on save.
- **Before an AI call** (Suggest Tags, Description, Explain, Optimize): same dialog with "Send
  anyway" / "Cancel". Content already on screen is scanned, so there is no extra request.
- **Remember the choice:** once the user confirms for an item, do not ask again for the same
  content in the same session (keyed by a hash of the content, in memory).

### Server-side helpers for later steps

- `containsSecrets(item)`: a boolean, used by D1 (block sharing, hide on the public page) and
  C3 (a warning line in MCP results).

### The AI provider's data policy

- Before writing the dialog copy, check the current terms of the free OpenRouter model in use
  (`nvidia/nemotron-3-ultra-550b-a55b:free`): does the provider log or train on prompts?
- Put the answer, with its source link and the date, in this spec's Notes. Word the dialog
  according to the facts found, and claim nothing that was not verified.

## Testing

- `src/lib/secrets.test.ts`:
  - One true positive per kind, using **made-up** values that match the shape (never real
    keys).
  - One placeholder per kind that must not match (`sk-xxxxxxxx`, `AKIAEXAMPLE…`,
    `API_KEY=your-api-key`, `postgres://user:password@localhost` → decide and document: the
    literal `password` is a placeholder).
  - The line number is right, and the preview is masked.
  - The 100k input runs in time.
  - `scanItem` covers the URL.
- Components are not unit-tested. Browser check: save a note holding a fake `ghp_…` token and
  see the dialog, then "Save anyway" saves it. Explain on a snippet holding a fake key shows the
  dialog before any request.

## Notes

- Not a guarantee: the dialog says "looks like", and no copy claims full detection.
- Strings in `secrets.*` (EN/FR).
- Known gaps, decided on review: a `sk-` value with no digit is not a key (no real key lacks
  one; this avoids names like `sk-learn-…`), and a database URL whose password holds a raw `/`
  is not reported (the password stops at `/` to keep the scan linear; URLs percent-encode it).
- **Data policy, checked 2026-11-27.** NVIDIA is the only provider of
  `nvidia/nemotron-3-ultra-550b-a55b:free` (the model in use: `AI_MODEL` is empty, so
  `ai-client.ts` uses its default). Its notice on
  https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free/providers says: "Your use is logged
  for security purposes and to improve NVIDIA products and services", the logged data "is not
  linked to your identity", and "please do not upload any confidential information or personal
  data". OpenRouter "does not use your Inputs or Outputs for model training"
  (https://openrouter.ai/privacy, updated 2026-08-31). **Not verified:** whether NVIDIA trains on
  prompts, and for how long it keeps them (the NVIDIA API Trial Terms PDF could not be read).
  So the AI dialog says only "The AI provider logs requests to improve its products."
