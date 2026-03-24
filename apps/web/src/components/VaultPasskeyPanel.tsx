import type { ManualImportVaultPasskeyState } from "../manualSnapshotStore";

type VaultPasskeyActionStatus = "idle" | "working" | "error" | "success";

interface VaultPasskeyPanelProps {
  passkeyState: ManualImportVaultPasskeyState | null;
  actionStatus: VaultPasskeyActionStatus;
  message: string | null;
  onEnable: () => void;
  onUnlock: () => void;
  onLock: () => void;
  onDisable: () => void;
}

export function VaultPasskeyPanel({
  passkeyState,
  actionStatus,
  message,
  onEnable,
  onUnlock,
  onLock,
  onDisable,
}: VaultPasskeyPanelProps) {
  if (!passkeyState) {
    return (
      <div className="soft-card">
        <h3>Passkey local do vault</h3>
        <p>
          Verificando se este navegador suporta desbloqueio local por passkey.
        </p>
      </div>
    );
  }

  const isWorking = actionStatus === "working";

  return (
    <div className="soft-card vault-passkey-panel">
      <div className="card-topline">
        <p className="micro-label">Passkey local do vault</p>
        <span
          className={`status-pill ${formatPasskeyStatusClassName(passkeyState.sessionStatus)}`}
        >
          {formatPasskeyStatus(passkeyState.sessionStatus)}
        </span>
      </div>

      <h3>
        {passkeyState.configured
          ? (passkeyState.displayName ?? "Passkey configurada")
          : "Desbloqueio local opcional"}
      </h3>

      <p>
        {passkeyState.sessionStatus === "unsupported"
          ? (passkeyState.supportReason ??
            "Este navegador nao suporta passkeys para o vault local.")
          : passkeyState.sessionStatus === "not-configured"
            ? "Ative uma passkey para exigir verificacao local antes de ler, salvar ou limpar o vault cifrado."
            : passkeyState.sessionStatus === "locked"
              ? "O vault local esta bloqueado nesta sessao. Desbloqueie com a passkey para voltar a ler e alterar snapshots."
              : "O vault local foi desbloqueado nesta sessao por passkey."}
      </p>

      <p className="muted-note">
        No modo atual, a passkey endurece o desbloqueio local da sessao e a
        leitura/escrita do vault, enquanto o conteudo fica protegido por um DEK
        local envolvido por um segredo de wrap persistido no navegador. Quando
        WebAuthn PRF estiver disponivel, a interface destaca esse modo; quando
        nao estiver, o estado continua honesto como wrap browser-local.
      </p>

      <div className="fact-row">
        {passkeyState.keyMaterialMode ? (
          <span className="vault-fact">
            Modo: {formatKeyMaterialMode(passkeyState.keyMaterialMode)}
          </span>
        ) : null}
        {passkeyState.rpId ? (
          <span className="vault-fact">RP ID: {passkeyState.rpId}</span>
        ) : null}
        {passkeyState.createdAt ? (
          <span className="vault-fact">
            Criada em: {formatLocalDateTime(passkeyState.createdAt)}
          </span>
        ) : null}
        {passkeyState.lastVerifiedAt ? (
          <span className="vault-fact">
            Ultimo unlock: {formatLocalDateTime(passkeyState.lastVerifiedAt)}
          </span>
        ) : null}
      </div>

      <div className="action-row subsection">
        {!passkeyState.configured ? (
          <button
            type="button"
            className="action-button action-button-secondary"
            onClick={onEnable}
            disabled={!passkeyState.supported || isWorking}
          >
            Ativar passkey
          </button>
        ) : passkeyState.sessionStatus === "locked" ? (
          <button
            type="button"
            className="action-button action-button-secondary"
            onClick={onUnlock}
            disabled={isWorking}
          >
            Desbloquear vault
          </button>
        ) : (
          <button
            type="button"
            className="action-button action-button-secondary"
            onClick={onLock}
            disabled={isWorking}
          >
            Bloquear sessao
          </button>
        )}

        {passkeyState.configured &&
        passkeyState.sessionStatus === "unlocked" ? (
          <button
            type="button"
            className="action-button action-button-danger"
            onClick={onDisable}
            disabled={isWorking}
          >
            Desativar passkey
          </button>
        ) : null}
      </div>

      {message ? (
        <p
          className={`status-banner ${
            actionStatus === "error"
              ? "status-banner-error"
              : "status-banner-success"
          }`}
          role="status"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

function formatPasskeyStatus(
  status: ManualImportVaultPasskeyState["sessionStatus"],
): string {
  switch (status) {
    case "unsupported":
      return "Sem suporte";
    case "not-configured":
      return "Desligada";
    case "locked":
      return "Bloqueada";
    case "unlocked":
      return "Desbloqueada";
    default:
      return status;
  }
}

function formatPasskeyStatusClassName(
  status: ManualImportVaultPasskeyState["sessionStatus"],
): string {
  switch (status) {
    case "unlocked":
      return "status-pill-ready";
    case "locked":
      return "status-pill-warning";
    case "unsupported":
      return "status-pill-error";
    case "not-configured":
      return "status-pill-idle";
    default:
      return "status-pill-idle";
  }
}

function formatLocalDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatKeyMaterialMode(
  value: NonNullable<ManualImportVaultPasskeyState["keyMaterialMode"]>,
): string {
  switch (value) {
    case "webauthn-prf":
      return "WebAuthn PRF";
    case "browser-local-wrap":
      return "Wrap browser-local";
    case "device-local":
      return "Device-local legado";
    default:
      return value;
  }
}
