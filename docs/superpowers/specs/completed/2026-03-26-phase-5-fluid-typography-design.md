# Fluid Typography Design

## Summary

Replace breakpoint-based responsive text sizing with CSS `clamp()` fluid typography on base HTML elements. The moderate scale changes text ~50% from mobile (375px) to desktop (1440px). No Tailwind tokens — sizing is applied directly to `h1`-`h6`, `body`, and `small` in `layout.css`. Components use correct semantic heading levels and inherit sizing automatically.

## Fluid Type Scale

| Element | `clamp()` value                                 | Mobile (375px) | Desktop (1440px) | line-height |
| ------- | ----------------------------------------------- | -------------- | ---------------- | ----------- |
| `h1`    | `clamp(1.5rem, 1rem + 2vw, 2.5rem)`             | 24px           | 40px             | 1.1         |
| `h2`    | `clamp(1.25rem, 0.9rem + 1.5vw, 1.875rem)`      | 20px           | 30px             | 1.2         |
| `h3`    | `clamp(1.125rem, 0.9rem + 1vw, 1.5rem)`         | 18px           | 24px             | 1.2         |
| `h4`    | `clamp(1rem, 0.9rem + 0.5vw, 1.25rem)`          | 16px           | 20px             | 1.3         |
| `h5`    | `clamp(0.9375rem, 0.875rem + 0.25vw, 1.125rem)` | 15px           | 18px             | 1.3         |
| `h6`    | `clamp(0.875rem, 0.85rem + 0.15vw, 1rem)`       | 14px           | 16px             | 1.3         |
| `body`  | `clamp(0.875rem, 0.8rem + 0.35vw, 1.0625rem)`   | 14px           | 17px             | 1.5         |
| `small` | `clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)`     | 12px           | 14px             | 1.4         |

Line-heights are fixed (not fluid).

## Implementation

### Part A — `layout.css` changes

- Replace current fixed heading font-size rules with the `clamp()` values above.
- Add fluid `font-size` to `body` and `small` elements.
- Keep existing Insignia font-family, `text-transform: uppercase`, and `font-weight: 900` rules on headings unchanged.

### Part B — Component migration

- Remove breakpoint-based text size classes (e.g., `text-lg sm:text-xl lg:text-2xl`, `text-[1.1rem] sm:text-2xl`) from components that use semantic headings — base styles handle sizing.
- Fix incorrect heading levels where the semantic level doesn't match the visual intent, so the document outline is correct and the fluid scale produces the right sizes.
- Leave explicit size classes only where a component intentionally overrides the base scale.

### Out of scope

- No font changes (Insignia headings, Arial body stay as-is).
- No color, spacing, or layout changes.
- No new dependencies or Tailwind config changes.
- No Tailwind `@theme` tokens for font sizes.
