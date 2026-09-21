# 007 - Visual baselines are rendered by CI, on Linux only

**Status:** accepted · 2026-09-14

## Context

A screenshot test is only as trustworthy as the match between the machine
that rendered the baseline and the machine running the test. Fonts, hinting
and anti-aliasing differ between Windows, macOS and Linux, so a baseline made
on a laptop fails in CI without any design change.

The usual answer is to render everything in the official Playwright Docker
image. This project deliberately has no Docker and a single environment
(GitHub Pages, tested through the local server), so that isn't available.

## Decision

- `@visual` runs on Linux only, on the two Chromium projects. The config
  filters it out elsewhere by `process.platform`, not by an environment
  variable.
- CI's test jobs compare against committed baselines and never write them
  (`updateSnapshots: "none"` in CI).
- Baselines come from a manual CI run (`update_snapshots`) on the same
  `ubuntu-latest` image and pinned Chromium build the test jobs use. It commits
  them to the branch it ran on, so new images are reviewed in the pull request
  like any other change.
- Everything that isn't design is pinned: `page.clock`, UTC, `en-GB`, reduced
  motion, and dashboard data served through `page.route`. The tolerance
  (`maxDiffPixelRatio: 0.001`) is sized for anti-aliasing noise, not for a
  moved element.

## Consequences

- No one can make a baseline locally; a design change needs one extra CI run
  on its branch. That friction is the price of trusting a red result.
- When GitHub updates the `ubuntu-latest` image, the baselines may need one
  refresh. It shows up as a failing run, never silently.
- Web fonts come from Google Fonts during the run. A font request that fails
  shows up as a difference and, after the retry passes, as a flaky test -
  which fails the job (`failOnFlakyTests`).
- Until the first baseline run, `@visual` fails. Push the change to a branch
  and run `update_snapshots` there before merging to `main`.
