import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import {
  protocolVersion,
  shellHighlights,
  shellSignalDeck,
  syncRunway,
} from "./content";
import { ArchitecturePage } from "./pages/ArchitecturePage";
import { CatalogPage } from "./pages/CatalogPage";
import { ImportPage } from "./pages/ImportPage";
import { OverviewPage } from "./pages/OverviewPage";
import { PlannerPage } from "./pages/PlannerPage";
import { useThemePreference } from "./useThemePreference";

function App() {
  const { theme, toggleTheme } = useThemePreference();

  return (
    <HashRouter>
      <div className="app-shell">
        <div className="backdrop backdrop-one" />
        <div className="backdrop backdrop-two" />
        <header className="site-header">
          <div className="site-header-top">
            <div className="brand-lockup">
              <p className="eyebrow">Formaê</p>
              <p className="brand-subtitle">
                Assistente academico local para progresso, importacao e
                planejamento
              </p>
            </div>

            <div className="site-header-actions">
              <span className="shell-badge">Protocol v{protocolVersion}</span>
              <button
                type="button"
                className="theme-toggle"
                onClick={toggleTheme}
                aria-pressed={theme === "dark"}
              >
                {theme === "dark" ? "Modo claro" : "Modo escuro"}
              </button>
            </div>
          </div>

          <div className="site-header-main">
            <div className="site-header-copy">
              <p className="site-header-kicker">
                PWA estatica, sync local e uma fronteira de confianca legivel
              </p>
              <h1>
                Planejamento academico local com sync honesto e progresso que
                nao vira caixa-preta
              </h1>
              <p className="lede">
                O Formaê nasce como uma releitura local-first: importacao
                automatica via extensao, vault cifrado no navegador, catalogo
                publico versionado e um planner que mostra dependencias,
                pendencias e limites da leitura sem vender magia falsa.
              </p>

              <div className="shell-chip-row">
                {shellSignalDeck.map((item) => (
                  <span key={item.label} className="hero-chip">
                    <strong>{item.label}</strong>
                    <span>{item.value}</span>
                  </span>
                ))}
              </div>

              <div className="site-header-cta-row">
                <NavLink to="/importacao" className="action-button">
                  Abrir importacao
                </NavLink>
                <NavLink
                  to="/planejador"
                  className="action-button action-button-secondary"
                >
                  Explorar planner
                </NavLink>
              </div>
            </div>

            <aside
              className="shell-hero-panel"
              aria-label="Resumo da plataforma"
            >
              <p className="section-label">Resumo da plataforma</p>
              <h2>Shell publico, ponte local e cofre cifrado</h2>
              <p>
                O fluxo privado roda no dispositivo do usuario. Em producao, a
                PWA conversa com a extensao pelo bridge direto; o relay legado
                fica so para depuracao local.
              </p>
              <div className="shell-status-list">
                <div className="shell-status-row">
                  <span className="status-pill status-pill-ready">Sync</span>
                  <p>Extensao MV3 com sessoes efemeras e aprovacao curta.</p>
                </div>
                <div className="shell-status-row">
                  <span className="status-pill status-pill-idle">Vault</span>
                  <p>
                    IndexedDB cifrado com modo PRF quando o navegador entrega.
                  </p>
                </div>
                <div className="shell-status-row">
                  <span className="status-pill status-pill-warning">Grade</span>
                  <p>
                    Planner local explica quando a leitura ainda depende de seed
                    ou revisao manual.
                  </p>
                </div>
              </div>
            </aside>
          </div>

          <div className="site-chrome">
            <nav className="site-nav" aria-label="Secoes principais">
              <NavLink to="/">Visao Geral</NavLink>
              <NavLink to="/planejador">Planejador</NavLink>
              <NavLink to="/catalogo">Catalogo</NavLink>
              <NavLink to="/importacao">Importacao</NavLink>
              <NavLink to="/arquitetura">Arquitetura</NavLink>
            </nav>
          </div>

          <section
            className="shell-highlight-row"
            aria-label="Diretrizes principais"
          >
            {shellHighlights.map((item) => (
              <article key={item.label} className="shell-highlight-card">
                <p className="micro-label">{item.label}</p>
                <p>{item.value}</p>
              </article>
            ))}
          </section>

          <section
            className="shell-runway-grid"
            aria-label="Fluxo da experiencia"
          >
            {syncRunway.map((item) => (
              <article key={item.step} className="shell-runway-card">
                <p className="shell-runway-step">{item.step}</p>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </section>
        </header>

        <main className="page-main">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/planejador" element={<PlannerPage />} />
            <Route path="/catalogo" element={<CatalogPage />} />
            <Route path="/importacao" element={<ImportPage />} />
            <Route path="/arquitetura" element={<ArchitecturePage />} />
          </Routes>
        </main>

        <footer className="site-footer">
          <span>PWA estatica publicada no GitHub Pages</span>
          <span>Slug tecnico: formae</span>
          <span>Theme aware UI</span>
        </footer>
      </div>
    </HashRouter>
  );
}

export default App;
