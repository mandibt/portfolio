# 006 - Role-first locators, with selectors kept in page objects

**Status:** accepted · 2026-09-14

## Context

The specs were written with selectors inline: roughly 90 CSS locators against
20 role-based ones, most of them on styling classes (`.btn-primary`,
`.job-title`). A class renamed for design reasons broke tests, the same
selectors were repeated across files (the LinkedIn link in three), and a
passing test said nothing about whether the page worked for assistive
technology.

Rewriting them with `getByRole` exposed real gaps in the site: job and project
titles were `<div>`s, so screen-reader users couldn't jump between roles;
sections had no accessible names; and the floating CTA faded out but stayed
focusable, so keyboard users could tab onto a link they couldn't see.

## Decision

- **Locator order:** `getByRole` with a name → `getByText` → `data-*`
  attributes the page already renders (the dashboard) → CSS, only for layout
  that has no semantics (skill bars, `<details>`, the document `<head>`).
- **Fix the markup, not add test hooks:** `<h3>` titles, `aria-labelledby` on
  sections, `visibility: hidden` for the CTA. No ARIA added purely for tests,
  no `data-testid`.
- **Page objects composed of components, provided as fixtures:**
  `tests/pages/` (`HomePage`, `CvPage`, `PageNotFound`, `QaDashboard`) built
  from `tests/components/` (`SiteNav`, `Timeline`, `SkillBars`). They return
  locators and perform actions; assertions stay in the specs.
- **Copy in one place:** `tests/data/site.ts`.
- **Enforced:** `playwright/no-raw-locators` is an error in `*.spec.ts`.
- **Viewport-specific tests by tag:** `@mobile` / `@desktop` with `grepInvert`
  per project, instead of `test.skip` inside the test.

## Consequences

- Tests break when accessibility breaks: a role locator that can't find an
  element is a screen reader that can't either.
- Accessible names are copy, and a résumé's copy changes. `site.ts` keeps a
  reworded heading to a one-line change.
- `getByRole` ignores hidden elements, so `toBeHidden()` on one also passes
  when it matches nothing. Tests that assert something disappears first assert
  it was visible; `SiteNav` matches with `includeHidden` so its links can be
  checked while the phone menu is closed.
- Phone interactions use `tap()`, as a phone would.
