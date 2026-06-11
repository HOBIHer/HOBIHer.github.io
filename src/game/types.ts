export type CharacterId = 'iron-oath';

export type CharacterClassId = CharacterId;

export type AscensionLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface AscensionProgress {
  unlockedLevel: AscensionLevel;
}

export type CardType = 'attack' | 'skill' | 'power' | 'curse';

export type CardRarity = 'starter' | 'basic' | 'common' | 'uncommon' | 'rare' | 'ancient' | 'curse';

export type RewardCardRarity = Exclude<CardRarity, 'starter' | 'basic' | 'curse'>;

export type CardCost = number | 'X' | 'unplayable';

export type CardTarget = 'enemy' | 'allEnemies' | 'self' | 'none';

export type GameMode = 'normal' | 'stealth';

export type ThemeId = 'normal' | 'document' | 'dashboard' | 'code' | 'meeting' | 'terminal';

export type BackgroundId = 'solid' | 'stealthGrid' | 'documentPaper' | 'darkCode' | 'custom';

export interface BackgroundSettings {
  id: BackgroundId;
  opacity: number;
  customImageDataUrl?: string;
}

export interface UserSettings {
  mode: GameMode;
  themeId: ThemeId;
  background: BackgroundSettings;
  compactMode: boolean;
}

export type MapNodeType = 'combat' | 'elite' | 'event' | 'rest' | 'shop' | 'boss';

export type ActNumber = 1 | 2 | 3;

export type MapNodeStatus = 'locked' | 'available' | 'completed' | 'current';

export interface MapNode {
  id: string;
  index: number;
  floor?: number;
  layer: number;
  parentNodeIds: string[];
  x: number;
  y: number;
  type: MapNodeType;
  label: string;
  lowProfileLabel: string;
  status: MapNodeStatus;
  nextNodeIds: string[];
  enemyGroupId?: string;
  bossId?: string;
}

export type GameScreen =
  | 'mainMenu'
  | 'map'
  | 'combat'
  | 'reward'
  | 'rest'
  | 'shop'
  | 'event'
  | 'runHistory'
  | 'settings'
  | 'victory'
  | 'defeat';

export type SavedRunScreen = GameScreen;

export type RewardType = 'card' | 'gold' | 'relic';

export interface RewardBundle {
  id: string;
  sourceNodeId: string;
  cardChoices: string[];
  gold: number;
  relicChoices: string[];
  potionId?: PotionId;
  claimed: boolean;
}

export type RunStatus = 'active' | 'victory' | 'defeat';

export interface RunSummary {
  id: string;
  seed: string;
  characterClassId: CharacterClassId;
  ascensionLevel?: AscensionLevel;
  status: RunStatus;
  floorReached: number;
  finalHp: number;
  maxHp: number;
  gold: number;
  deckSize: number;
  relicCount: number;
  completedAt: string;
  turnsTaken?: number;
  lowProfileTitle?: string;
}

export interface RestResult {
  nodeId: string;
  action?: 'rest' | 'upgrade';
  beforeHp: number;
  afterHp: number;
  healed: number;
  upgradedCardInstanceId?: string;
  upgradedCardDefinitionId?: string;
  upgradedCardName?: string;
  upgradedLowProfileName?: string;
  upgradeBeforeDescription?: string;
  upgradeAfterDescription?: string;
  upgradeBeforeLowProfileDescription?: string;
  upgradeAfterLowProfileDescription?: string;
  upgradeBeforeCost?: CardCost;
  upgradeAfterCost?: CardCost;
}

export interface CombatStartSnapshot {
  id: string;
  nodeId: string;
  floor: number;
  rngSeed: number;
  characterHp: number;
  map: MapNode[];
  potions: PotionInstance[];
  combat: CombatState;
}

export interface ShopStartSnapshot {
  id: string;
  nodeId: string;
  shopSeed: string;
  run: RunState;
}

export interface EventStartSnapshot {
  id: string;
  eventSeed: string;
  run: RunState;
}

export interface CurrentRunSave {
  screen: SavedRunScreen;
  run: RunState;
  combat?: CombatState;
  rewards: RewardOption[];
  pendingReward?: RewardBundle;
  savedAt: string;
}

export type RunHistoryResult = 'victory' | 'defeat' | 'abandoned';

export type RunHistoryEntry = RunSummary;

export type StatusId =
  | 'vulnerable'
  | 'weak'
  | 'frail'
  | 'strength'
  | 'dexterity'
  | 'artifact'
  | 'thorns'
  | 'regen'
  | 'bleed'
  | 'barrierLock'
  | 'blockRetention'
  | 'noDraw'
  | 'noEnergyGain'
  | 'vulnerableEnemyDamageReduction'
  | 'skillZeroExhaust'
  | 'startTurnLoseHpBlock'
  | 'vulnerableDamageBonus'
  | 'drawOnExhaust'
  | 'blockOnExhaust'
  | 'startTurnStrength'
  | 'startTurnExhaustTopCard'
  | 'startTurnRecallAttack'
  | 'counterAttack'
  | 'autoPlayDrawnBasicAttack'
  | 'startTurnLoseHpDamageAll'
  | 'damageAllOnHpLoss'
  | 'damageRandomOnBlock'
  | 'thirdAttackCopy'
  | 'temporaryStrength'
  | 'nextAttackExtraPlay'
  | 'nextAttackFree'
  | 'startTurnEnergy'
  | 'attackBlockThisTurn'
  | 'hpLossStrength'
  | 'endTurnAutoPlayAttack'
  | 'firstCardBlockDouble'
  | 'drawOnVulnerable'
  | 'enemyAttackDown30'
  | 'startTurnDraw'
  | 'startTurnEnergyNextTurns'
  | 'corrosiveLeak'
  | 'temporaryDexterity'
  | 'retainHand'
  | 'nextCardExtraPlay'
  | 'nextAttackDamageMultiplier'
  | 'startTurnBlock'
  | 'plating'
  | 'buffer'
  | 'ritual'
  | 'slippery'
  | 'slow'
  | 'constrict'
  | 'tangled'
  | 'tender'
  | 'slumber'
  | 'stun'
  | 'spawned'
  | 'curlUp'
  | 'reattach'
  | 'vitalSpark'
  | 'personalHive'
  | 'sandpit'
  | 'galvanic'
  | 'stock'
  | 'paperCuts'
  | 'plow'
  | 'ringing'
  | 'chainsOfBinding'
  | 'intangible'
  | 'painfulStabs'
  | 'nemesis'
  | 'pollutionSlimed'
  | 'pollutionDazed'
  | 'pollutionBurn'
  | 'pollutionWound'
  | 'infection'
  | 'toxic';

export type StatusMap = Partial<Record<StatusId, number>>;

export type StatusDecayTiming = 'turnStart' | 'turnEnd' | 'never';

export interface StatusDefinition {
  id: StatusId;
  label: string;
  isNegative?: boolean;
  decayTiming: StatusDecayTiming;
  attackDamageDealtFlatPerStack?: number;
  attackDamageDealtMultiplier?: number;
  attackDamageReceivedMultiplier?: number;
  blockGainFlatPerStack?: number;
  blockGainMultiplier?: number;
  preventsNegativeStatus?: boolean;
  thornsDamagePerStack?: number;
  turnEndHealPerStack?: number;
  turnEndHpLossPerStack?: number;
  preservesBlockAtTurnStart?: boolean;
  preservesBlockEveryTurn?: boolean;
}

export type RelicId = string;

export type RelicRarity = 'common' | 'uncommon' | 'rare';

export type RelicHook =
  | 'onCombatStart'
  | 'onTurnStart'
  | 'onTurnEnd'
  | 'onCardPlayed'
  | 'onAttackPlayed'
  | 'onSkillPlayed'
  | 'onEnemyKilled'
  | 'onShuffle'
  | 'onVictory';

export type RelicTriggerCondition =
  | {
      type: 'turnEquals';
      value: number;
    }
  | {
      type: 'firstSkillThisTurn';
    };

export type RelicEffect =
  | {
      type: 'applyStatus';
      target: 'player';
      status: StatusId;
      amount: number;
    }
  | {
      type: 'block';
      target: 'player';
      amount: number;
    }
  | {
      type: 'draw';
      amount: number;
    }
  | {
      type: 'gainEnergy';
      amount: number;
    }
  | {
      type: 'heal';
      amount: number;
    };

export interface RelicTrigger {
  hook: RelicHook;
  condition?: RelicTriggerCondition;
  effects: RelicEffect[];
}

export interface RelicDefinition {
  id: RelicId;
  name: string;
  lowProfileName: string;
  rarity: RelicRarity;
  starter?: boolean;
  description: string;
  lowProfileDescription: string;
  triggers: RelicTrigger[];
}

export type CardCondition =
  | {
      type: 'playerHpAtOrBelowHalf';
    }
  | {
      type: 'playerHasBlock';
    }
  | {
      type: 'exhaustedCardThisTurn';
    }
  | {
      type: 'lostHpThisTurn';
    }
  | {
      type: 'exhaustPileAtLeast';
      amount: number;
    }
  | {
      type: 'targetHasStatus';
      status: StatusId;
    };

export type CardEffect =
  | {
      type: 'damage';
      amount: number;
      target: 'enemy' | 'allEnemies';
    }
  | {
      type: 'damageAll';
      amount: number;
    }
  | {
      type: 'damageRepeated';
      amount: number;
      times: number | 'x' | 'hpLossEventsThisCombat';
      target: 'enemy';
    }
  | {
      type: 'damageRandomEnemy';
      amount: number;
      times: number;
    }
  | {
      type: 'damageAllRepeated';
      amount: number;
      times: 'x';
    }
  | {
      type: 'damageAllPerAttackPlayed';
      baseAmount: number;
      amountPerAttack: number;
    }
  | {
      type: 'damagePerPileCard';
      amountPerCard: number;
      pile: 'exhaust';
      target: 'enemy';
    }
  | {
      type: 'damagePerStatusStack';
      amountPerStack: number;
      status: StatusId;
      target: 'enemy';
    }
  | {
      type: 'damagePerCardsExhaustedThisTurn';
      amountPerCard: number;
      target: 'enemy';
    }
  | {
      type: 'damagePerBasicAttackCard';
      amountPerCard: number;
      target: 'enemy';
    }
  | {
      type: 'damageEqualToBlock';
      target: 'enemy';
    }
  | {
      type: 'block';
      amount: number;
      target?: 'player';
    }
  | {
      type: 'draw';
      amount: number;
    }
  | {
      type: 'drawUntilCardType';
      cardType: CardType;
      invert?: boolean;
    }
  | {
      type: 'discard';
      amount: number;
    }
  | {
      type: 'copySelfToDiscard';
      amount: number;
    }
  | {
      type: 'copySelfToHand';
      amount: number;
    }
  | {
      type: 'upgradeCardsInHand';
      amount: number | 'all';
    }
  | {
      type: 'preventDrawThisTurn';
    }
  | {
      type: 'exhaustFromHand';
      amount: number | 'all';
      random?: boolean;
      cardType?: CardType;
      excludeType?: CardType;
    }
  | {
      type: 'moveDiscardToDrawTop';
      amount: number;
    }
  | {
      type: 'playTopCards';
      count: number | 'x' | 'xPlusOne';
      exhaustPlayed?: boolean;
    }
  | {
      type: 'gainEnergy';
      amount: number;
    }
  | {
      type: 'gainEnergyPerCardInHand';
      cardType: CardType;
    }
  | {
      type: 'preventEnergyGainThisTurn';
    }
  | {
      type: 'loseHp';
      amount: number;
      target?: 'player';
    }
  | {
      type: 'heal';
      amount: number;
      target?: 'player';
    }
  | {
      type: 'blockNextTurn';
      amount: number;
    }
  | {
      type: 'blockPerCardsExhaustedThisTurn';
      amountPerCard: number;
    }
  | {
      type: 'applyStatus';
      status: StatusId;
      amount: number;
      target: 'player' | 'enemy';
    }
  | {
      type: 'applyStatusAll';
      status: StatusId;
      amount: number;
    }
  | {
      type: 'gainStatusPerTargetStatusStack';
      status: StatusId;
      targetStatus: StatusId;
      amountPerStack: number;
      target: 'player';
    }
  | {
      type: 'gainMaxHpIfTargetKilled';
      amount: number;
    }
  | {
      type: 'addRandomCardToHand';
      cardType?: CardType;
      upgraded?: boolean;
      costOverride?: number;
      exhaustOnPlay?: boolean;
    }
  | {
      type: 'addRandomCardsPerCardsExhaustedThisTurn';
      upgraded?: boolean;
    }
  | {
      type: 'doubleTargetStatus';
      status: StatusId;
    }
  | {
      type: 'gainTemporaryStrength';
      amount: number;
      target: 'player' | 'enemy';
    }
  | {
      type: 'requireExhaustPileAtLeast';
      amount: number;
    }
  | {
      type: 'setNextAttackExtraPlay';
      count: number;
    }
  | {
      type: 'setNextAttackFree';
      count: number;
    }
  | {
      type: 'setReplayForName';
      nameIncludes: string;
      amount: number;
    }
  | {
      type: 'costReducedByAttacksPlayedThisTurn';
    }
  | {
      type: 'increaseThisCardDamage';
      amount: number;
    }
  | {
      type: 'exhaustRandomAttackAndAddDamageToThisCard';
    }
  | {
      type: 'autoPlayFromExhaust';
      timing: 'turnStart' | 'turnEnd';
    }
  | {
      type: 'conditional';
      condition: CardCondition;
      effects: CardEffect[];
      elseEffects?: CardEffect[];
    }
  | {
      type: 'exhaustSelf';
    };

export interface CardDefinition {
  id: string;
  name: string;
  lowProfileName: string;
  type: CardType;
  rarity: CardRarity;
  cost: CardCost;
  target: CardTarget;
  description: string;
  lowProfileDescription: string;
  effects: CardEffect[];
  upgrade?: CardUpgrade;
  retain?: boolean;
  innate?: boolean;
  keywords?: CardKeyword[];
  curseTriggers?: CurseTrigger[];
  unremovable?: boolean;
  removeAfterCombats?: number;
}

export interface CardUpgrade {
  cost?: CardCost;
  description?: string;
  lowProfileDescription?: string;
  effects?: CardEffect[];
  innate?: boolean;
}

export interface CardInstance {
  instanceId: string;
  definitionId: string;
  upgraded: boolean;
  costOverride?: number;
  exhaustOnPlay?: boolean;
  damageBonus?: number;
  replay?: number;
  remainingCombats?: number;
}

export type CardKeyword = 'unplayable' | 'ethereal' | 'eternal' | 'retain' | 'innate' | 'exhaust';

export type CurseTriggerTiming = 'turnEndInHand' | 'combatStart';

export type CurseTriggerEffect =
  | {
      type: 'loseHp';
      amount: number;
    }
  | {
      type: 'takeDamage';
      amount: number;
    }
  | {
      type: 'loseGold';
      amount: number;
    }
  | {
      type: 'applyStatus';
      status: StatusId;
      amount: number;
    }
  | {
      type: 'loseHpPerHandCard';
      amountPerCard: number;
    };

export interface CurseTrigger {
  timing: CurseTriggerTiming;
  effects: CurseTriggerEffect[];
}

export type PotionId = string;

export type PotionRarity = 'common' | 'uncommon' | 'rare' | 'event' | 'token';

export type PotionTarget = 'self' | 'enemy' | 'allEnemies' | 'none';

export type PotionEffect =
  | {
      type: 'heal';
      amount: number;
    }
  | {
      type: 'healPercentMaxHp';
      percent: number;
    }
  | {
      type: 'block';
      amount: number;
    }
  | {
      type: 'multiplyBlock';
      multiplier: number;
    }
  | {
      type: 'draw';
      amount: number;
    }
  | {
      type: 'gainEnergy';
      amount: number;
    }
  | {
      type: 'gainMaxHp';
      amount: number;
    }
  | {
      type: 'damage';
      amount: number;
      target: 'enemy' | 'allEnemies';
    }
  | {
      type: 'applyStatus';
      status: StatusId;
      amount: number;
      target: 'player' | 'enemy';
    }
  | {
      type: 'applyStatusAll';
      status: StatusId;
      amount: number;
      target: 'enemies';
    }
  | {
      type: 'gainTemporaryStatus';
      status: 'strength' | 'dexterity';
      amount: number;
      target: 'player' | 'enemy' | 'allEnemies';
    }
  | {
      type: 'upgradeHand';
    }
  | {
      type: 'shuffleAllIntoDrawAndDraw';
      draw: number;
    }
  | {
      type: 'playTopCards';
      count: number;
    }
  | {
      type: 'fillPotionSlots';
    }
  | {
      type: 'deathWard';
      healPercent: number;
    }
  | {
      type: 'moveDiscardToHand';
      amount: number;
      costOverride?: number;
      random?: boolean;
    }
  | {
      type: 'addRandomCardsToHand';
      cardTypes: CardType[];
      upgraded?: boolean;
      costOverride?: number;
      exhaustOnPlay?: boolean;
    }
  | {
      type: 'randomizeHandCostsThisTurn';
    }
  | {
      type: 'retainHand';
      turns: number;
    }
  | {
      type: 'applyReplayToCardsByName';
      nameIncludes: string;
      amount: number;
    };

export interface PotionDefinition {
  id: PotionId;
  name: string;
  lowProfileName: string;
  rarity: PotionRarity;
  characterClassId?: CharacterClassId;
  description: string;
  lowProfileDescription: string;
  target: PotionTarget;
  effects: PotionEffect[];
}

export interface PotionInstance {
  instanceId: string;
  definitionId: PotionId;
}

export type EnemyIntentType = 'attack' | 'defend' | 'debuff' | 'mixed' | 'wait';

export interface EnemyIntent {
  type: EnemyIntentType;
  label: string;
  damage?: number;
  block?: number;
  status?: {
    id: StatusId;
    amount: number;
  };
}

export type EnemyEffect =
  | {
      type: 'damage';
      amount: number;
      target: 'player';
    }
  | {
      type: 'damageRepeated';
      amount: number;
      times: number;
      target: 'player';
    }
  | {
      type: 'block';
      amount: number;
      target: 'self';
    }
  | {
      type: 'applyStatus';
      status: StatusId;
      amount: number;
      target: 'player' | 'self';
    };

export interface EnemyMove {
  id: string;
  name: string;
  lowProfileName?: string;
  intent: EnemyIntent;
  effects: EnemyEffect[];
}

export type EnemyRole = 'normal' | 'elite' | 'boss' | 'summon' | 'part' | 'legacy';

export interface EnemyDefinition {
  id: string;
  name: string;
  lowProfileName?: string;
  description?: string;
  lowProfileDescription?: string;
  act?: ActNumber;
  role?: EnemyRole;
  maxHp: number;
  initialStatuses?: StatusMap;
  intentPattern: string[];
  moves: EnemyMove[];
}

export interface CombatantState {
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  statuses: StatusMap;
}

export interface EnemyCombatantState extends CombatantState {
  instanceId: string;
  definitionId: string;
  lowProfileName?: string;
  moveIndex: number;
  intent: EnemyIntent;
  defeated: boolean;
}

export type CombatPhase = 'player' | 'enemy' | 'won' | 'lost' | 'victory' | 'defeat';

export interface CombatState {
  id: string;
  rngSeed: number;
  ascensionLevel: AscensionLevel;
  turn: number;
  phase: CombatPhase;
  player: CombatantState;
  enemies: EnemyCombatantState[];
  drawPile: CardInstance[];
  hand: CardInstance[];
  discardPile: CardInstance[];
  exhaustPile: CardInstance[];
  energy: number;
  maxEnergy: number;
  relics: RelicId[];
  turnStats: CombatTurnStats;
  combatStats: CombatStats;
  log: string[];
}

export interface CombatTurnStats {
  cardsPlayed: number;
  attacksPlayed: number;
  skillsPlayed: number;
  powersPlayed: number;
  cardBlockGains: number;
  cardsExhausted: number;
  lostHpThisTurn: boolean;
  killedEnemyIds: string[];
}

export interface CombatStats {
  hpLossEvents: number;
  goldLost?: number;
}

export interface CharacterState {
  id: CharacterId;
  name: string;
  hp: number;
  maxHp: number;
  gold: number;
}

export type ShopItemType = 'card' | 'relic' | 'potion' | 'remove';

export interface ShopItem {
  id: string;
  type: ShopItemType;
  refId?: string;
  price: number;
  sold: boolean;
}

export interface ShopState {
  nodeId: string;
  items: ShopItem[];
  removeCardPrice: number;
}

export type EventKind = 'major' | 'minor';

export type EventChoiceStatus = 'available' | 'locked' | 'blocked';

export type EventEffect =
  | {
      type: 'gainGold';
      amount: number;
    }
  | {
      type: 'loseGold';
      amount: number | 'all';
    }
  | {
      type: 'loseHp';
      amount: number;
    }
  | {
      type: 'healToAtLeastPercent';
      percent: number;
    }
  | {
      type: 'gainMaxHp';
      amount: number;
      healSameAmount?: boolean;
    }
  | {
      type: 'gainPotionSlot';
      amount: number;
    }
  | {
      type: 'addRandomPotion';
      amount: number;
      rarity?: PotionRarity;
    }
  | {
      type: 'loseRandomPotion';
      amount: number;
    }
  | {
      type: 'addRandomRelic';
      amount: number;
      rarity?: RelicRarity;
    }
  | {
      type: 'removeRandomRelic';
      amount: number;
    }
  | {
      type: 'addCard';
      cardId: string;
      upgraded?: boolean;
    }
  | {
      type: 'addRandomCard';
      amount: number;
      rarity?: RewardCardRarity;
      cardType?: CardType;
      upgraded?: boolean;
    }
  | {
      type: 'addCurse';
      cardId: string;
    }
  | {
      type: 'addRandomCurse';
      amount: number;
    }
  | {
      type: 'upgradeRandomCards';
      amount: number;
      nameIncludes?: string;
    }
  | {
      type: 'removeRandomCards';
      amount: number;
    }
  | {
      type: 'transformRandomCards';
      amount: number;
      nameIncludes?: string;
    }
  | {
      type: 'downgradeRandomCards';
      amount: number;
    }
  | {
      type: 'blocked';
      reason: string;
    };

export interface EventChoice {
  id: string;
  label: string;
  lowProfileLabel: string;
  description: string;
  lowProfileDescription: string;
  effects: EventEffect[];
  status?: EventChoiceStatus;
  lockedReason?: string;
}

export interface EventDefinition {
  id: string;
  name: string;
  lowProfileName: string;
  kind: EventKind;
  description: string;
  lowProfileDescription: string;
  choices: EventChoice[];
}

export interface EventState {
  id: string;
  eventId: string;
  kind: EventKind;
  nodeId?: string;
  seed: string;
  name: string;
  lowProfileName: string;
  description: string;
  lowProfileDescription: string;
  choices: EventChoice[];
  resultLog: string[];
}

export interface RunState {
  id: string;
  seed: string;
  rngSeed: number;
  status: RunStatus;
  currentScreen: GameScreen;
  character: CharacterState;
  deck: CardInstance[];
  relics: RelicId[];
  potions: PotionInstance[];
  potionSlots: number;
  combatsWon: number;
  map: MapNode[];
  currentNodeId?: string;
  pendingReward?: RewardBundle;
  completedNodeIds: string[];
  act: number;
  floor: number;
  runStartedAt: string;
  ascensionLevel: AscensionLevel;
  shops: Record<string, ShopState>;
  currentShop?: ShopState;
  shopStartSnapshot?: ShopStartSnapshot;
  currentEvent?: EventState;
  eventStartSnapshot?: EventStartSnapshot;
  seenEventIds: string[];
  currentCombat?: CombatState;
  combatStartSnapshot?: CombatStartSnapshot;
  lastRestResult?: RestResult;
  currentSummary?: RunSummary;
  runLog: string[];
}

export interface RewardOption {
  id: string;
  type: 'card';
  cardId: string;
}
