# Private SIGAA Fixtures

Fixtures redigidas a partir de capturas locais do SIGAA em 2026-03-24.

Redacao aplicada:

- nomes de estudante removidos
- matricula removida
- curso removido
- identificadores de sessao e urls com `jsessionid` removidos
- notas, frequencias e codigos de disciplinas substituidos por placeholders ou texto neutro
- apenas a estrutura necessaria para replay de seletores foi preservada

Uso:

- `pnpm --dir infra/private-sync-e2e replay`

Os testes de replay leem `manifest.json` neste diretorio e verificam:

- seletores esperados
- texto obrigatorio ainda presente
- ausencia de texto sensivel conhecido
- ausencia de padroes numericos e de sessao redigidos
