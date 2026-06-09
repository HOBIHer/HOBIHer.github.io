import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import changelog from '../../CHANGELOG.md?raw';
import readme from '../../README.md?raw';
import { defaultSettings } from '../adapters/settingsAdapter';
import { warriorCardById } from '../game/data/cards/warrior';
import { trainingEnemies } from '../game/data/enemies/training';
import { playCard, startCombat, startRun } from '../game/engine/combat';
import { canEnterNode } from '../game/engine/map';
import { startNewRun } from '../game/engine/run';
import { useGameStore } from '../game/store/useGameStore';
import type { CardInstance } from '../game/types';
import { getPileCards, getPileLabel } from '../ui/components/PileInfo';
import { getStatusDescription } from '../ui/terminology/statusDescriptions';
import { RestScreenView } from '../ui/screens/RestScreen';

describe('v1.1.0 experience improvements', () => {
  afterEach(() => {
    useGameStore.setState({
      screen: 'mainMenu',
      settingsReturnScreen: 'mainMenu',
      run: undefined,
      combat: undefined,
      rewards: [],
      pendingReward: undefined,
      settings: defaultSettings,
      runHistory: [],
      lastRunSummary: undefined,
      canContinueRun: false,
    });
  });

  it('documents local setup, checks, and localStorage saves in README and changelog', () => {
    expect(readme).toContain('npm install');
    expect(readme).toContain('npm run dev');
    expect(readme).toContain('npm test');
    expect(readme).toContain('npm run build');
    expect(readme).toContain('localStorage');
    expect(changelog).toContain('v1.1.0');
    expect(changelog).toContain('branching Act 1 map');
  });

  it('marks defeated enemies, logs defeat, and blocks selecting defeated targets', () => {
    const run = startRun('defeated-target');
    let { combat } = startCombat(run, [
      {
        ...trainingEnemies[0],
        id: 'fragile-target',
        name: '薄壳靶',
        maxHp: 6,
      },
      trainingEnemies[1],
    ]);
    const firstAttack: CardInstance = {
      instanceId: 'test-attack-1',
      definitionId: 'short-blade-advance',
      upgraded: false,
    };
    const secondAttack: CardInstance = {
      instanceId: 'test-attack-2',
      definitionId: 'short-blade-advance',
      upgraded: false,
    };
    combat = {
      ...combat,
      hand: [firstAttack, secondAttack],
      energy: 3,
    };
    const defeatedTargetId = combat.enemies[0].instanceId;

    combat = playCard(combat, firstAttack.instanceId, defeatedTargetId);
    const energyAfterKill = combat.energy;
    combat = playCard(combat, secondAttack.instanceId, defeatedTargetId);

    expect(combat.enemies[0].defeated).toBe(true);
    expect(combat.log.some((entry) => entry.includes('薄壳靶 被击败'))).toBe(true);
    expect(combat.energy).toBe(energyAfterKill);
    expect(combat.log.at(-1)).toBe('目标已经无法选择。');
    expect(combat.enemies[1].hp).toBe(trainingEnemies[1].maxHp);
  });

  it('returns to main menu without abandoning and continues combat from the start snapshot', () => {
    useGameStore.getState().startNewRun('snapshot-continue');
    const firstNode = useGameStore.getState().run!.map[0];
    useGameStore.getState().enterMapNode(firstNode.id);
    const openingCombat = useGameStore.getState().combat!;
    const openingHand = openingCombat.hand.map((card) => card.instanceId);
    const targetEnemyId = openingCombat.enemies.find((enemy) => enemy.hp > 0 && !enemy.defeated)!.instanceId;
    const attack = openingCombat.hand.find(
      (card) => warriorCardById[card.definitionId].type === 'attack',
    )!;

    useGameStore.getState().playCard(attack.instanceId, targetEnemyId);
    expect(useGameStore.getState().combat!.hand.map((card) => card.instanceId)).not.toEqual(openingHand);

    useGameStore.getState().returnToMenu();

    expect(useGameStore.getState().screen).toBe('mainMenu');
    expect(useGameStore.getState().canContinueRun).toBe(true);

    useGameStore.getState().continueRun();

    expect(useGameStore.getState().screen).toBe('combat');
    expect(useGameStore.getState().combat!.turn).toBe(1);
    expect(useGameStore.getState().combat!.energy).toBe(3);
    expect(useGameStore.getState().combat!.hand.map((card) => card.instanceId)).toEqual(openingHand);
  });

  it('locks same-floor alternatives after choosing a branch node', () => {
    const store = useGameStore.getState();
    store.startNewRun('branch-choice');
    let run = useGameStore.getState().run!;
    useGameStore.getState().enterMapNode(run.map[0].id);
    useGameStore.setState({
      combat: {
        ...useGameStore.getState().combat!,
        phase: 'won',
      },
      run: {
        ...useGameStore.getState().run!,
        currentCombat: {
          ...useGameStore.getState().combat!,
          phase: 'won',
        },
      },
    });
    useGameStore.getState().endTurn();
    useGameStore.getState().skipReward();
    run = useGameStore.getState().run!;
    const availableFloorTwo = run.map.filter((node) => node.floor === 2 && canEnterNode(run.map, node.id));

    expect(availableFloorTwo).toHaveLength(2);

    useGameStore.getState().enterMapNode(availableFloorTwo[0].id);
    run = useGameStore.getState().run!;

    expect(run.map.find((node) => node.id === availableFloorTwo[0].id)?.status).toBe('current');
    expect(run.map.find((node) => node.id === availableFloorTwo[1].id)?.status).toBe('locked');
  });

  it('provides status descriptions for normal and low-profile modes', () => {
    expect(getStatusDescription('vulnerable', 'normal')).toContain('受到攻击伤害提高');
    expect(getStatusDescription('vulnerable', 'stealth')).toContain('推进效果');
  });

  it('renders the rest result before returning to the map', () => {
    const run = {
      ...startNewRun('rest-result-view'),
      currentScreen: 'rest' as const,
      lastRestResult: {
        nodeId: 'rest-node',
        beforeHp: 35,
        afterHp: 56,
        healed: 21,
      },
      character: {
        ...startNewRun('rest-result-view').character,
        hp: 56,
      },
    };
    const markup = renderToStaticMarkup(
      createElement(RestScreenView, {
        openSettings: () => undefined,
        restAtCurrentNode: () => undefined,
        returnToMapAfterRest: () => undefined,
        returnToMenu: () => undefined,
        run,
        settings: defaultSettings,
      }),
    );

    expect(markup).toContain('生命 35 -&gt; 56，恢复 21');
    expect(markup).toContain('返回路线');
  });

  it('exposes pile labels and card lists for pile viewers', () => {
    const { combat } = startCombat(startRun('pile-viewer'), trainingEnemies[0]);

    expect(getPileCards(combat, 'draw')).toBe(combat.drawPile);
    expect(getPileCards(combat, 'discard')).toBe(combat.discardPile);
    expect(getPileCards(combat, 'exhaust')).toBe(combat.exhaustPile);
    expect(getPileLabel('draw', 'normal')).toBe('抽牌堆');
    expect(getPileLabel('draw', 'stealth')).toBe('待处理项');
  });
});
