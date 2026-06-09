import { afterEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../game/store/useGameStore';
import { defaultSettings } from '../adapters/settingsAdapter';

describe('game store flow', () => {
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
    });
  });

  it('starts at the map, enters combat, claims a reward, and returns to the map', () => {
    useGameStore.getState().startNewRun('store-flow');
    const mapState = useGameStore.getState();
    const firstNode = mapState.run!.map[0];

    expect(mapState.screen).toBe('map');

    useGameStore.getState().enterMapNode(firstNode.id);
    const combatState = useGameStore.getState();

    expect(combatState.screen).toBe('combat');
    expect(combatState.combat?.enemies[0].definitionId).toBeDefined();

    useGameStore.setState({
      combat: {
        ...combatState.combat!,
        phase: 'won',
        player: {
          ...combatState.combat!.player,
          hp: 60,
        },
      },
      run: {
        ...combatState.run!,
        currentCombat: {
          ...combatState.combat!,
          phase: 'won',
          player: {
            ...combatState.combat!.player,
            hp: 60,
          },
        },
      },
    });

    useGameStore.getState().endTurn();
    const rewardState = useGameStore.getState();
    const reward = rewardState.rewards[0];

    expect(rewardState.screen).toBe('reward');
    expect(reward).toBeDefined();

    useGameStore.getState().chooseReward(reward.id);
    const nextState = useGameStore.getState();

    expect(nextState.screen).toBe('map');
    expect(nextState.run?.completedNodeIds).toContain(firstNode.id);
    expect(nextState.run?.deck).toContain(reward.cardId);
  });
});
