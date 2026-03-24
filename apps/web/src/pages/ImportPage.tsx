import type {
  LocalStudentSnapshotBundle,
  ManualImportNormalizedSchedule,
  ManualImportStoredSnapshot,
  PendingRequirementStatus,
} from "@formae/protocol";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { buildAutomaticSigaaSyncBundle } from "../automaticSigaaImport";
import { Metric } from "../components/Metric";
import { VaultPasskeyPanel } from "../components/VaultPasskeyPanel";
import { loadLatestProjectedStudentSnapshot } from "../localStudentSnapshot";
import { createManualImportPreview } from "../manualImport";
import { buildManualImportStoredSnapshot } from "../manualSnapshot";
import {
  clearLatestManualImportSnapshot,
  disableManualImportVaultPasskey,
  enableManualImportVaultPasskey,
  isVaultLockedError,
  loadManualImportVaultPasskeyState,
  loadManualImportVaultState,
  lockManualImportVaultSession,
  type ManualImportVaultPasskeyState,
  type ManualImportVaultState,
  saveLatestLocalStudentSnapshotBundle,
  unlockManualImportVaultPasskey,
} from "../manualSnapshotStore";
import {
  type CurriculumSeedResolutionConfidence,
  type CurriculumSeedSelectionMode,
  findCatalogMatches,
  resolveCurriculumSeed,
} from "../publicCatalog";
import { formatMeeting } from "../schedulePresentation";
import { runAutomaticSigaaSync } from "../sigaaBridge";
import { buildLocalStudentSnapshotBundle } from "../studentSnapshot";
import { normalizeScheduleCodesWithWasm } from "../wasmScheduleParser";

type ParserStatus = "idle" | "loading" | "ready" | "error";
type LocalSnapshotStatus =
  | "checking"
  | "idle"
  | "saving"
  | "saved"
  | "restored"
  | "clearing"
  | "cleared"
  | "error";
type AutomaticSyncStatus = "idle" | "syncing" | "ready" | "error";
type VaultPasskeyActionStatus = "idle" | "working" | "success" | "error";

interface ParserState {
  status: ParserStatus;
  normalizedSchedules: ManualImportNormalizedSchedule[];
  errorMessage: string | null;
}

const CAPTURED_AT = "2026-03-23T21:25:00Z";

export function ImportPage() {
  const [rawInput, setRawInput] = useState("");
  const deferredRawInput = useDeferredValue(rawInput);
  const preview = useMemo(
    () =>
      createManualImportPreview({
        source: "plain-text",
        rawInput: deferredRawInput,
        capturedAt: CAPTURED_AT,
        timingProfileId: "Ufba2025",
      }),
    [deferredRawInput],
  );
  const [parserState, setParserState] = useState<ParserState>({
    status: "idle",
    normalizedSchedules: [],
    errorMessage: null,
  });
  const [latestSnapshot, setLatestSnapshot] =
    useState<ManualImportStoredSnapshot | null>(null);
  const [latestBundle, setLatestBundle] =
    useState<LocalStudentSnapshotBundle | null>(null);
  const [vaultState, setVaultState] = useState<ManualImportVaultState | null>(
    null,
  );
  const [vaultPasskeyState, setVaultPasskeyState] =
    useState<ManualImportVaultPasskeyState | null>(null);
  const [preferredCurriculumSeedId, setPreferredCurriculumSeedId] = useState<
    string | null
  >(null);
  const [localSnapshotStatus, setLocalSnapshotStatus] =
    useState<LocalSnapshotStatus>("checking");
  const [localSnapshotMessage, setLocalSnapshotMessage] = useState<
    string | null
  >(null);
  const [sigaaUsername, setSigaaUsername] = useState("");
  const [sigaaPassword, setSigaaPassword] = useState("");
  const [automaticSyncStatus, setAutomaticSyncStatus] =
    useState<AutomaticSyncStatus>("idle");
  const [automaticSyncMessage, setAutomaticSyncMessage] = useState<
    string | null
  >(null);
  const [vaultPasskeyActionStatus, setVaultPasskeyActionStatus] =
    useState<VaultPasskeyActionStatus>("idle");
  const [vaultPasskeyMessage, setVaultPasskeyMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [nextVaultPasskeyState, nextVaultState] = await Promise.all([
        loadManualImportVaultPasskeyState(),
        loadManualImportVaultState(),
      ]);

      if (cancelled) {
        return;
      }

      setVaultPasskeyState(nextVaultPasskeyState);
      setVaultState(nextVaultState);
      setVaultPasskeyMessage(null);

      if (nextVaultPasskeyState.sessionStatus === "locked") {
        setLatestSnapshot(null);
        setLatestBundle(null);
        setPreferredCurriculumSeedId(null);
        setLocalSnapshotStatus("idle");
        setLocalSnapshotMessage(
          "O vault local esta bloqueado por passkey nesta sessao.",
        );
        return;
      }

      const loadedSnapshot = await loadLatestProjectedStudentSnapshot();

      if (cancelled) {
        return;
      }

      setLatestSnapshot(loadedSnapshot.bundle?.manualImport ?? null);
      setLatestBundle(loadedSnapshot.bundle);
      setPreferredCurriculumSeedId(
        loadedSnapshot.bundle?.manualImport.preferredCurriculumSeedId ?? null,
      );
      setLocalSnapshotStatus("idle");
      setLocalSnapshotMessage(null);
    })().catch((error: unknown) => {
      if (cancelled) {
        return;
      }

      if (isVaultLockedError(error)) {
        setLocalSnapshotStatus("idle");
        setLocalSnapshotMessage(error.message);
        return;
      }

      setLocalSnapshotStatus("error");
      setLocalSnapshotMessage(
        error instanceof Error
          ? error.message
          : "Falha ao abrir o snapshot local salvo no navegador.",
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (preview.detectedScheduleCodes.length === 0) {
      setParserState({
        status: "idle",
        normalizedSchedules: [],
        errorMessage: null,
      });
      return () => {
        cancelled = true;
      };
    }

    setParserState((currentState) => ({
      status: "loading",
      normalizedSchedules: currentState.normalizedSchedules,
      errorMessage: null,
    }));

    void normalizeScheduleCodesWithWasm(
      preview.detectedScheduleCodes,
      preview.timingProfileId,
    )
      .then((normalizedSchedules) => {
        if (cancelled) {
          return;
        }

        setParserState({
          status: "ready",
          normalizedSchedules,
          errorMessage: null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setParserState({
          status: "error",
          normalizedSchedules: [],
          errorMessage:
            error instanceof Error
              ? error.message
              : "Falha ao carregar o parser Rust/WASM.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [preview.detectedScheduleCodes, preview.timingProfileId]);

  const matchedComponents = findCatalogMatches(preview.detectedComponentCodes);
  const matchedComponentCodes = matchedComponents.map(
    (component) => component.code,
  );
  const requiresParser = preview.detectedScheduleCodes.length > 0;
  const currentManualSnapshot = useMemo(() => {
    if (
      rawInput !== deferredRawInput ||
      rawInput.trim().length === 0 ||
      (preview.detectedComponentCodes.length === 0 &&
        preview.detectedScheduleCodes.length === 0) ||
      (requiresParser && parserState.status !== "ready")
    ) {
      return null;
    }

    return buildManualImportStoredSnapshot({
      rawInput,
      source: "plain-text",
      timingProfileId: preview.timingProfileId,
      preview,
      normalizedSchedules: parserState.normalizedSchedules,
      preferredCurriculumSeedId,
      matchedCatalogComponentCodes: matchedComponentCodes,
    });
  }, [
    deferredRawInput,
    matchedComponentCodes,
    parserState.normalizedSchedules,
    parserState.status,
    preferredCurriculumSeedId,
    preview,
    rawInput,
    requiresParser,
  ]);
  const currentSnapshotOverride =
    latestBundle &&
    preferredCurriculumSeedId !==
      (latestBundle.manualImport.preferredCurriculumSeedId ?? null)
      ? {
          ...latestBundle.manualImport,
          preferredCurriculumSeedId,
        }
      : null;
  const draftManualSnapshot = currentManualSnapshot ?? currentSnapshotOverride;
  const draftMatchedComponents = useMemo(
    () =>
      draftManualSnapshot
        ? findCatalogMatches(draftManualSnapshot.detectedComponentCodes)
        : [],
    [draftManualSnapshot],
  );
  const currentBundle = useMemo(
    () =>
      draftManualSnapshot
        ? buildLocalStudentSnapshotBundle({
            manualImport: draftManualSnapshot,
            matchedCatalogComponents: draftMatchedComponents,
          })
        : null,
    [draftManualSnapshot, draftMatchedComponents],
  );
  const displayedBundle = currentBundle ?? latestBundle;
  const curriculumResolution = resolveCurriculumSeed(
    draftManualSnapshot?.detectedComponentCodes ??
      displayedBundle?.manualImport.detectedComponentCodes ??
      preview.detectedComponentCodes,
    draftManualSnapshot?.preferredCurriculumSeedId ??
      displayedBundle?.manualImport.preferredCurriculumSeedId ??
      null,
  );
  const hasSnapshotDraftFromText =
    rawInput === deferredRawInput &&
    rawInput.trim().length > 0 &&
    (preview.detectedComponentCodes.length > 0 ||
      preview.detectedScheduleCodes.length > 0) &&
    (!requiresParser || parserState.status === "ready");
  const hasCurriculumPreferenceChange =
    latestBundle !== null &&
    preferredCurriculumSeedId !==
      (latestBundle.manualImport.preferredCurriculumSeedId ?? null);
  const canSaveSnapshot =
    currentBundle !== null &&
    (hasSnapshotDraftFromText || hasCurriculumPreferenceChange) &&
    vaultPasskeyState?.sessionStatus !== "locked";
  const isVaultLocked = vaultPasskeyState?.sessionStatus === "locked";

  async function handleSaveSnapshot() {
    if (!canSaveSnapshot || !currentBundle) {
      return;
    }

    setLocalSnapshotStatus("saving");
    setLocalSnapshotMessage(null);

    try {
      const nextVaultState =
        await saveLatestLocalStudentSnapshotBundle(currentBundle);
      setLatestSnapshot(currentBundle.manualImport);
      setLatestBundle(currentBundle);
      setVaultState(nextVaultState);
      setLocalSnapshotStatus("saved");
      setLocalSnapshotMessage(
        `Snapshot consolidado salvo localmente em ${formatLocalDateTime(
          currentBundle.derivedAt,
        )}.`,
      );
    } catch (error: unknown) {
      setLocalSnapshotStatus("error");
      setLocalSnapshotMessage(
        isVaultLockedError(error)
          ? error.message
          : error instanceof Error
            ? error.message
            : "Falha ao salvar o snapshot localmente no navegador.",
      );
    }
  }

  function handleRestoreSnapshot() {
    if (!latestBundle) {
      return;
    }

    startTransition(() => {
      setRawInput(latestBundle.manualImport.rawInput);
    });

    setParserState({
      status:
        latestBundle.manualImport.detectedScheduleCodes.length > 0
          ? "ready"
          : "idle",
      normalizedSchedules: latestBundle.manualImport.normalizedSchedules,
      errorMessage: null,
    });
    setPreferredCurriculumSeedId(
      latestBundle.manualImport.preferredCurriculumSeedId ?? null,
    );
    setLocalSnapshotStatus("restored");
    setLocalSnapshotMessage(
      `Snapshot restaurado do navegador. Ultimo save: ${formatLocalDateTime(
        latestBundle.derivedAt,
      )}.`,
    );
  }

  async function handleClearSnapshot() {
    setLocalSnapshotStatus("clearing");
    setLocalSnapshotMessage(null);

    try {
      const nextVaultState = await clearLatestManualImportSnapshot();
      setLatestSnapshot(null);
      setLatestBundle(null);
      setVaultState(nextVaultState);
      setPreferredCurriculumSeedId(null);
      setLocalSnapshotStatus("cleared");
      setLocalSnapshotMessage("Snapshot salvo removido do navegador.");
    } catch (error: unknown) {
      setLocalSnapshotStatus("error");
      setLocalSnapshotMessage(
        isVaultLockedError(error)
          ? error.message
          : error instanceof Error
            ? error.message
            : "Falha ao limpar o snapshot salvo do navegador.",
      );
    }
  }

  async function handleAutomaticSync() {
    const usernameOrCpf = sigaaUsername.trim();
    if (!usernameOrCpf || sigaaPassword.trim().length === 0) {
      setAutomaticSyncStatus("error");
      setAutomaticSyncMessage(
        "Informe usuario ou CPF e a senha do SIGAA para esta sessao local.",
      );
      return;
    }

    setAutomaticSyncStatus("syncing");
    setAutomaticSyncMessage(null);
    setLocalSnapshotMessage(null);

    try {
      const rawPayload = await runAutomaticSigaaSync({
        usernameOrCpf,
        password: sigaaPassword,
        timingProfileId: "Ufba2025",
      });
      const { bundle } = await buildAutomaticSigaaSyncBundle({
        rawPayload,
        timingProfileId: "Ufba2025",
      });
      const nextVaultState = await saveLatestLocalStudentSnapshotBundle(bundle);

      startTransition(() => {
        setRawInput(bundle.manualImport.rawInput);
      });

      setParserState({
        status:
          bundle.manualImport.normalizedSchedules.length > 0 ? "ready" : "idle",
        normalizedSchedules: bundle.manualImport.normalizedSchedules,
        errorMessage: null,
      });
      setLatestSnapshot(bundle.manualImport);
      setLatestBundle(bundle);
      setVaultState(nextVaultState);
      setPreferredCurriculumSeedId(
        bundle.manualImport.preferredCurriculumSeedId ?? null,
      );
      setLocalSnapshotStatus("saved");
      setLocalSnapshotMessage(
        `Snapshot automatico salvo localmente em ${formatLocalDateTime(
          bundle.derivedAt,
        )}.`,
      );
      setAutomaticSyncStatus("ready");
      setAutomaticSyncMessage(
        "Minhas Turmas e Minhas Notas foram lidas localmente do SIGAA pela extensao.",
      );
      setSigaaUsername("");
      setSigaaPassword("");
    } catch (error: unknown) {
      setAutomaticSyncStatus("error");
      setAutomaticSyncMessage(
        isVaultLockedError(error)
          ? error.message
          : error instanceof Error
            ? error.message
            : "Falha ao sincronizar localmente com o SIGAA.",
      );
    }
  }

  async function handleEnableVaultPasskey() {
    setVaultPasskeyActionStatus("working");
    setVaultPasskeyMessage(null);

    try {
      const nextPasskeyState = await enableManualImportVaultPasskey();
      setVaultPasskeyState(nextPasskeyState);
      setVaultPasskeyActionStatus("success");
      setVaultPasskeyMessage(
        "Passkey ativada. Esta sessao local do vault ja foi destravada.",
      );
    } catch (error: unknown) {
      setVaultPasskeyActionStatus("error");
      setVaultPasskeyMessage(
        error instanceof Error
          ? error.message
          : "Falha ao ativar a passkey local do vault.",
      );
    }
  }

  async function handleUnlockVaultPasskey() {
    setVaultPasskeyActionStatus("working");
    setVaultPasskeyMessage(null);

    try {
      const nextPasskeyState = await unlockManualImportVaultPasskey();
      const [loadedSnapshot, nextVaultState] = await Promise.all([
        loadLatestProjectedStudentSnapshot(),
        loadManualImportVaultState(),
      ]);

      setVaultPasskeyState(nextPasskeyState);
      setVaultState(nextVaultState);
      setLatestSnapshot(loadedSnapshot.bundle?.manualImport ?? null);
      setLatestBundle(loadedSnapshot.bundle);
      setPreferredCurriculumSeedId(
        loadedSnapshot.bundle?.manualImport.preferredCurriculumSeedId ?? null,
      );
      setLocalSnapshotStatus("idle");
      setLocalSnapshotMessage(null);
      setVaultPasskeyActionStatus("success");
      setVaultPasskeyMessage(
        "Vault local desbloqueado por passkey nesta sessao.",
      );
    } catch (error: unknown) {
      setVaultPasskeyActionStatus("error");
      setVaultPasskeyMessage(
        error instanceof Error
          ? error.message
          : "Falha ao desbloquear o vault com passkey.",
      );
    }
  }

  async function handleLockVaultSession() {
    setVaultPasskeyActionStatus("working");
    setVaultPasskeyMessage(null);

    try {
      const nextPasskeyState = await lockManualImportVaultSession();
      setVaultPasskeyState(nextPasskeyState);
      setLatestSnapshot(null);
      setLatestBundle(null);
      setPreferredCurriculumSeedId(null);
      setLocalSnapshotStatus("idle");
      setLocalSnapshotMessage(
        "O vault local foi bloqueado para esta sessao do navegador.",
      );
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
      const nextPasskeyState = await disableManualImportVaultPasskey();
      const [loadedSnapshot, nextVaultState] = await Promise.all([
        loadLatestProjectedStudentSnapshot(),
        loadManualImportVaultState(),
      ]);

      setVaultPasskeyState(nextPasskeyState);
      setVaultState(nextVaultState);
      setLatestSnapshot(loadedSnapshot.bundle?.manualImport ?? null);
      setLatestBundle(loadedSnapshot.bundle);
      setPreferredCurriculumSeedId(
        loadedSnapshot.bundle?.manualImport.preferredCurriculumSeedId ?? null,
      );
      setLocalSnapshotStatus("idle");
      setLocalSnapshotMessage(null);
      setVaultPasskeyActionStatus("success");
      setVaultPasskeyMessage(
        "Passkey desativada. O vault volta a usar apenas a chave device-local.",
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
      <section className="hero-card">
        <p className="section-label">Importacao manual inicial</p>
        <h2>
          Importe do SIGAA com extensao local ou cole um trecho sem guardar
          senha
        </h2>
        <p>
          O sync automatico roda no dispositivo do usuario com uma extensao
          local, sem backend com PII. Quando a extensao nao estiver carregada, a
          importacao manual continua disponivel.
        </p>
      </section>

      <section className="panel">
        <p className="section-label">Sync automatico local</p>
        <div className="split-grid">
          <div className="soft-card">
            <h3>Conectar com o SIGAA</h3>
            <p>
              As credenciais ficam apenas em memoria na extensao durante a
              sessao atual. Nada disso e salvo no servidor.
            </p>
            <div className="field-grid">
              <label className="input-panel" htmlFor="sigaa-username">
                <span className="micro-label">Usuario ou CPF</span>
                <input
                  id="sigaa-username"
                  className="text-input"
                  type="text"
                  autoComplete="username"
                  value={sigaaUsername}
                  onChange={(event) => setSigaaUsername(event.target.value)}
                  placeholder="CPF ou login do SIGAA"
                />
              </label>

              <label className="input-panel" htmlFor="sigaa-password">
                <span className="micro-label">Senha do SIGAA</span>
                <input
                  id="sigaa-password"
                  className="text-input"
                  type="password"
                  autoComplete="current-password"
                  value={sigaaPassword}
                  onChange={(event) => setSigaaPassword(event.target.value)}
                  placeholder="Usada so nesta sessao local"
                />
              </label>
            </div>

            <div className="action-row subsection">
              <button
                type="button"
                className="action-button"
                onClick={() => void handleAutomaticSync()}
                disabled={
                  automaticSyncStatus === "syncing" ||
                  isLocalSnapshotBusy(localSnapshotStatus) ||
                  isVaultLocked
                }
              >
                {automaticSyncStatus === "syncing"
                  ? "Sincronizando..."
                  : "Importar automaticamente"}
              </button>
            </div>
          </div>

          <div className="soft-card">
            <h3>Contrato desta fase</h3>
            <ul className="list">
              <li>Carregue `apps/extension` como extensao MV3 unpacked.</li>
              <li>
                A extensao autentica localmente e captura `Minhas Turmas` e
                `Minhas Notas`.
              </li>
              <li>
                O app reaproveita o mesmo pipeline local de snapshot e vault.
              </li>
            </ul>
          </div>
        </div>

        <AutomaticSyncBanner
          status={automaticSyncStatus}
          message={automaticSyncMessage}
        />
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
              onChange={(event) => {
                const nextRawInput = event.target.value;
                setRawInput(nextRawInput);

                if (
                  latestBundle &&
                  nextRawInput !== latestBundle.manualImport.rawInput
                ) {
                  setPreferredCurriculumSeedId(null);
                }
              }}
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

        <div className="soft-card subsection">
          <div className="storage-header">
            <div>
              <h3>Snapshot local do navegador</h3>
              <p>
                Salva um bundle local com a importacao manual bruta e o
                StudentSnapshot minimo derivado localmente.
              </p>
            </div>
            <div className="action-row">
              <button
                type="button"
                className="action-button"
                onClick={() => void handleSaveSnapshot()}
                disabled={
                  !canSaveSnapshot || isLocalSnapshotBusy(localSnapshotStatus)
                }
              >
                Salvar snapshot
              </button>
              <button
                type="button"
                className="action-button action-button-secondary"
                onClick={handleRestoreSnapshot}
                disabled={
                  !latestBundle || isLocalSnapshotBusy(localSnapshotStatus)
                }
              >
                Restaurar ultimo
              </button>
              <button
                type="button"
                className="action-button action-button-danger"
                onClick={() => void handleClearSnapshot()}
                disabled={
                  !latestBundle || isLocalSnapshotBusy(localSnapshotStatus)
                }
              >
                Limpar salvo
              </button>
            </div>
          </div>

          <VaultPasskeyPanel
            passkeyState={vaultPasskeyState}
            actionStatus={vaultPasskeyActionStatus}
            message={vaultPasskeyMessage}
            onEnable={() => void handleEnableVaultPasskey()}
            onUnlock={() => void handleUnlockVaultPasskey()}
            onLock={() => void handleLockVaultSession()}
            onDisable={() => void handleDisableVaultPasskey()}
          />

          <LocalSnapshotBanner
            status={localSnapshotStatus}
            latestSnapshot={latestSnapshot}
            latestBundle={latestBundle}
            message={localSnapshotMessage}
            vaultState={vaultState}
            vaultPasskeyState={vaultPasskeyState}
          />

          {!canSaveSnapshot ? (
            <p className="storage-hint">
              {isVaultLocked
                ? "Desbloqueie o vault com a passkey antes de salvar ou limpar o snapshot local."
                : rawInput !== deferredRawInput
                  ? "Aguarde a analise local terminar antes de salvar."
                  : preview.detectedComponentCodes.length === 0 &&
                      preview.detectedScheduleCodes.length === 0
                    ? hasCurriculumPreferenceChange
                      ? "A preferencia manual da grade pode ser salva mesmo sem alterar o texto restaurado."
                      : "Cole um trecho com componentes ou codigos de horario para gerar um snapshot util."
                    : requiresParser && parserState.status !== "ready"
                      ? "O parser precisa concluir a normalizacao dos horarios antes do save."
                      : "Nenhum snapshot pode ser salvo com o estado atual."}
            </p>
          ) : null}
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
          <h3>Warnings do texto bruto</h3>
          <ul className="list">
            {preview.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel">
        <p className="section-label">Normalizacao pelo core Rust/WASM</p>
        <ParserStatusBanner
          status={parserState.status}
          errorMessage={parserState.errorMessage}
        />
        <div className="card-grid">
          {parserState.normalizedSchedules.map((normalizedSchedule) => (
            <article key={normalizedSchedule.inputCode} className="soft-card">
              <p className="micro-label">{normalizedSchedule.inputCode}</p>
              <h3>{normalizedSchedule.result.canonicalCode}</h3>
              <p>
                Parser: {normalizedSchedule.parser} · Meetings:{" "}
                {normalizedSchedule.result.meetings.length}
              </p>
              <ul className="list">
                {normalizedSchedule.result.meetings.map((meeting) => (
                  <li
                    key={`${normalizedSchedule.inputCode}-${meeting.day}-${meeting.turn}-${meeting.slotStart}-${meeting.slotEnd}`}
                  >
                    {formatMeeting(meeting)}
                  </li>
                ))}
              </ul>
              {normalizedSchedule.result.warnings.length > 0 ? (
                <div className="subsection">
                  <p className="micro-label">Warnings do parser</p>
                  <ul className="list">
                    {normalizedSchedule.result.warnings.map((warning) => (
                      <li
                        key={`${normalizedSchedule.inputCode}-${warning.code}-${warning.message}`}
                      >
                        {warning.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="panel accent-panel">
        <p className="section-label">StudentSnapshot minimo</p>
        {displayedBundle ? (
          <>
            <div className="metric-strip">
              <Metric
                label="Curriculo"
                value={displayedBundle.studentSnapshot.curriculum.name}
              />
              <Metric
                label="Componentes"
                value={String(
                  displayedBundle.studentSnapshot.curriculum.components.length,
                )}
              />
              <Metric
                label="Horarios"
                value={String(
                  displayedBundle.studentSnapshot.scheduleBlocks.length,
                )}
              />
              <Metric
                label="Pendencias"
                value={String(
                  displayedBundle.studentSnapshot.pendingRequirements.length,
                )}
              />
              <Metric
                label="Pre-requisitos"
                value={String(
                  displayedBundle.studentSnapshot.curriculum.prerequisiteRules
                    .length,
                )}
              />
            </div>

            <div className="card-grid subsection">
              <article className="soft-card">
                <p className="micro-label">Grade resolvida</p>
                <p>{displayedBundle.studentSnapshot.curriculum.course.name}</p>
                <div className="fact-row">
                  <span className="vault-fact">
                    ID:{" "}
                    {displayedBundle.studentSnapshot.curriculum.curriculumId}
                  </span>
                  <span className="vault-fact">
                    Carga total:{" "}
                    {
                      displayedBundle.studentSnapshot.curriculum.course
                        .totalWorkloadHours
                    }
                    h
                  </span>
                  <span
                    className={`status-pill ${formatCurriculumConfidenceClassName(
                      curriculumResolution.confidence,
                    )}`}
                  >
                    {formatCurriculumSelectionMode(
                      curriculumResolution.selectionMode,
                    )}{" "}
                    Grade{" "}
                    {formatCurriculumConfidence(
                      curriculumResolution.confidence,
                    )}
                  </span>
                </div>
                <p className="subsection">{curriculumResolution.reason}</p>
              </article>

              <article className="soft-card">
                <p className="micro-label">Componentes concluidos</p>
                <ul className="list">
                  {displayedBundle.studentSnapshot.completedComponents.map(
                    (component) => (
                      <li key={component.code}>
                        {component.code} - {component.title}
                      </li>
                    ),
                  )}
                </ul>
                {displayedBundle.studentSnapshot.completedComponents.length ===
                0 ? (
                  <p>
                    Nenhum componente foi classificado como concluido ainda.
                  </p>
                ) : null}
              </article>

              <article className="soft-card">
                <p className="micro-label">Componentes em andamento</p>
                <ul className="list">
                  {displayedBundle.studentSnapshot.inProgressComponents.map(
                    (component) => (
                      <li key={component.code}>
                        {component.code} - {component.title}
                      </li>
                    ),
                  )}
                </ul>
                {displayedBundle.studentSnapshot.inProgressComponents.length ===
                0 ? (
                  <p>Nenhum componente foi classificado como em andamento.</p>
                ) : null}
              </article>

              <article className="soft-card">
                <p className="micro-label">Candidatas de grade</p>
                {curriculumResolution.selectedMatch ? (
                  <>
                    <div className="action-row subsection">
                      <button
                        type="button"
                        className="action-button action-button-secondary"
                        onClick={() => setPreferredCurriculumSeedId(null)}
                      >
                        Usar ranking automatico
                      </button>
                    </div>
                    <ul className="list">
                      <li>
                        <div className="action-row">
                          <button
                            type="button"
                            className="action-button action-button-secondary"
                            onClick={() =>
                              setPreferredCurriculumSeedId(
                                curriculumResolution.selectedMatch?.curriculum
                                  .id ?? null,
                              )
                            }
                          >
                            Fixar esta grade
                          </button>
                          {preferredCurriculumSeedId ===
                          curriculumResolution.selectedMatch.curriculum.id ? (
                            <span className="status-pill status-pill-ready">
                              Manual
                            </span>
                          ) : null}
                        </div>
                        <strong>
                          {curriculumResolution.selectedMatch.curriculum.name}
                        </strong>{" "}
                        · {curriculumResolution.selectedMatch.matchedCount}{" "}
                        match ·{" "}
                        {Math.round(
                          curriculumResolution.selectedMatch
                            .detectedCoverageRatio * 100,
                        )}
                        % dos codigos detectados
                      </li>
                      {curriculumResolution.alternativeMatches.map((match) => (
                        <li key={match.curriculum.id}>
                          <div className="action-row">
                            <button
                              type="button"
                              className="action-button action-button-secondary"
                              onClick={() =>
                                setPreferredCurriculumSeedId(
                                  match.curriculum.id,
                                )
                              }
                            >
                              Fixar esta grade
                            </button>
                            {preferredCurriculumSeedId ===
                            match.curriculum.id ? (
                              <span className="status-pill status-pill-ready">
                                Manual
                              </span>
                            ) : null}
                          </div>
                          {match.curriculum.name} · {match.matchedCount} match ·{" "}
                          {Math.round(match.detectedCoverageRatio * 100)}% dos
                          codigos detectados
                        </li>
                      ))}
                    </ul>
                  </>
                ) : displayedBundle ? (
                  <>
                    <div className="action-row subsection">
                      <button
                        type="button"
                        className="action-button action-button-secondary"
                        onClick={() => setPreferredCurriculumSeedId(null)}
                      >
                        Voltar ao ranking automatico
                      </button>
                    </div>
                    <p>
                      Nenhuma grade seed teve sobreposicao suficiente com os
                      codigos detectados ate agora.
                    </p>
                  </>
                ) : (
                  <p>
                    Nenhuma grade seed teve sobreposicao suficiente com os
                    codigos detectados ate agora.
                  </p>
                )}
              </article>

              <article className="soft-card">
                <p className="micro-label">Pre-requisitos seed</p>
                <ul className="list">
                  {displayedBundle.studentSnapshot.curriculum.prerequisiteRules.map(
                    (rule) => (
                      <li key={`${rule.componentCode}-${rule.expression}`}>
                        <strong>{rule.componentCode}</strong> ·{" "}
                        {rule.expression}
                      </li>
                    ),
                  )}
                </ul>
                {displayedBundle.studentSnapshot.curriculum.prerequisiteRules
                  .length === 0 ? (
                  <p>Nenhuma regra seed foi resolvida para este snapshot.</p>
                ) : null}
              </article>

              <article className="soft-card">
                <p className="micro-label">Blocos de horario</p>
                <ul className="list">
                  {displayedBundle.studentSnapshot.scheduleBlocks.map(
                    (scheduleBlock) => (
                      <li
                        key={`${scheduleBlock.canonicalCode}-${scheduleBlock.rawCode}`}
                      >
                        <strong>{scheduleBlock.canonicalCode}</strong>
                        {scheduleBlock.componentCode
                          ? ` · ${scheduleBlock.componentCode}`
                          : " · sem vinculo confiavel"}
                        {scheduleBlock.meetings.length > 0
                          ? ` · ${scheduleBlock.meetings.map(formatMeeting).join(" | ")}`
                          : ""}
                      </li>
                    ),
                  )}
                </ul>
              </article>

              <article className="soft-card">
                <p className="micro-label">Pendencias locais</p>
                <ul className="list">
                  {displayedBundle.studentSnapshot.pendingRequirements.map(
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
              </article>
            </div>
          </>
        ) : (
          <p>
            O snapshot consolidado aparece aqui quando a importacao manual ja
            tem componentes ou horarios suficientes para projecao local.
          </p>
        )}
      </section>
    </div>
  );
}

function LocalSnapshotBanner({
  status,
  latestSnapshot,
  latestBundle,
  message,
  vaultState,
  vaultPasskeyState,
}: {
  status: LocalSnapshotStatus;
  latestSnapshot: ManualImportStoredSnapshot | null;
  latestBundle: LocalStudentSnapshotBundle | null;
  message: string | null;
  vaultState: ManualImportVaultState | null;
  vaultPasskeyState: ManualImportVaultPasskeyState | null;
}) {
  const facts = vaultState ? <VaultStateFacts vaultState={vaultState} /> : null;

  if (status === "checking") {
    return (
      <>
        <p className="status-banner">
          Verificando se existe um snapshot local...
        </p>
        {facts}
      </>
    );
  }

  if (status === "error") {
    return (
      <>
        <p className="status-banner status-banner-error" role="status">
          {message ?? "Falha ao acessar o snapshot local do navegador."}
        </p>
        {facts}
      </>
    );
  }

  if (message) {
    return (
      <>
        <p
          className={`status-banner ${
            status === "cleared" ? "" : "status-banner-success"
          }`}
          role="status"
        >
          {message}
        </p>
        {facts}
      </>
    );
  }

  if (!latestSnapshot) {
    return (
      <>
        <p className="status-banner" role="status">
          {vaultPasskeyState?.sessionStatus === "locked"
            ? "O vault esta bloqueado por passkey. Desbloqueie a sessao para ler o ultimo snapshot salvo."
            : "Ainda nao existe snapshot salvo neste navegador."}
        </p>
        {facts}
      </>
    );
  }

  return (
    <>
      <div className="storage-summary" role="status">
        <p className="micro-label">Ultimo snapshot salvo</p>
        <p>
          {formatLocalDateTime(latestSnapshot.savedAt)} ·{" "}
          {latestSnapshot.detectedComponentCodes.length} componentes brutos ·{" "}
          {latestBundle?.studentSnapshot.pendingRequirements.length ?? 0}{" "}
          pendencias locais
        </p>
      </div>
      {facts}
    </>
  );
}

function VaultStateFacts({
  vaultState,
}: {
  vaultState: ManualImportVaultState;
}) {
  const facts = [
    `Vault v${vaultState.storageVersion}`,
    vaultState.status === "sealed" ? "Estado: selado" : "Estado: vazio",
    `Chave: ${vaultState.keyId ?? "nenhuma"}`,
    "Derivacao: device-local",
  ];

  if (vaultState.updatedAt) {
    facts.push(`Atualizado: ${formatLocalDateTime(vaultState.updatedAt)}`);
  }

  if (vaultState.lastWipeAt && vaultState.lastWipeReason) {
    facts.push(
      `Ultimo wipe: ${formatLocalDateTime(vaultState.lastWipeAt)} (${formatWipeReason(vaultState.lastWipeReason)})`,
    );
  }

  if (vaultState.migrationSource) {
    facts.push("Migrado do store legivel anterior");
  }

  return (
    <div className="vault-fact-grid">
      {facts.map((fact) => (
        <span key={fact} className="vault-fact">
          {fact}
        </span>
      ))}
    </div>
  );
}

function ParserStatusBanner({
  status,
  errorMessage,
}: {
  status: ParserStatus;
  errorMessage: string | null;
}) {
  if (status === "idle") {
    return (
      <p className="status-banner">
        Cole pelo menos um codigo de horario para ativar o parser compartilhado.
      </p>
    );
  }

  if (status === "loading") {
    return <p className="status-banner">Carregando o parser Rust/WASM...</p>;
  }

  if (status === "error") {
    return (
      <p className="status-banner status-banner-error">
        {errorMessage ?? "Falha ao inicializar o parser Rust/WASM."}
      </p>
    );
  }

  return (
    <p className="status-banner status-banner-success">
      Parser Rust/WASM carregado e normalizando os codigos detectados.
    </p>
  );
}

function AutomaticSyncBanner({
  status,
  message,
}: {
  status: AutomaticSyncStatus;
  message: string | null;
}) {
  if (status === "syncing") {
    return (
      <p className="status-banner">
        A extensao esta autenticando localmente e capturando as views privadas
        do SIGAA.
      </p>
    );
  }

  if (status === "error") {
    return (
      <p className="status-banner status-banner-error">
        {message ??
          "Falha ao falar com a extensao local ou ao importar do SIGAA."}
      </p>
    );
  }

  if (status === "ready") {
    return (
      <p className="status-banner status-banner-success">
        {message ?? "Sync automatico concluido com sucesso."}
      </p>
    );
  }

  return (
    <p className="status-banner">
      O sync automatico depende da extensao local carregada neste navegador.
    </p>
  );
}

function formatLocalDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function isLocalSnapshotBusy(status: LocalSnapshotStatus): boolean {
  return status === "checking" || status === "saving" || status === "clearing";
}

function formatWipeReason(
  reason: ManualImportVaultState["lastWipeReason"],
): string {
  if (reason === "logout") {
    return "logout";
  }

  if (reason === "legacy-migration") {
    return "migracao";
  }

  return "limpeza manual";
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
    return "Manual";
  }

  return "Auto";
}
