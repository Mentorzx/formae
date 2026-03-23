# ADR 0005: Rust-first shared core

- Status: Accepted
- Date: 2026-03-23

## Context

Regras curriculares, parsing e normalizacao precisam ser reutilizaveis entre browser e runtimes locais.

## Decision

O modelo de dominio, parser e regras ficam em crates Rust e sobem para o browser via WebAssembly.

## Consequences

- Reuso real entre web, extensao e desktop.
- Menor duplicacao de regra de negocio em TypeScript.
- Build de WASM entra na definicao de pronto.

