# ADR 0006: IndexedDB + Web Crypto para vault local

- Status: Accepted
- Date: 2026-03-23

## Context

Snapshots privados precisam sobreviver localmente sem backend.

## Decision

O armazenamento local previsto para a PWA sera IndexedDB, com envelope cifrado via Web Crypto.
Na baseline atual, snapshots manuais sao selados com AES-GCM usando chave `device-local`
mantida no proprio navegador. O desbloqueio por passkey continua como evolucao posterior,
sem mudar o formato versionado do vault.

## Consequences

- Boa capacidade para dados estruturados.
- Wipe local controlavel por logout e acao explicita.
- Nada disso depende de servidor persistente.
- Migracoes de formato podem reaproveitar o mesmo vault sem reintroduzir store legivel.
