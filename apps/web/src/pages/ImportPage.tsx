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
import { Metric } from "../components/Metric";
import { loadLatestProjectedStudentSnapshot } from "../localStudentSnapshot";
import { createManualImportPreview } from "../manualImport";
import { buildManualImportStoredSnapshot } from "../manualSnapshot";
import {
  clearLatestManualImportSnapshot,
  loadManualImportVaultState,
  type ManualImportVaultState,
  saveLatestLocalStudentSnapshotBundle,
} from "../manualSnapshotStore";
import { findCatalogMatches } from "../publicCatalog";
import { formatMeeting } from "../schedulePresentation";
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
  const [localSnapshotStatus, setLocalSnapshotStatus] =
    useState<LocalSnapshotStatus>("checking");
  const [localSnapshotMessage, setLocalSnapshotMessage] = useState<
    string | null
  >(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [loadedSnapshot, nextVaultState] = await Promise.all([
        loadLatestProjectedStudentSnapshot(),
        loadManualImportVaultState(),
      ]);

      if (cancelled) {
        return;
      }

      setLatestSnapshot(loadedSnapshot.bundle?.manualImport ?? null);
      setLatestBundle(loadedSnapshot.bundle);
      setVaultState(nextVaultState);
      setLocalSnapshotStatus("idle");
    })().catch((error: unknown) => {
      if (cancelled) {
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
      matchedCatalogComponentCodes: matchedComponentCodes,
    });
  }, [
    deferredRawInput,
    matchedComponentCodes,
    parserState.normalizedSchedules,
    parserState.status,
    preview,
    rawInput,
    requiresParser,
  ]);
  const currentBundle = useMemo(
    () =>
      currentManualSnapshot
        ? buildLocalStudentSnapshotBundle({
            manualImport: currentManualSnapshot,
            matchedCatalogComponents: matchedComponents,
          })
        : null,
    [currentManualSnapshot, matchedComponents],
  );
  const displayedBundle = currentBundle ?? latestBundle;
  const canSaveSnapshot =
    rawInput === deferredRawInput &&
    rawInput.trim().length > 0 &&
    (preview.detectedComponentCodes.length > 0 ||
      preview.detectedScheduleCodes.length > 0) &&
    (!requiresParser || parserState.status === "ready") &&
    currentBundle !== null;

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
        error instanceof Error
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
      setLocalSnapshotStatus("cleared");
      setLocalSnapshotMessage("Snapshot salvo removido do navegador.");
    } catch (error: unknown) {
      setLocalSnapshotStatus("error");
      setLocalSnapshotMessage(
        error instanceof Error
          ? error.message
          : "Falha ao limpar o snapshot salvo do navegador.",
      );
    }
  }

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

          <LocalSnapshotBanner
            status={localSnapshotStatus}
            latestSnapshot={latestSnapshot}
            latestBundle={latestBundle}
            message={localSnapshotMessage}
            vaultState={vaultState}
          />

          {!canSaveSnapshot ? (
            <p className="storage-hint">
              {rawInput !== deferredRawInput
                ? "Aguarde a analise local terminar antes de salvar."
                : preview.detectedComponentCodes.length === 0 &&
                    preview.detectedScheduleCodes.length === 0
                  ? "Cole um trecho com componentes ou codigos de horario para gerar um snapshot util."
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
            </div>

            <div className="card-grid subsection">
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
}: {
  status: LocalSnapshotStatus;
  latestSnapshot: ManualImportStoredSnapshot | null;
  latestBundle: LocalStudentSnapshotBundle | null;
  message: string | null;
  vaultState: ManualImportVaultState | null;
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
          Ainda nao existe snapshot salvo neste navegador.
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
