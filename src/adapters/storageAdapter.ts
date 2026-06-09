import type {
  CombatStartSnapshot,
  CombatState,
  CurrentRunSave,
  GameScreen,
  MapNode,
  RelicId,
  RestResult,
  RewardOption,
  RunState,
  RunSummary,
  UserSettings,
} from '../game/types';
import { clampBackgroundOpacity } from './backgroundAdapter';

export const SAVE_DATA_VERSION = 2;
export const CURRENT_RUN_STORAGE_KEY = 'slaythefish2.currentRun.v2';
export const SETTINGS_STORAGE_KEY = 'slaythefish2.settings.v2';
export const RUN_HISTORY_STORAGE_KEY = 'slaythefish2.runHistory.v2';

const LEGACY_CURRENT_RUN_STORAGE_KEYS = ['slaythefish2.currentRun.v1'];
const LEGACY_SETTINGS_STORAGE_KEYS = ['slaythefish2.settings.v1'];
const LEGACY_RUN_HISTORY_STORAGE_KEYS = ['slaythefish2.runHistory.v1'];

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface VersionedSaveData<T> {
  version: number;
  savedAt: string;
  data: T;
}

export interface StorageAdapter {
  saveRun(run: CurrentRunSave): void;
  loadRun(): CurrentRunSave | undefined;
  clearRun(): void;
  saveSettings(settings: UserSettings): void;
  loadSettings(): UserSettings;
  saveRunHistory(history: RunSummary[]): void;
  loadRunHistory(): RunSummary[];
  exportRunHistoryJson(history?: RunSummary[]): string;
  importRunHistoryJson(json: string): RunSummary[];
}

export const defaultSettings: UserSettings = {
  mode: 'normal',
  themeId: 'normal',
  background: {
    id: 'solid',
    opacity: 0.24,
  },
  compactMode: false,
};

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly storage: StorageLike | undefined = getBrowserStorage()) {}

  saveRun(run: CurrentRunSave): void {
    this.setVersioned(CURRENT_RUN_STORAGE_KEY, run);
  }

  loadRun(): CurrentRunSave | undefined {
    const raw = this.getVersionedValue(CURRENT_RUN_STORAGE_KEY, LEGACY_CURRENT_RUN_STORAGE_KEYS);
    const migrated = this.migrateSaveData(raw);

    if (!migrated) {
      return undefined;
    }

    return normalizeCurrentRunSave(migrated.data);
  }

  clearRun(): void {
    this.storage?.removeItem(CURRENT_RUN_STORAGE_KEY);
    for (const key of LEGACY_CURRENT_RUN_STORAGE_KEYS) {
      this.storage?.removeItem(key);
    }
  }

  saveSettings(settings: UserSettings): void {
    this.setVersioned(SETTINGS_STORAGE_KEY, normalizeSettings(settings));
  }

  loadSettings(): UserSettings {
    const raw = this.getVersionedValue(SETTINGS_STORAGE_KEY, LEGACY_SETTINGS_STORAGE_KEYS);
    const migrated = this.migrateSaveData(raw);
    return normalizeSettings(migrated?.data);
  }

  saveRunHistory(history: RunSummary[]): void {
    this.setVersioned(RUN_HISTORY_STORAGE_KEY, normalizeRunHistory(history));
  }

  loadRunHistory(): RunSummary[] {
    const raw = this.getVersionedValue(RUN_HISTORY_STORAGE_KEY, LEGACY_RUN_HISTORY_STORAGE_KEYS);
    const migrated = this.migrateSaveData(raw);
    return normalizeRunHistory(migrated?.data);
  }

  exportRunHistoryJson(history: RunSummary[] = this.loadRunHistory()): string {
    return JSON.stringify(createVersionedSave(normalizeRunHistory(history)), null, 2);
  }

  importRunHistoryJson(json: string): RunSummary[] {
    const migrated = this.migrateSaveData(json);
    const imported = normalizeRunHistory(migrated?.data);
    this.saveRunHistory(imported);
    return imported;
  }

  migrateSaveData(raw: string | null | undefined): VersionedSaveData<unknown> | undefined {
    return migrateSaveData(raw);
  }

  private setVersioned<T>(key: string, data: T): void {
    this.storage?.setItem(key, JSON.stringify(createVersionedSave(data)));
  }

  private getVersionedValue(key: string, legacyKeys: string[]): string | null | undefined {
    const current = this.storage?.getItem(key);
    if (current) {
      return current;
    }

    for (const legacyKey of legacyKeys) {
      const legacy = this.storage?.getItem(legacyKey);
      if (legacy) {
        return legacy;
      }
    }

    return current;
  }
}

export function getBrowserStorage(): StorageLike | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.localStorage;
}

export function migrateSaveData(
  raw: string | null | undefined,
): VersionedSaveData<unknown> | undefined {
  if (!raw) {
    return undefined;
  }

  const parsed = JSON.parse(raw) as unknown;
  if (isRecord(parsed) && typeof parsed.version === 'number' && 'data' in parsed) {
    return {
      version: parsed.version,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date(0).toISOString(),
      data: parsed.data,
    };
  }

  return createVersionedSave(parsed);
}

export function normalizeSettings(value: unknown): UserSettings {
  const record = isRecord(value) ? value : {};
  const background = isRecord(record.background) ? record.background : {};
  const mode = record.mode === 'stealth' ? 'stealth' : defaultSettings.mode;
  const themeIds = new Set(['normal', 'document', 'dashboard', 'code', 'meeting', 'terminal']);
  const backgroundIds = new Set(['solid', 'stealthGrid', 'documentPaper', 'darkCode', 'custom']);

  return {
    mode,
    themeId: themeIds.has(String(record.themeId))
      ? (record.themeId as UserSettings['themeId'])
      : mode === 'stealth'
        ? 'document'
        : defaultSettings.themeId,
    background: {
      id: backgroundIds.has(String(background.id))
        ? (background.id as UserSettings['background']['id'])
        : defaultSettings.background.id,
      opacity: clampBackgroundOpacity(Number(background.opacity ?? defaultSettings.background.opacity)),
      customImageDataUrl:
        typeof background.customImageDataUrl === 'string' ? background.customImageDataUrl : undefined,
    },
    compactMode: Boolean(record.compactMode),
  };
}

export function normalizeRunHistory(value: unknown): RunSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeRunSummary(entry))
    .filter((entry): entry is RunSummary => Boolean(entry));
}

export function createRunHistoryEntry(
  run: CurrentRunSave['run'],
  status: Exclude<RunSummary['status'], 'active'> = 'defeat',
): RunSummary {
  const completedAt = new Date().toISOString();
  return {
    id: `${run.id}-${status}-${completedAt}`,
    seed: run.seed,
    characterClassId: run.character.id,
    status,
    floorReached: run.floor,
    finalHp: Math.max(0, run.character.hp),
    maxHp: run.character.maxHp,
    gold: run.character.gold,
    deckSize: run.deck.length,
    relicCount: run.relics.length,
    completedAt,
    turnsTaken: run.currentCombat?.turn,
    lowProfileTitle: status === 'victory' ? '流程完成' : '流程中止',
  };
}

function normalizeCurrentRunSave(value: unknown): CurrentRunSave | undefined {
  if (!isRecord(value) || !isRecord(value.run)) {
    return undefined;
  }

  const screen = normalizeScreen(value.screen);
  const pendingReward = isRecord(value.pendingReward)
    ? (value.pendingReward as unknown as CurrentRunSave['pendingReward'])
    : isRecord((value.run as Record<string, unknown>).pendingReward)
      ? ((value.run as Record<string, unknown>).pendingReward as unknown as CurrentRunSave['pendingReward'])
      : undefined;
  const rewards = Array.isArray(value.rewards) ? (value.rewards as RewardOption[]) : [];
  const run = normalizeRunState(value.run, screen, pendingReward);
  const combat = normalizeCombatState(value.combat) ?? run.currentCombat;

  return {
    screen,
    run: {
      ...run,
      currentScreen: screen,
      currentCombat: combat,
      pendingReward,
    },
    combat,
    rewards,
    pendingReward,
    savedAt: typeof value.savedAt === 'string' ? value.savedAt : new Date(0).toISOString(),
  };
}

function normalizeRunState(
  value: unknown,
  screen: GameScreen,
  pendingReward: CurrentRunSave['pendingReward'],
): RunState {
  const record = isRecord(value) ? value : {};
  const character = isRecord(record.character) ? record.character : {};
  const rngSeed = Number.isFinite(Number(record.rngSeed)) ? Number(record.rngSeed) : 0;
  const id = typeof record.id === 'string' ? record.id : `run-${rngSeed}`;
  const seed = typeof record.seed === 'string' ? record.seed : String(rngSeed);

  return {
    id,
    seed,
    rngSeed,
    status:
      record.status === 'victory' || record.status === 'defeat' || record.status === 'active'
        ? record.status
        : 'active',
    currentScreen: screen,
    character: {
      id: 'iron-oath',
      name: typeof character.name === 'string' ? character.name : '铁誓者',
      hp: Number.isFinite(Number(character.hp)) ? Number(character.hp) : 72,
      maxHp: Number.isFinite(Number(character.maxHp)) ? Number(character.maxHp) : 72,
      gold: Number.isFinite(Number(character.gold)) ? Number(character.gold) : 0,
    },
    deck: Array.isArray(record.deck) ? record.deck.filter(isString) : [],
    relics: Array.isArray(record.relics) ? (record.relics.filter(isString) as RelicId[]) : [],
    combatsWon: Number.isFinite(Number(record.combatsWon)) ? Number(record.combatsWon) : 0,
    map: normalizeMapNodes(record.map),
    currentNodeId: typeof record.currentNodeId === 'string' ? record.currentNodeId : undefined,
    pendingReward,
    completedNodeIds: Array.isArray(record.completedNodeIds)
      ? record.completedNodeIds.filter(isString)
      : [],
    act: Number.isFinite(Number(record.act)) ? Number(record.act) : 1,
    floor: Number.isFinite(Number(record.floor)) ? Number(record.floor) : 1,
    runStartedAt:
      typeof record.runStartedAt === 'string' ? record.runStartedAt : new Date(0).toISOString(),
    currentCombat: normalizeCombatState(record.currentCombat),
    combatStartSnapshot: normalizeCombatStartSnapshot(record.combatStartSnapshot),
    lastRestResult: normalizeRestResult(record.lastRestResult),
    currentSummary: isRecord(record.currentSummary)
      ? (record.currentSummary as unknown as RunState['currentSummary'])
      : undefined,
    runLog: Array.isArray(record.runLog) ? record.runLog.filter(isString) : [],
  };
}

function normalizeMapNodes(value: unknown): MapNode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const statuses = new Set(['locked', 'available', 'completed', 'current']);
  const types = new Set(['combat', 'elite', 'rest', 'boss']);

  return value.filter(isRecord).map((node, index) => ({
    id: typeof node.id === 'string' ? node.id : `legacy-node-${index}`,
    index: Number.isFinite(Number(node.index)) ? Number(node.index) : index,
    floor: Number.isFinite(Number(node.floor))
      ? Number(node.floor)
      : Number.isFinite(Number(node.index))
        ? Number(node.index) + 1
        : index + 1,
    type: types.has(String(node.type)) ? (node.type as MapNode['type']) : 'combat',
    label: typeof node.label === 'string' ? node.label : '普通战斗',
    lowProfileLabel:
      typeof node.lowProfileLabel === 'string' ? node.lowProfileLabel : '常规会话',
    status: statuses.has(String(node.status)) ? (node.status as MapNode['status']) : 'locked',
    nextNodeIds: Array.isArray(node.nextNodeIds) ? node.nextNodeIds.filter(isString) : [],
    enemyGroupId: typeof node.enemyGroupId === 'string' ? node.enemyGroupId : undefined,
    bossId: typeof node.bossId === 'string' ? node.bossId : undefined,
  }));
}

function normalizeCombatState(value: unknown): CombatState | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const combat = value as unknown as CombatState;
  return {
    ...combat,
    enemies: Array.isArray(combat.enemies)
      ? combat.enemies.map((enemy) => ({
          ...enemy,
          defeated: Boolean(enemy.defeated) || Number(enemy.hp) <= 0,
        }))
      : [],
    log: Array.isArray(combat.log) ? combat.log.filter(isString) : [],
  };
}

function normalizeCombatStartSnapshot(value: unknown): CombatStartSnapshot | undefined {
  if (!isRecord(value) || !isRecord(value.combat)) {
    return undefined;
  }

  const combat = normalizeCombatState(value.combat);
  if (!combat) {
    return undefined;
  }

  return {
    id: typeof value.id === 'string' ? value.id : 'combat-start-snapshot',
    nodeId: typeof value.nodeId === 'string' ? value.nodeId : '',
    floor: Number.isFinite(Number(value.floor)) ? Number(value.floor) : 1,
    rngSeed: Number.isFinite(Number(value.rngSeed)) ? Number(value.rngSeed) : combat.rngSeed,
    characterHp: Number.isFinite(Number(value.characterHp))
      ? Number(value.characterHp)
      : combat.player.hp,
    map: normalizeMapNodes(value.map),
    combat,
  };
}

function normalizeRestResult(value: unknown): RestResult | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    nodeId: typeof value.nodeId === 'string' ? value.nodeId : '',
    beforeHp: Number.isFinite(Number(value.beforeHp)) ? Number(value.beforeHp) : 0,
    afterHp: Number.isFinite(Number(value.afterHp)) ? Number(value.afterHp) : 0,
    healed: Number.isFinite(Number(value.healed)) ? Number(value.healed) : 0,
  };
}

function normalizeRunSummary(value: unknown): RunSummary | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const legacyResult = value.result === 'victory' || value.result === 'defeat' ? value.result : undefined;
  const status =
    value.status === 'victory' || value.status === 'defeat' || value.status === 'active'
      ? value.status
      : legacyResult ?? 'defeat';

  return {
    id:
      typeof value.id === 'string'
        ? value.id
        : `${String(value.runId ?? 'run')}-${status}-${String(value.completedAt ?? value.endedAt ?? '')}`,
    seed: typeof value.seed === 'string' ? value.seed : String(value.rngSeed ?? value.runId ?? 'unknown'),
    characterClassId: 'iron-oath',
    status,
    floorReached: Number.isFinite(Number(value.floorReached))
      ? Number(value.floorReached)
      : Number.isFinite(Number(value.combatsWon))
        ? Number(value.combatsWon)
        : 0,
    finalHp: Number.isFinite(Number(value.finalHp)) ? Number(value.finalHp) : 0,
    maxHp: Number.isFinite(Number(value.maxHp)) ? Number(value.maxHp) : 72,
    gold: Number.isFinite(Number(value.gold)) ? Number(value.gold) : 0,
    deckSize: Number.isFinite(Number(value.deckSize)) ? Number(value.deckSize) : 0,
    relicCount: Number.isFinite(Number(value.relicCount)) ? Number(value.relicCount) : 0,
    completedAt:
      typeof value.completedAt === 'string'
        ? value.completedAt
        : typeof value.endedAt === 'string'
          ? value.endedAt
          : new Date(0).toISOString(),
    turnsTaken: Number.isFinite(Number(value.turnsTaken)) ? Number(value.turnsTaken) : undefined,
    lowProfileTitle:
      typeof value.lowProfileTitle === 'string'
        ? value.lowProfileTitle
        : status === 'victory'
          ? '流程完成'
          : '流程中止',
  };
}

function normalizeScreen(value: unknown): GameScreen {
  const screens = new Set<GameScreen>([
    'mainMenu',
    'map',
    'combat',
    'reward',
    'rest',
    'runHistory',
    'settings',
    'victory',
    'defeat',
  ]);

  if (screens.has(value as GameScreen)) {
    return value as GameScreen;
  }

  return value === 'menu' ? 'mainMenu' : 'combat';
}

function createVersionedSave<T>(data: T): VersionedSaveData<T> {
  return {
    version: SAVE_DATA_VERSION,
    savedAt: new Date().toISOString(),
    data,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}
