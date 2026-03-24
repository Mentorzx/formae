import { trustBoundaries } from "../content";

export function ArchitecturePage() {
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
