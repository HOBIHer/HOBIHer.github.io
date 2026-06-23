import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../adapters/settingsAdapter';
import { startNewRun } from '../game/engine/run';
import type { UserSettings } from '../game/types';
import { MapScreenView } from '../ui/screens/MapScreen';
import { RestScreenView } from '../ui/screens/RestScreen';
import { RewardScreenView } from '../ui/screens/RewardScreen';

const stealthSettings: UserSettings = {
  ...defaultSettings,
  mode: 'stealth',
  themeId: 'document',
};

describe('milestone 5 stealth screen labels', () => {
  it('MapScreen shows the low-profile title and boss terminology', () => {
    const markup = renderToStaticMarkup(
      createElement(MapScreenView, {
        enterMapNode: () => undefined,
        openSettings: () => undefined,
        returnToMenu: () => undefined,
        run: startNewRun('stealth-map'),
        settings: stealthSettings,
      }),
    );

    expect(markup).toContain('流程面板');
    expect(markup).toContain('最终议题');
  });

  it('RestScreen shows the low-profile rest title', () => {
    const run = startNewRun('stealth-rest');
    const markup = renderToStaticMarkup(
      createElement(RestScreenView, {
        openSettings: () => undefined,
        restAtCurrentNode: () => undefined,
        returnToMenu: () => undefined,
        run: {
          ...run,
          currentScreen: 'rest',
          currentNodeId: run.map[3].id,
        },
        settings: stealthSettings,
      }),
    );

    expect(markup).toContain('整理节点');
    expect(markup).toContain('恢复 30% 稳定度上限');
  });

  it('RewardScreen shows the low-profile reward title', () => {
    const run = startNewRun('stealth-reward');
    const pendingReward = {
      id: 'reward-test',
      sourceNodeId: run.map[0].id,
      cardChoices: ['short-blade-advance', 'guarded-stance', 'iron-rack'],
      gold: 12,
      relicChoices: [],
      claimed: false,
    };

    const markup = renderToStaticMarkup(
      createElement(RewardScreenView, {
        claimReward: () => undefined,
        openSettings: () => undefined,
        pendingReward,
        returnToMenu: () => undefined,
        settings: stealthSettings,
        skipReward: () => undefined,
      }),
    );

    expect(markup).toContain('处理结果');
    expect(markup).toContain('选择操作项');
  });
});
