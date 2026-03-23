import {
  BRIDGE_PROTOCOL_VERSION,
  bridgeMessageKinds,
  createRequestSyncExample,
} from "@formae/protocol";

export const protocolVersion = BRIDGE_PROTOCOL_VERSION;
export const messageKinds = bridgeMessageKinds;
export const requestSyncExample = createRequestSyncExample();

export const principles = [
  {
    title: "Static-first shell",
    body: "GitHub Pages publica a PWA sem backend para dados privados. Cloudflare Pages continua documentado como opção futura, não como dependência da v0.",
  },
  {
    title: "Fronteira honesta de confiança",
    body: "A integração com páginas autenticadas do SIGAA fica no dispositivo do usuário, via extensão ou companion local, sem credenciais persistidas no servidor.",
  },
  {
    title: "Núcleo compartilhado em Rust",
    body: "Domínio acadêmico, parsing de horários e regras curriculares saem da UI e podem rodar no browser via WebAssembly ou em runtimes locais.",
  },
] as const;

export const milestones = [
  {
    phase: "Fase 0",
    title: "Arquitetura e contratos",
    body: "Monorepo, parser UFBA 2025, fixtures públicas, ADRs e baseline de CI.",
  },
  {
    phase: "Fase 1",
    title: "Catálogo público",
    body: "Pipeline manual para dados públicos de turmas, componentes e regras operacionais da UFBA.",
  },
  {
    phase: "Fase 2",
    title: "Sync privado local",
    body: "Extensão MV3 negocia credenciais efêmeras, extrai conteúdo localmente e delega normalização ao core em Rust/WASM.",
  },
  {
    phase: "Fase 3",
    title: "Vault local",
    body: "IndexedDB cifrado com Web Crypto, desbloqueio local por passkey e wipe explícito no logout.",
  },
] as const;

export const trustBoundaries = [
  "Web shell estático sem acesso livre ao domínio autenticado do SIGAA.",
  "Extensão local com permissões mínimas e contratos versionados para coleta efêmera.",
  "Core Rust/WASM responsável por normalização e serialização estável.",
  "Vault local cifrado no navegador com wipe por sessão ou limpeza completa.",
] as const;

export const officialSources = [
  "SIGAA público da UFBA para turmas, componentes e páginas institucionais abertas.",
  "UFBA SIM para regras operacionais, códigos de horário e comunicação estudantil.",
  "SUPAC para matrícula, histórico, vínculo, declarações e fluxos documentais.",
  "Validador público de documentos emitidos pelo SIGAA para verificação local.",
] as const;
