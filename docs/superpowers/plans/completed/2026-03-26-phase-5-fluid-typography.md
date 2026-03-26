# Fluid Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace breakpoint-based responsive text sizing with CSS `clamp()` fluid typography on base HTML elements, and clean up components to use correct semantic heading levels.

**Architecture:** Fluid `clamp()` font-sizes are defined once on base elements (`h1`-`h6`, `body`, `small`) in `layout.css`. Components use semantic HTML headings and inherit sizing automatically. Existing breakpoint-based text size classes are removed from components.

**Tech Stack:** CSS `clamp()`, Tailwind CSS v4, Next.js 15

---

### Task 1: Add fluid font-sizes to base elements in layout.css

**Files:**

- Modify: `src/app/layout.css:83-101`

- [ ] **Step 1: Replace the `html, body` block with fluid body font-size**

In `src/app/layout.css`, replace lines 83-89:

```css
html,
body {
    font-size: 16px;
    font-family: Arial, Helvetica, sans-serif;
    background-color: var(--blue);
    color: var(--text);
}
```

with:

```css
html,
body {
    font-size: clamp(0.875rem, 0.8rem + 0.35vw, 1.0625rem);
    line-height: 1.5;
    font-family: Arial, Helvetica, sans-serif;
    background-color: var(--blue);
    color: var(--text);
}
```

- [ ] **Step 2: Add fluid font-sizes to the heading block**

In `src/app/layout.css`, replace lines 91-101:

```css
h1,
h2,
h3,
h4,
h5,
h6 {
    @apply flex flex-col sm:block;
    font-family: 'Insignia', 'Impact', sans-serif;
    text-transform: uppercase;
    font-weight: 900;
}
```

with:

```css
h1,
h2,
h3,
h4,
h5,
h6 {
    @apply flex flex-col sm:block;
    font-family: 'Insignia', 'Impact', sans-serif;
    text-transform: uppercase;
    font-weight: 900;
}

h1 {
    font-size: clamp(1.5rem, 1rem + 2vw, 2.5rem);
    line-height: 1.1;
}

h2 {
    font-size: clamp(1.25rem, 0.9rem + 1.5vw, 1.875rem);
    line-height: 1.2;
}

h3 {
    font-size: clamp(1.125rem, 0.9rem + 1vw, 1.5rem);
    line-height: 1.2;
}

h4 {
    font-size: clamp(1rem, 0.9rem + 0.5vw, 1.25rem);
    line-height: 1.3;
}

h5 {
    font-size: clamp(0.9375rem, 0.875rem + 0.25vw, 1.125rem);
    line-height: 1.3;
}

h6 {
    font-size: clamp(0.875rem, 0.85rem + 0.15vw, 1rem);
    line-height: 1.3;
}
```

- [ ] **Step 3: Add fluid font-size for `small` elements**

After the `h6` block added above, add:

```css
small {
    font-size: clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem);
    line-height: 1.4;
}
```

- [ ] **Step 4: Run the dev server and visually verify**

Run: `npm run dev`

Open the site in a browser at different viewport widths (375px, 768px, 1440px). Verify:

- Headings scale fluidly without jumps
- Body text is readable at all sizes
- No layout breaks from the size changes

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.css
git commit -m "feat: add fluid clamp() typography to base HTML elements"
```

---

### Task 2: Remove text size overrides from about page headings

**Files:**

- Modify: `src/app/about/page.jsx:23,46,64`

The three `<h2>` elements on the about page have `className="text-lg sm:text-xl lg:text-2xl"`. Since `h2` now gets fluid sizing from `layout.css`, these classes are redundant.

- [ ] **Step 1: Remove text size classes from the About section h2**

In `src/app/about/page.jsx` line 23, change:

```jsx
<h2 className="text-lg sm:text-xl lg:text-2xl">About</h2>
```

to:

```jsx
<h2>About</h2>
```

- [ ] **Step 2: Remove text size classes from the Discord section h2**

In `src/app/about/page.jsx` line 46, change:

```jsx
<h2 className="text-lg sm:text-xl lg:text-2xl">Discord (Bot)</h2>
```

to:

```jsx
<h2>Discord (Bot)</h2>
```

- [ ] **Step 3: Remove text size classes from the API section h2**

In `src/app/about/page.jsx` line 64, change:

```jsx
<h2 className="text-lg sm:text-xl lg:text-2xl">API</h2>
```

to:

```jsx
<h2>API</h2>
```

- [ ] **Step 4: Visually verify the about page**

Open `/about` and resize the browser. The headings should now scale fluidly instead of jumping at breakpoints.

- [ ] **Step 5: Commit**

```bash
git add src/app/about/page.jsx
git commit -m "refactor: remove breakpoint text classes from about page headings"
```

---

### Task 3: Remove text size override from UserDashboard h1

**Files:**

- Modify: `src/components/dashboard/UserDashboard.jsx:16`

The `<h1>` has `className="text-4xl"` which overrides the fluid `h1` sizing. The fluid `h1` tops out at `2.5rem` (40px) vs `text-4xl` (36px), which is close enough — the fluid scale is the intended behavior now.

- [ ] **Step 1: Remove text-4xl from the h1**

In `src/components/dashboard/UserDashboard.jsx` line 16, change:

```jsx
<h1 className="text-4xl">Dashboard</h1>
```

to:

```jsx
<h1>Dashboard</h1>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/UserDashboard.jsx
git commit -m "refactor: remove text-4xl override from dashboard h1"
```

---

### Task 4: Remove text size override from ApiDashboard h2

**Files:**

- Modify: `src/components/dashboard/ApiDashboard.jsx:16`

The `<h2>` has `className="text-4xl"` which makes it visually the same size as an h1. The fluid `h2` scale (`1.25rem` to `1.875rem`) is more appropriate for a section within the dashboard.

- [ ] **Step 1: Remove text-4xl from the h2**

In `src/components/dashboard/ApiDashboard.jsx` line 16, change:

```jsx
<h2 className="text-4xl">API Keys</h2>
```

to:

```jsx
<h2>API Keys</h2>
```

- [ ] **Step 2: Visually verify the dashboard page**

Navigate to the dashboard (requires login). Verify the "Dashboard" h1 is visually larger than "API Keys" h2, creating a clear hierarchy.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/ApiDashboard.jsx
git commit -m "refactor: remove text-4xl override from API keys h2"
```

---

### Task 5: Remove text-xl from War.jsx wrapper divs

**Files:**

- Modify: `src/components/h1/War/War.jsx:32,53`

The `text-xl` class is on `<div>` wrappers that contain `<h3>` elements and icons. The `<h3>` now gets its fluid size from `layout.css`. The `text-xl` on the wrapper div was setting the size for the h3 via inheritance, but the base style now takes precedence. Remove `text-xl` so the h3 uses its own fluid size.

- [ ] **Step 1: Remove text-xl from the Global Stats wrapper div**

In `src/components/h1/War/War.jsx` line 32, change:

```jsx
<div className="flex items-center justify-start gap-2 text-xl">
```

to:

```jsx
<div className="flex items-center justify-start gap-2">
```

- [ ] **Step 2: Remove text-xl from the faction stats wrapper div**

In `src/components/h1/War/War.jsx` line 53, change:

```jsx
<div className="flex items-center justify-start gap-2 text-xl">
```

to:

```jsx
<div className="flex items-center justify-start gap-2">
```

- [ ] **Step 3: Visually verify the war stats section**

Open the homepage or `/war` page. Verify the "Global Stats" and faction heading text scales fluidly and looks proportional to the icon next to it.

- [ ] **Step 4: Commit**

```bash
git add src/components/h1/War/War.jsx
git commit -m "refactor: remove text-xl from war stat heading wrappers"
```

---

### Task 6: Clean up Header logo text sizing

**Files:**

- Modify: `src/components/layout/Header/Header.jsx:38`

The logo `<Link>` has `text-[1.1rem] font-bold sm:text-2xl`. This is not a heading element — it's a logo/brand text inside a `<figcaption>`. The fluid body size from `layout.css` applies to the `<Link>`, but the logo needs to be larger than body text. Since this is a brand element (not a semantic heading), keep an explicit size but replace the breakpoint approach with a single `clamp()` value.

- [ ] **Step 1: Replace breakpoint classes with a fluid arbitrary value**

In `src/components/layout/Header/Header.jsx` line 38, change:

```jsx
className =
    'z-50 flex flex-row items-center justify-center gap-2 text-[1.1rem] font-bold sm:text-2xl';
```

to:

```jsx
className =
    'z-50 flex flex-row items-center justify-center gap-2 text-[clamp(1.1rem,0.9rem+1vw,1.5rem)] font-bold';
```

This scales the logo from 17.6px on mobile to 24px on desktop, matching the previous breakpoint behavior but fluid.

- [ ] **Step 2: Visually verify the header**

Resize the browser. The logo text should scale smoothly instead of jumping at the `sm` breakpoint.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Header/Header.jsx
git commit -m "refactor: replace breakpoint text classes with fluid clamp() on header logo"
```

---

### Task 7: Run Prettier and final verification

**Files:**

- All modified files

- [ ] **Step 1: Run Prettier**

```bash
npm run format
```

- [ ] **Step 2: Full visual verification**

Open the site and check these pages at 375px, 768px, and 1440px viewport widths:

- Homepage: heading hierarchy, war stats, events
- `/about`: section headings
- `/war`: season selector, war stats, timeline
- Dashboard (if accessible): h1 and h2 hierarchy

Verify:

- Text scales smoothly without breakpoint jumps
- Heading hierarchy is visually clear (h1 > h2 > h3)
- No layout shifts or overflow from the new sizes
- Small text (Event component `text-sm`, SeasonSelector `text-sm`) is still readable

- [ ] **Step 3: Commit any formatting changes**

```bash
git add -A
git commit -m "style: prettier formatting"
```

---

## Notes

**Intentionally kept `text-sm` classes:**

- `src/components/h1/Event/Event.jsx:55` — `text-sm` on a `<div>` wrapping event details. This is intentional small text for secondary information, not a heading override.
- `src/app/war/page.jsx:78,83` — `text-sm` on season selector `<span>` and `<Link>` elements. These are UI controls, not headings.

These are legitimate overrides of the base body size for specific UI purposes and should remain.
