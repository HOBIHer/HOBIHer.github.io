import type { CSSProperties } from 'react';
import type { UserSettings } from '../../game/types';
import { getBackgroundStyle } from '../../adapters/backgroundAdapter';

export function getAppRootClassName(settings: UserSettings): string {
  return [
    'app-root',
    `mode-${settings.mode}`,
    `theme-${settings.themeId}`,
    `background-${settings.background.id}`,
    settings.compactMode ? 'density-compact' : 'density-comfortable',
  ].join(' ');
}

export function getAppRootStyle(settings: UserSettings): CSSProperties {
  return getBackgroundStyle(settings.background);
}
