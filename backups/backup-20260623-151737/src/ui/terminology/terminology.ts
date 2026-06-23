import type { GameMode } from '../../game/types';

export interface Terminology {
  combat: string;
  enemy: string;
  card: string;
  energy: string;
  hp: string;
  block: string;
  damage: string;
  turn: string;
  endTurn: string;
  log: string;
  map: string;
  reward: string;
  gold: string;
  relic: string;
  menuTitle: string;
  menuEyebrow: string;
}

export const terminologyByMode: Record<GameMode, Terminology> = {
  normal: {
    combat: '战斗',
    enemy: '敌人',
    card: '卡牌',
    energy: '能量',
    hp: '生命',
    block: '格挡',
    damage: '伤害',
    turn: '回合',
    endTurn: '结束回合',
    log: '战斗日志',
    map: '路线',
    reward: '战利品',
    gold: '金币',
    relic: '遗物',
    menuTitle: 'SlaytheFish2',
    menuEyebrow: '本地离线爬塔卡牌原型',
  },
  stealth: {
    combat: '会话',
    enemy: '目标',
    card: '操作项',
    energy: '配额',
    hp: '稳定度',
    block: '缓冲',
    damage: '推进',
    turn: '周期',
    endTurn: '结束周期',
    log: '处理记录',
    map: '流程面板',
    reward: '处理结果',
    gold: '额度',
    relic: '凭证',
    menuTitle: '本地分析面板',
    menuEyebrow: '本地离线分析工作台',
  },
};

export function getTerminology(mode: GameMode): Terminology {
  return terminologyByMode[mode];
}
