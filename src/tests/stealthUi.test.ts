import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, loadSettings, saveSettings, type StorageLike } from '../adapters/settingsAdapter';
import { warriorCardById } from '../game/data/cards/warrior';
import { trainingEnemies } from '../game/data/enemies/training';
import { startCombat, startRun } from '../game/engine/combat';
import { useGameStore } from '../game/store/useGameStore';
import type { UserSettings } from '../game/types';
import { CardView } from '../ui/components/CardView';
import { CombatLog } from '../ui/components/CombatLog';
import { EndTurnButton } from '../ui/components/EndTurnButton';
import { EnemyPanel } from '../ui/components/EnemyPanel';
import { getAppRootClassName } from '../ui/themes/appTheme';

const stealthSettings: UserSettings = {
  ...defaultSettings,
  mode: 'stealth',
  themeId: 'document',
  background: {
    id: 'stealthGrid',
    opacity: 0.35,
  },
};

describe('stealth UI settings', () => {
  afterEach(() => {
    useGameStore.setState({
      screen: 'mainMenu',
      settingsReturnScreen: 'mainMenu',
      run: undefined,
      combat: undefined,
      rewards: [],
      pendingReward: undefined,
      settings: defaultSettings,
    });
  });

  it('stealth mode card UI uses lowProfileName and lowProfileDescription', () => {
    const markup = renderToStaticMarkup(
      createElement(CardView, {
        card: warriorCardById['short-blade-advance'],
        mode: 'stealth',
      }),
    );

    expect(markup).toContain('快速推进');
    expect(markup).toContain('推进 6 点进度。');
    expect(markup).not.toContain('短刃推进');
  });

  it('stealth mode combat UI shows enemy as target and end turn as end cycle', () => {
    const run = startRun('stealth-combat');
    const started = startCombat(run, trainingEnemies[0]);
    const enemyMarkup = renderToStaticMarkup(
      createElement(EnemyPanel, {
        enemy: started.combat.enemies[0],
        mode: 'stealth',
      }),
    );
    const buttonMarkup = renderToStaticMarkup(createElement(EndTurnButton, { mode: 'stealth' }));
    const logMarkup = renderToStaticMarkup(
      createElement(CombatLog, { entries: ['本地记录'], mode: 'stealth' }),
    );

    expect(enemyMarkup).toContain('目标');
    expect(buttonMarkup).toContain('结束周期');
    expect(logMarkup).toContain('处理记录');
  });

  it('theme changes update the app root className', () => {
    const className = getAppRootClassName({
        ...defaultSettings,
        mode: 'stealth',
        themeId: 'terminal',
    });

    expect(className).toContain('theme-terminal');
    expect(className).toContain('mode-stealth');
  });

  it('custom background settings can be saved and loaded', () => {
    const storage = createMemoryStorage();
    const settings: UserSettings = {
      ...defaultSettings,
      background: {
        id: 'custom',
        opacity: 0.55,
        customImageDataUrl: 'data:image/png;base64,local-only',
      },
    };

    saveSettings(settings, storage);
    const loaded = loadSettings(storage);

    expect(loaded.background.id).toBe('custom');
    expect(loaded.background.opacity).toBe(0.55);
    expect(loaded.background.customImageDataUrl).toBe('data:image/png;base64,local-only');
  });
});

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
