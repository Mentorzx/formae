import {
  CHROME_WEB_STORE_URL,
  GITHUB_ISSUES_URL,
  GITHUB_REPOSITORY_URL,
} from "../runtimeLinks";

const SUPPORT_LINKS = [
  {
    label: "Repositorio",
    href: GITHUB_REPOSITORY_URL,
    body: "Codigo-fonte, historico de commits e releases publicos.",
  },
  {
    label: "Issues",
    href: GITHUB_ISSUES_URL,
    body: "Canal principal para bugs, regressao de sync e problemas no planner.",
  },
  {
    label: "Chrome Web Store",
    href: CHROME_WEB_STORE_URL,
    body: "Instalacao principal da extensao para o fluxo publico do produto.",
  },
];

export function SupportPage() {
  return (
    <div className="page-grid">
      <section className="hero-card accent-panel">
        <p className="section-label">Suporte publico</p>
        <h2>Onde acompanhar, instalar e reportar problemas hoje</h2>
        <p>
          O fluxo recomendado agora e abrir a PWA publicada, instalar a extensao
          pela Chrome Web Store, preparar a sessao efemera na popup e
          sincronizar. Se algo falhar, registre um issue com navegador, sistema
          e sintomas.
        </p>
      </section>

      <section className="panel">
        <p className="section-label">Canais</p>
        <div className="card-grid">
          {SUPPORT_LINKS.map((link) => (
            <article key={link.href} className="soft-card">
              <h3>{link.label}</h3>
              <p>{link.body}</p>
              <a
                className="inline-link"
                href={link.href}
                target="_blank"
                rel="noreferrer"
              >
                Abrir {link.label.toLowerCase()}
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="section-label">Checklist para relatar bug</p>
        <ol className="list ordered">
          <li>
            Informe se o problema ocorreu na PWA, na extensao ou nos dois.
          </li>
          <li>Informe navegador, versao e sistema operacional.</li>
          <li>Descreva em que tela estava e qual acao executou.</li>
          <li>
            Diga se o erro aconteceu com importacao manual, sync automatico,
            vault local ou planner.
          </li>
          <li>
            Redija logs e capturas sem expor CPF, senha, historico ou
            identificadores de sessao.
          </li>
        </ol>
      </section>

      <section className="panel">
        <p className="section-label">Estado da distribuicao</p>
        <p>
          O fluxo publico foi alinhado para instalacao pela Chrome Web Store. O
          pipeline continua gerando pacotes e verificacoes locais para
          Chrome/Firefox, mas a jornada principal do aluno agora aponta para a
          instalacao em loja em vez do download manual por ZIP.
        </p>
      </section>
    </div>
  );
}
