import type { CardInstance, CombatState } from '../types';
import { shuffle } from '../rng';

const HAND_LIMIT = 10;

export interface DrawCardsOptions {
  onShuffle?: (combat: CombatState) => CombatState;
  onCardDrawn?: (combat: CombatState, card: CardInstance) => CombatState;
}

export function createDeckCardInstances(cardIds: string[], prefix: string): CardInstance[] {
  return cardIds.map((definitionId, index) => ({
    definitionId,
    instanceId: `${prefix}-${definitionId}-${index}`,
    upgraded: false,
  }));
}

export function createRewardCardInstance(definitionId: string, prefix: string): CardInstance {
  return {
    definitionId,
    instanceId: `${prefix}-${definitionId}`,
    upgraded: false,
  };
}

export function createCardInstances(cards: Array<string | CardInstance>, prefix: string): CardInstance[] {
  return cards.map((card, index) => {
    const definitionId = typeof card === 'string' ? card : card.definitionId;
    const upgraded = typeof card === 'string' ? false : Boolean(card.upgraded);

      return {
        definitionId,
        upgraded,
        instanceId: `${prefix}-${definitionId}-${upgraded ? 'upgraded' : 'base'}-${index}`,
        costOverride: typeof card === 'string' ? undefined : card.costOverride,
        exhaustOnPlay: typeof card === 'string' ? undefined : card.exhaustOnPlay,
        damageBonus: typeof card === 'string' ? undefined : card.damageBonus,
      };
  });
}

export function drawCards(
  combat: CombatState,
  amount: number,
  options: DrawCardsOptions = {},
): CombatState {
  if ((combat.player.statuses.noDraw ?? 0) > 0) {
    return {
      ...combat,
      log: [...combat.log, '本回合不能再抽牌。'],
    };
  }

  let nextCombat = { ...combat, log: [...combat.log] };
  let drawPile = [...nextCombat.drawPile];
  let discardPile = [...nextCombat.discardPile];
  let hand = [...nextCombat.hand];
  let rngSeed = nextCombat.rngSeed;
  let drawn = 0;

  for (let count = 0; count < amount; count += 1) {
    if (hand.length >= HAND_LIMIT) {
      break;
    }

    if (drawPile.length === 0 && discardPile.length > 0) {
      const shuffled = shuffle(discardPile, rngSeed);
      drawPile = shuffled.items;
      discardPile = [];
      rngSeed = shuffled.seed;
      nextCombat = {
        ...nextCombat,
        rngSeed,
        drawPile,
        discardPile,
        hand,
        log: [...nextCombat.log, '弃牌堆洗入抽牌堆。'],
      };

      if (options.onShuffle) {
        nextCombat = options.onShuffle(nextCombat);
        drawPile = [...nextCombat.drawPile];
        discardPile = [...nextCombat.discardPile];
        hand = [...nextCombat.hand];
        rngSeed = nextCombat.rngSeed;
      }
    }

    const nextCard = drawPile.shift();
    if (!nextCard) {
      break;
    }

    hand.push(nextCard);
    drawn += 1;

    if (options.onCardDrawn) {
      nextCombat = {
        ...nextCombat,
        rngSeed,
        drawPile,
        discardPile,
        hand,
      };
      nextCombat = options.onCardDrawn(nextCombat, nextCard);
      drawPile = [...nextCombat.drawPile];
      discardPile = [...nextCombat.discardPile];
      hand = [...nextCombat.hand];
      rngSeed = nextCombat.rngSeed;
    }
  }

  if (drawn > 0) {
    nextCombat.log.push(`抽取 ${drawn} 张牌。`);
  }

  return {
    ...nextCombat,
    rngSeed,
    drawPile,
    discardPile,
    hand,
  };
}

export function discardEntireHand(combat: CombatState): CombatState {
  const discardedCards = combat.hand.filter((card) => card);

  if (discardedCards.length === 0) {
    return combat;
  }

  return {
    ...combat,
    hand: [],
    discardPile: [...combat.discardPile, ...discardedCards],
    log: [...combat.log, `弃掉手牌 ${discardedCards.length} 张。`],
  };
}

export function discardFromHand(combat: CombatState, amount: number): CombatState {
  if (amount <= 0 || combat.hand.length === 0) {
    return combat;
  }

  const discarded = combat.hand.slice(0, amount);
  const remaining = combat.hand.slice(amount);

  return {
    ...combat,
    hand: remaining,
    discardPile: [...combat.discardPile, ...discarded],
    log: [...combat.log, `弃掉 ${discarded.length} 张牌。`],
  };
}
