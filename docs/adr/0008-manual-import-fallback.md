# ADR 0008: Importacao manual como fallback

- Status: Accepted
- Date: 2026-03-23

## Context

Automacao privada pode demorar para amadurecer por causa de markup instavel e politicas do navegador.

## Decision

O produto pode lancar primeiro com catalogo publico e importacao manual, antes do sync automatico completo.

## Consequences

- Time-to-value menor.
- Arquitetura nao fica bloqueada pela extensao.
- O dominio e o parser continuam uteis desde a primeira entrega.

