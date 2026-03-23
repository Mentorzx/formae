# ADR 0009: Versionamento de seletores e fixtures

- Status: Accepted
- Date: 2026-03-23

## Context

O markup do SIGAA pode mudar sem aviso e quebrar automacoes.

## Decision

Fixtures HTML publicas, replay tests e versionamento explicito de seletores fazem parte da fundacao do repositorio.

## Consequences

- Regressao de parser e coleta fica visivel cedo.
- O time evita seletores espalhados e hardcodes opacos.
- Mudancas de markup viram contrato revisavel.

