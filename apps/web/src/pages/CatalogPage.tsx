import { Metric } from "../components/Metric";
import { publicCatalog, publicCatalogSummary } from "../publicCatalog";

export function CatalogPage() {
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
