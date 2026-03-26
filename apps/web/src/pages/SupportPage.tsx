const SUPPORT_LINKS = [
  {
    label: "Repositorio",
    href: "https://github.com/Mentorzx/formae",
    body: "Codigo-fonte, historico de commits e releases publicos.",
  },
  {
    label: "Issues",
    href: "https://github.com/Mentorzx/formae/issues",
    body: "Canal principal para bugs, regressao de sync e problemas no planner.",
  },
  {
    label: "Releases",
    href: "https://github.com/Mentorzx/formae/releases/latest",
    body: "Artefatos atuais da extensao para Chrome e Firefox.",
  },
];

export function SupportPage() {
  return (
    <div className="page-grid">
      <section className="hero-card accent-panel">
        <p className="section-label">Suporte publico</p>
        <h2>Onde acompanhar, instalar e reportar problemas hoje</h2>
        <p>
          O Formaê ainda esta em preview avancado. O fluxo mais util para
          suporte e abrir a PWA publicada, instalar a extensao pelos releases e,
          se algo falhar, registrar um issue com navegador, sistema e sintomas.
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
          <li>Informe se o problema ocorreu na PWA, na extensao ou nos dois.</li>
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
          A extensao ja tem empacotamento para Chrome e Firefox e pipeline de
          verificacao reprodutivel. A publicacao em loja ainda depende das
          contas de publisher, segredos de API e revisao das lojas.
        </p>
      </section>
    </div>
  );
}
