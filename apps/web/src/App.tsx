import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import { ArchitecturePage } from "./pages/ArchitecturePage";
import { CatalogPage } from "./pages/CatalogPage";
import { ImportPage } from "./pages/ImportPage";
import { OverviewPage } from "./pages/OverviewPage";
import { PlannerPage } from "./pages/PlannerPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { SupportPage } from "./pages/SupportPage";
import { CHROME_WEB_STORE_URL } from "./runtimeLinks";
import { useThemePreference } from "./useThemePreference";

function App() {
  const { theme, toggleTheme } = useThemePreference();

  return (
    <HashRouter>
      <div className="app-shell">
        <div className="backdrop backdrop-one" />
        <div className="backdrop backdrop-two" />

        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="brand-lockup">
              <span
                className="eyebrow"
                style={{ fontSize: "1.25rem", fontWeight: "700" }}
              >
                Formaê
              </span>
              <p className="sidebar-tagline">
                Planejador acadêmico local-first para UFBA.
              </p>
            </div>
          </div>

          <nav className="sidebar-nav" aria-label="Navegação Secundária">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? "nav-item active" : "nav-item"
              }
            >
              Visão Geral
            </NavLink>
            <NavLink
              to="/planejador"
              className={({ isActive }) =>
                isActive ? "nav-item active" : "nav-item"
              }
            >
              Planejador
            </NavLink>
            <NavLink
              to="/catalogo"
              className={({ isActive }) =>
                isActive ? "nav-item active" : "nav-item"
              }
            >
              Catálogo
            </NavLink>
            <NavLink
              to="/importacao"
              className={({ isActive }) =>
                isActive ? "nav-item active" : "nav-item"
              }
            >
              Importação
            </NavLink>
          </nav>

          <div className="sidebar-footer">
            <nav className="sidebar-nav-small">
              <NavLink to="/arquitetura">Arquitetura</NavLink>
              <NavLink to="/privacidade">Privacidade</NavLink>
              <NavLink to="/suporte">Suporte</NavLink>
            </nav>
            <div className="sidebar-actions">
              <a
                className="shell-badge"
                href={CHROME_WEB_STORE_URL}
                target="_blank"
                rel="noreferrer"
              >
                Instalar extensão
              </a>
              <button
                type="button"
                className="theme-toggle"
                onClick={toggleTheme}
                aria-pressed={theme === "dark"}
              >
                {theme === "dark" ? "☀️" : "🌙"}
              </button>
            </div>
          </div>
        </aside>

        <main className="main-content">
          <div className="page-container">
            <Routes>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/planejador" element={<PlannerPage />} />
              <Route path="/catalogo" element={<CatalogPage />} />
              <Route path="/importacao" element={<ImportPage />} />
              <Route path="/arquitetura" element={<ArchitecturePage />} />
              <Route path="/privacidade" element={<PrivacyPage />} />
              <Route path="/suporte" element={<SupportPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </HashRouter>
  );
}

export default App;
