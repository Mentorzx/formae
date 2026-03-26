import type { LocalStudentSnapshotBundle } from "@formae/protocol";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Metric } from "../components/Metric";
import { VaultPasskeyPanel } from "../components/VaultPasskeyPanel";
import {
  type LocalStudentSnapshotSource,
  loadLatestProjectedStudentSnapshot,
} from "../localStudentSnapshot";
import {
  disableManualImportVaultPasskey,
  enableManualImportVaultPasskey,
  isVaultLockedError,
  loadManualImportVaultPasskeyState,
  lockManualImportVaultSession,
  type ManualImportVaultPasskeyState,
  unlockManualImportVaultPasskey,
} from "../manualSnapshotStore";
import { CHROME_WEB_STORE_URL } from "../runtimeLinks";
import {
  type ExtensionBridgeStatus,
  readExtensionBridgeStatus,
} from "../sigaaBridge";
import {
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
  const [extensionBridgeStatus, setExtensionBridgeStatus] =
    useState<ExtensionBridgeStatus>({
      installed: false,
      extensionId: null,
      sessionState: "unknown",
      credentialState: null,
    });

  const hydrateOverview = useCallback(async () => {
    try {
      const [nextVaultPasskeyState, nextBridgeStatus] = await Promise.all([
        loadManualImportVaultPasskeyState(),
        readExtensionBridgeStatus().catch(() => ({
          installed: false,
          extensionId: null,
          sessionState: "unknown" as const,
          credentialState: null,
        })),
      ]);

      setVaultPasskeyState(nextVaultPasskeyState);
      setExtensionBridgeStatus(nextBridgeStatus);

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
      setOverviewState({
        status: "ready",
        bundle,
        bundleSource: source,
        summary: bundle ? summarizeStudentProgress(bundle) : null,
        errorMessage: null,
      });
    } catch (error: unknown) {
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
            : "Falha ao abrir o panorama local do navegador.",
      });
    }
  }, []);

  useEffect(() => {
    void hydrateOverview();
  }, [hydrateOverview]);

  async function handleEnableVaultPasskey() {
    setVaultPasskeyActionStatus("working");
    setVaultPasskeyMessage(null);

    try {
      const nextState = await enableManualImportVaultPasskey();
      setVaultPasskeyState(nextState);
      setVaultPasskeyActionStatus("success");
      setVaultPasskeyMessage(
        "Passkey ativada. O cofre local passa a exigir desbloqueio nesta máquina.",
      );
    } catch (error: unknown) {
      setVaultPasskeyActionStatus("error");
      setVaultPasskeyMessage(
        error instanceof Error ? error.message : "Falha ao ativar a passkey.",
      );
    }
  }

  async function handleUnlockVaultPasskey() {
    setVaultPasskeyActionStatus("working");
    setVaultPasskeyMessage(null);

    try {
      const nextState = await unlockManualImportVaultPasskey();
      setVaultPasskeyState(nextState);
      await hydrateOverview();
      setVaultPasskeyActionStatus("success");
      setVaultPasskeyMessage("Cofre local desbloqueado nesta sessão.");
    } catch (error: unknown) {
      setVaultPasskeyActionStatus("error");
      setVaultPasskeyMessage(
        error instanceof Error
          ? error.message
          : "Falha ao desbloquear o cofre.",
      );
    }
  }

  async function handleLockVaultSession() {
    setVaultPasskeyActionStatus("working");
    setVaultPasskeyMessage(null);

    try {
      const nextState = await lockManualImportVaultSession();
      setVaultPasskeyState(nextState);
      await hydrateOverview();
      setVaultPasskeyActionStatus("success");
      setVaultPasskeyMessage("Sessão local bloqueada novamente.");
    } catch (error: unknown) {
      setVaultPasskeyActionStatus("error");
      setVaultPasskeyMessage(
        error instanceof Error ? error.message : "Falha ao bloquear a sessão.",
      );
    }
  }

  async function handleDisableVaultPasskey() {
    setVaultPasskeyActionStatus("working");
    setVaultPasskeyMessage(null);

    try {
      const nextState = await disableManualImportVaultPasskey();
      setVaultPasskeyState(nextState);
      setVaultPasskeyActionStatus("success");
      setVaultPasskeyMessage(
        "Passkey desativada. O cofre volta ao fallback local do navegador.",
      );
    } catch (error: unknown) {
      setVaultPasskeyActionStatus("error");
      setVaultPasskeyMessage(
        error instanceof Error
          ? error.message
          : "Falha ao desativar a passkey.",
      );
    }
  }

  const heroState = resolveHeroState(
    extensionBridgeStatus,
    overviewState.summary,
  );
  const courseName =
    overviewState.summary?.studentSnapshot.curriculum.course.name ?? "UFBA";

  return (
    <div className="page-grid">
      <section className="hero-card accent-panel">
        <p className="section-label">Formaê</p>
        <h1>{heroState.title}</h1>
        <p>{heroState.body}</p>

        <div className="action-row">
          {heroState.primaryHref ? (
            <a
              className="action-button"
              href={heroState.primaryHref}
              target={heroState.primaryExternal ? "_blank" : undefined}
              rel={heroState.primaryExternal ? "noreferrer" : undefined}
            >
              {heroState.primaryLabel}
            </a>
          ) : (
            <Link
              className="action-button"
              to={heroState.primaryTo ?? "/importacao"}
            >
              {heroState.primaryLabel}
            </Link>
          )}
          <Link
            className="action-button action-button-secondary"
            to="/planejador"
          >
            Abrir planejador
          </Link>
        </div>

        <div className="metric-strip">
          <Metric
            label="Extensão"
            value={
              extensionBridgeStatus.installed ? "Detectada" : "Não instalada"
            }
          />
          <Metric
            label="Sessão SIGAA"
            value={
              extensionBridgeStatus.sessionState === "ready"
                ? "Pronta"
                : extensionBridgeStatus.installed
                  ? "Abrir popup"
                  : "Pendente"
            }
          />
          <Metric
            label="Snapshot local"
            value={
              overviewState.summary
                ? `${overviewState.summary.componentCount} componentes`
                : "Nenhum salvo"
            }
          />
        </div>
      </section>

      <section className="panel">
        <p className="section-label">Primeiro uso</p>
        <div className="card-grid">
          <article className="soft-card">
            <p className="micro-label">1. Instalar extensão</p>
            <h3>Conecte o navegador ao SIGAA</h3>
            <p>
              A extensão roda no seu navegador, lê o SIGAA localmente e evita
              qualquer backend com dados sensíveis.
            </p>
            <a
              className="inline-link"
              href={CHROME_WEB_STORE_URL}
              target="_blank"
              rel="noreferrer"
            >
              Abrir Chrome Web Store
            </a>
          </article>
          <article className="soft-card">
            <p className="micro-label">2. Abrir a popup</p>
            <h3>Prepare a sessão efêmera</h3>
            <p>
              Informe CPF ou usuário e senha do SIGAA somente na popup da
              extensão. A sessão curta precisa estar ativa antes do sync.
            </p>
          </article>
          <article className="soft-card">
            <p className="micro-label">3. Sincronizar</p>
            <h3>Importe histórico, turmas e notas</h3>
            <p>
              A sincronização salva um snapshot reduzido no navegador e libera a
              visão geral, o planejador e as pendências locais.
            </p>
            <Link className="inline-link" to="/importacao">
              Ir para importação
            </Link>
          </article>
        </div>
      </section>

      <section className="panel">
        <p className="section-label">Estado atual</p>
        <div className="card-grid">
          <article className="soft-card">
            <p className="micro-label">Produto</p>
            <h3>{courseName}</h3>
            <p>
              {overviewState.summary
                ? `Última leitura local em ${formatLocalDateTime(overviewState.summary.derivedAt)}.`
                : "Nenhum snapshot acadêmico salvo neste navegador ainda."}
            </p>
            <div className="fact-row">
              <span className="vault-fact">
                Origem: {formatBundleSource(overviewState.bundleSource)}
              </span>
            </div>
          </article>
          <article className="soft-card">
            <p className="micro-label">Extensão</p>
            <h3>
              {extensionBridgeStatus.installed
                ? extensionBridgeStatus.sessionState === "ready"
                  ? "Pronta para sincronizar"
                  : "Instalada, mas sem sessão curta ativa"
                : "Instalação pendente"}
            </h3>
            <p>
              {extensionBridgeStatus.installed
                ? "Se a sessão curta expirar, basta abrir a popup e salvar novamente as credenciais efêmeras."
                : "Instale a extensão pela loja para liberar o fluxo automático do SIGAA."}
            </p>
          </article>
          <article className="soft-card">
            <p className="micro-label">Cofre local</p>
            <h3>
              {vaultPasskeyState?.sessionStatus === "locked"
                ? "Bloqueado"
                : vaultPasskeyState?.keyMaterialMode === "webauthn-prf"
                  ? "PRF ativo"
                  : "Pronto no navegador"}
            </h3>
            <p>
              O snapshot fica no navegador. Quando houver suporte, a passkey usa
              material PRF; nos demais casos o fallback continua disponível.
            </p>
          </article>
        </div>
      </section>

      {overviewState.status === "error" ? (
        <section className="panel">
          <p className="section-label">Falha ao carregar</p>
          <p>{overviewState.errorMessage}</p>
        </section>
      ) : null}

      {overviewState.summary ? (
        <>
          <section className="panel">
            <p className="section-label">Resumo do curso</p>
            <div className="metric-strip">
              <Metric
                label="Concluído"
                value={`${overviewState.summary.completedComponentPercent}%`}
              />
              <Metric
                label="Em trilha"
                value={`${overviewState.summary.activeComponentPercent}%`}
              />
              <Metric
                label="Pendências"
                value={String(overviewState.summary.pendingRequirementCount)}
              />
              <Metric
                label="Revisão"
                value={String(overviewState.summary.reviewCount)}
              />
            </div>
          </section>

          <section className="panel">
            <p className="section-label">Próximos focos</p>
            <div className="card-grid">
              {overviewState.summary.focusItems.slice(0, 6).map((item) => (
                <article key={item.code} className="soft-card">
                  <div className="card-topline">
                    <p className="micro-label">{item.code}</p>
                    <span
                      className={`status-pill ${priorityClassName(item.priority)}`}
                    >
                      {formatPriority(item.priority)}
                    </span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.reason}</p>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <section className="panel">
        <p className="section-label">Proteção local</p>
        <VaultPasskeyPanel
          passkeyState={vaultPasskeyState}
          actionStatus={vaultPasskeyActionStatus}
          message={vaultPasskeyMessage}
          onEnable={() => void handleEnableVaultPasskey()}
          onUnlock={() => void handleUnlockVaultPasskey()}
          onLock={() => void handleLockVaultSession()}
          onDisable={() => void handleDisableVaultPasskey()}
        />
      </section>
    </div>
  );
}

function resolveHeroState(
  extensionBridgeStatus: ExtensionBridgeStatus,
  summary: StudentProgressSummary | null,
) {
  if (!extensionBridgeStatus.installed) {
    return {
      title: "Instale a extensão e conecte o SIGAA sem backend",
      body: "Abra a loja, instale a extensão do Formaê e volte para preparar a sessão efêmera do SIGAA. A sincronização roda no seu navegador e salva apenas um snapshot reduzido no cofre local.",
      primaryLabel: "Instalar extensão",
      primaryHref: CHROME_WEB_STORE_URL,
      primaryExternal: true,
    };
  }

  if (extensionBridgeStatus.sessionState !== "ready") {
    return {
      title: "A extensão já está aqui. Falta abrir a popup e liberar o sync",
      body: "A jornada agora é curta: abra a popup da extensão, informe CPF ou usuário e senha do SIGAA para esta sessão e volte para sincronizar. Quando a aprovação curta estiver ativa, o botão de importação já funciona.",
      primaryLabel: "Ir para importação",
      primaryTo: "/importacao",
      primaryExternal: false,
    };
  }

  if (!summary) {
    return {
      title: "Sessão pronta. Falta o primeiro snapshot local",
      body: "A extensão já está pronta para ler turmas, notas e histórico. Rode a sincronização uma vez para preencher a visão geral e destravar o planejador com os seus dados.",
      primaryLabel: "Sincronizar agora",
      primaryTo: "/importacao",
      primaryExternal: false,
    };
  }

  return {
    title: "Seu panorama acadêmico já está no navegador",
    body: "A partir daqui o Formaê deixa de ser só uma importação e vira leitura rápida do que você já concluiu, do que merece atenção agora e do que pode entrar no próximo planejamento.",
    primaryLabel: "Atualizar sincronização",
    primaryTo: "/importacao",
    primaryExternal: false,
  };
}

function priorityClassName(priority: "high" | "medium" | "low") {
  switch (priority) {
    case "high":
      return "status-pill-warning";
    case "medium":
      return "status-pill-ready";
    default:
      return "status-pill-idle";
  }
}

function formatPriority(priority: "high" | "medium" | "low") {
  switch (priority) {
    case "high":
      return "Agora";
    case "medium":
      return "Em seguida";
    default:
      return "Depois";
  }
}

function formatBundleSource(source: LocalStudentSnapshotSource): string {
  switch (source) {
    case "bundle":
      return "Bundle salvo";
    case "manual-snapshot-fallback":
      return "Reconstruído localmente";
    default:
      return "Nenhum";
  }
}

function formatLocalDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
