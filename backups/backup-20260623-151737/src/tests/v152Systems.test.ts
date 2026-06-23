import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../adapters/settingsAdapter';
import { warriorCardById } from '../game/data/cards/warrior';
import { trainingEnemies } from '../game/data/enemies/training';
import { playCard, startCombat } from '../game/engine/combat';
import { startNewRun, upgradeCardAtNode } from '../game/engine/run';
import type { CardInstance, CombatState, RunState } from '../game/types';
import { CardView } from '../ui/components/CardView';
import { RelicBar } from '../ui/components/RelicBar';
import { getKeywordDescription } from '../ui/terminology/keywordDescriptions';
import { MapScreenView } from '../ui/screens/MapScreen';
import { RestScreenView } from '../ui/screens/RestScreen';

describe('v1.5.2 starter loadout, rest upgrades, relic display, and card keywords', () => {
  it('starts a new default run with exactly 5 attacks, 4 defenses, and Break Stance Smash, all unupgraded', () => {
    const run = startNewRun('v152-starter-deck');
    const counts = countDeck(run.deck);

    expect(run.deck).toHaveLength(10);
    expect(counts['short-blade-advance']).toBe(5);
    expect(counts['guarded-stance']).toBe(4);
    expect(counts['break-stance-smash']).toBe(1);
    expect(run.deck.every((card) => card.upgraded === false)).toBe(true);
  });

  it('records and renders before/after rest upgrade details, including changed cost', () => {
    const card: CardInstance = {
      definitionId: 'v130-guard-snap',
      instanceId: 'rest-cost-change-card',
      upgraded: false,
    };
    const run = enterSyntheticRest({
      ...startNewRun('v152-rest-upgrade'),
      deck: [card],
    });

    const upgraded = upgradeCardAtNode(run, card.instanceId);
    const result = upgraded.lastRestResult;

    expect(result?.action).toBe('upgrade');
    expect(result?.upgradeBeforeDescription).toBe(warriorCardById['v130-guard-snap'].description);
    expect(result?.upgradeAfterDescription).toBe(warriorCardById['v130-guard-snap'].upgrade?.description);
    expect(result?.upgradeBeforeCost).toBe(1);
    expect(result?.upgradeAfterCost).toBe(0);
    expect(upgraded.deck[0].upgraded).toBe(true);
    expect(upgradeCardAtNode(upgraded, card.instanceId)).toBe(upgraded);

    const markup = renderToStaticMarkup(
      createElement(RestScreenView, {
        run: upgraded,
        settings: defaultSettings,
        restAtCurrentNode: () => undefined,
        upgradeCardAtCurrentNode: () => undefined,
        returnToMapAfterRest: () => undefined,
        openSettings: () => undefined,
        returnToMenu: () => undefined,
      }),
    );

    expect(markup).toContain('「盾势反扣」已升级');
    expect(markup).toContain('升级前：');
    expect(markup).toContain('升级后：');
    expect(markup).toContain('费用');
    expect(markup).toContain('1');
    expect(markup).toContain('0');
  });

  it('grants and displays the starter relic, and the relic heals on combat victory', () => {
    const run = startNewRun('v152-starter-relic');
    expect(run.relics).toEqual(['afterglow-charm']);
    expect(new Set(run.relics).size).toBe(run.relics.length);

    const relicMarkup = renderToStaticMarkup(createElement(RelicBar, { relicIds: run.relics, mode: 'normal' }));
    expect(relicMarkup).toContain('余息护符');
    expect(relicMarkup).toContain('战斗胜利时回复 3 点生命。');

    const stealthMarkup = renderToStaticMarkup(createElement(RelicBar, { relicIds: run.relics, mode: 'stealth' }));
    expect(stealthMarkup).toContain('恢复凭证');
    expect(stealthMarkup).toContain('流程节点完成时回复 3 点稳定度。');

    const emptyMarkup = renderToStaticMarkup(createElement(RelicBar, { relicIds: [], mode: 'normal' }));
    expect(emptyMarkup).toContain('没有遗物');

    const mapMarkup = renderToStaticMarkup(
      createElement(MapScreenView, {
        run,
        settings: defaultSettings,
        enterMapNode: () => undefined,
        openSettings: () => undefined,
        returnToMenu: () => undefined,
      }),
    );
    expect(mapMarkup).toContain('余息护符');

    let { combat } = startCombat(run, { ...trainingEnemies[0], maxHp: 6 });
    combat = forceHand(combat, ['short-blade-advance']);
    combat = {
      ...combat,
      player: {
        ...combat.player,
        hp: 50,
      },
    };

    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);

    expect(combat.phase).toBe('won');
    expect(combat.player.hp).toBe(53);
  });

  it('returns mode-specific keyword descriptions and renders focusable card keywords', () => {
    expect(getKeywordDescription('格挡', 'normal')).toContain('伤害');
    expect(getKeywordDescription('缓冲', 'stealth')).toContain('稳定度');

    const normalMarkup = renderToStaticMarkup(
      createElement(CardView, {
        card: warriorCardById['guarded-stance'],
        mode: 'normal',
      }),
    );

    expect(normalMarkup).toContain('mechanic-keyword');
    expect(normalMarkup).toContain('tabindex="0"');
    expect(normalMarkup).toContain('格挡');

    const stealthMarkup = renderToStaticMarkup(
      createElement(CardView, {
        card: warriorCardById['guarded-stance'],
        mode: 'stealth',
      }),
    );

    expect(stealthMarkup).toContain('mechanic-keyword');
    expect(stealthMarkup).toContain('缓冲');
    expect(stealthMarkup).toContain('稳定度');
  });
});

function countDeck(deck: CardInstance[]): Record<string, number> {
  return deck.reduce<Record<string, number>>((counts, card) => {
    counts[card.definitionId] = (counts[card.definitionId] ?? 0) + 1;
    return counts;
  }, {});
}

function enterSyntheticRest(run: RunState): RunState {
  const restNode = run.map.find((node) => node.type === 'rest')!;
  return {
    ...run,
    currentNodeId: restNode.id,
    currentScreen: 'rest',
    map: run.map.map((node) =>
      node.id === restNode.id ? { ...node, status: 'current' as const } : node,
    ),
  };
}

function forceHand(combat: CombatState, definitionIds: string[]): CombatState {
  return {
    ...combat,
    hand: definitionIds.map((definitionId, index) => ({
      definitionId,
      instanceId: `forced-${definitionId}-${index}`,
      upgraded: false,
    })),
    drawPile: [],
    discardPile: [],
    exhaustPile: [],
    energy: 10,
  };
}
