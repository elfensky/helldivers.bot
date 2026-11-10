# Website standard — scope and deviations

helldivers.bot follows the developer handbook's `website-standard`, revision 1.3. This file records
the scope calls and the deviations, each with its item ID and reason (decided by the owner on
2026-11-09, #620).

## Scope

- **A11Y-02, European Accessibility Act: out of scope.** The site offers none of the services the Act
  lists (Directive (EU) 2019/882, Art. 2(2)): no e-commerce, banking, e-books, passenger transport,
  electronic communications or access to audiovisual media. The Ko-fi button leads to Ko-fi's own
  site; nothing is sold here.
- **A11Y-03, Annex V information:** not required, because the EAA does not apply (A11Y-02).
- **LEG-01, operator type: a private person, non-commercial.** The site is a hobby fan project
  (`src/app/legal/page.jsx`, "Nature of This Broadcast"). It offers no service that is normally paid
  for: a Ko-fi gift buys nothing, and supporter ideas without a paywall are tracked in #647. WVV/CSA
  art. 2:20 and WER art. XII.6 therefore require no operator identification block.

## Deviations

- **HTML-12, rendering model: every page hydrates.** The Next.js App Router hydrates every page,
  also the document-like ones (docs, legal, archives). The live map, the notifications and the
  account features need client code, and the app shares one root layout with them.

## Credits and licences (LEG-08)

| Asset | Where | Source and licence | Permission |
|---|---|---|---|
| Code | the whole repository | AGPL-3.0-only (`LICENSE`, README § Licence) | Own work |
| Third-party npm packages | `package.json`, `package-lock.json` | Each package's own licence, recorded in its `license` field in `package-lock.json` | Granted by each package's licence |
| Helldivers artwork: faction icons, attack, defend, Super Earth, wings, backstab, background, logo, galaxy map | `public/icons/`, `public/images/background.webp`, `public/images/logo.webp`, `public/svgs/galaxy.svg` | © Arrowhead Game Studios / Sony Interactive Entertainment | None held: no licence and no written permission from the rights holders. The project is a non-commercial fan site; the credit does not grant permission |
| Favicons, Apple splash screens | `public/favicons/`, `public/splash/` | Made from the logo: © Arrowhead Game Studios / Sony Interactive Entertainment | Same as the Helldivers artwork: none held |
| Open Graph fallback | `public/og-fallback.png` | A static image of the site name; no artwork | Own work |
| Space Grotesk, Inter, Space Mono | `next/font/google` in `src/app/layout.jsx`, self-hosted at build time | Google Fonts, SIL Open Font License 1.1 | Granted by the OFL 1.1 |
| Noto Sans Symbols 2 (the Cyberstan glitch glyphs: sextant blocks U+1FB00–1FB3B) | `next/font/google` in `src/app/layout.jsx`, self-hosted at build time | Google Fonts, SIL Open Font License 1.1 | Granted by the OFL 1.1 |
| Ko-fi button | `public/images/kofi.webp`, in the footer | Brand asset of Ko-fi | Ko-fi's brand-assets page offers its buttons to "link to your page", under its content guidelines ([more.ko-fi.com/brand-assets](https://more.ko-fi.com/brand-assets), read 2026-11-10). The button links to this project's Ko-fi page |
| GitHub marks | `public/svgs/github.black.svg`, `public/svgs/github.white.svg` | Brand asset of GitHub | GitHub's logo guidelines allow the mark "as a social button to link to your GitHub profile or project" ([brand.github.com/foundations/logo](https://brand.github.com/foundations/logo), read 2026-11-10). No page uses the files at present |

Two fonts without a licence were removed in #620. Space Grotesk replaced Insignia (Adobe / Linotype,
a commercial font) as the display font. Collective Consciousness, the old glitch font, had no known
author or licence: its copyright field held the FontCreator template "(your company)". #651 replaced
it with Noto Sans Symbols 2.
