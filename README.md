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
- WASM-backed schedule normalization inside the manual-import flow, loaded from the shared Rust core.
- Browser-local snapshot persistence for manual imports, stored in IndexedDB and restorable without backend state.
- Versioned local vault baseline with AES-GCM sealing, device-local key material and migration from the earlier cleartext snapshot store.

## Local secrets

Use `.env.example` only as a template. Do not commit real SIGAA credentials, and do not store them in tracked files. The intended product flow keeps SIGAA credentials ephemeral and session-based.

## License and brand

The source code is licensed under Apache-2.0. The name "Formaê", its future logo and related brand assets are reserved and are not licensed for reuse or derivative branding. See [TRADEMARKS.md](./TRADEMARKS.md).
