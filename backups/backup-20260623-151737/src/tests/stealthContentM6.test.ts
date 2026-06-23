import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../adapters/settingsAdapter';
import { warriorCardById } from '../game/data/cards/warrior';
import { trainingEnemyById } from '../game/data/enemies/training';
import { startCombat, startRun } from '../game/engine/combat';
import type { RewardBundle } from '../game/types';
import { CardView } from '../ui/components/CardView';
import { EnemyPanel } from '../ui/components/EnemyPanel';
import { RewardScreenView } from '../ui/screens/RewardScreen';

const stealthSettings = {
  ...defaultSettings,
  mode: 'stealth' as const,
  themeId: 'document' as const,
};

describe('milestone 6 stealth content display', () => {
  it('shows low-profile names and descriptions for new cards', () => {
    const markup = renderToStaticMarkup(
      createElement(CardView, {
        card: warriorCardById['price-of-iron'],
        mode: 'stealth',
      }),
    );

    expect(markup).toContain('资源换档');
    expect(markup).toContain('降低 3 点稳定度');
    expect(markup).not.toContain('铁价');
  });

  it('shows low-profile names for new enemies', () => {
    const run = startRun('m6-stealth-enemy');
    const { combat } = startCombat(run, trainingEnemyById.gear_cantor);
    const markup = renderToStaticMarkup(
      createElement(EnemyPanel, {
        enemy: combat.enemies[0],
        mode: 'stealth',
      }),
    );

    expect(markup).toContain('同步事项');
    expect(markup).not.toContain('齿轮领唱者');
  });

  it('shows low-profile names and descriptions for relic rewards', () => {
    const pendingReward: RewardBundle = {
      id: 'm6-relic-reward',
      sourceNodeId: 'node-elite',
      cardChoices: [],
      gold: 24,
      relicChoices: ['red-needle'],
      claimed: false,
    };

    const markup = renderToStaticMarkup(
      createElement(RewardScreenView, {
        pendingReward,
        settings: stealthSettings,
        claimReward: () => undefined,
        skipReward: () => undefined,
        openSettings: () => undefined,
        returnToMenu: () => undefined,
      }),
    );

    expect(markup).toContain('赤针凭证');
    expect(markup).toContain('推进增幅');
    expect(markup).not.toContain('赤针</button>');
  });
});
