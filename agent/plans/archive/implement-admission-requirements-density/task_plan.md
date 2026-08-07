# Task Plan: Implement Admission Requirements and Density

**Status**: archived
**Created**: 2026-08-07T12:15:00+08:00
**Archived**: 2026-08-07T13:42:56+08:00

## Goal

Ingest the supplied 32-university requirements and 2023–2026 destination-share data into IV Map's existing provenance-aware architecture, expose it in the university detail experience without confusing it with personal admission odds or per-graduate density, and verify a production build.

## Phases

### Phase 1: Foundation and source normalization
- [x] Inventory the clean origin/main worktree, build scripts, current types, and source/provenance conventions.
- [x] Copy the supplied source files into gitignored local input storage and implement deterministic university/high-school alias normalization.
- [x] Add a database migration for aliases, requirement observations, feeder outcome/value semantics, and denominator linkage.

### Phase 2: Clean and publish data
- [x] Implement a parser/cleaner for the 32-school requirements Markdown and all three density CSVs.
- [x] Quarantine malformed appendix rows, preserve missing denominators, and generate a machine-readable quality report.
- [x] Generate validated frontend snapshots for requirements and destination-share history.

### Phase 3: Product integration
- [x] Add typed data loaders and a university admission-requirements/living-environment section.
- [x] Add destination-share latest/history presentation alongside, but distinct from, existing per-graduate pathway density.
- [x] Enrich China-ecosystem editorial bases without replacing the current fingerprint axes.

### Phase 4: Verification and handoff
- [x] Add data/parser/component tests for aliases, semantics, formulae, missing values, and malformed rows.
- [x] Run lint/type tests and one production build; fix at most one build failure as required by the testing skill.
- [x] Review the final diff, document what remains quarantined, and prepare the branch for user review.

## Decisions

- Work in `/Users/sean/code/sean/ivy-map-enrichment` on `agent/admission-requirements-density`; do not modify the dirty main worktree.
- Keep the existing editorial paper-and-ink interface direction. New modules use typographic hierarchy and ruled sections rather than adding generic cards.
- Raw user attachments stay outside git; committed outputs contain normalized data plus provenance metadata, not private local paths.
- Perform the final UI review against the local production data using the in-app browser, covering both a populated destination-share case and a missing-denominator case.

## Findings

- origin/main already publishes a 173-school, 1,551-observation `data/course-attribution.json`; it should be the canonical high-school catalog for the incoming density labels rather than duplicating schools from `data/raw/schools.csv`.
- Existing `UniversityPathways` defines density as outcomes per 100 high-school graduates. The new destination share must be a separate view and type so the two denominators cannot be confused.
- The established cleaner pattern already supports content hashes, source line locators, generated SQL, new institution insertion, and source-artifact registration; the new cleaner can reuse these conventions.
- Frontend build is driven by committed generated JSON, while `.data/` is already gitignored and suitable for local source attachments.
- All five local inputs were copied into `.data/university-enrichment` and content-hashed. Their raw bytes remain outside git.
- The 173-school course-attribution snapshot already contains stable IDs for every legitimate incoming school label, including WLSA, SAS, Concordia International, new Beijing schools, and Shanghai additions. Matching can therefore be exact/curated against this catalog with no new public school IDs required for clean rows.
- Migration 0005 extends the existing tables non-destructively: reviewed aliases, explicit feeder outcome/value status, population scope, and a self-referential denominator observation link.
- The cleaner now parses all 32 requirement blocks, classifies requirement semantics, maps density rows through stable IDs, validates formulas, emits frontend JSON plus auditable SQL, and quarantines synthetic/unknown/out-of-scope rows.
- The first successful cleaner run produced 32 requirement profiles, 128 denominator rows (66 populated), 506 destination observations, and 392 computable shares. Thirty-two rows are quarantined pending a final alias/reason audit.
- After adding the reviewed Beijing Keystone alias, the final snapshot contains 517 usable destination observations across 36 schools and 31 universities; 400 have a compatible denominator and computed share. Quarantine is now exactly the expected 20 malformed appendix aggregates plus one out-of-scope 2022 row.
- The committed snapshot is about 520 KB, so PostgreSQL can remain the source of truth while Vercel safely serves a generated static JSON without runtime database reads.
- University profiles now consume the enhanced long-form style blurb and recalibrate only the existing China-ecosystem editorial axis through documented fixed bands. Safety remains a separate prose block and never replaces a fingerprint axis.
- The new detail section uses ruled typography, semantic labels, and progressive disclosure for notes/sources, preserving the established editorial visual system instead of adding a dense grid of generic cards.
- Existing region-grouped high-school cards now show the new numerator/denominator/share and multi-year history only when available, while retaining the separate per-100-graduates metric and an explicit non-probability explanation.
- The full Vitest suite passes: 10 files and 63 tests, including new coverage for 32 profiles, alias IDs, 400 reproducible shares, null denominators, quarantine counts, and five fixed China-ecosystem bands.
- `pnpm exec tsc --noEmit` passes, and `pnpm lint` passes with only the pre-existing `components/map/ChinaMap.tsx` warning.
- The invalid cross-worktree `node_modules` symlink was verified, unlinked, and replaced with a local frozen-lockfile install; the dirty main worktree was not changed.
- The single permitted production-build retry passed: Next.js compiled, type-checked, and generated all 86 static pages, including all 32 university detail routes.
- The build regenerated only `builtAt` timestamps in two pre-existing snapshots; those timestamp-only changes were removed from the branch diff.
- The local Next.js server is running against the branch data and the in-app browser is connected for final visual/semantic inspection.
- Desktop semantic QA on Cambridge confirms the new requirements, living-environment, 2023–2026 destination-share, missing-denominator, and non-probability copy all render in the intended sections; no browser warnings or errors were logged.
- Desktop visual QA confirms the editorial two-column requirements/living-environment section is aligned, readable, and consistent with the current paper-and-ink system.
- Mobile QA at 390×844 confirms long English requirements wrap without horizontal overflow, the living-environment column stacks cleanly, and region-grouped high-school cards remain readable; no browser warnings or errors were logged.
- Mobile destination-share QA confirms the numerator/denominator equation, population scope, and non-probability warning remain legible inside the existing high-school card component.
- Final cleaner/SQL review confirms the import is transactional and idempotent by content/observation hash, denominator rows are inserted before linked school observations, the public snapshot contains no local source paths, and `git diff --check` is clean.
- Fly CLI is authenticated, `llm-gateway-pg` is healthy (all checks passing), and the cluster reports roughly 80% disk free; use the repository's established stdin-to-psql path for migration/import.
- Remote preflight confirms migration 0005 and this enrichment batch have not yet been applied: no alias table, denominator-link column, enrichment source, requirement observations, or university-total denominator rows exist yet.
- Migration `0005_university_enrichment.sql` applied successfully to Fly PostgreSQL; only expected first-run notices appeared for constraints that did not previously exist.
- The 1.1 MB generated enrichment import completed successfully on Fly PostgreSQL in one transaction.
- Remote post-import verification matches the cleaner exactly: 1 source, 4 artifacts, 224 credential requirements, 62 valid editorial ratings, 39 aliases, 66 populated university denominators, 517 school-destination rows, 400 denominator links, and 0 invalid links. The `ivy_map` database is about 19.4 MB.
- Browser QA was finalized, the temporary mobile viewport was reset, and the local development server was stopped cleanly.
- Final diff review found no secret/local-path leakage; the only unrelated snapshot changes are trailing-newline noise from the build and will be removed before commit.
- Final branch diff is scoped to the enrichment feature; generated-build timestamp/newline noise is removed. The 21 quarantined rows remain documented in the committed snapshot: 20 malformed appendix aggregate headings and one out-of-scope Oxford 2022 row.

## Errors

- The first cleaner run exposed one TypeScript parse error from unquoted Chinese object keys containing parentheses. Dependencies are available through a gitignored worktree symlink; fix the syntax once and rerun the cleaner.
- The first production build reached Turbopack but failed because this worktree's `node_modules` is a symlink to the dirty main worktree (`TurbopackInternalError: Symlink [project]/node_modules is invalid`). Remove only that worktree-owned symlink, install local dependencies, then use the testing skill's single allowed build retry.
- The browser backend does not support `networkidle` despite the generic type docs; use the supported `domcontentloaded` state for local visual QA.
- A one-line remote SQL preflight lost string quotes through nested shell parsing. Switched to the repository's documented stdin-fed `psql -f -` path; the read-only query then succeeded.
