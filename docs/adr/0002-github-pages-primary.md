# ADR 0002: GitHub Pages como host primario

- Status: Accepted
- Date: 2026-03-23

## Context

O repositorio ja vive no GitHub e o primeiro marco nao precisa de backend.

## Decision

GitHub Pages sera o host primario da v0. Cloudflare Pages fica documentado como espelho futuro.

## Consequences

- Deploy simples e integrado com Actions.
- Uso de `HashRouter` no v0 para evitar dependencia de rewrites.
- Base path configuravel para repositorio e dominio customizado.

