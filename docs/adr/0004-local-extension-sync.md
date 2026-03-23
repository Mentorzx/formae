# ADR 0004: Sync privado por runtime local

- Status: Accepted
- Date: 2026-03-23

## Context

Um site comum nao consegue navegar livremente em conteudo autenticado de outro dominio por causa de SOP e CORS.

## Decision

A sincronizacao privada futura sera feita por extensao MV3 local, com companion Tauri opcional para casos avancados.

## Consequences

- O browser extension vira a fronteira de automacao autenticada.
- O shell web continua sem acesso direto ao SIGAA autenticado.
- Se a extensao atrasar, importacao manual continua viavel.

