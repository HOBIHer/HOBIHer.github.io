import type {
  AscensionProgress,
  CardCost,
  CombatStartSnapshot,
  CombatState,
  CardInstance,
  CurrentRunSave,
  EventStartSnapshot,
  EventState,
  GameScreen,
  MapNode,
  PotionInstance,
  RelicId,
  RestResult,
  RewardOption,
  RunState,
  RunSummary,
  ShopStartSnapshot,
  ShopState,
  UserSettings,
} from '../game/types';
import { clampBackgroundOpacity } from './backgroundAdapter';

export const SAVE_DATA_VERSION = 5;
export const CURRENT_RUN_STORAGE_KEY = 'slaythefish2.currentRun.v5';
export const SETTINGS_STORAGE_KEY = 'slaythefish2.settings.v5';
export const RUN_HISTORY_STORAGE_KEY = 'slaythefish2.runHistory.v5';
export const ASCENSION_PROGRESS_STORAGE_KEY = 'slaythefish2.ascensionProgress.v5';

const LEGACY_CURRENT_RUN_STORAGE_KEYS = ['slaythefish2.currentRun.v4', 'slaythefish2.currentRun.v3', 'slaythefish2.currentRun.v2', 'slaythefish2.currentRun.v1'];
const LEGACY_SETTINGS_STORAGE_KEYS = ['slaythefish2.settings.v4', 'slaythefish2.settings.v3', 'slaythefish2.settings.v2', 'slaythefish2.settings.v1'];
const LEGACY_RUN_HISTORY_STORAGE_KEYS = ['slaythefish2.runHistory.v4', 'slaythefish2.runHistory.v3', 'slaythefish2.runHistory.v2', 'slaythefish2.runHistory.v1'];
const LEGACY_ASCENSION_PROGRESS_STORAGE_KEYS = ['slaythefish2.ascensionProgress.v4'];

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
  saveAscensionProgress(progress: AscensionProgress): void;
  loadAscensionProgress(): AscensionProgress;
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

  saveAscensionProgress(progress: AscensionProgress): void {
    this.setVersioned(ASCENSION_PROGRESS_STORAGE_KEY, normalizeAscensionProgress(progress));
  }

  loadAscensionProgress(): AscensionProgress {
    const raw = this.getVersionedValue(
      ASCENSION_PROGRESS_STORAGE_KEY,
      LEGACY_ASCENSION_PROGRESS_STORAGE_KEYS,
    );
    const migrated = this.migrateSaveData(raw);
    return normalizeAscensionProgress(migrated?.data);
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
    ascensionLevel: run.ascensionLevel,
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
    deck: normalizeDeck(record.deck, id),
    relics: Array.isArray(record.relics) ? (record.relics.filter(isString) as RelicId[]) : [],
    potions: normalizePotions(record.potions),
    potionSlots: Number.isFinite(Number(record.potionSlots)) ? Number(record.potionSlots) : 3,
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
    ascensionLevel: normalizeAscensionLevel(record.ascensionLevel),
    shops: normalizeShops(record.shops),
    currentShop: normalizeShopState(record.currentShop),
    shopStartSnapshot: normalizeShopStartSnapshot(record.shopStartSnapshot),
    currentEvent: normalizeEventState(record.currentEvent),
    eventStartSnapshot: normalizeEventStartSnapshot(record.eventStartSnapshot),
    seenEventIds: Array.isArray(record.seenEventIds) ? record.seenEventIds.filter(isString) : [],
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
  const types = new Set(['combat', 'elite', 'event', 'rest', 'shop', 'boss']);

  const normalized = value.filter(isRecord).map((node, index) => {
    const layer = Number.isFinite(Number(node.layer))
      ? Number(node.layer)
      : Number.isFinite(Number(node.floor))
        ? Number(node.floor) - 1
        : Number.isFinite(Number(node.index))
          ? Number(node.index)
          : index;
    const rawStatus = statuses.has(String(node.status)) ? (node.status as MapNode['status']) : 'locked';

    return {
      id: typeof node.id === 'string' ? node.id : `legacy-node-${index}`,
      index: Number.isFinite(Number(node.index)) ? Number(node.index) : index,
      floor: Number.isFinite(Number(node.floor)) ? Number(node.floor) : layer + 1,
      layer,
      x: Number.isFinite(Number(node.x)) ? Number(node.x) : index,
      y: Number.isFinite(Number(node.y)) ? Number(node.y) : layer,
      type: types.has(String(node.type)) ? (node.type as MapNode['type']) : 'combat',
      label: typeof node.label === 'string' ? node.label : '普通战斗',
      lowProfileLabel:
        typeof node.lowProfileLabel === 'string' ? node.lowProfileLabel : '常规会话',
      status: rawStatus === 'current' ? 'available' : rawStatus,
      parentNodeIds: Array.isArray(node.parentNodeIds) ? node.parentNodeIds.filter(isString) : [],
      nextNodeIds: Array.isArray(node.nextNodeIds) ? node.nextNodeIds.filter(isString) : [],
      enemyGroupId: typeof node.enemyGroupId === 'string' ? node.enemyGroupId : undefined,
      bossId: typeof node.bossId === 'string' ? node.bossId : undefined,
    };
  });

  return normalized.map((node) => ({
    ...node,
    parentNodeIds:
      node.parentNodeIds.length > 0
        ? node.parentNodeIds
        : normalized.filter((candidate) => candidate.nextNodeIds.includes(node.id)).map((candidate) => candidate.id),
  }));
}

function normalizeCombatState(value: unknown): CombatState | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const combat = value as unknown as CombatState;
  return {
    ...combat,
    ascensionLevel: normalizeAscensionLevel(combat.ascensionLevel),
    turnStats: {
      cardsPlayed: Number(combat.turnStats?.cardsPlayed ?? 0),
      attacksPlayed: Number(combat.turnStats?.attacksPlayed ?? 0),
      skillsPlayed: Number(combat.turnStats?.skillsPlayed ?? 0),
      powersPlayed: Number(combat.turnStats?.powersPlayed ?? 0),
      cardBlockGains: Number(combat.turnStats?.cardBlockGains ?? 0),
      cardsExhausted: Number(combat.turnStats?.cardsExhausted ?? 0),
      lostHpThisTurn: Boolean(combat.turnStats?.lostHpThisTurn),
      killedEnemyIds: Array.isArray(combat.turnStats?.killedEnemyIds)
        ? combat.turnStats.killedEnemyIds.filter(isString)
        : [],
    },
    combatStats: {
      hpLossEvents: Number(combat.combatStats?.hpLossEvents ?? 0),
      goldLost: Number(combat.combatStats?.goldLost ?? 0),
    },
    enemies: Array.isArray(combat.enemies)
      ? combat.enemies.map((enemy) => ({
          ...enemy,
          defeated: Boolean(enemy.defeated) || Number(enemy.hp) <= 0,
        }))
      : [],
    drawPile: normalizeDeck(combat.drawPile, combat.id),
    hand: normalizeDeck(combat.hand, combat.id),
    discardPile: normalizeDeck(combat.discardPile, combat.id),
    exhaustPile: normalizeDeck(combat.exhaustPile, combat.id),
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
    potions: normalizePotions(value.potions),
    combat,
  };
}

function normalizeRestResult(value: unknown): RestResult | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    nodeId: typeof value.nodeId === 'string' ? value.nodeId : '',
    action: value.action === 'upgrade' ? 'upgrade' : 'rest',
    beforeHp: Number.isFinite(Number(value.beforeHp)) ? Number(value.beforeHp) : 0,
    afterHp: Number.isFinite(Number(value.afterHp)) ? Number(value.afterHp) : 0,
    healed: Number.isFinite(Number(value.healed)) ? Number(value.healed) : 0,
    upgradedCardInstanceId:
      typeof value.upgradedCardInstanceId === 'string' ? value.upgradedCardInstanceId : undefined,
    upgradedCardDefinitionId:
      typeof value.upgradedCardDefinitionId === 'string' ? value.upgradedCardDefinitionId : undefined,
    upgradedCardName: typeof value.upgradedCardName === 'string' ? value.upgradedCardName : undefined,
    upgradedLowProfileName:
      typeof value.upgradedLowProfileName === 'string' ? value.upgradedLowProfileName : undefined,
    upgradeBeforeDescription:
      typeof value.upgradeBeforeDescription === 'string' ? value.upgradeBeforeDescription : undefined,
    upgradeAfterDescription:
      typeof value.upgradeAfterDescription === 'string' ? value.upgradeAfterDescription : undefined,
    upgradeBeforeLowProfileDescription:
      typeof value.upgradeBeforeLowProfileDescription === 'string'
        ? value.upgradeBeforeLowProfileDescription
        : undefined,
    upgradeAfterLowProfileDescription:
      typeof value.upgradeAfterLowProfileDescription === 'string'
        ? value.upgradeAfterLowProfileDescription
        : undefined,
    upgradeBeforeCost: normalizeCardCost(value.upgradeBeforeCost),
    upgradeAfterCost: normalizeCardCost(value.upgradeAfterCost),
  };
}

function normalizeCardCost(value: unknown): CardCost | undefined {
  if (value === 'X' || value === 'unplayable') {
    return value;
  }

  if (Number.isFinite(Number(value))) {
    return Math.max(0, Number(value));
  }

  return undefined;
}

function normalizeDeck(value: unknown, prefix = 'deck'): CardInstance[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((card, index): CardInstance | undefined => {
      if (typeof card === 'string') {
        return {
          definitionId: card,
          instanceId: `${prefix}-${card}-${index}`,
          upgraded: false,
        };
      }

      if (!isRecord(card) || typeof card.definitionId !== 'string') {
        return undefined;
      }

      return {
        definitionId: card.definitionId,
        instanceId: typeof card.instanceId === 'string' ? card.instanceId : `${prefix}-${card.definitionId}-${index}`,
        upgraded: Boolean(card.upgraded),
        costOverride: Number.isFinite(Number(card.costOverride)) ? Number(card.costOverride) : undefined,
        exhaustOnPlay: typeof card.exhaustOnPlay === 'boolean' ? card.exhaustOnPlay : undefined,
        damageBonus: Number.isFinite(Number(card.damageBonus)) ? Number(card.damageBonus) : undefined,
        replay: Number.isFinite(Number(card.replay)) ? Number(card.replay) : undefined,
        remainingCombats: Number.isFinite(Number(card.remainingCombats)) ? Number(card.remainingCombats) : undefined,
      };
    })
    .filter((card): card is CardInstance => Boolean(card));
}

function normalizePotions(value: unknown): PotionInstance[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((potion, index): PotionInstance | undefined => {
      if (typeof potion === 'string') {
        return {
          definitionId: potion,
          instanceId: `potion-${potion}-${index}`,
        };
      }

      if (!isRecord(potion) || typeof potion.definitionId !== 'string') {
        return undefined;
      }

      return {
        definitionId: potion.definitionId,
        instanceId:
          typeof potion.instanceId === 'string' ? potion.instanceId : `potion-${potion.definitionId}-${index}`,
      };
    })
    .filter((potion): potion is PotionInstance => Boolean(potion));
}

function normalizeShops(value: unknown): Record<string, ShopState> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([nodeId, shop]) => [nodeId, normalizeShopState(shop)] as const)
      .filter((entry): entry is readonly [string, ShopState] => Boolean(entry[1])),
  );
}

function normalizeShopState(value: unknown): ShopState | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    nodeId: typeof value.nodeId === 'string' ? value.nodeId : '',
    removeCardPrice: Number.isFinite(Number(value.removeCardPrice)) ? Number(value.removeCardPrice) : 75,
    items: Array.isArray(value.items)
      ? value.items.filter(isRecord).map((item, index) => ({
          id: typeof item.id === 'string' ? item.id : `shop-item-${index}`,
          type:
            item.type === 'card' || item.type === 'relic' || item.type === 'potion' || item.type === 'remove'
              ? item.type
              : 'card',
          refId: typeof item.refId === 'string' ? item.refId : undefined,
          price: Number.isFinite(Number(item.price)) ? Number(item.price) : 0,
          sold: Boolean(item.sold),
        }))
      : [],
  };
}

function normalizeShopStartSnapshot(value: unknown): ShopStartSnapshot | undefined {
  if (!isRecord(value) || !isRecord(value.run)) {
    return undefined;
  }

  return {
    id: typeof value.id === 'string' ? value.id : 'shop-start-snapshot',
    nodeId: typeof value.nodeId === 'string' ? value.nodeId : '',
    shopSeed: typeof value.shopSeed === 'string' ? value.shopSeed : '',
    run: normalizeRunState(value.run, 'shop', undefined),
  };
}

function normalizeEventStartSnapshot(value: unknown): EventStartSnapshot | undefined {
  if (!isRecord(value) || !isRecord(value.run)) {
    return undefined;
  }

  return {
    id: typeof value.id === 'string' ? value.id : 'event-start-snapshot',
    eventSeed: typeof value.eventSeed === 'string' ? value.eventSeed : '',
    run: normalizeRunState(value.run, 'event', undefined),
  };
}

function normalizeEventState(value: unknown): EventState | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    id: typeof value.id === 'string' ? value.id : 'event',
    eventId: typeof value.eventId === 'string' ? value.eventId : '',
    kind: value.kind === 'minor' ? 'minor' : 'major',
    nodeId: typeof value.nodeId === 'string' ? value.nodeId : undefined,
    seed: typeof value.seed === 'string' ? value.seed : '',
    name: typeof value.name === 'string' ? value.name : '事件',
    lowProfileName: typeof value.lowProfileName === 'string' ? value.lowProfileName : '事项',
    description: typeof value.description === 'string' ? value.description : '',
    lowProfileDescription:
      typeof value.lowProfileDescription === 'string' ? value.lowProfileDescription : '',
    choices: Array.isArray(value.choices) ? (value.choices as EventState['choices']) : [],
    resultLog: Array.isArray(value.resultLog) ? value.resultLog.filter(isString) : [],
  };
}

function normalizeAscensionProgress(value: unknown): AscensionProgress {
  const record = isRecord(value) ? value : {};
  return {
    unlockedLevel: normalizeAscensionLevel(record.unlockedLevel),
  };
}

function normalizeAscensionLevel(value: unknown) {
  const level = Number.isFinite(Number(value)) ? Math.floor(Number(value)) : 0;
  return Math.min(10, Math.max(0, level)) as AscensionProgress['unlockedLevel'];
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
    ascensionLevel: normalizeAscensionLevel(value.ascensionLevel),
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
    'shop',
    'event',
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
