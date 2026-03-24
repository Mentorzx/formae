import type { Component } from "@formae/protocol";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { Metric } from "../components/Metric";
import {
  DependencyLegend,
  type PlannerStatusTone,
  ProgressDonut,
  ProgressRing,
  StatusGlyph,
} from "../components/planner";
import { type IraWeightBasis, projectIraFromBaseline } from "../iraSimulator";
import {
  type LocalStudentSnapshotSource,
  loadLatestProjectedStudentSnapshot,
} from "../localStudentSnapshot";
import { isVaultLockedError } from "../manualSnapshotStore";
import { buildPlannerConnectionPaths } from "../plannerConnections";
import {
  buildPlannerRelationHighlights,
  createPlannerBoardFromProgress,
  type PlannerBoard,
  type PlannerBoardTermView,
  type PlannerComponentCard,
  type PlannerRelationHighlights,
  type PlannerTerm,
  projectPlannerBoard,
  validatePlannerMove,
} from "../plannerModel";
import {
  loadPlannerState,
  savePlannerState,
  updatePlannerState,
} from "../plannerStateStore";
import {
  type ComponentAcademicStatus,
  type StudentProgressSummary,
  summarizeStudentProgress,
} from "../studentProgress";

type PlannerStatus = "loading" | "ready" | "empty" | "locked" | "error";
type PlannerFeedbackTone = "idle" | "ready" | "error";

interface PlannerLoadState {
  status: PlannerStatus;
  summary: StudentProgressSummary | null;
  bundleSource: LocalStudentSnapshotSource;
  errorMessage: string | null;
}

interface PlannerFeedback {
  tone: PlannerFeedbackTone;
  message: string | null;
}

interface PlannerLinkLayerState {
  width: number;
  height: number;
  paths: Array<{
    id: string;
    kind: "prerequisite" | "dependent";
    path: string;
  }>;
}

const ALL_COMPONENT_STATUSES: ComponentAcademicStatus[] = [
  "completed",
  "inProgress",
  "review",
];

const EMPTY_LINK_LAYER: PlannerLinkLayerState = {
  width: 0,
  height: 0,
  paths: [],
};

export function PlannerPage() {
  const [loadState, setLoadState] = useState<PlannerLoadState>({
    status: "loading",
    summary: null,
    bundleSource: "none",
    errorMessage: null,
  });
  const [plannerState, setPlannerState] = useState(() => loadPlannerState());
  const [board, setBoard] = useState<PlannerBoard | null>(null);
  const [queryDraft, setQueryDraft] = useState(
    plannerState.preferences.filterDraft?.query ?? "",
  );
  const deferredQuery = useDeferredValue(queryDraft);
  const [selectedStatuses, setSelectedStatuses] = useState<
    ComponentAcademicStatus[]
  >(ALL_COMPONENT_STATUSES);
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [showScheduledOnly, setShowScheduledOnly] = useState(false);
  const [showReviewOnly, setShowReviewOnly] = useState(false);
  const [selectedComponentCode, setSelectedComponentCode] = useState<
    string | null
  >(plannerState.preferences.filterDraft?.focusComponentCode ?? null);
  const [hoveredComponentCode, setHoveredComponentCode] = useState<
    string | null
  >(null);
  const [draggedComponentCode, setDraggedComponentCode] = useState<
    string | null
  >(null);
  const [feedback, setFeedback] = useState<PlannerFeedback>({
    tone: "idle",
    message: null,
  });
  const [linkLayerState, setLinkLayerState] =
    useState<PlannerLinkLayerState>(EMPTY_LINK_LAYER);
  const [iraBaselineAverage, setIraBaselineAverage] = useState("");
  const [iraBaselineWeight, setIraBaselineWeight] = useState("");
  const [iraGradesByCode, setIraGradesByCode] = useState<
    Record<string, string>
  >({});
  const [iraWeightBasis, setIraWeightBasis] =
    useState<IraWeightBasis>("credits");
  const boardStageRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const initialCompactPreference = useRef(plannerState.preferences.compact);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const loaded = await loadLatestProjectedStudentSnapshot();

      if (cancelled) {
        return;
      }

      if (!loaded.bundle) {
        setLoadState({
          status: "empty",
          summary: null,
          bundleSource: loaded.source,
          errorMessage: null,
        });
        setBoard(null);
        return;
      }

      const nextSummary = summarizeStudentProgress(loaded.bundle);

      setLoadState({
        status: "ready",
        summary: nextSummary,
        bundleSource: loaded.source,
        errorMessage: null,
      });
      setBoard(
        createPlannerBoardFromProgress(nextSummary, {
          compact: initialCompactPreference.current,
        }),
      );
    })().catch((error: unknown) => {
      if (cancelled) {
        return;
      }

      if (isVaultLockedError(error)) {
        setLoadState({
          status: "locked",
          summary: null,
          bundleSource: "none",
          errorMessage: error.message,
        });
        setBoard(null);
        return;
      }

      setLoadState({
        status: "error",
        summary: null,
        bundleSource: "none",
        errorMessage:
          error instanceof Error
            ? error.message
            : "Falha ao abrir o planner local derivado do snapshot salvo.",
      });
      setBoard(null);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    savePlannerState(globalThis.localStorage, plannerState);
  }, [plannerState]);

  const connectedOnly =
    plannerState.preferences.filterDraft?.connectedOnly ?? false;
  const focusComponentCode = hoveredComponentCode ?? selectedComponentCode;

  useEffect(() => {
    setPlannerState((currentState) =>
      updatePlannerState(currentState, {
        filterDraft:
          deferredQuery.trim().length > 0 ||
          connectedOnly ||
          selectedComponentCode
            ? {
                query: deferredQuery,
                connectedOnly,
                focusComponentCode: selectedComponentCode,
              }
            : null,
      }),
    );
  }, [connectedOnly, deferredQuery, selectedComponentCode]);

  const componentIndex = useMemo(
    () =>
      new Map<string, Component>(
        loadState.summary?.studentSnapshot.curriculum.components.map(
          (component): [string, Component] => [component.code, component],
        ) ?? [],
      ),
    [loadState.summary],
  );

  const projectedBoard = useMemo(() => {
    if (!board) {
      return null;
    }

    return projectPlannerBoard(board, {
      query: deferredQuery,
      statuses:
        selectedStatuses.length === ALL_COMPONENT_STATUSES.length
          ? undefined
          : selectedStatuses,
      focusComponentCode,
      connectedOnly,
      compact: plannerState.preferences.compact,
    });
  }, [
    board,
    connectedOnly,
    deferredQuery,
    focusComponentCode,
    plannerState.preferences.compact,
    selectedStatuses,
  ]);

  const firstPlannedTermId =
    board?.terms.find((term) => term.kind === "planned")?.id ?? null;
  const reviewTermId =
    board?.terms.find((term) => term.kind === "review")?.id ?? null;

  const visibleTerms = useMemo(() => {
    if (!board || !projectedBoard) {
      return [];
    }

    return projectVisibleTerms({
      board,
      projectedBoardTerms: projectedBoard.terms,
      firstPlannedTermId,
      reviewTermId,
      showAvailableOnly,
      showScheduledOnly,
      showReviewOnly,
    });
  }, [
    board,
    firstPlannedTermId,
    projectedBoard,
    reviewTermId,
    showAvailableOnly,
    showReviewOnly,
    showScheduledOnly,
  ]);

  const visibleCodes = useMemo(
    () => new Set(visibleTerms.flatMap((term) => term.visibleComponentCodes)),
    [visibleTerms],
  );

  const relationHighlights = useMemo<PlannerRelationHighlights | null>(() => {
    if (!board || !focusComponentCode) {
      return null;
    }

    return buildPlannerRelationHighlights(
      board.dependencyGraph,
      focusComponentCode,
    );
  }, [board, focusComponentCode]);

  useEffect(() => {
    if (!board || !relationHighlights || !boardStageRef.current) {
      setLinkLayerState(EMPTY_LINK_LAYER);
      return;
    }

    let animationFrameId = 0;
    const stageElement = boardStageRef.current;

    const measure = () => {
      const containerRect = stageElement.getBoundingClientRect();
      const rectMap = Object.fromEntries(
        relationHighlights.relatedComponentCodes.flatMap((componentCode) => {
          if (!visibleCodes.has(componentCode)) {
            return [];
          }

          const element = cardRefs.current.get(componentCode);

          if (!element) {
            return [];
          }

          const cardRect = element.getBoundingClientRect();

          return [
            [
              componentCode,
              {
                x: cardRect.left - containerRect.left,
                y: cardRect.top - containerRect.top,
                width: cardRect.width,
                height: cardRect.height,
              },
            ] as const,
          ];
        }),
      );
      const edgeKindById = new Map<string, "prerequisite" | "dependent">(
        relationHighlights.edges.map(
          (edge) => [`${edge.from}->${edge.to}`, edge.kind] as const,
        ),
      );
      const nextPaths = buildPlannerConnectionPaths(
        rectMap,
        relationHighlights.edges
          .filter(
            (edge) => visibleCodes.has(edge.from) && visibleCodes.has(edge.to),
          )
          .map((edge) => ({
            sourceId: edge.from,
            targetId: edge.to,
          })),
      );

      setLinkLayerState({
        width: containerRect.width,
        height: containerRect.height,
        paths: nextPaths.map((connection) => ({
          id: connection.id,
          kind: edgeKindById.get(connection.id) ?? "prerequisite",
          path: connection.path,
        })),
      });
    };

    const queueMeasurement = () => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(measure);
    };

    queueMeasurement();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            queueMeasurement();
          });

    resizeObserver?.observe(stageElement);
    for (const element of cardRefs.current.values()) {
      resizeObserver?.observe(element);
    }

    globalThis.addEventListener("resize", queueMeasurement);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver?.disconnect();
      globalThis.removeEventListener("resize", queueMeasurement);
    };
  }, [board, relationHighlights, visibleCodes]);

  const hoursSummary = useMemo(
    () => buildHoursSummary(loadState.summary),
    [loadState.summary],
  );

  const nextFocusItems = loadState.summary?.focusItems.slice(0, 4) ?? [];
  const graphStats = board
    ? {
        roots: board.dependencyGraph.rootComponentCodes.length,
        leaves: board.dependencyGraph.leafComponentCodes.length,
      }
    : null;

  const iraProjection = useMemo(() => {
    if (!board || !loadState.summary) {
      return null;
    }

    const inProgressCodes =
      board.terms
        .find((term) => term.kind === "in-progress")
        ?.componentCodes.slice(0, 4) ?? [];
    const plannedCodes = board.terms
      .filter((term) => term.kind === "planned")
      .flatMap((term) => term.componentCodes)
      .slice(0, 4);
    const simulatedCodes = uniqueValues([
      ...inProgressCodes,
      ...plannedCodes,
    ]).slice(0, 6);

    return projectIraFromBaseline({
      baselineAverage: iraBaselineAverage,
      baselineWeight: Number(iraBaselineWeight),
      projectedEntries: simulatedCodes.flatMap((code) => {
        const component = componentIndex.get(code);
        if (!component) {
          return [];
        }

        return [
          {
            code,
            title: component.title,
            credits: component.credits,
            workloadHours: component.workloadHours,
            gradeValue: iraGradesByCode[code] ?? "",
          },
        ];
      }),
      options: {
        weightBasis: iraWeightBasis,
      },
    });
  }, [
    board,
    componentIndex,
    iraBaselineAverage,
    iraBaselineWeight,
    iraGradesByCode,
    iraWeightBasis,
    loadState.summary,
  ]);

  if (loadState.status === "loading") {
    return (
      <div className="page-grid">
        <section className="hero-card">
          <p className="section-label">Planejador local</p>
          <h2>Carregando a trilha derivada do vault local</h2>
          <p>
            O planner so existe depois que o navegador consegue abrir um
            snapshot salvo localmente. Nenhum dado privado sai deste
            dispositivo.
          </p>
        </section>
      </div>
    );
  }

  if (loadState.status === "locked") {
    return (
      <div className="page-grid">
        <section className="hero-card">
          <p className="section-label">Planner bloqueado</p>
          <h2>O vault local precisa ser desbloqueado primeiro</h2>
          <p>
            O planejador nao le o snapshot enquanto a sessao do vault estiver
            bloqueada por passkey. Desbloqueie o vault e volte para esta tela.
          </p>
          <div className="action-row">
            <Link className="action-button action-button-secondary" to="/">
              Abrir visao geral
            </Link>
            <Link className="action-button" to="/importacao">
              Ir para importacao
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (loadState.status === "empty") {
    return (
      <div className="page-grid">
        <section className="hero-card">
          <p className="section-label">Planner local</p>
          <h2>Nenhum snapshot local foi salvo ainda</h2>
          <p>
            O planner nasce do snapshot salvo no navegador. Primeiro importe um
            texto do SIGAA ou rode a sincronizacao automatica pela extensao.
          </p>
          <div className="action-row">
            <Link className="action-button" to="/importacao">
              Abrir importacao
            </Link>
            <Link
              className="action-button action-button-secondary"
              to="/catalogo"
            >
              Ver catalogo publico
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (
    loadState.status === "error" ||
    !loadState.summary ||
    !board ||
    !projectedBoard
  ) {
    return (
      <div className="page-grid">
        <section className="hero-card">
          <p className="section-label">Planner local</p>
          <h2>Falha ao montar o planner derivado</h2>
          <p>
            {loadState.errorMessage ??
              "O snapshot local nao conseguiu virar uma trilha planejavel nesta leitura."}
          </p>
        </section>
      </div>
    );
  }

  const currentSummary = loadState.summary;

  return (
    <div className="page-grid planner-shell">
      <section className="panel planner-hud">
        <div className="planner-hud-copy">
          <p className="section-label">Planejador local-first</p>
          <h2>
            Grade viva, com dependencias explicitas e planejamento por periodo
            real
          </h2>
          <p>
            Esta tela trabalha em cima de um snapshot local derivado, nao de uma
            fonte autoritativa do SIGAA em tempo real. Ela e forte para explorar
            trilhas, testar encaixes e enxergar bloqueios; quando a grade seed
            ainda estiver ambigua, o proprio app marca isso.
          </p>
        </div>

        <div className="planner-hud-metrics">
          <Metric
            label="Progresso concluido"
            value={`${loadState.summary.completedComponentPercent}%`}
          />
          <Metric
            label="Cobertura ativa"
            value={`${loadState.summary.activeComponentPercent}%`}
          />
          <Metric
            label="Catalogo reconhecido"
            value={`${loadState.summary.matchedCatalogCount}/${loadState.summary.componentCount}`}
          />
          <Metric
            label="Fonte local"
            value={
              loadState.bundleSource === "bundle" ? "Vault atual" : "Fallback"
            }
          />
        </div>

        <div className="planner-progress-strip">
          <div className="planner-progress-overview">
            <div className="planner-progress-header">
              <div>
                <p className="micro-label">Integralizacao local</p>
                <h3>{hoursSummary.completedHoursLabel} integralizadas</h3>
              </div>
              <ProgressRing
                value={hoursSummary.completedHours}
                max={hoursSummary.totalHours}
                size={54}
                strokeWidth={6}
                title={`Carga concluida: ${hoursSummary.completedHoursLabel}`}
              />
            </div>

            <div className="planner-progress-bar" aria-hidden="true">
              <span
                className="planner-progress-bar-completed"
                style={{
                  width: `${hoursSummary.completedRatio}%`,
                }}
              />
              <span
                className="planner-progress-bar-active"
                style={{
                  width: `${hoursSummary.inProgressRatio}%`,
                }}
              />
            </div>

            <div className="planner-progress-facts">
              <span>{hoursSummary.totalHoursLabel} totais mapeadas</span>
              <span>{hoursSummary.remainingHoursLabel} ainda por vencer</span>
              <span>
                Grade atual:{" "}
                {loadState.summary.studentSnapshot.curriculum.curriculumId}
              </span>
            </div>
          </div>

          <div className="planner-donut-grid">
            <article className="planner-donut-card">
              <ProgressDonut
                value={hoursSummary.completedHours}
                max={hoursSummary.totalHours}
                label={hoursSummary.completedHoursLabel}
                title="Carga horaria concluida localmente"
                progressColor="#2b7a5b"
              />
              <div>
                <strong>Concluidas</strong>
                <p>
                  {loadState.summary.completedCount} componentes finalizadas no
                  snapshot local.
                </p>
              </div>
            </article>

            <article className="planner-donut-card">
              <ProgressDonut
                value={hoursSummary.inProgressHours}
                max={hoursSummary.totalHours}
                label={hoursSummary.inProgressHoursLabel}
                title="Carga em andamento"
                progressColor="#d3752b"
              />
              <div>
                <strong>Em andamento</strong>
                <p>
                  {loadState.summary.inProgressCount} componentes ainda ativas
                  no periodo atual.
                </p>
              </div>
            </article>

            <article className="planner-donut-card">
              <ProgressDonut
                value={hoursSummary.remainingHours}
                max={hoursSummary.totalHours}
                label={hoursSummary.remainingHoursLabel}
                title="Carga ainda restante"
                progressColor="#5466b8"
              />
              <div>
                <strong>Restantes</strong>
                <p>
                  {loadState.summary.remainingComponentCount} componentes ainda
                  pedem encaixe na trilha.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="panel planner-controls">
        <div className="planner-controls-topline">
          <div>
            <p className="micro-label">Filtros e modo de leitura</p>
            <h3>Busque, reduza ruido e fixe o foco</h3>
          </div>
          <div className="planner-toggle-row">
            <button
              type="button"
              className={buildToggleClassName(plannerState.preferences.compact)}
              onClick={() => {
                setPlannerState((currentState) =>
                  updatePlannerState(currentState, {
                    compact: !currentState.preferences.compact,
                  }),
                );
              }}
            >
              {plannerState.preferences.compact
                ? "Modo detalhado"
                : "Modo compacto"}
            </button>
            <button
              type="button"
              className={buildToggleClassName(
                plannerState.preferences.darkGraphFocus,
              )}
              onClick={() => {
                setPlannerState((currentState) =>
                  updatePlannerState(currentState, {
                    darkGraphFocus: !currentState.preferences.darkGraphFocus,
                  }),
                );
              }}
            >
              {plannerState.preferences.darkGraphFocus
                ? "Contraste normal"
                : "Foco alto nas relacoes"}
            </button>
          </div>
        </div>

        <div className="planner-search-row">
          <label className="planner-search">
            <span className="detail-label">Busca local</span>
            <input
              className="text-input planner-search-input"
              type="search"
              value={queryDraft}
              onChange={(event) => {
                startTransition(() => {
                  setQueryDraft(event.target.value);
                });
              }}
              placeholder="Codigo, nome da disciplina ou parte do titulo"
            />
          </label>

          <div className="planner-chip-group">
            <button
              type="button"
              className={buildChipClassName(
                !selectedStatuses.includes("completed"),
              )}
              onClick={() => {
                setSelectedStatuses((currentStatuses) =>
                  togglePlannerStatus(currentStatuses, "completed"),
                );
              }}
            >
              Ocultar concluidas
            </button>
            <button
              type="button"
              className={buildChipClassName(showAvailableOnly)}
              onClick={() => {
                setShowAvailableOnly((currentValue) => !currentValue);
              }}
            >
              So liberadas agora
            </button>
            <button
              type="button"
              className={buildChipClassName(showScheduledOnly)}
              onClick={() => {
                setShowScheduledOnly((currentValue) => !currentValue);
              }}
            >
              Com horario local
            </button>
            <button
              type="button"
              className={buildChipClassName(showReviewOnly)}
              onClick={() => {
                setShowReviewOnly((currentValue) => !currentValue);
              }}
            >
              Em revisao
            </button>
            <button
              type="button"
              className={buildChipClassName(connectedOnly)}
              onClick={() => {
                setPlannerState((currentState) =>
                  updatePlannerState(currentState, {
                    filterDraft: {
                      query: deferredQuery,
                      connectedOnly: !connectedOnly,
                      focusComponentCode: selectedComponentCode,
                    },
                  }),
                );
              }}
              disabled={!focusComponentCode}
            >
              So relacionadas
            </button>
          </div>
        </div>

        <div className="planner-chip-group">
          {ALL_COMPONENT_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className={buildChipClassName(selectedStatuses.includes(status))}
              onClick={() => {
                setSelectedStatuses((currentStatuses) =>
                  togglePlannerStatus(currentStatuses, status),
                );
              }}
            >
              {formatAcademicStatusLabel(status)}
            </button>
          ))}
          <button
            type="button"
            className="planner-chip"
            onClick={() => {
              setSelectedStatuses(ALL_COMPONENT_STATUSES);
              setShowAvailableOnly(false);
              setShowReviewOnly(false);
              setShowScheduledOnly(false);
              setQueryDraft("");
              setSelectedComponentCode(null);
              setPlannerState((currentState) =>
                updatePlannerState(currentState, {
                  filterDraft: null,
                }),
              );
            }}
          >
            Limpar filtros
          </button>
        </div>

        {feedback.message ? (
          <p
            className={`status-banner ${
              feedback.tone === "error"
                ? "status-banner-error"
                : "status-banner-success"
            }`}
            role="status"
          >
            {feedback.message}
          </p>
        ) : null}
      </section>

      <div className="planner-layout">
        <section className="panel planner-board-panel">
          <div className="planner-board-header">
            <div>
              <p className="micro-label">Mapa curricular local</p>
              <h3>Arraste componentes, renomeie periodos e teste a trilha</h3>
            </div>
            <div className="action-row">
              <button
                type="button"
                className="action-button action-button-secondary"
                onClick={() => {
                  setBoard(
                    createPlannerBoardFromProgress(currentSummary, {
                      compact: plannerState.preferences.compact,
                    }),
                  );
                  setFeedback({
                    tone: "ready",
                    message:
                      "Planner local resetado para a trilha derivada do snapshot atual.",
                  });
                }}
              >
                Resetar trilha
              </button>
              <button
                type="button"
                className="action-button"
                onClick={() => {
                  setBoard((currentBoard) =>
                    currentBoard
                      ? appendPlannerTerm(currentBoard)
                      : currentBoard,
                  );
                }}
              >
                Adicionar periodo
              </button>
            </div>
          </div>

          <div className="planner-truth-note">
            <strong>Leitura honesta:</strong> o planner usa uma grade seed
            versionada e um snapshot local salvo neste navegador. Se a grade
            ainda estiver ambigua, trate este encaixe como melhor
            correspondencia local, nao como confirmacao oficial do SIGAA.
          </div>

          <div className="planner-board-stage" ref={boardStageRef}>
            {relationHighlights && linkLayerState.paths.length > 0 ? (
              <svg
                className={`planner-link-layer ${
                  plannerState.preferences.darkGraphFocus
                    ? "planner-link-layer-strong"
                    : ""
                }`}
                viewBox={`0 0 ${Math.max(linkLayerState.width, 1)} ${Math.max(
                  linkLayerState.height,
                  1,
                )}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {linkLayerState.paths.map((connection) => (
                  <path
                    key={connection.id}
                    d={connection.path}
                    className={`planner-link planner-link-${connection.kind}`}
                  />
                ))}
              </svg>
            ) : null}

            <div className="planner-board-grid">
              {visibleTerms.map((term, termIndex) => {
                const dropValidation =
                  draggedComponentCode &&
                  board.cardsByCode[draggedComponentCode]
                    ? validatePlannerMove(board, draggedComponentCode, term.id)
                    : null;
                const displayedTitle =
                  plannerState.preferences.termLabels[term.id] ??
                  suggestPlannerTermTitle(board, term, termIndex);

                return (
                  <fieldset
                    key={term.id}
                    className={`planner-term planner-term-${term.kind} ${
                      draggedComponentCode
                        ? dropValidation?.canMove === false
                          ? "planner-term-drop-blocked"
                          : "planner-term-drop-ready"
                        : ""
                    }`}
                    onDragOver={(event) => {
                      event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();

                      const nextComponentCode =
                        draggedComponentCode ??
                        event.dataTransfer.getData("text/plain") ??
                        null;

                      if (
                        !nextComponentCode ||
                        !board.cardsByCode[nextComponentCode]
                      ) {
                        return;
                      }

                      const nextFeedback = handlePlannerDrop({
                        board,
                        componentCode: nextComponentCode,
                        targetTermId: term.id,
                      });

                      if (nextFeedback.nextBoard) {
                        setBoard(nextFeedback.nextBoard);
                      }

                      setFeedback({
                        tone: nextFeedback.tone,
                        message: nextFeedback.message,
                      });
                      setDraggedComponentCode(null);
                    }}
                  >
                    <legend className="sr-only">
                      Coluna do periodo {displayedTitle}
                    </legend>
                    <header className="planner-term-header">
                      <StatusGlyph
                        status={mapTermKindToTone(term.kind)}
                        label={formatTermKindLabel(term.kind)}
                        size={18}
                      />

                      <div className="planner-term-copy">
                        <label className="planner-term-title-label">
                          <span className="detail-label">Periodo</span>
                          <input
                            className="planner-term-title-input"
                            type="text"
                            value={displayedTitle}
                            onChange={(event) => {
                              const nextValue = event.target.value;

                              setPlannerState((currentState) => {
                                const nextTermLabels = {
                                  ...currentState.preferences.termLabels,
                                };

                                if (nextValue.trim().length === 0) {
                                  delete nextTermLabels[term.id];
                                } else {
                                  nextTermLabels[term.id] = nextValue;
                                }

                                return updatePlannerState(currentState, {
                                  termLabels: nextTermLabels,
                                });
                              });
                            }}
                          />
                        </label>
                        <p>{describePlannerTerm(term)}</p>
                      </div>
                    </header>

                    <div className="planner-term-stats">
                      <span>{term.visibleComponentCodes.length} visiveis</span>
                      <span>{term.componentCodes.length} totais</span>
                    </div>

                    <div className="planner-card-stack">
                      {term.visibleComponentCodes.length === 0 ? (
                        <div className="planner-empty-slot">
                          Nenhum componente visivel neste recorte.
                        </div>
                      ) : (
                        term.visibleComponentCodes.map((componentCode) => {
                          const card = board.cardsByCode[componentCode];
                          const component = componentIndex.get(componentCode);

                          if (!card || !component) {
                            return null;
                          }

                          const highlightState = resolvePlannerHighlightState({
                            card,
                            focusComponentCode,
                            relationHighlights,
                            darkGraphFocus:
                              plannerState.preferences.darkGraphFocus,
                          });
                          const statusTone = resolveCardTone(term.kind, card);
                          const isDraggable =
                            card.academicStatus === "review" ||
                            term.kind === "planned" ||
                            term.kind === "review";

                          return (
                            <button
                              type="button"
                              key={card.code}
                              ref={(node) => {
                                if (node) {
                                  cardRefs.current.set(card.code, node);
                                  return;
                                }

                                cardRefs.current.delete(card.code);
                              }}
                              className={`planner-card ${highlightState.className} ${
                                plannerState.preferences.compact
                                  ? "planner-card-compact"
                                  : ""
                              }`}
                              draggable={isDraggable}
                              onMouseEnter={() => {
                                setHoveredComponentCode(card.code);
                              }}
                              onMouseLeave={() => {
                                setHoveredComponentCode((currentCode) =>
                                  currentCode === card.code
                                    ? null
                                    : currentCode,
                                );
                              }}
                              onFocus={() => {
                                setHoveredComponentCode(card.code);
                              }}
                              onBlur={() => {
                                setHoveredComponentCode((currentCode) =>
                                  currentCode === card.code
                                    ? null
                                    : currentCode,
                                );
                              }}
                              onClick={() => {
                                setSelectedComponentCode((currentCode) =>
                                  currentCode === card.code ? null : card.code,
                                );
                              }}
                              onDragStart={(event) => {
                                if (!isDraggable) {
                                  event.preventDefault();
                                  return;
                                }

                                event.dataTransfer.effectAllowed = "move";
                                event.dataTransfer.setData(
                                  "text/plain",
                                  card.code,
                                );
                                setDraggedComponentCode(card.code);
                                setFeedback({
                                  tone: "idle",
                                  message: null,
                                });
                              }}
                              onDragEnd={() => {
                                setDraggedComponentCode(null);
                              }}
                            >
                              <div className="planner-card-topline">
                                <span className="planner-code-tag">
                                  {card.code}
                                </span>
                                <span className="planner-hours-tag">
                                  {formatHours(component.workloadHours)}
                                </span>
                              </div>

                              <div className="planner-card-heading">
                                <StatusGlyph
                                  status={statusTone}
                                  label={buildCardStatusLabel(card, term.kind)}
                                  size={20}
                                />
                                <div>
                                  <h4>{card.title}</h4>
                                  <p>{describePlannerCard(card, term.kind)}</p>
                                </div>
                              </div>

                              <div className="planner-card-facts">
                                <span>
                                  {formatAcademicStatusLabel(
                                    card.academicStatus,
                                  )}
                                </span>
                                <span>
                                  {card.prerequisiteCodes.length} prereq.
                                </span>
                                <span>{card.dependentCodes.length} libera</span>
                                {card.scheduleBlockCount > 0 ? (
                                  <span>
                                    {card.scheduleBlockCount} horario(s)
                                  </span>
                                ) : null}
                              </div>

                              {!plannerState.preferences.compact ? (
                                <div className="planner-card-footer">
                                  <span>
                                    {card.pendingRequirementCount > 0
                                      ? `${card.pendingRequirementCount} pendencia(s)`
                                      : "Sem pendencias locais abertas"}
                                  </span>
                                  <span>
                                    {card.hasCatalogMatch
                                      ? "Catalogo reconhecido"
                                      : "Precisa de revisao manual"}
                                  </span>
                                </div>
                              ) : null}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="planner-sidebar">
          <section className="panel planner-side-panel">
            <p className="micro-label">Visao de dependencias</p>
            <h3>
              {focusComponentCode
                ? `Rede local de ${focusComponentCode}`
                : "Passe o mouse ou fixe uma disciplina"}
            </h3>
            <p>
              {focusComponentCode
                ? "Prerequisitos diretos ficam destacados em verde; disciplinas liberadas pela selecionada aparecem em azul."
                : "O hover enfatiza a cadeia de liberacao. Um clique fixa a leitura e permite usar o filtro “So relacionadas”."}
            </p>

            <div className="planner-legend-shell">
              <DependencyLegend
                items={[
                  {
                    id: "selected",
                    label: "Selecionada",
                    tone: "active",
                    description: "Ponto central da leitura atual.",
                  },
                  {
                    id: "prerequisite",
                    label: "Prerequisito",
                    tone: "done",
                    description: "Disciplina que precisa vir antes.",
                  },
                  {
                    id: "dependent",
                    label: "Libera",
                    tone: "queued",
                    description: "Disciplina que abre depois desta.",
                  },
                  {
                    id: "review",
                    label: "Bloqueio local",
                    tone: "blocked",
                    description: "Componente ainda sem encaixe confiavel.",
                  },
                ]}
              />
            </div>

            {relationHighlights ? (
              <div className="planner-relation-grid">
                <article className="soft-card">
                  <span className="detail-label">Vem antes</span>
                  <strong>{relationHighlights.prerequisiteCodes.length}</strong>
                  <p>
                    {relationHighlights.prerequisiteCodes.length > 0
                      ? relationHighlights.prerequisiteCodes.join(", ")
                      : "Nenhum prerequisito direto."}
                  </p>
                </article>
                <article className="soft-card">
                  <span className="detail-label">Libera depois</span>
                  <strong>{relationHighlights.dependentCodes.length}</strong>
                  <p>
                    {relationHighlights.dependentCodes.length > 0
                      ? relationHighlights.dependentCodes.join(", ")
                      : "Nenhuma liberacao direta."}
                  </p>
                </article>
              </div>
            ) : null}
          </section>

          <section className="panel planner-side-panel">
            <p className="micro-label">Leitura do curso</p>
            <h3>Proximos focos da trilha local</h3>
            <div className="planner-focus-list">
              {nextFocusItems.length === 0 ? (
                <p>
                  O snapshot atual ainda nao gerou uma fila de foco forte. Isso
                  costuma acontecer quando a grade seed ainda esta rasa ou o
                  snapshot local veio incompleto.
                </p>
              ) : (
                nextFocusItems.map((item) => (
                  <article key={item.code} className="planner-focus-item">
                    <div className="planner-focus-topline">
                      <span className="planner-code-tag">{item.code}</span>
                      <span className="status-pill status-pill-idle">
                        {formatFocusPriority(item.priority)}
                      </span>
                    </div>
                    <strong>{item.title}</strong>
                    <p>{item.reason}</p>
                  </article>
                ))
              )}
            </div>

            {graphStats ? (
              <div className="planner-mini-metrics">
                <span>{graphStats.roots} raizes na malha local</span>
                <span>{graphStats.leaves} folhas na malha local</span>
                <span>
                  {loadState.summary.pendingRequirementCount} pendencias abertas
                </span>
              </div>
            ) : null}
          </section>

          <section className="panel planner-side-panel">
            <p className="micro-label">Simulador de IRA</p>
            <h3>Projecao rapida sobre a proxima leva de componentes</h3>
            <p>
              O calculo e local, opcional e nao substitui o IRA oficial. Use a
              media base e o peso acumulado que voce ja conhece, depois teste
              notas provaveis para os componentes ativos e planejados.
            </p>

            <div className="planner-ira-form">
              <label>
                <span className="detail-label">Media base</span>
                <input
                  className="text-input"
                  type="text"
                  inputMode="decimal"
                  value={iraBaselineAverage}
                  onChange={(event) => {
                    setIraBaselineAverage(event.target.value);
                  }}
                  placeholder="Ex.: 7,84"
                />
              </label>

              <label>
                <span className="detail-label">
                  Peso base (
                  {iraWeightBasis === "credits" ? "creditos" : "horas"})
                </span>
                <input
                  className="text-input"
                  type="number"
                  min="0"
                  step="1"
                  value={iraBaselineWeight}
                  onChange={(event) => {
                    setIraBaselineWeight(event.target.value);
                  }}
                  placeholder="Ex.: 148"
                />
              </label>

              <div className="planner-chip-group">
                <button
                  type="button"
                  className={buildChipClassName(iraWeightBasis === "credits")}
                  onClick={() => {
                    setIraWeightBasis("credits");
                  }}
                >
                  Base por creditos
                </button>
                <button
                  type="button"
                  className={buildChipClassName(
                    iraWeightBasis === "workloadHours",
                  )}
                  onClick={() => {
                    setIraWeightBasis("workloadHours");
                  }}
                >
                  Base por horas
                </button>
              </div>
            </div>

            <div className="planner-ira-grid">
              {(
                board.terms.find((term) => term.kind === "in-progress")
                  ?.componentCodes ?? []
              )
                .concat(
                  board.terms.find((term) => term.kind === "planned")
                    ?.componentCodes ?? [],
                )
                .slice(0, 6)
                .map((componentCode) => {
                  const component = componentIndex.get(componentCode);

                  if (!component) {
                    return null;
                  }

                  return (
                    <label key={component.code} className="planner-ira-row">
                      <span className="detail-label">{component.code}</span>
                      <strong>{component.title}</strong>
                      <input
                        className="text-input"
                        type="text"
                        inputMode="decimal"
                        value={iraGradesByCode[component.code] ?? ""}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setIraGradesByCode((currentMap) => ({
                            ...currentMap,
                            [component.code]: nextValue,
                          }));
                        }}
                        placeholder="Nota projetada"
                      />
                    </label>
                  );
                })}
            </div>

            {iraProjection ? (
              <div className="planner-ira-result">
                <div className="planner-ira-metrics">
                  <article className="soft-card">
                    <span className="detail-label">Media projetada</span>
                    <strong>
                      {iraProjection.roundedProjectedAverage === null
                        ? "Aguardando base"
                        : iraProjection.roundedProjectedAverage.toFixed(2)}
                    </strong>
                  </article>
                  <article className="soft-card">
                    <span className="detail-label">Delta local</span>
                    <strong>
                      {iraProjection.roundedDelta === null
                        ? "Sem delta"
                        : iraProjection.roundedDelta.toFixed(2)}
                    </strong>
                  </article>
                </div>

                <p className="muted-note">
                  {iraProjection.scenario.consideredCount} componente(s)
                  entraram na conta; {iraProjection.scenario.ignoredCount} foram
                  ignorados por nota ou peso invalidos.
                </p>

                {iraProjection.warnings.length > 0 ? (
                  <ul className="list">
                    {iraProjection.warnings.slice(0, 4).map((warning) => (
                      <li
                        key={`${warning.code}-${warning.entryCode ?? "baseline"}`}
                      >
                        {warning.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}

function buildHoursSummary(summary: StudentProgressSummary | null) {
  if (!summary) {
    return {
      totalHours: 0,
      completedHours: 0,
      inProgressHours: 0,
      remainingHours: 0,
      completedRatio: 0,
      inProgressRatio: 0,
      totalHoursLabel: "0h",
      completedHoursLabel: "0h",
      inProgressHoursLabel: "0h",
      remainingHoursLabel: "0h",
    };
  }

  const totalHours = sumComponentHours(
    summary.studentSnapshot.curriculum.components,
  );
  const completedHours = sumComponentHours(
    summary.studentSnapshot.completedComponents,
  );
  const inProgressHours = sumComponentHours(
    summary.studentSnapshot.inProgressComponents,
  );
  const remainingHours = Math.max(
    totalHours - completedHours - inProgressHours,
    0,
  );
  const totalRatio = totalHours > 0 ? totalHours : 1;

  return {
    totalHours,
    completedHours,
    inProgressHours,
    remainingHours,
    completedRatio: Math.round((completedHours / totalRatio) * 100),
    inProgressRatio: Math.round((inProgressHours / totalRatio) * 100),
    totalHoursLabel: formatHours(totalHours),
    completedHoursLabel: formatHours(completedHours),
    inProgressHoursLabel: formatHours(inProgressHours),
    remainingHoursLabel: formatHours(remainingHours),
  };
}

function sumComponentHours(components: Component[]) {
  return components.reduce(
    (total, component) => total + (component.workloadHours ?? 0),
    0,
  );
}

function formatHours(value: number) {
  return `${value}h`;
}

function togglePlannerStatus(
  currentStatuses: ComponentAcademicStatus[],
  nextStatus: ComponentAcademicStatus,
) {
  if (currentStatuses.includes(nextStatus)) {
    if (currentStatuses.length === 1) {
      return currentStatuses;
    }

    return currentStatuses.filter((status) => status !== nextStatus);
  }

  return [...currentStatuses, nextStatus];
}

function buildToggleClassName(active: boolean) {
  return active ? "planner-toggle planner-toggle-active" : "planner-toggle";
}

function buildChipClassName(active: boolean) {
  return active ? "planner-chip planner-chip-active" : "planner-chip";
}

function formatAcademicStatusLabel(status: ComponentAcademicStatus) {
  switch (status) {
    case "completed":
      return "Concluidas";
    case "inProgress":
      return "Cursando";
    case "review":
      return "Em revisao";
    default:
      return status;
  }
}

function formatTermKindLabel(kind: PlannerTerm["kind"]) {
  switch (kind) {
    case "completed":
      return "Concluidas";
    case "in-progress":
      return "Atual";
    case "planned":
      return "Planejado";
    case "review":
      return "Revisao";
    default:
      return kind;
  }
}

function describePlannerTerm(term: PlannerTerm) {
  switch (term.kind) {
    case "completed":
      return "Historico ja reconhecido no snapshot local.";
    case "in-progress":
      return "Componentes ativos no periodo atual.";
    case "planned":
      return "Coluna de planejamento arrastavel.";
    case "review":
      return "Itens que ainda precisam de encaixe ou revisao.";
    default:
      return "Leitura local da trilha.";
  }
}

function suggestPlannerTermTitle(
  board: PlannerBoard,
  term: PlannerTerm,
  termIndex: number,
) {
  if (term.kind === "completed") {
    return "Concluidas";
  }

  if (term.kind === "in-progress") {
    return `Agora · ${formatAcademicTermOffset(0)}`;
  }

  if (term.kind === "review") {
    return "Revisar encaixe";
  }

  const plannedPosition = board.terms
    .slice(0, termIndex + 1)
    .filter((currentTerm) => currentTerm.kind === "planned").length;

  return formatAcademicTermOffset(plannedPosition);
}

function formatAcademicTermOffset(offset: number) {
  const now = new Date();
  let year = now.getFullYear();
  let term = now.getMonth() < 6 ? 1 : 2;

  for (let currentOffset = 0; currentOffset < offset; currentOffset += 1) {
    if (term === 1) {
      term = 2;
      continue;
    }

    year += 1;
    term = 1;
  }

  return `${year}.${term}`;
}

function mapTermKindToTone(kind: PlannerTerm["kind"]): PlannerStatusTone {
  switch (kind) {
    case "completed":
      return "done";
    case "in-progress":
      return "active";
    case "planned":
      return "queued";
    case "review":
      return "blocked";
    default:
      return "neutral";
  }
}

function resolveCardTone(
  termKind: PlannerTerm["kind"],
  card: PlannerComponentCard,
): PlannerStatusTone {
  if (card.academicStatus === "completed") {
    return "done";
  }

  if (card.academicStatus === "inProgress") {
    return "active";
  }

  if (termKind === "planned") {
    return "queued";
  }

  return "blocked";
}

function buildCardStatusLabel(
  card: PlannerComponentCard,
  termKind: PlannerTerm["kind"],
) {
  if (card.academicStatus === "completed") {
    return "Concluida";
  }

  if (card.academicStatus === "inProgress") {
    return "Cursando";
  }

  if (termKind === "planned") {
    return "Planejavel";
  }

  return "Pede revisao";
}

function describePlannerCard(
  card: PlannerComponentCard,
  termKind: PlannerTerm["kind"],
) {
  if (card.academicStatus === "completed") {
    return "Ja saiu do historico local.";
  }

  if (card.academicStatus === "inProgress") {
    return "Ativa no periodo corrente.";
  }

  if (termKind === "planned") {
    return "Arraste para testar outro encaixe.";
  }

  return "Ainda sem encaixe confiavel.";
}

function resolvePlannerHighlightState(input: {
  card: PlannerComponentCard;
  focusComponentCode: string | null;
  relationHighlights: PlannerRelationHighlights | null;
  darkGraphFocus: boolean;
}) {
  if (!input.focusComponentCode || !input.relationHighlights) {
    return {
      className: "",
    };
  }

  if (input.card.code === input.focusComponentCode) {
    return {
      className: "planner-card-selected",
    };
  }

  if (input.relationHighlights.prerequisiteCodes.includes(input.card.code)) {
    return {
      className: "planner-card-prerequisite",
    };
  }

  if (input.relationHighlights.dependentCodes.includes(input.card.code)) {
    return {
      className: "planner-card-dependent",
    };
  }

  if (
    input.relationHighlights.relatedComponentCodes.includes(input.card.code)
  ) {
    return {
      className: "planner-card-related",
    };
  }

  return {
    className: input.darkGraphFocus
      ? "planner-card-dimmed planner-card-dimmed-strong"
      : "planner-card-dimmed",
  };
}

function projectVisibleTerms(input: {
  board: PlannerBoard;
  projectedBoardTerms: PlannerBoardTermView[];
  firstPlannedTermId: string | null;
  reviewTermId: string | null;
  showAvailableOnly: boolean;
  showScheduledOnly: boolean;
  showReviewOnly: boolean;
}) {
  return input.projectedBoardTerms.map((term) => ({
    ...term,
    visibleComponentCodes: term.visibleComponentCodes.filter(
      (componentCode) => {
        const card = input.board.cardsByCode[componentCode];

        if (!card) {
          return false;
        }

        if (input.showAvailableOnly && term.id !== input.firstPlannedTermId) {
          return false;
        }

        if (input.showScheduledOnly && card.scheduleBlockCount === 0) {
          return false;
        }

        if (input.showReviewOnly && term.id !== input.reviewTermId) {
          return false;
        }

        return true;
      },
    ),
  }));
}

function appendPlannerTerm(board: PlannerBoard): PlannerBoard {
  const nextTermId = createCustomPlannerTermId(board.terms);
  const insertIndex = board.terms.findIndex((term) => term.kind === "review");
  const nextTerms = [...board.terms];

  nextTerms.splice(insertIndex >= 0 ? insertIndex : nextTerms.length, 0, {
    id: nextTermId,
    title: "",
    kind: "planned",
    componentCodes: [],
  });

  return {
    ...board,
    terms: nextTerms,
  };
}

function createCustomPlannerTermId(terms: PlannerTerm[]) {
  const existingIds = new Set(terms.map((term) => term.id));
  let nextIndex = 1;

  while (existingIds.has(`planned-custom-${nextIndex}`)) {
    nextIndex += 1;
  }

  return `planned-custom-${nextIndex}`;
}

function handlePlannerDrop(input: {
  board: PlannerBoard;
  componentCode: string;
  targetTermId: string;
}) {
  const sourceTerm = input.board.terms.find((term) =>
    term.componentCodes.includes(input.componentCode),
  );
  const targetTerm = input.board.terms.find(
    (term) => term.id === input.targetTermId,
  );

  if (!sourceTerm || !targetTerm) {
    return {
      tone: "error" as const,
      message:
        "Nao foi possivel resolver a origem ou o destino desse movimento.",
      nextBoard: null,
    };
  }

  if (sourceTerm.id === targetTerm.id) {
    return {
      tone: "ready" as const,
      message: "A disciplina ja estava nesse periodo.",
      nextBoard: null,
    };
  }

  if (
    sourceTerm.kind === "completed" ||
    sourceTerm.kind === "in-progress" ||
    targetTerm.kind === "completed" ||
    targetTerm.kind === "in-progress"
  ) {
    return {
      tone: "error" as const,
      message:
        "Componentes concluidos ou em andamento nao devem ser arrastados para reescrever o historico local.",
      nextBoard: null,
    };
  }

  const validation = validatePlannerMove(
    input.board,
    input.componentCode,
    input.targetTermId,
  );

  if (!validation.canMove) {
    const blockedList =
      validation.blockingPrerequisiteCodes.length > 0
        ? ` Bloqueios: ${validation.blockingPrerequisiteCodes.join(", ")}.`
        : "";

    return {
      tone: "error" as const,
      message: `Esse encaixe quebra a ordem local de prerequisitos.${blockedList}`,
      nextBoard: null,
    };
  }

  return {
    tone: "ready" as const,
    message: `${input.componentCode} movida para ${input.targetTermId}.`,
    nextBoard: movePlannerCard(
      input.board,
      input.componentCode,
      input.targetTermId,
    ),
  };
}

function movePlannerCard(
  board: PlannerBoard,
  componentCode: string,
  targetTermId: string,
) {
  const currentCard = board.cardsByCode[componentCode];
  const sourceTerm = board.terms.find((term) =>
    term.componentCodes.includes(componentCode),
  );

  if (!sourceTerm || !currentCard) {
    return board;
  }

  const nextTerms = board.terms.map((term) => {
    if (term.id === sourceTerm.id) {
      return {
        ...term,
        componentCodes: term.componentCodes.filter(
          (code) => code !== componentCode,
        ),
      };
    }

    if (term.id === targetTermId) {
      return {
        ...term,
        componentCodes: [...term.componentCodes, componentCode],
      };
    }

    return term;
  });

  return {
    ...board,
    terms: nextTerms,
    cardsByCode: {
      ...board.cardsByCode,
      [componentCode]: {
        ...currentCard,
        termId: targetTermId,
      },
    },
  };
}

function formatFocusPriority(
  priority: StudentProgressSummary["focusItems"][number]["priority"],
) {
  switch (priority) {
    case "high":
      return "Alta";
    case "medium":
      return "Media";
    case "low":
      return "Baixa";
    default:
      return priority;
  }
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values));
}
