export type CharacterId = 'iron-oath';

export type CharacterClassId = CharacterId;

export type CardType = 'attack' | 'skill' | 'power';

export type CardRarity = 'starter' | 'common' | 'uncommon' | 'rare';

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

export type MapNodeType = 'combat' | 'elite' | 'rest' | 'boss';

export type MapNodeStatus = 'locked' | 'available' | 'completed' | 'current';

export interface MapNode {
  id: string;
  index: number;
  floor?: number;
  type: MapNodeType;
  label: string;
  lowProfileLabel: string;
  status: MapNodeStatus;
  nextNodeIds?: string[];
  enemyGroupId?: string;
  bossId?: string;
}

export type GameScreen =
  | 'mainMenu'
  | 'map'
  | 'combat'
  | 'reward'
  | 'rest'
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
  claimed: boolean;
}

export type RunStatus = 'active' | 'victory' | 'defeat';

export interface RunSummary {
  id: string;
  seed: string;
  characterClassId: CharacterClassId;
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
  beforeHp: number;
  afterHp: number;
  healed: number;
}

export interface CombatStartSnapshot {
  id: string;
  nodeId: string;
  floor: number;
  rngSeed: number;
  characterHp: number;
  map: MapNode[];
  combat: CombatState;
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
  | 'barrierLock';

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
      type: 'block';
      amount: number;
      target?: 'player';
    }
  | {
      type: 'draw';
      amount: number;
    }
  | {
      type: 'discard';
      amount: number;
    }
  | {
      type: 'gainEnergy';
      amount: number;
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
      type: 'applyStatus';
      status: StatusId;
      amount: number;
      target: 'player' | 'enemy';
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
  cost: number;
  target: CardTarget;
  description: string;
  lowProfileDescription: string;
  effects: CardEffect[];
  retain?: boolean;
}

export interface CardInstance {
  instanceId: string;
  definitionId: string;
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
  intent: EnemyIntent;
  effects: EnemyEffect[];
}

export interface EnemyDefinition {
  id: string;
  name: string;
  lowProfileName?: string;
  maxHp: number;
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
  log: string[];
}

export interface CombatTurnStats {
  cardsPlayed: number;
  attacksPlayed: number;
  skillsPlayed: number;
  powersPlayed: number;
  killedEnemyIds: string[];
}

export interface CharacterState {
  id: CharacterId;
  name: string;
  hp: number;
  maxHp: number;
  gold: number;
}

export interface RunState {
  id: string;
  seed: string;
  rngSeed: number;
  status: RunStatus;
  currentScreen: GameScreen;
  character: CharacterState;
  deck: string[];
  relics: RelicId[];
  combatsWon: number;
  map: MapNode[];
  currentNodeId?: string;
  pendingReward?: RewardBundle;
  completedNodeIds: string[];
  act: number;
  floor: number;
  runStartedAt: string;
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
