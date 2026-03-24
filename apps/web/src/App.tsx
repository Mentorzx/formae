import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import { protocolVersion, shellHighlights } from "./content";
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
              <h1>Assistente academico leve, local e explicito nas fronteiras</h1>
              <p className="lede">
                Novo projeto inspirado no MeForma original e no trabalho de
                Joao Pedro Rodrigues Cerqueira, mas com arquitetura nova, sem
                backend para dados sensiveis e com Rust no centro das regras.
              </p>

              <div className="site-header-cta-row">
                <NavLink to="/importacao" className="action-button">
                  Importar agora
                </NavLink>
                <NavLink
                  to="/planejador"
                  className="action-button action-button-secondary"
                >
                  Abrir planejador
                </NavLink>
              </div>
            </div>

            <aside className="shell-hero-panel" aria-label="Resumo da plataforma">
              <p className="section-label">Resumo da plataforma</p>
              <h2>Shell estatico + extensao local + vault cifrado</h2>
              <p>
                O fluxo privado roda no dispositivo do usuario. O shell web
                publica a experiencia e a camada de leitura, enquanto o sync
                autenticado e a normalizacao ficam fora do servidor.
              </p>
              <ul className="shell-point-list">
                <li>GitHub Pages como publicação inicial.</li>
                <li>Extensão MV3 para sessões autenticadas efêmeras.</li>
                <li>Rust/WASM para regras, parsing e contratos estáveis.</li>
              </ul>
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

          <div className="shell-highlight-row" aria-label="Diretrizes principais">
            {shellHighlights.map((item) => (
              <article key={item.label} className="shell-highlight-card">
                <p className="micro-label">{item.label}</p>
                <p>{item.value}</p>
              </article>
            ))}
          </div>
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
