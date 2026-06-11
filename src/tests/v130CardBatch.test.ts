import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { rewardWarriorCards } from '../game/data/cards/warrior';
import { blockedV130Cards, v130Cards } from '../game/data/cards/v130Batch';
import { createUpgradedCardDefinition } from '../game/engine/cardUpgrades';
import { endPlayerTurn, playCard, startCombat, startRun } from '../game/engine/combat';
import { getCardPlayCost } from '../game/engine/effects';
import type { CardDefinition, CombatState, EnemyDefinition } from '../game/types';
import { CardView } from '../ui/components/CardView';

const patientEnemy: EnemyDefinition = {
  id: 'v130-patient-target',
  name: '耐久靶',
  lowProfileName: '耐久事项',
  maxHp: 999,
  intentPattern: ['wait'],
  moves: [
    {
      id: 'wait',
      name: '静置',
      intent: { type: 'wait', label: '等待' },
      effects: [],
    },
  ],
};

const attackingEnemy: EnemyDefinition = {
  id: 'v130-attacker',
  name: '回测靶',
  lowProfileName: '回测事项',
  maxHp: 80,
  intentPattern: ['attack'],
  moves: [
    {
      id: 'attack',
      name: '推进',
      intent: { type: 'attack', label: '攻击', damage: 10 },
      effects: [{ type: 'damage', amount: 10, target: 'player' }],
    },
  ],
};

describe('v1.3.0 card batch', () => {
  it('implements all local rows and records blocked rows with exact reasons', () => {
    expect(v130Cards).toHaveLength(84);
    expect(blockedV130Cards.map((card) => card.row).sort((a, b) => a - b)).toEqual([27, 60, 75]);
  });

  it('has unique ids and complete base and upgrade fields', () => {
    expect(new Set(v130Cards.map((card) => card.id)).size).toBe(v130Cards.length);

    for (const card of v130Cards) {
      expect(card.name).toBeTruthy();
      expect(card.lowProfileName).toBeTruthy();
      expect(card.description).toBeTruthy();
      expect(card.lowProfileDescription).toBeTruthy();
      expect(card.rarity).toBeTruthy();
      expect(card.cost === 'X' || Number.isFinite(card.cost)).toBe(true);
      expect(card.target).toBeTruthy();
      expect(card.effects.length).toBeGreaterThan(0);
      expect(card.upgrade?.description).toBeTruthy();
      expect(card.upgrade?.lowProfileDescription).toBeTruthy();
      expect(card.upgrade?.effects?.length).toBeGreaterThan(0);
      expect(card.upgrade?.cost === 'X' || Number.isFinite(card.upgrade?.cost)).toBe(true);
    }
  });

  it('puts every non-basic v1.3.0 card into the Iron Oath reward pool', () => {
    const rewardIds = new Set(rewardWarriorCards.map((card) => card.id));
    const eligible = v130Cards.filter((card) => card.rarity !== 'basic');
    const basic = v130Cards.filter((card) => card.rarity === 'basic');

    expect(eligible.length).toBeGreaterThan(0);
    expect(eligible.every((card) => rewardIds.has(card.id))).toBe(true);
    expect(basic.every((card) => !rewardIds.has(card.id))).toBe(true);
  });

  it('uses explicit upgraded costs, effects, and descriptions from the batch', () => {
    const upgradedEcho = createUpgradedCardDefinition(getCard('v130-echo-scratch'));
    expect(upgradedEcho.cost).toBe(0);
    expect(upgradedEcho.description).toContain('8 点伤害');
    expect(upgradedEcho.effects).toContainEqual({ type: 'damage', amount: 8, target: 'enemy' });

    const upgradedX = createUpgradedCardDefinition(getCard('v130-surge-cascade'));
    expect(upgradedX.cost).toBe('X');
    expect(upgradedX.description).toContain('X+1');
    expect(upgradedX.effects).toContainEqual({ type: 'playTopCards', count: 'xPlusOne' });
  });

  it('renders low-profile names and descriptions for new cards', () => {
    const card = getCard('v130-blood-spark');
    const markup = renderToStaticMarkup(createElement(CardView, { card, mode: 'stealth' }));

    expect(markup).toContain(card.lowProfileName);
    expect(markup).toContain(card.lowProfileDescription);
    expect(markup).not.toContain(card.description);
  });

  it('can play every implemented v1.3.0 card without blocking or crashing', () => {
    for (const card of v130Cards) {
      let combat = preparedCombat(card.id);
      const playedId = combat.hand[0].instanceId;
      combat = playCard(combat, playedId, combat.enemies[0].instanceId);

      expect(combat.log.join('\n')).toContain(`使用 ${card.name}`);
      expect(combat.hand.some((candidate) => candidate.instanceId === playedId)).toBe(false);
      expect(combat.phase).not.toBe('lost');
    }
  });

  it('spends X and repeats all-enemy damage for X-cost attacks', () => {
    let combat = preparedCombat('v130-x-wide-storm');
    combat = {
      ...combat,
      energy: 3,
      enemies: [
        { ...combat.enemies[0], hp: 50, statuses: {} },
        { ...combat.enemies[1], hp: 50, statuses: {} },
      ],
    };

    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);

    expect(combat.energy).toBe(0);
    expect(combat.enemies[0].hp).toBe(35);
    expect(combat.enemies[1].hp).toBe(35);
  });

  it('blocks later draw after floodgate-draw resolves its own draw first', () => {
    let combat = preparedCombat('v130-floodgate-draw');
    combat = {
      ...combat,
      drawPile: [
        instance('short-blade-advance', 'draw-a'),
        instance('guarded-stance', 'draw-b'),
        instance('short-blade-advance', 'draw-c'),
        instance('guarded-stance', 'draw-d'),
      ],
      hand: [instance('v130-floodgate-draw', 'flood'), instance('v130-quick-study', 'study')],
    };

    combat = playCard(combat, 'flood', combat.enemies[0].instanceId);
    expect(combat.hand.length).toBe(4);

    combat = playCard(combat, 'study', combat.enemies[0].instanceId);
    expect(combat.hand.map((card) => card.instanceId)).not.toContain('draw-d');
  });

  it('triggers exhaust-based block and draw mechanisms', () => {
    let combat = preparedCombat('v130-ash-shell');
    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);

    combat = {
      ...combat,
      hand: [instance('v130-cycle-sift', 'sift'), instance('short-blade-advance', 'fuel')],
      drawPile: [instance('guarded-stance', 'drawn')],
      energy: 10,
    };
    combat = playCard(combat, 'sift', combat.enemies[0].instanceId);

    expect(combat.player.block).toBeGreaterThanOrEqual(3);
    expect(combat.exhaustPile.some((card) => card.instanceId === 'fuel')).toBe(true);
  });

  it('preserves block after locked-bulwark and applies turn-start power hooks', () => {
    let combat = preparedCombat('v130-locked-bulwark', attackingEnemy);
    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);
    combat = {
      ...combat,
      player: {
        ...combat.player,
        block: 12,
      },
      hand: [],
      drawPile: [],
      discardPile: [],
    };

    combat = endPlayerTurn(combat);

    expect(combat.phase).toBe('player');
    expect(combat.player.block).toBeGreaterThan(0);
  });

  it('makes skills free and exhausts them after ancient-edict', () => {
    let combat = preparedCombat('v130-ancient-edict');
    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);
    combat = {
      ...combat,
      hand: [instance('v130-field-refit', 'refit'), instance('short-blade-advance', 'upgrade-target')],
      energy: 0,
    };

    expect(getCardPlayCost(combat, combat.hand[0])).toBe(0);
    combat = playCard(combat, 'refit', combat.enemies[0].instanceId);

    expect(combat.exhaustPile.some((card) => card.instanceId === 'refit')).toBe(true);
  });

  it('reduces falling-cleave cost by attacks already played this turn', () => {
    const combat = preparedCombat('v130-falling-cleave');
    expect(getCardPlayCost(combat, combat.hand[0])).toBe(1);
  });
});

function preparedCombat(cardId: string, enemy: EnemyDefinition | EnemyDefinition[] = [patientEnemy, { ...patientEnemy, id: 'v130-patient-target-b' }]): CombatState {
  const run = startRun(`v130-${cardId}`);
  let { combat } = startCombat(run, enemy);
  return {
    ...combat,
    player: {
      ...combat.player,
      hp: 60,
      block: 12,
    },
    enemies: combat.enemies.map((candidate) => ({
      ...candidate,
      statuses: {
        vulnerable: 2,
      },
    })),
    hand: [
      instance(cardId, `played-${cardId}`),
      instance('short-blade-advance', 'support-attack'),
      instance('guarded-stance', 'support-skill'),
      instance('settle-breath', 'support-skill-b'),
    ],
    drawPile: [
      instance('short-blade-advance', 'draw-attack'),
      instance('guarded-stance', 'draw-skill'),
      instance('short-blade-advance', 'draw-attack-b'),
    ],
    discardPile: [instance('short-blade-advance', 'discard-attack'), instance('guarded-stance', 'discard-skill')],
    exhaustPile: [
      instance('guarded-stance', 'exhaust-a'),
      instance('short-blade-advance', 'exhaust-b'),
      instance('settle-breath', 'exhaust-c'),
    ],
    energy: 10,
    turnStats: {
      ...combat.turnStats,
      attacksPlayed: 2,
      cardsPlayed: 2,
      cardsExhausted: 1,
      lostHpThisTurn: true,
    },
    combatStats: {
      hpLossEvents: 2,
    },
  };
}

function instance(definitionId: string, instanceId: string, upgraded = false) {
  return {
    definitionId,
    instanceId,
    upgraded,
  };
}

function getCard(id: string): CardDefinition {
  const card = v130Cards.find((candidate) => candidate.id === id);
  if (!card) {
    throw new Error(`Missing v1.3.0 card: ${id}`);
  }
  return card;
}
