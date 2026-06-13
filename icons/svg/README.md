# Curated icon set

Reusable SVG icons for the Ocean Safe app, extracted from
[lucide-static](https://github.com/lucide-icons/lucide) and
[@tabler/icons](https://github.com/tabler/tabler-icons).

## Layout

```
icons/svg/
├── lucide/   # weather, UI, nav, common — ~24x24 viewBox, 1.5px stroke
└── tabler/   # marine-specific glyphs — ~24x24 viewBox, 2px stroke
```

## How to use one

Inline the SVG markup directly in `index.html` — these are small enough (~300-800 bytes each) that data URIs are unnecessary. Wrap in a span so you can color it with CSS:

```html
<span class="icon icon-md" style="color: var(--ocean-deep)">
  <!-- paste contents of icons/svg/lucide/alert-triangle.svg here -->
</span>
```

Add this once to your stylesheet:

```css
.icon { display: inline-flex; vertical-align: middle; }
.icon svg { width: 1em; height: 1em; }
.icon-sm svg { width: 14px; height: 14px; }
.icon-md svg { width: 18px; height: 18px; }
.icon-lg svg { width: 24px; height: 24px; }
```

SVGs use `stroke="currentColor"` by default, so they inherit the parent's `color` — great for theming.

## Adding more icons

Edit the `LUCIDE` or `TABLER` arrays in `scripts/extract-icons.mjs` and re-run:

```bash
npm run icons:extract
```

Browse upstream sources:
- Lucide: https://lucide.dev (filter by name)
- Tabler: https://tabler.io/icons (search the outline set)

## Stroke-weight note

Lucide uses 1.5px stroke; Tabler uses 2px. They don't visually match at the same display size — use them in distinct contexts (Lucide for fine UI, Tabler for the marine vocabulary chips) rather than side-by-side.
