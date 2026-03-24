import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import { protocolVersion } from "./content";
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
          <div>
            <p className="eyebrow">Formaê</p>
            <h1>Assistente academico leve, local e explicito nas fronteiras</h1>
            <p className="lede">
              Novo projeto inspirado no MeForma original e no trabalho de Joao
              Pedro Rodrigues Cerqueira, mas com arquitetura nova, sem backend
              para dados sensiveis e com Rust no centro das regras.
            </p>
          </div>

          <div className="site-chrome">
            <nav className="site-nav" aria-label="Secoes principais">
              <NavLink to="/">Visao Geral</NavLink>
              <NavLink to="/planejador">Planejador</NavLink>
              <NavLink to="/catalogo">Catalogo</NavLink>
              <NavLink to="/importacao">Importacao</NavLink>
              <NavLink to="/arquitetura">Arquitetura</NavLink>
            </nav>

            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-pressed={theme === "dark"}
            >
              {theme === "dark" ? "Modo claro" : "Modo escuro"}
            </button>
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
          <span>Protocol v{protocolVersion}</span>
          <span>PWA estatica publicada no GitHub Pages</span>
          <span>Slug tecnico: formae</span>
        </footer>
      </div>
    </HashRouter>
  );
}

export default App;
