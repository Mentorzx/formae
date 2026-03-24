import { Metric } from "../components/Metric";
import {
  publicCatalog,
  publicCatalogProvenance,
  publicCatalogSnapshot,
  publicCatalogSourceCoverage,
  publicCatalogSummary,
} from "../publicCatalog";

export function CatalogPage() {
  return (
    <div className="page-grid">
      <section className="hero-card accent-panel">
        <p className="section-label">Catalogo publico e proveniencia</p>
        <h2>Snapshot publico versionado para mostrar origem, cobertura e seed</h2>
        <p>
          O app consome dois contratos complementares: o snapshot publico
          gerado em <code>infra/static-data/public-catalog.snapshot.json</code>
          para provar cobertura e origem, e o indice seed em
          <code>infra/static-data/catalog-index.json</code> para manter a
          selecao de curriculos local e estavel.
        </p>
        <div className="metric-strip">
          <Metric
            label="Fontes no snapshot"
            value={`${publicCatalogProvenance.sourceCount}/${publicCatalogSummary.sourceCount}`}
          />
          <Metric
            label="Paginas publicas"
            value={String(publicCatalogProvenance.pageCount)}
          />
          <Metric
            label="Fixtures validas"
            value={String(publicCatalogProvenance.fixtureBackedPageCount)}
          />
          <Metric
            label="Curriculos seed"
            value={String(publicCatalogSummary.curriculumCount)}
          />
        </div>
      </section>

      <section className="panel">
        <p className="section-label">Proveniencia do snapshot</p>
        <div className="provenance-grid">
          <div className="soft-card">
            <h3>Build e rastreabilidade</h3>
            <div className="detail-stack">
              <p>
                <span className="detail-label">Builder</span>
                <strong>{publicCatalogProvenance.builderVersion}</strong>
              </p>
              <p>
                <span className="detail-label">Gerado em</span>
                <strong>{publicCatalogProvenance.generatedAt}</strong>
              </p>
              <p>
                <span className="detail-label">Schema</span>
                <strong>v{publicCatalogProvenance.schemaVersion}</strong>
              </p>
            </div>
          </div>
          <div className="soft-card">
            <h3>Cobertura de extracao</h3>
            <div className="detail-stack">
              <p>
                <span className="detail-label">Paginas com componentes</span>
                <strong>{publicCatalogProvenance.pagesWithComponentEvidence}</strong>
              </p>
              <p>
                <span className="detail-label">Paginas com horarios</span>
                <strong>{publicCatalogProvenance.pagesWithScheduleEvidence}</strong>
              </p>
              <p>
                <span className="detail-label">Atalhos e notas</span>
                <strong>
                  {publicCatalogProvenance.scheduleGuideCount} guias,{" "}
                  {publicCatalogProvenance.timeSlotCount} faixas,{" "}
                  {publicCatalogProvenance.noteCount} notas
                </strong>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <p className="section-label">Cobertura por fonte</p>
        <div className="card-grid">
          {publicCatalogSourceCoverage.map((coverage) => (
            <article key={coverage.source.id} className="soft-card">
              <p className="micro-label">{coverage.source.id}</p>
              <h3>{coverage.source.title}</h3>
              <p>{coverage.source.url}</p>
              <div className="tag-grid compact-grid">
                <span className="tag">{coverage.pageCount} paginas</span>
                <span className="tag">{coverage.fixtureBackedPageCount} fixtures</span>
                <span className="tag">{coverage.componentCodeCount} componentes</span>
                <span className="tag">{coverage.scheduleCodeCount} codigos</span>
              </div>
              <div className="detail-stack">
                <p>
                  <span className="detail-label">PII</span>
                  <strong>{coverage.source.pii}</strong>
                </p>
                <p>
                  <span className="detail-label">Origem</span>
                  <strong>{coverage.source.kind}</strong>
                </p>
                <p>
                  <span className="detail-label">Cobertura relativa</span>
                  <strong>{Math.round(coverage.pageCoverageRatio * 100)}%</strong>
                </p>
                <p>
                  <span className="detail-label">Fixture</span>
                  <strong>{coverage.source.fixture}</strong>
                </p>
              </div>
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
        <p className="section-label">Curriculos seed preservados</p>
        <div className="card-grid">
          {publicCatalog.curricula.map((curriculum) => (
            <article key={curriculum.id} className="soft-card">
              <p className="micro-label">{curriculum.course.code}</p>
              <h3>{curriculum.name}</h3>
              <p>{curriculum.course.name}</p>
              <div className="tag-grid compact-grid">
                <span className="tag">
                  {curriculum.components.length} componentes
                </span>
                <span className="tag">
                  {curriculum.prerequisiteRules.length} regras
                </span>
                <span className="tag">{curriculum.equivalences.length} equivalencias</span>
              </div>
              <div className="detail-stack">
                <p>
                  <span className="detail-label">Versao</span>
                  <strong>{curriculum.versionTag}</strong>
                </p>
                <p>
                  <span className="detail-label">Notas</span>
                  <strong>{curriculum.notes.length} entradas</strong>
                </p>
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

      <section className="panel">
        <p className="section-label">Snapshot bruto</p>
        <div className="soft-card">
          <p>
            <span className="detail-label">Paginas</span>
            <strong>{publicCatalogSnapshot.pages.length}</strong>
          </p>
          <p>
            <span className="detail-label">Componentes</span>
            <strong>{publicCatalogSnapshot.components.length}</strong>
          </p>
          <p>
            <span className="detail-label">Faixas de horario</span>
            <strong>{publicCatalogSnapshot.timeSlots.length}</strong>
          </p>
        </div>
      </section>
    </div>
  );
}
