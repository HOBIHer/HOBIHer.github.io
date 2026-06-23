import {
  LocalStorageAdapter,
  SETTINGS_STORAGE_KEY,
  defaultSettings,
  getBrowserStorage,
  normalizeSettings,
  type StorageLike,
} from './storageAdapter';
import type { UserSettings } from '../game/types';

export {
  SETTINGS_STORAGE_KEY,
  defaultSettings,
  getBrowserStorage,
  normalizeSettings,
  type StorageLike,
};

export function loadSettings(storage: StorageLike | undefined = getBrowserStorage()): UserSettings {
  return new LocalStorageAdapter(storage).loadSettings();
}

export function saveSettings(
  settings: UserSettings,
  storage: StorageLike | undefined = getBrowserStorage(),
): void {
  new LocalStorageAdapter(storage).saveSettings(settings);
}

export function clearSettings(storage: StorageLike | undefined = getBrowserStorage()): UserSettings {
  storage?.removeItem(SETTINGS_STORAGE_KEY);
  return defaultSettings;
}
