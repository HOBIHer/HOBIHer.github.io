import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { enemyGroupById, getEnemyGroupsForNodeType, selectEnemyGroup } from '../game/data/enemies/groups';
import { trainingEnemyById, trainingEnemies } from '../game/data/enemies/training';
import { createTreeMap } from '../game/engine/map';
import { endPlayerTurn, playCard, startCombat, startRun } from '../game/engine/combat';
import { resolveEnemyEffect } from '../game/engine/effects';
import { enterMapNode, startNewRun } from '../game/engine/run';
import type { ActNumber, CardInstance, MapNode, RunState } from '../game/types';
import { EnemyPanel } from '../ui/components/EnemyPanel';

const requiredV160EnemyIds = [
  'assassin_raider',
  'axe_raider',
  'brute_raider',
  'crossbow_raider',
  'tracker_raider',
  'cubex_construct',
  'eye_with_teeth',
  'flyconid',
  'fogmog',
  'fuzzy_wurm_crawler',
  'inklet',
  'leaf_slime_m',
  'leaf_slime_s',
  'twig_slime_m',
  'twig_slime_s',
  'mawler',
  'nibbit',
  'shrinker_beetle',
  'slithering_strangler',
  'snapping_jaxfruit',
  'vine_shambler',
  'bygone_effigy',
  'byrdonis',
  'phrog_parasite',
  'wriggler',
  'vantom',
  'ceremonial_beast',
  'kin_priest',
  'kin_follower',
  'bowlbug_egg',
  'bowlbug_nectar',
  'bowlbug_rock',
  'bowlbug_silk',
  'chomper',
  'exoskeleton',
  'hunter_killer',
  'louse_progenitor',
  'myte',
  'ovicopter',
  'tough_egg',
  'slumbering_beetle',
  'spiny_toad',
  'the_obscura',
  'thieving_hopper',
  'tunneler',
  'decimillipede_segment',
  'entomancer',
  'infested_prism',
  'knowledge_demon',
  'the_insatiable',
  'kaiser_crab_crusher',
  'kaiser_crab_rocket',
  'axebot',
  'calcified_cultist',
  'damp_cultist',
  'devoted_sculptor',
  'fabricator',
  'guardbot',
  'stabbot',
  'zapbot',
  'noisebot',
  'frog_knight',
  'globe_head',
  'living_shield',
  'owl_magistrate',
  'scroll_of_biting',
  'slimed_berserker',
  'the_forgotten',
  'the_lost',
  'turret_operator',
  'cubex_construct_overgrowth',
  'flail_knight',
  'spectral_knight',
  'magi_knight',
  'mecha_knight',
  'soul_nexus',
  'doormaker_door',
  'doormaker',
  'torch_head_amalgam',
  'the_queen',
  'test_subject_c10',
];

describe('v1.6.0 enemy pool update', () => {
  it('registers every requested v1.6 enemy with complete data-driven fields', () => {
    expect(new Set(trainingEnemies.map((enemy) => enemy.id)).size).toBe(trainingEnemies.length);

    for (const enemyId of requiredV160EnemyIds) {
      const enemy = trainingEnemyById[enemyId];
      expect(enemy, enemyId).toBeDefined();
      expect(enemy.name).toBeTruthy();
      expect(enemy.lowProfileName).toBeTruthy();
      expect(enemy.description).toBeTruthy();
      expect(enemy.lowProfileDescription).toBeTruthy();
      expect(enemy.act).toBeGreaterThanOrEqual(1);
      expect(enemy.act).toBeLessThanOrEqual(3);
      expect(enemy.role).toBeTruthy();
      expect(enemy.maxHp).toBeGreaterThan(0);
      expect(enemy.moves.length).toBeGreaterThan(0);
      const moveIds = new Set(enemy.moves.map((move) => move.id));
      expect(enemy.intentPattern.every((moveId) => moveIds.has(moveId))).toBe(true);
      expect(enemy.moves.every((move) => move.effects.every((effect) => effect.target === 'player' || effect.target === 'self'))).toBe(true);
    }
  });

  it('selects current-act combat, elite, and boss groups deterministically', () => {
    for (const act of [1, 2, 3] as const) {
      for (const nodeType of ['combat', 'elite', 'boss'] as const) {
        const selected = selectEnemyGroup(nodeType, `v160-${act}-${nodeType}`, act);
        expect(selected).toEqual(selectEnemyGroup(nodeType, `v160-${act}-${nodeType}`, act));
        expect(selected.act).toBe(act);
        expect(selected.nodeType).toBe(nodeType);
        expect(getEnemyGroupsForNodeType(nodeType, act).map((group) => group.id)).toContain(selected.id);
      }
    }
  });

  it('stores a seed-determined act-specific boss group on each act map', () => {
    for (const act of [1, 2, 3] as const) {
      const mapA = createTreeMap(`boss-map-${act}`, 0, act);
      const mapB = createTreeMap(`boss-map-${act}`, 0, act);
      const bossA = mapA.find((node) => node.type === 'boss')!;
      const bossB = mapB.find((node) => node.type === 'boss')!;
      const group = enemyGroupById[bossA.enemyGroupId!];

      expect(bossA.enemyGroupId).toBe(bossB.enemyGroupId);
      expect(bossA.bossId).toBe(bossB.bossId);
      expect(group.act).toBe(act);
      expect(group.nodeType).toBe('boss');
      expect(group.enemyIds).toContain(bossA.bossId);
    }
  });

  it('usually varies act boss selection across different seeds', () => {
    for (const act of [1, 2, 3] as const) {
      const selectedIds = new Set(
        Array.from({ length: 24 }, (_, index) => selectEnemyGroup('boss', `v160-variety-${act}-${index}`, act).id),
      );

      expect(selectedIds.size).toBeGreaterThan(1);
    }
  });

  it('enters map nodes using only the current act enemy pool', () => {
    for (const act of [1, 2, 3] as const) {
      const run = makeRunAtAct(act);
      const combatNode = run.map.find((node) => node.type === 'combat')!;
      const entered = enterMapNode(run, combatNode.id);
      const group = enemyGroupById[entered.map.find((node) => node.id === combatNode.id)!.enemyGroupId!];

      expect(group.act).toBe(act);
      expect(group.nodeType).toBe('combat');
      expect(entered.currentCombat?.enemies.map((enemy) => enemy.definitionId)).toEqual(group.enemyIds);
    }
  });

  it('applies initial statuses and v1.6 combat mechanisms', () => {
    let combat = startCombat(startRun('v160-slippery', [], 0), {
      ...trainingEnemyById.vantom,
      maxHp: 20,
    }).combat;
    combat = {
      ...combat,
      hand: [card('short-blade-advance', 'strike')],
      drawPile: [],
      discardPile: [],
      energy: 3,
    };
    combat = playCard(combat, 'strike', combat.enemies[0].instanceId);
    expect(combat.enemies[0].hp).toBe(19);
    expect(combat.enemies[0].statuses.slippery).toBe(8);

    combat = startCombat(startRun('v160-repeated', [], 0), trainingEnemyById.inklet).combat;
    combat = resolveEnemyEffect(combat, combat.enemies[0].instanceId, {
      type: 'damageRepeated',
      amount: 4,
      times: 3,
      target: 'player',
    });
    expect(combat.player.hp).toBe(60);

    combat = startCombat(startRun('v160-intangible', [], 0), {
      ...trainingEnemyById.test_subject_c10,
      maxHp: 20,
      initialStatuses: { intangible: 1 },
    }).combat;
    combat = {
      ...combat,
      hand: [card('short-blade-advance', 'intangible-strike')],
      drawPile: [],
      discardPile: [],
      energy: 3,
    };
    combat = playCard(combat, 'intangible-strike', combat.enemies[0].instanceId);
    expect(combat.enemies[0].hp).toBe(19);
  });

  it('applies generic end-turn HP loss statuses used by enemy pressure moves', () => {
    let combat = startCombat(startRun('v160-constrict', [], 0), trainingEnemyById.eye_with_teeth).combat;
    combat = {
      ...combat,
      hand: [],
      drawPile: [],
      discardPile: [],
      player: {
        ...combat.player,
        statuses: { constrict: 3 },
      },
    };
    combat = endPlayerTurn(combat);

    expect(combat.player.hp).toBe(69);
    expect(combat.player.statuses.constrict).toBe(2);
  });

  it('smoke-resolves at least one full move cycle for every v1.6 enemy', () => {
    for (const enemyId of requiredV160EnemyIds) {
      const enemy = trainingEnemyById[enemyId];
      let combat = startCombat(startRun(`v160-smoke-${enemyId}`, [], 0), enemy).combat;
      combat = {
        ...combat,
        player: {
          ...combat.player,
          hp: 999,
          maxHp: 999,
          statuses: {},
        },
      };

      for (const move of enemy.moves) {
        for (const effect of move.effects) {
          combat = resolveEnemyEffect(combat, combat.enemies[0].instanceId, effect);
        }
      }

      expect(combat.enemies[0].definitionId).toBe(enemyId);
      expect(combat.player.hp).toBeGreaterThan(0);
    }
  });

  it('stun and slumber skip enemy actions without removing the enemy from combat', () => {
    let combat = startCombat(startRun('v160-slumber', [], 0), trainingEnemyById.slumbering_beetle).combat;
    const hpBefore = combat.player.hp;
    combat = endPlayerTurn({ ...combat, hand: [], drawPile: [], discardPile: [] });

    expect(combat.player.hp).toBe(hpBefore);
    expect(combat.enemies[0].defeated).toBe(false);
    expect(combat.enemies[0].statuses.slumber).toBe(2);
  });

  it('renders v1.6 enemies with low-profile names and intent terminology', () => {
    const combat = startCombat(startRun('v160-stealth-enemy', [], 0), trainingEnemyById.inklet).combat;
    const markup = renderToStaticMarkup(
      createElement(EnemyPanel, {
        enemy: combat.enemies[0],
        mode: 'stealth',
      }),
    );

    expect(markup).toContain(trainingEnemyById.inklet.lowProfileName!);
    expect(markup).toContain('Advance');
    expect(markup).not.toContain('Inklet');
    expect(markup).not.toContain('Attack');
  });
});

function makeRunAtAct(act: ActNumber): RunState {
  const run = startNewRun(`v160-act-${act}`);
  const map = createTreeMap(`v160-act-${act}`, 0, act).map((node, index) =>
    index === 0 ? { ...node, status: 'available' as const, parentNodeIds: [] } : node,
  );
  return {
    ...run,
    act,
    map,
    currentScreen: 'map',
    currentEvent: undefined,
    eventStartSnapshot: undefined,
  };
}

function card(definitionId: string, instanceId: string): CardInstance {
  return {
    definitionId,
    instanceId,
    upgraded: false,
  };
}
