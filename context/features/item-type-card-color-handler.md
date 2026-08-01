# Feature — Couleur de fond des cartes par type d'item

> Comment chaque type d'item (chacun ayant sa couleur d'accent) applique cette
> couleur au fond de sa carte, sans jamais casser la lisibilité
> du thème sombre.
>

---

## 1. Principe général

Chaque type d'item possède **une couleur d'accent unique**. Cette couleur n'est
**jamais** utilisée en fond plein. Elle est déclinée en **4 rôles** à des
opacités croissantes, du plus subtil au plus saturé :

| Rôle    | Où                                    | Opacité de l'accent | Objectif |
| ------- | ------------------------------------- | ------------------- | -------- |
| `wash`  | fond de toute la carte                | **6 %**             | teinter très légèrement la carte pour l'associer au type |
| `ring`  | bordure de la carte au survol         | **40 %**            | souligner le type au hover |
| `tint`  | fond de la puce d'icône               | **15 %**            | pastille colorée sous l'icône |
| `color` | icône + label texte                   | **100 %**           | seul endroit où l'accent est pleinement saturé |

Règle clé : **plus la surface est grande, plus l'opacité est faible.** Le fond
de carte (grande surface) est à 6 %, la puce d'icône (petite surface) à 15 %,
et seuls les petits éléments (icône, label) utilisent la couleur pleine.

---

## 2. Les couleurs d'accent (tokens)

Définies dans `:root` de `app/globals.css`, en OKLCH, avec luminosité et chroma
volontairement homogènes pour un rendu cohérent sur fond sombre :

```css
--snippet: oklch(0.72 0.15 162);  /* vert émeraude */
--prompt:  oklch(0.78 0.14 75);   /* ambre / or */
--note:    oklch(0.7 0.13 235);   /* bleu */
--command: oklch(0.72 0.11 195);  /* cyan */
--file:    oklch(0.72 0.15 30);   /* orange-rouge */
--image:   oklch(0.72 0.13 340);  /* rose / magenta */
--link:    oklch(0.8 0.13 100);   /* jaune-vert (lime) */
```

Ces variables sont exposées comme utilitaires Tailwind via `@theme inline` :

```css
@theme inline {
  --color-snippet: var(--snippet);
  --color-prompt:  var(--prompt);
  --color-note:    var(--note);
  --color-command: var(--command);
  --color-file:    var(--file);
  --color-image:   var(--image);
  --color-link:    var(--link);
}
```

Résultat : les classes `bg-snippet`, `text-prompt`, `border-note`, etc. sont
générées automatiquement, ainsi que leurs variantes d'opacité (`bg-snippet/15`).

---

## 3. Le mapping type → classes (`lib/dashboard-data.ts`)

Chaque type déclare ses 4 classes dans `TYPES`. C'est la **source de vérité** :

```ts
export interface TypeConfig {
  type: ContentType
  label: string
  icon: LucideIcon
  color: string  // texte/icône pleine couleur
  tint: string   // fond puce d'icône (15 %)
  wash: string   // fond de carte (6 %)
  ring: string   // bordure au survol (40 %)
}

export const TYPES: TypeConfig[] = [
  { type: 'snippet', label: 'Snippets', icon: Code2,         color: 'text-snippet', tint: 'bg-snippet/15', wash: 'bg-snippet/[0.06]', ring: 'hover:border-snippet/40' },
  { type: 'prompt',  label: 'Prompts',  icon: Sparkles,      color: 'text-prompt',  tint: 'bg-prompt/15',  wash: 'bg-prompt/[0.06]',  ring: 'hover:border-prompt/40' },
  { type: 'note',    label: 'Notes',    icon: StickyNote,    color: 'text-note',    tint: 'bg-note/15',    wash: 'bg-note/[0.06]',    ring: 'hover:border-note/40' },
  { type: 'command', label: 'Commands', icon: TerminalSquare,color: 'text-command', tint: 'bg-command/15', wash: 'bg-command/[0.06]', ring: 'hover:border-command/40' },
  { type: 'file',    label: 'Files',    icon: File,          color: 'text-file',    tint: 'bg-file/15',    wash: 'bg-file/[0.06]',    ring: 'hover:border-file/40' },
  { type: 'image',   label: 'Images',   icon: ImageIcon,     color: 'text-image',   tint: 'bg-image/15',   wash: 'bg-image/[0.06]',   ring: 'hover:border-image/40' },
  { type: 'link',    label: 'Links',    icon: LinkIcon,      color: 'text-link',    tint: 'bg-link/15',    wash: 'bg-link/[0.06]',    ring: 'hover:border-link/40' },
]
```

Tableau de correspondance complet :

| Type      | Couleur   | `wash` (fond carte) | `ring` (bordure hover)      | `tint` (puce)     | `color` (icône/label) |
| --------- | --------- | ------------------- | --------------------------- | ----------------- | --------------------- |
| `snippet` | vert      | `bg-snippet/[0.06]` | `hover:border-snippet/40`   | `bg-snippet/15`   | `text-snippet`        |
| `prompt`  | ambre     | `bg-prompt/[0.06]`  | `hover:border-prompt/40`    | `bg-prompt/15`    | `text-prompt`         |
| `note`    | bleu      | `bg-note/[0.06]`    | `hover:border-note/40`      | `bg-note/15`      | `text-note`           |
| `command` | cyan      | `bg-command/[0.06]` | `hover:border-command/40`   | `bg-command/15`   | `text-command`        |
| `file`    | orange    | `bg-file/[0.06]`    | `hover:border-file/40`      | `bg-file/15`      | `text-file`           |
| `image`   | rose      | `bg-image/[0.06]`   | `hover:border-image/40`     | `bg-image/15`     | `text-image`          |
| `link`    | lime      | `bg-link/[0.06]`    | `hover:border-link/40`      | `bg-link/15`      | `text-link`           |

---

## 4. Application sur la carte (`collection-card.tsx`)

La carte récupère sa config via `TYPE_MAP[collection.type]`, puis empile les
classes. L'ordre est important : le `wash` teinté vient **par-dessus** le
`bg-card` de base, la couleur pleine `bg-card` restant la couche neutre.

```tsx
const t = TYPE_MAP[collection.type]
const Icon = t.icon

<article
  className={cn(
    // base neutre : bordure + fond carte + ombre
    'group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm shadow-black/20',
    // transition + élévation au survol
    'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/30',
    t.wash,   // <-- teinte de fond à 6 % (couche par-dessus bg-card)
    t.ring,   // <-- bordure colorée à 40 % au survol
    view === 'list' ? 'flex items-center gap-4 p-4' : 'flex flex-col p-5',
  )}
>
```

La puce d'icône utilise `tint` (15 %) et l'icône utilise `color` (100 %) :

```tsx
<span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', t.tint)}>
  <Icon className={cn('size-5', t.color)} aria-hidden="true" />
</span>
```

Le label textuel du type utilise `color` (100 %) en police mono :

```tsx
<span className={cn('font-mono font-medium', t.color)}>{t.label.slice(0, -1)}</span>
```

### Empilement visuel des couches de fond

```
┌─────────────────────────────────────┐
│  border-border (bordure neutre)      │  ← devient t.ring (accent 40 %) au hover
│ ┌─────────────────────────────────┐ │
│ │  bg-card (fond neutre du thème) │ │  ← couche 1, opaque
│ │  + t.wash (accent 6 %)          │ │  ← couche 2, translucide par-dessus
│ │                                 │ │
│ │  [puce t.tint 15 %] [icône      │ │
│ │                      t.color]   │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## 5. Points d'attention pour reproduire

- **Opacité arbitraire vs échelle Tailwind** : `wash` utilise la syntaxe
  arbitraire `/[0.06]` car 6 % n'existe pas dans l'échelle par défaut. `tint`
  (`/15`) et `ring` (`/40`) utilisent l'échelle standard. Conservez ces valeurs
  exactes — elles ont été calibrées pour le fond sombre `oklch(0.16 …)`.
- **Classes statiques obligatoires (Tailwind v4)** : les classes ne peuvent pas
  être construites dynamiquement (`bg-${type}/15` ne serait pas détecté par le
  scanner). Elles sont donc **écrites en toutes lettres** dans `TYPES`, ce qui
  garantit leur présence dans le CSS compilé.
- **Un seul endroit à pleine saturation** : n'utilisez la couleur pleine
  (`color`) que sur l'icône et le label. Tout le reste (fond, puce, bordure)
  reste translucide, sinon le contraste avec `card-foreground` chute.
- **La teinte doit rester subtile** : à 6 %, la couleur du type est perçue
  comme une nuance, pas comme un bloc coloré. C'est ce qui permet d'afficher 7
  types côte à côte dans une grille sans effet « arc-en-ciel » criard.
- **Le hover révèle le type** : au repos, seule la puce d'icône affiche
  franchement la couleur ; au survol, la bordure `ring` (40 %) renforce
  l'identité du type en plus de l'élévation de la carte.

---

## 6. Ajouter un nouveau type

1. Ajouter le token dans `:root` de `globals.css` :
   `--podcast: oklch(0.72 0.14 300);`
2. L'exposer dans `@theme inline` :
   `--color-podcast: var(--podcast);`
3. Étendre l'union `ContentType` dans `dashboard-data.ts`.
4. Ajouter la ligne dans `TYPES` avec les **4 classes écrites en clair** :
   `color: 'text-podcast', tint: 'bg-podcast/15', wash: 'bg-podcast/[0.06]', ring: 'hover:border-podcast/40'`

Aucune modification de `collection-card.tsx` n'est nécessaire : la carte lit
tout depuis `TYPE_MAP`.
