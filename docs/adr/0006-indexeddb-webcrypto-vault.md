# ADR 0006: IndexedDB + Web Crypto para vault local

- Status: Accepted
- Date: 2026-03-23

## Context

Snapshots privados precisam sobreviver localmente sem backend.

## Decision

O armazenamento local previsto para a PWA sera IndexedDB, com envelope cifrado via Web Crypto.

## Consequences

- Boa capacidade para dados estruturados.
- Wipe local controlavel por logout e acao explicita.
- Nada disso depende de servidor persistente.

