import type {
  LocalStudentSnapshotBundle,
  PendingRequirementStatus,
} from "@formae/protocol";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Metric } from "../components/Metric";
import {
  messageKinds,
  milestones,
  principles,
  requestSyncExample,
} from "../content";
import {
  type LocalStudentSnapshotSource,
  loadLatestProjectedStudentSnapshot,
} from "../localStudentSnapshot";
import {
  type ComponentProgressStatus,
  type StudentProgressSummary,
  summarizeStudentProgress,
} from "../studentProgress";

type OverviewStatus = "loading" | "ready" | "error";

interface OverviewState {
  status: OverviewStatus;
  bundle: LocalStudentSnapshotBundle | null;
  bundleSource: LocalStudentSnapshotSource;
  summary: StudentProgressSummary | null;
  errorMessage: string | null;
}

export function OverviewPage() {
  const [overviewState, setOverviewState] = useState<OverviewState>({
    status: "loading",
    bundle: null,
    bundleSource: "none",
    summary: null,
    errorMessage: null,
  });

  useEffect(() => {
    let cancelled = false;

    void loadLatestProjectedStudentSnapshot()
      .then(({ bundle, source }) => {
        if (cancelled) {
          return;
        }

        setOverviewState({
          status: "ready",
          bundle,
          bundleSource: source,
          summary: bundle ? summarizeStudentProgress(bundle) : null,
          errorMessage: null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setOverviewState({
          status: "error",
          bundle: null,
          bundleSource: "none",
          summary: null,
          errorMessage:
            error instanceof Error
              ? error.message
              : "Falha ao carregar o snapshot local do navegador.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page-grid">
      <section className="hero-card">
        <p className="section-label">
          {overviewState.summary ? "Progresso local" : "Primeiro marco"}
        </p>
        <h2>
          {overviewState.summary
            ? "Integralizacao inicial do snapshot salvo"
            : "Shell estatico + contratos + parser UFBA 2025"}
        </h2>
        <p>
          {overviewState.summary
            ? "Esta leitura mostra o que o bundle local ja resolve sem backend: componentes mapeados, horarios vinculados e pendencias que ainda exigem revisao."
            : "A v0 existe para reduzir risco tecnico cedo: PWA de leitura local, contratos explicitos, fixtures publicas e o parser de horarios preparado para codigos como 35N12, isto e, terca e quinta de 18:30 a 20:20."}
        </p>
        <div className="metric-strip">
          {overviewState.summary ? (
            <>
              <Metric
                label="Integralizacao inicial"
                value={`${overviewState.summary.resolvedComponentPercent}%`}
              />
              <Metric
                label="Catalogo resolvido"
                value={`${overviewState.summary.matchedCatalogCount}/${overviewState.summary.componentCount}`}
              />
              <Metric
                label="Horarios vinculados"
                value={`${overviewState.summary.boundScheduleBlockCount}/${overviewState.summary.scheduleBlockCount}`}
              />
              <Metric
                label="Pendencias abertas"
                value={String(overviewState.summary.pendingRequirementCount)}
              />
            </>
          ) : (
            <>
              <Metric label="Hospedagem inicial" value="GitHub Pages" />
              <Metric label="Dados privados no servidor" value="0" />
              <Metric label="Stack principal" value="React + Rust/WASM" />
            </>
          )}
        </div>
        {overviewState.summary ? (
          <p className="micro-copy">
            Ultima derivacao:{" "}
            {formatLocalDateTime(overviewState.summary.derivedAt)}
            {" | "}Origem: {formatBundleSource(overviewState.bundleSource)}
          </p>
        ) : null}
      </section>

      <OverviewSnapshotPanel overviewState={overviewState} />

      {overviewState.summary ? (
        <>
          <section className="panel">
            <p className="section-label">Componentes do snapshot</p>
            <div className="card-grid">
              {overviewState.summary.componentItems.map((component) => (
                <article key={component.code} className="soft-card">
                  <div className="card-topline">
                    <p className="micro-label">{component.code}</p>
                    <span
                      className={`status-pill status-pill-${component.status}`}
                    >
                      {formatComponentProgressStatus(component.status)}
                    </span>
                  </div>
                  <h3>{component.title}</h3>
                  <div className="fact-row">
                    <span className="vault-fact">
                      Catalogo: {component.hasCatalogMatch ? "ok" : "pendente"}
                    </span>
                    <span className="vault-fact">
                      Horarios: {component.scheduleBlockCount}
                    </span>
                    <span className="vault-fact">
                      Pendencias: {component.pendingRequirements.length}
                    </span>
                  </div>
                  {component.pendingRequirements.length > 0 ? (
                    <ul className="list subsection">
                      {component.pendingRequirements.map((requirement) => (
                        <li key={requirement.id}>
                          <strong>
                            {formatPendingRequirementStatus(requirement.status)}
                          </strong>{" "}
                          {requirement.title}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>Sem pendencias especificas para este componente.</p>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className="panel accent-panel">
            <p className="section-label">Pendencias e leitura do catalogo</p>
            <div className="split-grid">
              <div className="soft-card">
                <h3>Pendencias sem vinculo direto</h3>
                {overviewState.summary.generalPendingRequirements.length > 0 ? (
                  <ul className="list">
                    {overviewState.summary.generalPendingRequirements.map(
                      (requirement) => (
                        <li key={requirement.id}>
                          <strong>
                            {formatPendingRequirementStatus(requirement.status)}
                          </strong>{" "}
                          {requirement.title}
                        </li>
                      ),
                    )}
                  </ul>
                ) : (
                  <p>Nenhuma pendencia geral aberta neste snapshot.</p>
                )}
              </div>

              <div className="soft-card">
                <h3>Leitura atual do snapshot</h3>
                <ul className="list">
                  <li>
                    Curriculo local:{" "}
                    {overviewState.summary.studentSnapshot.curriculum.name}
                  </li>
                  <li>
                    Curso local:{" "}
                    {
                      overviewState.summary.studentSnapshot.curriculum.course
                        .name
                    }
                  </li>
                  <li>
                    Blocos sem vinculo:{" "}
                    {overviewState.summary.unboundScheduleBlockCount}
                  </li>
                  <li>
                    Snapshot salvo em:{" "}
                    {formatLocalDateTime(
                      overviewState.bundle?.manualImport.savedAt ??
                        overviewState.summary.derivedAt,
                    )}
                  </li>
                </ul>
              </div>
            </div>
          </section>
        </>
      ) : null}

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

function OverviewSnapshotPanel({
  overviewState,
}: {
  overviewState: OverviewState;
}) {
  if (overviewState.status === "loading") {
    return (
      <section className="panel">
        <p className="status-banner">
          Carregando o snapshot local do navegador...
        </p>
      </section>
    );
  }

  if (overviewState.status === "error") {
    return (
      <section className="panel">
        <p className="status-banner status-banner-error">
          {overviewState.errorMessage ??
            "Falha ao ler o snapshot local do navegador."}
        </p>
      </section>
    );
  }

  if (!overviewState.summary) {
    return (
      <section className="panel accent-panel">
        <p className="section-label">Sem snapshot local</p>
        <h3>Nenhuma projecao local foi salva ainda</h3>
        <p>
          A visao geral fica mais util depois que a importacao manual gera e
          salva um bundle local com componentes, horarios e pendencias ja
          projetados no navegador.
        </p>
        <p>
          Abra a{" "}
          <Link className="inline-link" to="/importacao">
            importacao manual
          </Link>
          , cole um trecho do SIGAA e salve o snapshot consolidado para liberar
          esta leitura.
        </p>
      </section>
    );
  }

  return null;
}

function formatLocalDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatBundleSource(source: LocalStudentSnapshotSource): string {
  if (source === "bundle") {
    return "bundle consolidado";
  }

  if (source === "manual-snapshot-fallback") {
    return "snapshot manual legado";
  }

  return "sem dados locais";
}

function formatComponentProgressStatus(
  status: ComponentProgressStatus,
): string {
  if (status === "ready") {
    return "Resolvido";
  }

  if (status === "partial") {
    return "Parcial";
  }

  return "Revisar";
}

function formatPendingRequirementStatus(
  status: PendingRequirementStatus,
): string {
  if (status === "completed") {
    return "Concluida:";
  }

  if (status === "inProgress") {
    return "Em andamento:";
  }

  return "Pendente:";
}
