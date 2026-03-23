import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import {
  messageKinds,
  milestones,
  officialSources,
  principles,
  protocolVersion,
  requestSyncExample,
  trustBoundaries,
} from "./content";

function App() {
  return (
    <HashRouter>
      <div className="app-shell">
        <div className="backdrop backdrop-one" />
        <div className="backdrop backdrop-two" />
        <header className="site-header">
          <div>
            <p className="eyebrow">Formaê</p>
            <h1>Assistente acadêmico leve, local e explícito nas fronteiras</h1>
            <p className="lede">
              Novo projeto inspirado no MeForma original e no trabalho de Joao
              Pedro Rodrigues Cerqueira, mas com arquitetura nova, sem backend
              para dados sensíveis e com Rust no centro das regras.
            </p>
          </div>

          <nav className="site-nav" aria-label="Seções principais">
            <NavLink to="/">Visão Geral</NavLink>
            <NavLink to="/arquitetura">Arquitetura</NavLink>
            <NavLink to="/entregas">Entregas</NavLink>
          </nav>
        </header>

        <main className="page-main">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/arquitetura" element={<ArchitecturePage />} />
            <Route path="/entregas" element={<DeliveryPage />} />
          </Routes>
        </main>

        <footer className="site-footer">
          <span>Protocol v{protocolVersion}</span>
          <span>PWA estática publicada no GitHub Pages</span>
          <span>Slug técnico: formae</span>
        </footer>
      </div>
    </HashRouter>
  );
}

function OverviewPage() {
  return (
    <div className="page-grid">
      <section className="hero-card">
        <p className="section-label">Primeiro marco</p>
        <h2>Shell estático + contratos + parser UFBA 2025</h2>
        <p>
          A v0 existe para reduzir risco técnico cedo: PWA de leitura local,
          contratos explícitos, fixtures públicas e o parser de horários
          preparado para códigos como <strong>35N12</strong>, isto é, terça e
          quinta de <strong>18:30 a 20:20</strong>.
        </p>
        <div className="metric-strip">
          <Metric label="Hospedagem inicial" value="GitHub Pages" />
          <Metric label="Dados privados no servidor" value="0" />
          <Metric label="Stack principal" value="React + Rust/WASM" />
        </div>
      </section>

      <section className="panel">
        <p className="section-label">Princípios</p>
        <div className="card-grid">
          {principles.map((item) => (
            <article key={item.title} className="soft-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="section-label">
          Mensagens previstas entre web e runtimes locais
        </p>
        <div className="tag-grid">
          {messageKinds.map((kind) => (
            <span key={kind} className="tag">
              {kind}
            </span>
          ))}
        </div>
        <pre className="code-block">
          <code>{JSON.stringify(requestSyncExample, null, 2)}</code>
        </pre>
      </section>
    </div>
  );
}

function ArchitecturePage() {
  return (
    <div className="page-grid">
      <section className="panel">
        <p className="section-label">Fronteiras de confiança</p>
        <ul className="list">
          {trustBoundaries.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <p className="section-label">Fluxo privado esperado</p>
        <ol className="list ordered">
          <li>
            Usuário desbloqueia o app localmente e inicia a sincronização.
          </li>
          <li>
            Extensão local coleta CPF ou usuário e senha apenas em memória.
          </li>
          <li>
            Conteúdo autenticado do SIGAA é lido localmente e convertido em
            payload bruto.
          </li>
          <li>
            Rust/WASM normaliza horários, pendências e metadados acadêmicos.
          </li>
          <li>
            Snapshot cifrado vai para IndexedDB; logout aciona wipe
            configurável.
          </li>
        </ol>
      </section>

      <section className="panel accent-panel">
        <p className="section-label">Regras de horário UFBA 2025</p>
        <div className="timeline">
          <div>
            <span>M1</span>
            <strong>07:00–07:55</strong>
          </div>
          <div>
            <span>T2</span>
            <strong>13:55–14:50</strong>
          </div>
          <div>
            <span>N1</span>
            <strong>18:30–19:25</strong>
          </div>
          <div>
            <span>N2</span>
            <strong>19:25–20:20</strong>
          </div>
        </div>
      </section>
    </div>
  );
}

function DeliveryPage() {
  return (
    <div className="page-grid">
      <section className="panel">
        <p className="section-label">Roadmap</p>
        <div className="card-grid">
          {milestones.map((item) => (
            <article key={item.phase} className="soft-card">
              <p className="micro-label">{item.phase}</p>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="section-label">
          Fontes oficiais tratadas como referência
        </p>
        <ul className="list">
          {officialSources.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <p className="section-label">Entrega desta base</p>
        <p>
          Este repositório já nasce com o shell da PWA, contratos TypeScript,
          parser e modelo canônico em Rust, docs de arquitetura, ADRs, fixtures
          públicas e workflows para CI e publicação estática.
        </p>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
