import { useState } from "react";
import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import {
  messageKinds,
  milestones,
  principles,
  protocolVersion,
  requestSyncExample,
  trustBoundaries,
} from "./content";
import { createManualImportPreview } from "./manualImport";
import {
  findCatalogMatches,
  publicCatalog,
  publicCatalogSummary,
} from "./publicCatalog";

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
              para dados sensiveis e com Rust no centro das regras.
            </p>
          </div>

          <nav className="site-nav" aria-label="Seções principais">
            <NavLink to="/">Visao Geral</NavLink>
            <NavLink to="/catalogo">Catalogo</NavLink>
            <NavLink to="/importacao">Importacao</NavLink>
            <NavLink to="/arquitetura">Arquitetura</NavLink>
          </nav>
        </header>

        <main className="page-main">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
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

function OverviewPage() {
  return (
    <div className="page-grid">
      <section className="hero-card">
        <p className="section-label">Primeiro marco</p>
        <h2>Shell estatico + contratos + parser UFBA 2025</h2>
        <p>
          A v0 existe para reduzir risco tecnico cedo: PWA de leitura local,
          contratos explicitos, fixtures publicas e o parser de horarios
          preparado para codigos como <strong>35N12</strong>, isto e, terca e
          quinta de <strong>18:30 a 20:20</strong>.
        </p>
        <div className="metric-strip">
          <Metric label="Hospedagem inicial" value="GitHub Pages" />
          <Metric label="Dados privados no servidor" value="0" />
          <Metric label="Stack principal" value="React + Rust/WASM" />
        </div>
      </section>

      <section className="panel">
        <p className="section-label">Principios</p>
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

      <section className="panel">
        <p className="section-label">Roadmap imediato</p>
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
    </div>
  );
}

function CatalogPage() {
  return (
    <div className="page-grid">
      <section className="hero-card">
        <p className="section-label">Catalogo publico inicial</p>
        <h2>Seed estatico para fontes, componentes e atalhos oficiais</h2>
        <p>
          O v0 ja consome um indice publico versionado dentro do repositorio.
          Ele existe para validar contratos, navegar fontes oficiais e sustentar
          a fase inicial sem tocar em dados privados.
        </p>
        <div className="metric-strip">
          <Metric
            label="Fontes oficiais"
            value={String(publicCatalogSummary.sourceCount)}
          />
          <Metric
            label="Componentes seed"
            value={String(publicCatalogSummary.componentCount)}
          />
          <Metric
            label="Atalhos uteis"
            value={String(publicCatalogSummary.shortcutCount)}
          />
        </div>
      </section>

      <section className="panel">
        <p className="section-label">Fontes publicas</p>
        <div className="card-grid">
          {publicCatalog.sources.map((source) => (
            <article key={source.id} className="soft-card">
              <h3>{source.title}</h3>
              <p>{source.url}</p>
              <p>Nivel de PII: {source.pii}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="section-label">Componentes seed</p>
        <div className="card-grid">
          {publicCatalog.components.map((component) => (
            <article key={component.code} className="soft-card">
              <p className="micro-label">{component.code}</p>
              <h3>{component.title}</h3>
              <p>{component.summary}</p>
              <div className="tag-grid compact-grid">
                <span className="tag">{component.scheduleCode}</span>
                <span className="tag">{component.canonicalScheduleCode}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="section-label">Atalhos e notas</p>
        <div className="split-grid">
          <div className="soft-card">
            <h3>Documentos e operacao</h3>
            <ul className="list">
              {publicCatalog.documentShortcuts.map((shortcut) => (
                <li key={shortcut.url}>
                  <a href={shortcut.url} target="_blank" rel="noreferrer">
                    {shortcut.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="soft-card">
            <h3>Notas do dataset</h3>
            <ul className="list">
              {publicCatalog.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function ImportPage() {
  const [rawInput, setRawInput] = useState("");
  const preview = createManualImportPreview({
    source: "plain-text",
    rawInput,
    capturedAt: "2026-03-23T21:25:00Z",
    timingProfileId: "Ufba2025",
  });
  const matchedComponents = findCatalogMatches(preview.detectedComponentCodes);

  return (
    <div className="page-grid">
      <section className="hero-card">
        <p className="section-label">Importacao manual inicial</p>
        <h2>
          Cole texto exportado do SIGAA sem nunca guardar senha em arquivo
        </h2>
        <p>
          Esta previa trabalha apenas com texto colado localmente. O objetivo
          agora e detectar codigos de horario e componentes para preparar o
          caminho da importacao manual antes do sync automatico.
        </p>
      </section>

      <section className="panel">
        <p className="section-label">Cole um trecho</p>
        <div className="split-grid">
          <label className="input-panel" htmlFor="manual-import">
            <span className="micro-label">Texto bruto</span>
            <textarea
              id="manual-import"
              className="import-textarea"
              value={rawInput}
              onChange={(event) => setRawInput(event.target.value)}
              placeholder="Exemplo: MATA37 - Introducao a Logica de Programacao - 3M23 5T23"
            />
          </label>

          <div className="soft-card">
            <h3>Privacidade operacional</h3>
            <ul className="list">
              <li>Nao cole senha do SIGAA.</li>
              <li>Use apenas trechos de historico, matricula ou turmas.</li>
              <li>O processamento desta previa e local ao navegador.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="panel">
        <p className="section-label">Preview extraido</p>
        <div className="split-grid">
          <div className="soft-card">
            <h3>Codigos detectados</h3>
            <p>Caracteres analisados: {preview.rawLength}</p>
            <div className="tag-grid compact-grid">
              {preview.detectedComponentCodes.map((code) => (
                <span key={code} className="tag">
                  {code}
                </span>
              ))}
              {preview.detectedScheduleCodes.map((code) => (
                <span key={code} className="tag">
                  {code}
                </span>
              ))}
            </div>
            {preview.detectedComponentCodes.length === 0 &&
            preview.detectedScheduleCodes.length === 0 ? (
              <p>Nenhum codigo detectado ainda.</p>
            ) : null}
          </div>

          <div className="soft-card">
            <h3>Matching com catalogo seed</h3>
            <ul className="list">
              {matchedComponents.map((component) => (
                <li key={component.code}>
                  {component.code} - {component.title}
                </li>
              ))}
            </ul>
            {matchedComponents.length === 0 ? (
              <p>Nenhum componente seed casou com a entrada.</p>
            ) : null}
          </div>
        </div>

        <div className="soft-card warnings-card">
          <h3>Warnings</h3>
          <ul className="list">
            {preview.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function ArchitecturePage() {
  return (
    <div className="page-grid">
      <section className="panel">
        <p className="section-label">Fronteiras de confianca</p>
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
            Usuario desbloqueia o app localmente e inicia a sincronizacao.
          </li>
          <li>
            Extensao local coleta CPF ou usuario e senha apenas em memoria.
          </li>
          <li>
            Conteudo autenticado do SIGAA e lido localmente e convertido em
            payload bruto.
          </li>
          <li>
            Rust/WASM normaliza horarios, pendencias e metadados academicos.
          </li>
          <li>
            Snapshot cifrado vai para IndexedDB; logout aciona wipe
            configuravel.
          </li>
        </ol>
      </section>

      <section className="panel accent-panel">
        <p className="section-label">Regras de horario UFBA 2025</p>
        <div className="timeline">
          <div>
            <span>M1</span>
            <strong>07:00-07:55</strong>
          </div>
          <div>
            <span>T2</span>
            <strong>13:55-14:50</strong>
          </div>
          <div>
            <span>N1</span>
            <strong>18:30-19:25</strong>
          </div>
          <div>
            <span>N2</span>
            <strong>19:25-20:20</strong>
          </div>
        </div>
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
