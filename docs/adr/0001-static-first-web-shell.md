# ADR 0001: Static-first web shell

- Status: Accepted
- Date: 2026-03-23

## Context

O produto precisa ser barato, leve e hosteavel sem backend com dados privados.

## Decision

O primeiro runtime publico sera uma PWA estatica em React + Vite, publicada como site estatico.

## Consequences

- Menor custo operacional.
- Integracao privada precisa acontecer localmente.
- O shell web fica limpo, auditavel e facil de espelhar.

