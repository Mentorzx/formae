# Formaê

Formaê is a new academic assistant for UFBA students, inspired by the original MeForma and by the work of Joao Pedro Rodrigues Cerqueira. This repository starts with a static-first, privacy-first monorepo that keeps private academic data on the user's device and avoids a backend with sensitive data.

## Principles

- Lightweight by default: static web app first, optional local runtimes later.
- Honest privacy boundary: no server-side storage of SIGAA credentials or private academic data.
- Rust-first core: shared domain rules, schedule parsing, normalization and storage contracts live outside the UI.
- Incremental delivery: public catalog and manual import can ship before automatic private sync is mature.

## Current layout

```text
apps/
  web/         # PWA shell published to GitHub Pages
  extension/   # reserved MV3 browser integration surface
  desktop/     # reserved Tauri 2.0 companion surface
packages/
  protocol/    # message contracts between web shell and local runtimes
crates/
  domain/      # canonical academic domain model
  parser/      # UFBA/SIGAA schedule code parser
  rules/       # curriculum and pending-requirement helpers
  crypto/      # local encrypted vault metadata and wipe policies
  wasm_core/   # WebAssembly bridge for browser use
  test_fixtures/
docs/
  architecture.md
  adr/
infra/
  public-catalog-builder/
  static-data/
fixtures/
  public/
```

## Local development

```bash
corepack enable
corepack prepare pnpm@10.18.3 --activate
pnpm install
pnpm prepare:wasm
pnpm dev:web
cargo test --workspace
pnpm build
```

## What ships in this bootstrap

- React + Vite PWA shell with HashRouter and GitHub Pages-friendly base path.
- Accepted architecture baseline, threat model and ADR set.
- Rust crates for the canonical domain model, UFBA 2025 timing profile and schedule parsing.
- Contract fixtures and CI workflows for Node, Rust and GitHub Pages deployment.
- Seeded public catalog data and an initial manual-import preview that works from pasted text.
- Public catalog builder with provenance metadata, drift validation and a live UFBA public seed for Engenharia Civil.
- WASM-backed schedule normalization inside the manual-import flow, loaded from the shared Rust core.
- Automatic local SIGAA sync through the MV3 extension popup, with ephemeral credentials kept out of the web shell and reused by the same browser-local snapshot and vault pipeline.
- Direct extension runtime bridge on supported browsers, with the legacy page relay reduced to a fallback path and a short approval window armed from the extension popup.
- Browser-local snapshot persistence for manual imports, stored in IndexedDB and restorable without backend state.
- Versioned local vault baseline with AES-GCM sealing, device-local key material, short-lived passkey unlock sessions and migration from the earlier cleartext snapshot store.
- Automatic sync persistence minimized to a structured local summary instead of full raw SIGAA page text.
- Minimal `StudentSnapshot` projection derived locally from manual imports, including schedule blocks, in-progress components and explicit pending-review items.
- Overview page wired to the latest local projection, surfacing initial progress, catalog coverage and open pending items directly from browser storage.
- Private Playwright harness for authenticated SIGAA captures and end-to-end validation of `web -> extension -> SIGAA -> local vault`.

## Local secrets

Use `.env.example` only as a template. Do not commit real SIGAA credentials, and do not store them in tracked files. The intended product flow keeps SIGAA credentials ephemeral and session-based.

## Private sync validation

The local-only SIGAA harness lives in `infra/private-sync-e2e`.

```bash
cd infra/private-sync-e2e
pnpm install
pnpm sync:web
```

That command expects the PWA to be running locally at `http://localhost:4173/#/importacao` and the MV3 extension to be loaded unpacked from `apps/extension`.
The harness seeds the extension popup with ephemeral credentials for the test session and then triggers the sync from the web shell without filling any credential field in the page itself.

## License and brand

The source code is licensed under Apache-2.0. The name "Formaê", its future logo and related brand assets are reserved and are not licensed for reuse or derivative branding. See [TRADEMARKS.md](./TRADEMARKS.md).
