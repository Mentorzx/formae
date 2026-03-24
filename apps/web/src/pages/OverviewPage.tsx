import type {
  LocalStudentSnapshotBundle,
  PendingRequirementStatus,
} from "@formae/protocol";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Metric } from "../components/Metric";
import { VaultPasskeyPanel } from "../components/VaultPasskeyPanel";
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
  disableManualImportVaultPasskey,
  isVaultLockedError,
  loadManualImportVaultPasskeyState,
  lockManualImportVaultSession,
  type ManualImportVaultPasskeyState,
  unlockManualImportVaultPasskey,
} from "../manualSnapshotStore";
import {
  type CurriculumSeedResolutionConfidence,
  type CurriculumSeedSelectionMode,
  resolveCurriculumSeed,
} from "../publicCatalog";
import {
  type ComponentAcademicStatus,
  type ComponentProgressStatus,
  type CurriculumFocusPriority,
  type CurriculumLaneStatus,
  type StudentProgressSummary,
  summarizeStudentProgress,
} from "../studentProgress";

type OverviewStatus = "loading" | "ready" | "error";
type VaultPasskeyActionStatus = "idle" | "working" | "success" | "error";

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
  const [vaultPasskeyState, setVaultPasskeyState] =
    useState<ManualImportVaultPasskeyState | null>(null);
  const [vaultPasskeyActionStatus, setVaultPasskeyActionStatus] =
    useState<VaultPasskeyActionStatus>("idle");
  const [vaultPasskeyMessage, setVaultPasskeyMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const nextVaultPasskeyState = await loadManualImportVaultPasskeyState();

      if (cancelled) {
        return;
      }

      setVaultPasskeyState(nextVaultPasskeyState);
      setVaultPasskeyMessage(null);

      if (nextVaultPasskeyState.sessionStatus === "locked") {
        setOverviewState({
          status: "ready",
          bundle: null,
          bundleSource: "none",
          summary: null,
          errorMessage: null,
        });
        return;
      }

      const { bundle, source } = await loadLatestProjectedStudentSnapshot();

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
    })().catch((error: unknown) => {
      if (cancelled) {
        return;
      }

      if (isVaultLockedError(error)) {
        setOverviewState({
          status: "ready",
          bundle: null,
          bundleSource: "none",
          summary: null,
          errorMessage: null,
        });
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
  const curriculumResolution = overviewState.bundle
    ? resolveCurriculumSeed(
        overviewState.bundle.manualImport.detectedComponentCodes,
        overviewState.bundle.manualImport.preferredCurriculumSeedId ?? null,
      )
    : null;
  const overviewSourceLabel = formatBundleSource(overviewState.bundleSource);
  const overviewResolutionLabel = curriculumResolution
    ? curriculumResolution.selectionMode === "manual-override"
      ? "Grade fixada manualmente"
      : curriculumResolution.isAmbiguous
        ? "Selecao automatica ambigua"
        : "Selecao automatica"
    : "Sem snapshot local";

  async function handleUnlockVaultPasskey() {
    setVaultPasskeyActionStatus("working");
    setVaultPasskeyMessage(null);

    try {
      const nextVaultPasskeyState = await unlockManualImportVaultPasskey();
      const { bundle, source } = await loadLatestProjectedStudentSnapshot();

      setVaultPasskeyState(nextVaultPasskeyState);
      setOverviewState({
        status: "ready",
        bundle,
        bundleSource: source,
        summary: bundle ? summarizeStudentProgress(bundle) : null,
        errorMessage: null,
      });
      setVaultPasskeyActionStatus("success");
      setVaultPasskeyMessage(
        "Vault local desbloqueado por passkey nesta sessao.",
      );
    } catch (error: unknown) {
      setVaultPasskeyActionStatus("error");
      setVaultPasskeyMessage(
        error instanceof Error
          ? error.message
          : "Falha ao desbloquear o vault local.",
      );
    }
  }

  async function handleLockVaultSession() {
    setVaultPasskeyActionStatus("working");
    setVaultPasskeyMessage(null);

    try {
      const nextVaultPasskeyState = await lockManualImportVaultSession();

      setVaultPasskeyState(nextVaultPasskeyState);
      setOverviewState({
        status: "ready",
        bundle: null,
        bundleSource: "none",
        summary: null,
        errorMessage: null,
      });
      setVaultPasskeyActionStatus("success");
      setVaultPasskeyMessage(
        "Sessao do vault bloqueada. Um novo unlock por passkey sera exigido.",
      );
    } catch (error: unknown) {
      setVaultPasskeyActionStatus("error");
      setVaultPasskeyMessage(
        error instanceof Error
          ? error.message
          : "Falha ao bloquear a sessao local do vault.",
      );
    }
  }

  async function handleDisableVaultPasskey() {
    setVaultPasskeyActionStatus("working");
    setVaultPasskeyMessage(null);

    try {
      const nextVaultPasskeyState = await disableManualImportVaultPasskey();
      const { bundle, source } = await loadLatestProjectedStudentSnapshot();

      setVaultPasskeyState(nextVaultPasskeyState);
      setOverviewState({
        status: "ready",
        bundle,
        bundleSource: source,
        summary: bundle ? summarizeStudentProgress(bundle) : null,
        errorMessage: null,
      });
      setVaultPasskeyActionStatus("success");
      setVaultPasskeyMessage(
        "Passkey desativada. O vault volta a depender apenas da chave local do navegador.",
      );
    } catch (error: unknown) {
      setVaultPasskeyActionStatus("error");
      setVaultPasskeyMessage(
        error instanceof Error
          ? error.message
          : "Falha ao desativar a passkey do vault.",
      );
    }
  }

  return (
    <div className="page-grid">
      <section className="hero-card accent-panel overview-hero">
        <div className="hero-split">
          <div className="hero-copy-block">
            <p className="section-label">
              {overviewState.summary ? "Progresso local" : "Primeiro marco"}
            </p>
            <h2>
              {overviewState.summary
                ? "Integralizacao local com leitura de progresso mais clara"
                : "Shell estatica, contratos explicitos e parser UFBA 2025"}
            </h2>
            <p>
              {overviewState.summary
                ? "Agora a visao separa melhor o que ja foi concluido, o que segue ativo e o que pede revisao manual antes de virar progresso confiavel no vault local."
                : "A v0 existe para reduzir risco tecnico cedo: PWA de leitura local, contratos explicitos, fixtures publicas e o parser de horarios preparado para codigos como 35N12, isto e, terca e quinta de 18:30 a 20:20."}
            </p>

            <div className="hero-cta-row">
              <Link to="/importacao" className="action-button">
                Importar agora
              </Link>
              <Link
                to="/planejador"
                className="action-button action-button-secondary"
              >
                Ver planejador
              </Link>
            </div>
          </div>

          <aside className="hero-callout">
            <p className="micro-label">Estado atual</p>
            <h3>{overviewResolutionLabel}</h3>
            <div className="shell-chip-row">
              <span className="vault-fact">
                Origem: {overviewState.summary ? overviewSourceLabel : "nenhuma"}
              </span>
              <span className="vault-fact">
                {overviewState.summary
                  ? `${overviewState.summary.reviewCount} itens em revisão`
                  : "Sem snapshot salvo"}
              </span>
            </div>
            {overviewState.summary ? (
              <p className="micro-copy">
                Ultima derivacao:{" "}
                {formatLocalDateTime(overviewState.summary.derivedAt)}
              </p>
            ) : (
              <p className="micro-copy">
                A tela aguarda um snapshot local para mostrar integralizacao,
                pendencias e trilhas de curso.
              </p>
            )}
          </aside>
        </div>

        <div className="metric-strip">
          {overviewState.summary ? (
            <>
              <Metric
                label="Integralizacao concluida"
                value={`${overviewState.summary.completedComponentPercent}%`}
              />
              <Metric
                label="Cobertura ativa"
                value={`${overviewState.summary.activeComponentPercent}%`}
              />
              <Metric
                label="Restantes"
                value={String(overviewState.summary.remainingComponentCount)}
              />
              <Metric
                label="Revisao manual"
                value={String(overviewState.summary.reviewCount)}
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
      </section>

      <OverviewSnapshotPanel
        overviewState={overviewState}
        vaultPasskeyState={vaultPasskeyState}
        vaultPasskeyActionStatus={vaultPasskeyActionStatus}
        vaultPasskeyMessage={vaultPasskeyMessage}
        onUnlockVaultPasskey={() => void handleUnlockVaultPasskey()}
        onLockVaultSession={() => void handleLockVaultSession()}
        onDisableVaultPasskey={() => void handleDisableVaultPasskey()}
      />

      {overviewState.summary ? (
        <>
          <section className="panel">
            <p className="section-label">Trilha de integralizacao</p>
            <div className="card-grid">
              {overviewState.summary.curriculumLanes.map((lane) => (
                <article key={lane.id} className="soft-card">
                  <div className="card-topline">
                    <p className="micro-label">{lane.title}</p>
                    <span
                      className={`status-pill ${formatLaneStatusClassName(lane.status)}`}
                    >
                      {formatLaneStatus(lane.status)}
                    </span>
                  </div>
                  <h3>
                    {lane.count} componente{lane.count === 1 ? "" : "s"}
                  </h3>
                  <p>{lane.description}</p>
                  <div aria-hidden="true" className="progress-meter">
                    <span
                      className={`progress-meter-fill progress-meter-fill-${lane.status}`}
                      style={{ width: `${lane.percent}%` }}
                    />
                  </div>
                  <div className="fact-row">
                    <span className="vault-fact">
                      {lane.percent}% da trilha
                    </span>
                    <span className="vault-fact">
                      {lane.componentCodes.length > 0
                        ? lane.componentCodes.join(", ")
                        : "Nenhum componente"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>

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
                      Estado: {formatAcademicStatus(component.academicStatus)}
                    </span>
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
                    ID da grade:{" "}
                    {
                      overviewState.summary.studentSnapshot.curriculum
                        .curriculumId
                    }
                  </li>
                  <li>
                    Curso local:{" "}
                    {
                      overviewState.summary.studentSnapshot.curriculum.course
                        .name
                    }
                  </li>
                  <li>
                    Regras seed:{" "}
                    {
                      overviewState.summary.studentSnapshot.curriculum
                        .prerequisiteRules.length
                    }
                  </li>
                  <li>
                    Confianca da grade:{" "}
                    {curriculumResolution
                      ? formatCurriculumConfidence(
                          curriculumResolution.confidence,
                        )
                      : "nao avaliada"}
                  </li>
                  <li>
                    Selecao da grade:{" "}
                    {curriculumResolution
                      ? formatCurriculumSelectionMode(
                          curriculumResolution.selectionMode,
                        )
                      : "nao avaliada"}
                  </li>
                  <li>
                    Catalogo coberto:{" "}
                    {overviewState.summary.matchedCatalogCount}/
                    {overviewState.summary.componentCount}
                  </li>
                  <li>
                    Integralizacao concluida:{" "}
                    {overviewState.summary.completedCount}/
                    {overviewState.summary.componentCount}
                  </li>
                  <li>
                    Cobertura ativa:{" "}
                    {overviewState.summary.completedCount +
                      overviewState.summary.inProgressCount}
                    /{overviewState.summary.componentCount}
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
                  <li>
                    Retencao local:{" "}
                    {formatRetentionMode(
                      overviewState.bundle?.manualImport.retentionMode ??
                        "full-raw-text",
                    )}
                  </li>
                </ul>
              </div>

              <div className="soft-card">
                <h3>Selecao da grade seed</h3>
                {curriculumResolution?.selectedMatch ? (
                  <>
                    <p>{curriculumResolution.reason}</p>
                    <div className="fact-row">
                      <span
                        className={`status-pill ${formatCurriculumConfidenceClassName(
                          curriculumResolution.confidence,
                        )}`}
                      >
                        {formatCurriculumSelectionMode(
                          curriculumResolution.selectionMode,
                        )}{" "}
                        Confianca{" "}
                        {formatCurriculumConfidence(
                          curriculumResolution.confidence,
                        )}
                      </span>
                      <span className="vault-fact">
                        {curriculumResolution.selectedMatch.matchedCount} match
                      </span>
                    </div>
                    <ul className="list subsection">
                      <li>
                        <strong>
                          {curriculumResolution.selectedMatch.curriculum.name}
                        </strong>{" "}
                        ·{" "}
                        {Math.round(
                          curriculumResolution.selectedMatch
                            .detectedCoverageRatio * 100,
                        )}
                        % dos codigos detectados
                      </li>
                      {curriculumResolution.alternativeMatches.map((match) => (
                        <li key={match.curriculum.id}>
                          {match.curriculum.name} · {match.matchedCount} match
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>
                    Nenhuma grade seed publica conseguiu cobrir os componentes
                    detectados neste snapshot.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="panel accent-panel">
            <p className="section-label">Proximo foco</p>
            <div className="card-grid">
              {overviewState.summary.focusItems.length > 0 ? (
                overviewState.summary.focusItems.map((item) => (
                  <article key={item.code} className="soft-card">
                    <div className="card-topline">
                      <p className="micro-label">{item.code}</p>
                      <span
                        className={`status-pill ${formatFocusPriorityClassName(item.priority)}`}
                      >
                        {formatFocusPriority(item.priority)}
                      </span>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.reason}</p>
                  </article>
                ))
              ) : (
                <article className="soft-card">
                  <h3>Sem focos imediatos</h3>
                  <p>
                    O snapshot atual nao deixou componentes abertos para revisao
                    ou retomada.
                  </p>
                </article>
              )}
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
  vaultPasskeyState,
  vaultPasskeyActionStatus,
  vaultPasskeyMessage,
  onUnlockVaultPasskey,
  onLockVaultSession,
  onDisableVaultPasskey,
}: {
  overviewState: OverviewState;
  vaultPasskeyState: ManualImportVaultPasskeyState | null;
  vaultPasskeyActionStatus: VaultPasskeyActionStatus;
  vaultPasskeyMessage: string | null;
  onUnlockVaultPasskey: () => void;
  onLockVaultSession: () => void;
  onDisableVaultPasskey: () => void;
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

  if (vaultPasskeyState?.sessionStatus === "locked") {
    return (
      <section className="panel accent-panel">
        <p className="section-label">Vault local bloqueado</p>
        <h3>Desbloqueie o snapshot salvo com a passkey local</h3>
        <p>
          O bundle local ja existe neste navegador, mas a sessao atual exige
          verificacao local antes de ler componentes, horarios e pendencias.
        </p>
        <VaultPasskeyPanel
          passkeyState={vaultPasskeyState}
          actionStatus={vaultPasskeyActionStatus}
          message={vaultPasskeyMessage}
          onEnable={() => {}}
          onUnlock={onUnlockVaultPasskey}
          onLock={onLockVaultSession}
          onDisable={onDisableVaultPasskey}
        />
        <p>
          Se preferir ajustar isso na tela de importacao, abra a{" "}
          <Link className="inline-link" to="/importacao">
            area de importacao
          </Link>
          .
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

function formatAcademicStatus(status: ComponentAcademicStatus): string {
  if (status === "completed") {
    return "concluido";
  }

  if (status === "inProgress") {
    return "em andamento";
  }

  return "nao classificado";
}

function formatLaneStatus(status: CurriculumLaneStatus): string {
  if (status === "completed") {
    return "Fechado";
  }

  if (status === "inProgress") {
    return "Ativo";
  }

  return "Aberto";
}

function formatLaneStatusClassName(status: CurriculumLaneStatus): string {
  if (status === "completed") {
    return "status-pill-ready";
  }

  if (status === "inProgress") {
    return "status-pill-partial";
  }

  return "status-pill-review";
}

function formatFocusPriority(priority: CurriculumFocusPriority): string {
  if (priority === "high") {
    return "Alta";
  }

  if (priority === "medium") {
    return "Media";
  }

  return "Baixa";
}

function formatFocusPriorityClassName(
  priority: CurriculumFocusPriority,
): string {
  if (priority === "high") {
    return "status-pill-review";
  }

  if (priority === "medium") {
    return "status-pill-partial";
  }

  return "status-pill-ready";
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

function formatCurriculumConfidence(
  confidence: CurriculumSeedResolutionConfidence,
): string {
  if (confidence === "high") {
    return "forte";
  }

  if (confidence === "medium") {
    return "media";
  }

  return "fraca";
}

function formatCurriculumConfidenceClassName(
  confidence: CurriculumSeedResolutionConfidence,
): string {
  if (confidence === "high") {
    return "status-pill-ready";
  }

  if (confidence === "medium") {
    return "status-pill-partial";
  }

  return "status-pill-review";
}

function formatCurriculumSelectionMode(
  selectionMode: CurriculumSeedSelectionMode,
): string {
  if (selectionMode === "manual-override") {
    return "manual";
  }

  return "automatica";
}

function formatRetentionMode(
  retentionMode: "full-raw-text" | "structured-minimized",
): string {
  return retentionMode === "structured-minimized"
    ? "resumo estruturado minimizado"
    : "texto bruto completo";
}
