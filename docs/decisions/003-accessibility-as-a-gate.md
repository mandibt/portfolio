# 003 - Accessibility is a failing gate, not a report

**Status:** accepted · 2026-09-11

## Context

A QA portfolio that claims quality should meet a public standard, and the
European Accessibility Act has applied since June 2025. Advisory scans get
ignored; a number on a dashboard nobody acts on is decoration.

## Decision

- `@axe-core/playwright` scans every page on every browser against WCAG 2.0,
  2.1 and 2.2 at levels A and AA. Any violation fails the test, and the build.
- The home page is scanned with the collapsed earlier roles expanded, since
  axe skips hidden content.
- `toMatchAriaSnapshot` pins the document outline and navigation as assistive
  technology receives them - landmark, heading levels and order - which axe
  does not check.
- Keyboard behaviour is tested directly: a skip link as the first Tab stop, and
  a visible focus outline on every control.

## Consequences

- The first scan failed on text contrast (`--ink-faint` at ~3:1); the token was
  fixed rather than the rule disabled. No rules are excluded today.
- Tab-order tests skip WebKit, which only tabs to links when an OS setting
  allows it - a platform behaviour, not a site defect.
- Violations are attached to each test as JSON and shown per page and browser
  on the dashboard.
