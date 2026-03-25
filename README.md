# Formaê

O Formaê é um assistente acadêmico para estudantes da UFBA, inspirado no MeForma original e no trabalho de João Pedro Rodrigues Cerqueira, mas com uma arquitetura nova: local-first, sem backend com dados sensíveis, com PWA estática, extensão de navegador e núcleo compartilhado em Rust/WASM.

## Estado atual

Hoje o repositório já entrega:

- PWA em React + Vite publicada no GitHub Pages
- planner visual local com busca, filtros, dark mode, modo compacto, drag and drop e mapa de dependências
- importação manual de texto do SIGAA
- sincronização automática local com o SIGAA via extensão MV3
- vault local cifrado no navegador
- endurecimento opcional do vault com passkey e cópia embrulhada via WebAuthn PRF quando disponível
- parser de horários UFBA 2025 em Rust/WASM
- catálogo público seed versionado

Endereço público atual:

- `https://mentorzx.github.io/formae/`

## Compromisso deste README

Este README deve ser atualizado sempre que uma mudança no produto afetar:

- instalação
- configuração
- fluxo de uso
- comandos de desenvolvimento
- limitações conhecidas

Ou seja: se o jeito de usar o Formaê mudar, este passo a passo também precisa mudar no mesmo commit ou na mesma rodada.

## Como usar hoje, do zero

### 1. Clonar o repositório

```bash
gh repo clone Mentorzx/formae
cd formae
```

Se você não usa `gh`, pode usar:

```bash
git clone https://github.com/Mentorzx/formae.git
cd formae
```

### 2. Instalar os pré-requisitos

Você precisa ter instalado localmente:

- Node.js `22+`
- `corepack`
- `pnpm 10+`
- Rust stable
- `wasm-pack`

No Linux/macOS, o caminho feliz fica assim:

```bash
corepack enable
corepack prepare pnpm@10.18.3 --activate
rustup default stable
cargo install wasm-pack
```

### 3. Instalar as dependências do monorepo

Na raiz do projeto:

```bash
pnpm install
```

### 4. Preparar o bundle WASM

O app web usa o núcleo Rust/WASM. Antes do primeiro uso local:

```bash
pnpm prepare:wasm
```

### 5. Subir a aplicação web

```bash
pnpm dev:web
```

Depois abra:

- `http://localhost:4173/#/`

## Como navegar no app hoje

Depois de abrir a PWA, o fluxo principal é:

1. `Visão Geral`
   Mostra o estado local do snapshot salvo no navegador.
2. `Planejador`
   Mostra a grade viva, com dependências, drag and drop, filtros e simulador local de IRA.
3. `Catálogo`
   Mostra os seeds e fontes públicas que o app conhece.
4. `Importação`
   É a tela para importar manualmente ou disparar a sincronização automática local com a extensão.
5. `Arquitetura`
   Explica as fronteiras técnicas e decisões do projeto.

## Como usar a importação manual

Se você quer testar o Formaê sem extensão:

1. Abra `Importação`
2. Cole texto copiado do SIGAA
3. O app detecta códigos de componente e horários
4. O parser Rust/WASM normaliza horários como `35N12`
5. Salve o snapshot local no navegador
6. Volte para `Visão Geral` ou `Planejador`

O que isso já faz:

- detectar componentes
- detectar horários
- associar com o catálogo seed
- gerar um `StudentSnapshot` local
- alimentar visão geral e planner

## Como usar a sincronização automática com o SIGAA

Hoje o sync automático funciona localmente via extensão MV3, sem enviar suas credenciais para servidor do Formaê.

### 1. Suba a PWA localmente

```bash
pnpm dev:web
```

### 2. Carregue a extensão no navegador

No Chrome ou Chromium:

1. Abra `chrome://extensions`
2. Ative `Modo do desenvolvedor`
3. Clique em `Carregar sem compactação`
4. Selecione a pasta:
   `apps/extension`

Se você quiser gerar artefatos de distribuição locais:

```bash
pnpm package:extension
```

Isso gera:

- um `.zip` para Chrome em `dist/releases`
- um `.xpi` para Firefox em `dist/releases`
- checksums e manifesto de release determinístico

### 3. Abra a tela de importação

Use:

- `http://localhost:4173/#/importacao`

### 4. Faça o fluxo de sync

No estado atual:

1. a popup da extensão arma a janela curta de aprovação do sync
2. a extensão usa as credenciais só em memória
3. a extensão lê `Minhas Turmas` e `Minhas Notas` localmente no SIGAA
4. o snapshot automático é salvo localmente no vault do navegador
5. `Visão Geral` e `Planejador` passam a refletir esse estado local

## Como usar o planner visual

O `Planejador` é hoje a área mais forte da interface.

Você pode:

- buscar por código ou nome
- ocultar concluídas
- mostrar só componentes liberadas agora
- destacar componentes com horário local
- destacar componentes em revisão
- passar o mouse para ver cadeia de pré-requisitos e liberações
- clicar para fixar uma disciplina como foco
- arrastar componentes planejáveis entre períodos
- renomear colunas para algo como `2026.2`, `2027.1` etc.
- alternar entre modo detalhado e compacto
- alternar entre modo claro e escuro
- fazer uma projeção local de IRA

Importante:

- o planner é derivado do snapshot local salvo no navegador
- ele não é uma confirmação oficial do SIGAA em tempo real
- quando a grade seed ainda estiver rasa ou ambígua, trate a leitura como aproximação local

## Passkey e vault local

O vault local hoje já existe e pode usar passkey como endurecimento de sessão.

Na prática atual:

- os dados do snapshot ficam no navegador
- o vault é cifrado localmente
- a passkey ajuda a bloquear/desbloquear a sessão local
- quando o navegador e o autenticador suportam PRF, o vault passa a preferir esse material como caminho principal de derivação para novos wraps e migra o cofre local na primeira sessão compatível
- quando PRF não estiver disponível, o fallback continua sendo `browser-local-wrap`
- o resumo bruto preservado após sync automático também foi minimizado; a PWA guarda o texto estruturado necessário sem trafegar o dump combinado completo do SIGAA

Isso significa que a segurança local já melhorou bastante, mas ainda não é o estado final mais forte possível: ainda falta derivação realmente ancorada de ponta a ponta em WebAuthn para todo o ciclo do vault.

## Segredos locais e `.env`

Use `.env.example` apenas como modelo.

Regras do projeto:

- nunca commitar credenciais reais
- nunca colocar credenciais em arquivos rastreados
- usar variáveis locais só quando necessário para testes privados
- tratar credenciais do SIGAA como efêmeras e de sessão

## Harness privado de validação do sync

O teste privado do fluxo `web -> extensão -> SIGAA -> vault local` fica em:

- `infra/private-sync-e2e`

Fluxo básico:

```bash
cd infra/private-sync-e2e
pnpm install
pnpm sync:web
```

Observações:

- a PWA precisa estar rodando localmente
- a extensão precisa estar carregada no navegador
- o harness espera a rota `#/importacao`
- o relay legado via `window.postMessage` fica restrito a localhost; no domínio publicado a PWA usa a ponte direta da extensão
- esse fluxo é para validação local privada, não para uso público normal do produto

## Comandos úteis de desenvolvimento

Na raiz do monorepo:

```bash
pnpm dev:web
pnpm prepare:wasm
pnpm build
pnpm test
pnpm lint
pnpm package:extension
node scripts/verify-extension-release.mjs
node scripts/audit-extension-package.mjs
```

Validação só do app web:

```bash
pnpm --filter @formae/web typecheck
pnpm --filter @formae/web test
```

Atualizar o catálogo público versionado:

```bash
pnpm --dir infra/public-catalog-builder build
```

Hoje esse snapshot já inclui:

- páginas públicas oficiais com provenance por captura
- estruturas curriculares públicas do SIGAA
- detalhes públicos de matriz curricular por curso/entrada quando a fonte viva expõe essa navegação
- componentes e faixas de horário públicos normalizados para consumo local pela PWA

## Estrutura do repositório

```text
apps/
  web/         # PWA publicada no GitHub Pages
  extension/   # integração local com SIGAA via navegador
  desktop/     # espaço reservado para companion futuro em Tauri

packages/
  protocol/    # contratos compartilhados entre web, extensão e runtimes locais

crates/
  domain/         # modelo acadêmico canônico
  parser/         # parser de horários UFBA/SIGAA
  rules/          # regras curriculares e pendências
  crypto/         # contratos e metadados do vault local
  wasm_core/      # bridge WebAssembly
  test_fixtures/  # fixtures e replay de contrato

docs/
  architecture.md
  adr/

infra/
  public-catalog-builder/
  static-data/
  private-sync-e2e/
```

## Limitações conhecidas hoje

O Formaê ainda não é o ponto final do produto. Hoje ainda faltam, entre outras coisas:

- catálogo público mais autoritativo por curso e entrada
- cobertura pública ainda concentrada no seed vivo atual de Engenharia Civil
- vault com derivação criptográfica mais forte, além do modo `device-local`
- distribuição assinada e publicada da extensão
- cobertura mais profunda de histórico e documentos do SIGAA
- paridade mais forte com Firefox

## Documentação complementar

- arquitetura: [docs/architecture.md](./docs/architecture.md)
- decisões arquiteturais: [docs/adr](./docs/adr)
- marca e uso do nome: [TRADEMARKS.md](./TRADEMARKS.md)

## Licença e marca

O código-fonte está sob `Apache-2.0`.

O nome `Formaê`, sua identidade visual presente e futura, e seus ativos de marca não estão liberados para rebranding derivado. Veja:

- [TRADEMARKS.md](./TRADEMARKS.md)
