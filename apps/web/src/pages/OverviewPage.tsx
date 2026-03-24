import { Metric } from "../components/Metric";
import {
  messageKinds,
  milestones,
  principles,
  requestSyncExample,
} from "../content";

export function OverviewPage() {
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
