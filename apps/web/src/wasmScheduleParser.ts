import type {
  ManualImportNormalizedSchedule,
  ScheduleParseResult,
  TimingProfileId,
} from "@formae/protocol";

interface WasmScheduleModule {
  default(input?: unknown): Promise<unknown>;
  parseScheduleCode(raw: string, profileId: string): ScheduleParseResult;
}

let wasmModulePromise: Promise<WasmScheduleModule> | null = null;

export async function normalizeScheduleCodesWithWasm(
  scheduleCodes: string[],
  timingProfileId: TimingProfileId,
): Promise<ManualImportNormalizedSchedule[]> {
  const wasmModule = await loadWasmScheduleModule();

  return scheduleCodes.map((inputCode) => ({
    inputCode,
    parser: "rust-wasm",
    result: wasmModule.parseScheduleCode(inputCode, timingProfileId),
  }));
}

async function loadWasmScheduleModule(): Promise<WasmScheduleModule> {
  if (wasmModulePromise) {
    return wasmModulePromise;
  }

  wasmModulePromise = (async () => {
    const wasmModule = (await import(
      "./generated/wasm/formae_wasm_core.js"
    )) as WasmScheduleModule;

    await wasmModule.default();
    return wasmModule;
  })().catch((error: unknown) => {
    wasmModulePromise = null;
    throw error;
  });

  return wasmModulePromise;
}
