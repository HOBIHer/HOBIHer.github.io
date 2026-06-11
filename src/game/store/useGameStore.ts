import { create } from 'zustand';
import {
  clearSettings,
  defaultSettings,
  loadSettings,
  saveSettings,
} from '../../adapters/settingsAdapter';
import { LocalStorageAdapter } from '../../adapters/storageAdapter';
import {
  completeCombatNode,
  enterMapNode as enterRunMapNode,
  failRun,
  leaveRestNode,
  restartCombatFromSnapshot,
  restartEventFromSnapshot,
  restartShopFromSnapshot,
  resolveReward as resolveRunReward,
  restAtNode,
  skipCardReward,
  startNewRun as startEngineRun,
  upgradeCardAtNode,
} from '../engine/run';
import { resolveEventChoice as resolveRunEventChoice } from '../engine/events';
import {
  endPlayerTurn,
  isCombatLost,
  isCombatWon,
  playCard as playCombatCard,
} from '../engine/combat';
import { triggerDeathWardPotion, usePotion as useRunPotion } from '../engine/potions';
import { buyShopItem as buyRunShopItem, leaveShopNode } from '../engine/shop';
import { clampAscensionLevel, unlockNextAscensionLevel } from '../engine/ascension';
import type {
  AscensionLevel,
  AscensionProgress,
  BackgroundId,
  CombatState,
  CurrentRunSave,
  GameMode,
  GameScreen,
  RewardBundle,
  RewardOption,
  RunState,
  RunSummary,
  ThemeId,
  UserSettings,
} from '../types';

type ReturnableScreen = Exclude<GameScreen, 'settings'>;

interface GameStore {
  screen: GameScreen;
  settingsReturnScreen: ReturnableScreen;
  run?: RunState;
  combat?: CombatState;
  rewards: RewardOption[];
  pendingReward?: RewardBundle;
  settings: UserSettings;
  runHistory: RunSummary[];
  lastRunSummary?: RunSummary;
  canContinueRun: boolean;
  exportJson: string;
  importJson: string;
  importError?: string;
  ascensionProgress: AscensionProgress;
  selectedAscensionLevel: AscensionLevel;
  setSelectedAscensionLevel: (level: AscensionLevel) => void;
  startNewRun: (seed?: string | number, ascensionLevel?: AscensionLevel) => void;
  continueRun: () => void;
  enterMapNode: (nodeId: string) => void;
  playCard: (cardInstanceId: string, targetEnemyId?: string) => void;
  endTurn: () => void;
  chooseReward: (rewardId: string) => void;
  claimReward: (selectedCardId?: string, selectedRelicId?: string) => void;
  skipReward: () => void;
  restAtCurrentNode: () => void;
  upgradeCardAtCurrentNode: (cardInstanceId: string) => void;
  returnToMapAfterRest: () => void;
  usePotion: (potionInstanceId: string, targetEnemyId?: string) => void;
  buyShopItem: (itemId: string) => void;
  leaveShop: () => void;
  chooseEventChoice: (choiceId: string) => void;
  returnToMenu: () => void;
  openRunHistory: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  setGameMode: (mode: GameMode) => void;
  toggleGameMode: () => void;
  setTheme: (themeId: ThemeId) => void;
  setBackgroundId: (backgroundId: BackgroundId) => void;
  setCustomBackground: (dataUrl: string) => void;
  setBackgroundOpacity: (opacity: number) => void;
  setCompactMode: (compactMode: boolean) => void;
  clearLocalSettings: () => void;
  clearLocalRun: () => void;
  exportRunHistory: () => void;
  setImportJson: (json: string) => void;
  importRunHistory: () => void;
}

const storageAdapter = new LocalStorageAdapter();
const savedRun = resumeCurrentRunSave(storageAdapter.loadRun());
const savedAscensionProgress = storageAdapter.loadAscensionProgress();
const initialScreen = savedRun?.screen ?? 'mainMenu';

export const useGameStore = create<GameStore>((set, get) => ({
  screen: initialScreen,
  settingsReturnScreen: initialScreen === 'settings' ? 'mainMenu' : initialScreen,
  run: savedRun?.run,
  combat: savedRun?.combat ?? savedRun?.run.currentCombat,
  rewards: savedRun?.rewards ?? createRewardOptions(savedRun?.pendingReward ?? savedRun?.run.pendingReward),
  pendingReward: savedRun?.pendingReward ?? savedRun?.run.pendingReward,
  settings: loadSettings(),
  runHistory: storageAdapter.loadRunHistory(),
  lastRunSummary: savedRun?.run.currentSummary,
  canContinueRun: Boolean(savedRun?.run.status === 'active'),
  exportJson: '',
  importJson: '',
  ascensionProgress: savedAscensionProgress,
  selectedAscensionLevel: savedAscensionProgress.unlockedLevel,
  setSelectedAscensionLevel: (level) => {
    const unlocked = get().ascensionProgress.unlockedLevel;
    set({ selectedAscensionLevel: clampAscensionLevel(Math.min(level, unlocked)) });
  },
  startNewRun: (seed, ascensionLevel) => {
    const unlocked = get().ascensionProgress.unlockedLevel;
    const selected = clampAscensionLevel(Math.min(ascensionLevel ?? get().selectedAscensionLevel, unlocked));
    const run = startEngineRun(seed, selected);
    const nextState = stateFromRun(run);
    set(nextState);
    saveCurrentRun({ ...get(), ...nextState });
  },
  continueRun: () => {
    const saved = resumeCurrentRunSave(storageAdapter.loadRun());
    const fallbackRun = get().run?.status === 'active' ? get().run : undefined;
    const fallbackSave = fallbackRun
      ? resumeCurrentRunSave({
          screen: fallbackRun.currentScreen,
          run: fallbackRun,
          combat: fallbackRun.currentCombat,
          rewards: get().rewards,
          pendingReward: fallbackRun.pendingReward,
          savedAt: new Date().toISOString(),
        })
      : undefined;
    const currentRun = saved ?? fallbackSave;

    if (!currentRun || currentRun.run.status !== 'active') {
      set({ canContinueRun: false });
      return;
    }

    const nextState = stateFromRun(currentRun.run);
    set({
      ...nextState,
      screen: currentRun.screen,
      combat: currentRun.combat ?? currentRun.run.currentCombat,
      rewards: currentRun.rewards,
      pendingReward: currentRun.pendingReward ?? currentRun.run.pendingReward,
      settingsReturnScreen: currentRun.screen === 'settings' ? 'mainMenu' : currentRun.screen,
      canContinueRun: true,
    });
    saveCurrentRun({
      ...get(),
      ...nextState,
      screen: currentRun.screen,
      combat: currentRun.combat ?? currentRun.run.currentCombat,
      rewards: currentRun.rewards,
      pendingReward: currentRun.pendingReward ?? currentRun.run.pendingReward,
    });
  },
  enterMapNode: (nodeId) => {
    const { run } = get();
    if (!run) {
      return;
    }

    const nextRun = enterRunMapNode(run, nodeId);
    const nextState = stateFromRun(nextRun);
    set(nextState);
    saveCurrentRun({ ...get(), ...nextState });
  },
  playCard: (cardInstanceId, targetEnemyId) => {
    const { combat, run } = get();
    if (!combat || !run) {
      return;
    }

    const nextCombat = playCombatCard(combat, cardInstanceId, targetEnemyId);
    handleCombatResult({ ...run, currentCombat: nextCombat }, nextCombat, set, get);
  },
  endTurn: () => {
    const { combat, run } = get();
    if (!combat || !run) {
      return;
    }

    const nextCombat = endPlayerTurn(combat);
    handleCombatResult({ ...run, currentCombat: nextCombat }, nextCombat, set, get);
  },
  chooseReward: (rewardId) => {
    const { pendingReward, rewards } = get();
    const selectedCardId = pendingReward?.cardChoices.includes(rewardId)
      ? rewardId
      : rewards.find((reward) => reward.id === rewardId)?.cardId;
    get().claimReward(selectedCardId);
  },
  claimReward: (selectedCardId, selectedRelicId) => {
    const { run } = get();
    if (!run) {
      return;
    }

    const nextRun = resolveRunReward(run, selectedCardId, selectedRelicId);
    commitRunTransition(run, nextRun, set, get);
  },
  skipReward: () => {
    const { run } = get();
    if (!run) {
      return;
    }

    const nextRun = skipCardReward(run);
    commitRunTransition(run, nextRun, set, get);
  },
  restAtCurrentNode: () => {
    const { run } = get();
    if (!run) {
      return;
    }

    const nextRun = restAtNode(run);
    const nextState = stateFromRun(nextRun);
    set(nextState);
    saveCurrentRun({ ...get(), ...nextState });
  },
  upgradeCardAtCurrentNode: (cardInstanceId) => {
    const { run } = get();
    if (!run) {
      return;
    }

    const nextRun = upgradeCardAtNode(run, cardInstanceId);
    const nextState = stateFromRun(nextRun);
    set(nextState);
    saveCurrentRun({ ...get(), ...nextState });
  },
  returnToMapAfterRest: () => {
    const { run } = get();
    if (!run) {
      return;
    }

    const nextRun = leaveRestNode(run);
    const nextState = stateFromRun(nextRun);
    set(nextState);
    saveCurrentRun({ ...get(), ...nextState });
  },
  usePotion: (potionInstanceId, targetEnemyId) => {
    const { run, combat, screen } = get();
    if (!run || screen !== 'combat') {
      return;
    }

    const result = useRunPotion(run, combat, potionInstanceId, targetEnemyId);
    const nextRun = {
      ...result.run,
      currentCombat: result.combat,
      currentScreen: 'combat' as const,
    };
    const nextState = stateFromRun(nextRun);
    set(nextState);
    saveCurrentRun({ ...get(), ...nextState });
  },
  buyShopItem: (itemId) => {
    const { run, screen } = get();
    if (!run || screen !== 'shop') {
      return;
    }

    const nextRun = buyRunShopItem(run, itemId);
    const nextState = stateFromRun(nextRun);
    set(nextState);
    saveCurrentRun({ ...get(), ...nextState });
  },
  leaveShop: () => {
    const { run, screen } = get();
    if (!run || screen !== 'shop') {
      return;
    }

    const nextRun = leaveShopNode(run);
    const nextState = stateFromRun(nextRun);
    set(nextState);
    saveCurrentRun({ ...get(), ...nextState });
  },
  chooseEventChoice: (choiceId) => {
    const { run, screen } = get();
    if (!run || screen !== 'event') {
      return;
    }

    const nextRun = resolveRunEventChoice(run, choiceId);
    const nextState = stateFromRun(nextRun);
    set(nextState);
    saveCurrentRun({ ...get(), ...nextState });
  },
  returnToMenu: () => {
    const state = get();
    if (state.run?.status === 'active' && isSaveableScreen(state.screen)) {
      saveCurrentRun(createDeterministicContinueState(state));
      set({
        screen: 'mainMenu',
        settingsReturnScreen: 'mainMenu',
        combat: undefined,
        canContinueRun: true,
      });
      return;
    }

    storageAdapter.clearRun();
    set({
      screen: 'mainMenu',
      settingsReturnScreen: 'mainMenu',
      run: undefined,
      combat: undefined,
      rewards: [],
      pendingReward: undefined,
      lastRunSummary: undefined,
      canContinueRun: false,
    });
  },
  openRunHistory: () => {
    set({ screen: 'runHistory' });
  },
  openSettings: () => {
    const screen = get().screen;
    set({
      screen: 'settings',
      settingsReturnScreen: screen === 'settings' ? get().settingsReturnScreen : screen,
    });
  },
  closeSettings: () => {
    set({ screen: get().settingsReturnScreen });
  },
  setGameMode: (mode) => {
    updateSettings(set, get, (settings) => ({
      ...settings,
      mode,
      themeId:
        mode === 'stealth' && settings.themeId === 'normal'
          ? 'document'
          : mode === 'normal'
            ? 'normal'
            : settings.themeId,
    }));
  },
  toggleGameMode: () => {
    const nextMode = get().settings.mode === 'normal' ? 'stealth' : 'normal';
    get().setGameMode(nextMode);
  },
  setTheme: (themeId) => {
    updateSettings(set, get, (settings) => ({
      ...settings,
      themeId,
      mode: themeId === 'normal' ? 'normal' : settings.mode,
    }));
  },
  setBackgroundId: (backgroundId) => {
    updateSettings(set, get, (settings) => ({
      ...settings,
      background: {
        ...settings.background,
        id: backgroundId,
      },
    }));
  },
  setCustomBackground: (dataUrl) => {
    updateSettings(set, get, (settings) => ({
      ...settings,
      background: {
        ...settings.background,
        id: 'custom',
        customImageDataUrl: dataUrl,
      },
    }));
  },
  setBackgroundOpacity: (opacity) => {
    updateSettings(set, get, (settings) => ({
      ...settings,
      background: {
        ...settings.background,
        opacity,
      },
    }));
  },
  setCompactMode: (compactMode) => {
    updateSettings(set, get, (settings) => ({
      ...settings,
      compactMode,
    }));
  },
  clearLocalSettings: () => {
    clearSettings();
    set({ settings: defaultSettings });
  },
  clearLocalRun: () => {
    storageAdapter.clearRun();
    set({
      screen: 'mainMenu',
      settingsReturnScreen: 'mainMenu',
      run: undefined,
      combat: undefined,
      rewards: [],
      pendingReward: undefined,
      canContinueRun: false,
    });
  },
  exportRunHistory: () => {
    set({ exportJson: storageAdapter.exportRunHistoryJson(get().runHistory), importError: undefined });
  },
  setImportJson: (json) => {
    set({ importJson: json, importError: undefined });
  },
  importRunHistory: () => {
    try {
      const runHistory = storageAdapter.importRunHistoryJson(get().importJson);
      set({
        runHistory,
        exportJson: storageAdapter.exportRunHistoryJson(runHistory),
        importError: undefined,
      });
    } catch {
      set({ importError: '导入失败：JSON 格式无效。' });
    }
  },
}));

function handleCombatResult(
  run: RunState,
  combat: CombatState,
  set: (partial: Partial<GameStore>) => void,
  get: () => GameStore,
): void {
  const previousGoldLost = get().combat?.combatStats.goldLost ?? 0;
  const nextGoldLost = combat.combatStats.goldLost ?? 0;
  const goldLoss = Math.max(0, nextGoldLost - previousGoldLost);
  const runAfterCombatCosts =
    goldLoss > 0
      ? {
          ...run,
          character: {
            ...run.character,
            gold: Math.max(0, run.character.gold - goldLoss),
          },
        }
      : run;

  const deathWard = triggerDeathWardPotionIfNeeded(runAfterCombatCosts, combat);
  if (deathWard.triggered) {
    const nextState = stateFromRun(deathWard.run);
    set(nextState);
    saveCurrentRun({ ...get(), ...nextState });
    return;
  }

  if (isCombatWon(combat)) {
    const nextRun = completeCombatNode(runAfterCombatCosts);
    const nextState = stateFromRun(nextRun);
    set(nextState);
    saveCurrentRun({ ...get(), ...nextState });
    return;
  }

  if (isCombatLost(combat)) {
    const nextRun = failRun(runAfterCombatCosts);
    commitRunTransition(run, nextRun, set, get);
    return;
  }

  const nextRun = {
    ...runAfterCombatCosts,
    currentCombat: combat,
    currentScreen: 'combat' as const,
  };
  const nextState = stateFromRun(nextRun);
  set(nextState);
  saveCurrentRun({ ...get(), ...nextState });
}

function triggerDeathWardPotionIfNeeded(
  run: RunState,
  combat: CombatState,
): { run: RunState; combat: CombatState; triggered: boolean } {
  return isCombatLost(combat) ? triggerDeathWardPotion(run, combat) : { run, combat, triggered: false };
}

function commitRunTransition(
  previousRun: RunState,
  nextRun: RunState,
  set: (partial: Partial<GameStore>) => void,
  get: () => GameStore,
): void {
  const nextState = stateFromRun(nextRun);

  if (previousRun.status === 'active' && nextRun.status !== 'active' && nextRun.currentSummary) {
    const ascensionProgress =
      nextRun.status === 'victory'
        ? {
            unlockedLevel: unlockNextAscensionLevel(get().ascensionProgress.unlockedLevel),
          }
        : get().ascensionProgress;
    const runHistory = recordRunSummary(nextRun.currentSummary, get().runHistory);
    set({
      ...nextState,
      runHistory,
      lastRunSummary: nextRun.currentSummary,
      canContinueRun: false,
      ascensionProgress,
      selectedAscensionLevel: ascensionProgress.unlockedLevel,
    });
    storageAdapter.saveAscensionProgress(ascensionProgress);
    storageAdapter.clearRun();
    return;
  }

  set(nextState);
  saveCurrentRun({ ...get(), ...nextState });
}

function stateFromRun(run: RunState): Partial<GameStore> {
  return {
    screen: run.currentScreen,
    run,
    combat: run.currentCombat,
    rewards: createRewardOptions(run.pendingReward),
    pendingReward: run.pendingReward,
    lastRunSummary: run.currentSummary,
    canContinueRun: run.status === 'active',
  };
}

function resumeCurrentRunSave(save: CurrentRunSave | undefined): CurrentRunSave | undefined {
  if (!save) {
    return undefined;
  }

  if (save.screen !== 'combat' || !save.run.combatStartSnapshot) {
    return save;
  }

  const run = restartCombatFromSnapshot(save.run);
  return {
    ...save,
    screen: 'combat',
    run,
    combat: run.currentCombat,
    rewards: [],
    pendingReward: undefined,
  };
}

function createDeterministicContinueState(
  state: Pick<GameStore, 'screen' | 'run' | 'combat' | 'rewards' | 'pendingReward'>,
): Pick<GameStore, 'screen' | 'run' | 'combat' | 'rewards' | 'pendingReward'> {
  if (state.screen === 'shop' && state.run?.shopStartSnapshot) {
    const run = restartShopFromSnapshot(state.run);
    return {
      screen: 'shop',
      run,
      combat: undefined,
      rewards: [],
      pendingReward: undefined,
    };
  }

  if (state.screen === 'event' && state.run?.eventStartSnapshot) {
    const run = restartEventFromSnapshot(state.run);
    return {
      screen: 'event',
      run,
      combat: undefined,
      rewards: [],
      pendingReward: undefined,
    };
  }

  return state;
}

function createRewardOptions(reward: RewardBundle | undefined): RewardOption[] {
  if (!reward) {
    return [];
  }

  return reward.cardChoices.map((cardId) => ({
    id: `${reward.id}-${cardId}`,
    type: 'card',
    cardId,
  }));
}

function recordRunSummary(summary: RunSummary, history: RunSummary[]): RunSummary[] {
  const runHistory = history.some((entry) => entry.id === summary.id) ? history : [summary, ...history];
  storageAdapter.saveRunHistory(runHistory);
  return runHistory;
}

function updateSettings(
  set: (partial: Partial<GameStore>) => void,
  get: () => GameStore,
  update: (settings: UserSettings) => UserSettings,
): void {
  const settings = update(get().settings);
  saveSettings(settings);
  set({ settings });
}

function saveCurrentRun(state: Pick<GameStore, 'screen' | 'run' | 'combat' | 'rewards' | 'pendingReward'>): void {
  if (!state.run || state.run.status !== 'active' || !isSaveableScreen(state.screen)) {
    return;
  }

  const currentRun: CurrentRunSave = {
    screen: state.screen,
    run: state.run,
    combat: state.combat,
    rewards: state.rewards,
    pendingReward: state.pendingReward,
    savedAt: new Date().toISOString(),
  };
  storageAdapter.saveRun(currentRun);
}

function isSaveableScreen(screen: GameScreen): boolean {
  return screen === 'map' || screen === 'combat' || screen === 'reward' || screen === 'rest' || screen === 'shop' || screen === 'event';
}
