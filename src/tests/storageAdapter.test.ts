import { afterEach, describe, expect, it, vi } from 'vitest';
import { CloudSyncAdapterPlaceholder } from '../adapters/cloudSyncAdapterPlaceholder';
import {
  CURRENT_RUN_STORAGE_KEY,
  LocalStorageAdapter,
  RUN_HISTORY_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  SAVE_DATA_VERSION,
  type StorageLike,
} from '../adapters/storageAdapter';
import { startCombat, startRun } from '../game/engine/combat';
import type { CurrentRunSave, RunSummary, UserSettings } from '../game/types';

describe('local storage adapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves settings to localStorage with a version field', () => {
    const storage = createMemoryStorage();
    const adapter = new LocalStorageAdapter(storage);
    const settings: UserSettings = {
      mode: 'stealth',
      themeId: 'terminal',
      background: {
        id: 'custom',
        opacity: 0.5,
        customImageDataUrl: 'data:image/png;base64,local',
      },
      compactMode: true,
    };

    adapter.saveSettings(settings);
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    const loaded = adapter.loadSettings();

    expect(raw).toContain(`"version":${SAVE_DATA_VERSION}`);
    expect(loaded).toEqual(settings);
  });

  it('saves and loads the current run', () => {
    const storage = createMemoryStorage();
    const adapter = new LocalStorageAdapter(storage);
    const run = startRun('save-run');
    const started = startCombat(run);
    const currentRun: CurrentRunSave = {
      screen: 'combat',
      run: started.run,
      combat: started.combat,
      rewards: [],
      savedAt: '2026-06-08T00:00:00.000Z',
    };

    adapter.saveRun(currentRun);
    const loaded = adapter.loadRun();

    expect(storage.getItem(CURRENT_RUN_STORAGE_KEY)).toContain(`"version":${SAVE_DATA_VERSION}`);
    expect(loaded?.run.id).toBe(currentRun.run.id);
    expect(loaded?.combat?.id).toBe(currentRun.combat?.id);
    expect(loaded?.screen).toBe('combat');
  });

  it('exports run history JSON', () => {
    const storage = createMemoryStorage();
    const adapter = new LocalStorageAdapter(storage);
    const history = [createHistoryEntry('run-a')];

    adapter.saveRunHistory(history);
    const exported = adapter.exportRunHistoryJson();
    const parsed = JSON.parse(exported) as { version: number; data: RunSummary[] };

    expect(storage.getItem(RUN_HISTORY_STORAGE_KEY)).toContain(`"version":${SAVE_DATA_VERSION}`);
    expect(parsed.version).toBe(SAVE_DATA_VERSION);
    expect(parsed.data[0].id).toBe('run-a-history');
  });

  it('imports run history JSON', () => {
    const storage = createMemoryStorage();
    const adapter = new LocalStorageAdapter(storage);
    const history = [createHistoryEntry('run-b')];
    const json = adapter.exportRunHistoryJson(history);

    const imported = adapter.importRunHistoryJson(json);

    expect(imported).toHaveLength(1);
    expect(imported[0].id).toBe('run-b-history');
    expect(adapter.loadRunHistory()[0].id).toBe('run-b-history');
  });

  it('disabled cloud sync placeholder does not call fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const cloud = new CloudSyncAdapterPlaceholder();
    const historyEntry = createHistoryEntry('run-cloud');
    const settings: UserSettings = {
      mode: 'normal',
      themeId: 'normal',
      background: { id: 'solid', opacity: 0.24 },
      compactMode: false,
    };
    const uploadResult = await cloud.uploadRunSummary(historyEntry);
    const downloadResult = await cloud.downloadRunHistory();
    const settingsResult = await cloud.syncSettings(settings);

    expect(uploadResult).toEqual({
      ok: false,
      reason: 'NotEnabled',
      message: '云同步：预留接口，当前未启用',
    });
    expect(downloadResult.reason).toBe('NotEnabled');
    expect(settingsResult.reason).toBe('NotEnabled');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

function createHistoryEntry(runId: string): RunSummary {
  return {
    id: `${runId}-history`,
    seed: runId,
    characterClassId: 'iron-oath',
    status: 'victory',
    floorReached: 5,
    finalHp: 30,
    maxHp: 72,
    gold: 24,
    deckSize: 12,
    relicCount: 1,
    completedAt: '2026-06-08T00:00:00.000Z',
  };
}

function createMemoryStorage(): StorageLike {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}
