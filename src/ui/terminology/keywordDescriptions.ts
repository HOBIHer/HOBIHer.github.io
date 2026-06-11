import type { GameMode } from '../../game/types';

export interface KeywordDescription {
  id: string;
  normalTerms: string[];
  stealthTerms: string[];
  normalDescription: string;
  stealthDescription: string;
}

export interface KeywordTextSegment {
  text: string;
  description?: string;
}

export const keywordDescriptions: KeywordDescription[] = [
  {
    id: 'damage',
    normalTerms: ['伤害', '造成'],
    stealthTerms: ['进度', '推进'],
    normalDescription: '伤害会先被格挡抵消，剩余部分降低生命。',
    stealthDescription: '推进会先被缓冲抵消，剩余部分降低稳定度。',
  },
  {
    id: 'block',
    normalTerms: ['格挡'],
    stealthTerms: ['缓冲'],
    normalDescription: '格挡会抵消来自攻击的伤害，通常在你的回合开始时清空。',
    stealthDescription: '缓冲会保护稳定度并抵消推进压力，通常在新周期开始时清空。',
  },
  {
    id: 'draw',
    normalTerms: ['抽牌', '抽取', '抽'],
    stealthTerms: ['补充'],
    normalDescription: '从抽牌堆把牌加入手牌；抽牌堆为空时会洗入弃牌堆。',
    stealthDescription: '从待处理区把操作项加入当前列表；待处理区为空时会重排归档区。',
  },
  {
    id: 'discard',
    normalTerms: ['弃牌', '弃掉'],
    stealthTerms: ['移出', '归档'],
    normalDescription: '把手牌移动到弃牌堆，之后可被重新洗回抽牌堆。',
    stealthDescription: '把当前操作项移动到归档区，之后可被重新排入待处理区。',
  },
  {
    id: 'exhaust',
    normalTerms: ['消耗'],
    stealthTerms: ['移除'],
    normalDescription: '消耗的牌会离开本场战斗的正常牌堆循环。',
    stealthDescription: '移除的操作项会离开本次会话的常规循环。',
  },
  {
    id: 'vulnerable',
    normalTerms: ['易伤'],
    stealthTerms: ['暴露', '风险标记'],
    normalDescription: '易伤会提高受到的攻击伤害。',
    stealthDescription: '暴露会提高受到的推进压力。',
  },
  {
    id: 'weak',
    normalTerms: ['虚弱'],
    stealthTerms: ['降效'],
    normalDescription: '虚弱会降低造成的攻击伤害。',
    stealthDescription: '降效会降低推进输出。',
  },
  {
    id: 'frail',
    normalTerms: ['脆弱'],
    stealthTerms: ['易扰'],
    normalDescription: '脆弱会降低获得的格挡。',
    stealthDescription: '易扰会降低获得的缓冲。',
  },
  {
    id: 'strength',
    normalTerms: ['力量'],
    stealthTerms: ['推进增幅'],
    normalDescription: '力量会提高攻击造成的伤害。',
    stealthDescription: '推进增幅会提高推进输出。',
  },
  {
    id: 'dexterity',
    normalTerms: ['敏捷'],
    stealthTerms: ['响应'],
    normalDescription: '敏捷会提高从卡牌获得的格挡。',
    stealthDescription: '响应会提高从操作项获得的缓冲。',
  },
  {
    id: 'artifact',
    normalTerms: ['神器'],
    stealthTerms: ['抵消'],
    normalDescription: '神器会抵消下一次可被抵消的负面状态。',
    stealthDescription: '抵消会挡下一次可被抵消的负面影响。',
  },
  {
    id: 'thorns',
    normalTerms: ['荆棘'],
    stealthTerms: ['反击'],
    normalDescription: '受到攻击伤害时，荆棘会对攻击者造成反击伤害。',
    stealthDescription: '受到推进压力时，反击会回敬来源。',
  },
  {
    id: 'regen',
    normalTerms: ['再生'],
    stealthTerms: ['持续修复'],
    normalDescription: '再生会在回合结束时回复生命并逐步减少。',
    stealthDescription: '持续修复会在周期结束时恢复稳定度并逐步减少。',
  },
  {
    id: 'bleed',
    normalTerms: ['流血'],
    stealthTerms: ['持续损耗'],
    normalDescription: '流血会在指定时机造成生命损失。',
    stealthDescription: '持续损耗会在指定时机降低稳定度。',
  },
  {
    id: 'retain',
    normalTerms: ['保留'],
    stealthTerms: ['保留'],
    normalDescription: '保留的牌在回合结束时不会被弃掉。',
    stealthDescription: '保留的操作项在周期结束时不会被归档。',
  },
  {
    id: 'innate',
    normalTerms: ['固有'],
    stealthTerms: ['起始'],
    normalDescription: '固有牌会优先进入起始手牌。',
    stealthDescription: '起始项会优先进入初始处理列表。',
  },
  {
    id: 'plating',
    normalTerms: ['镀层', 'Plating'],
    stealthTerms: ['周期缓冲'],
    normalDescription: '镀层会在你的回合结束时提供等量格挡，并在你的回合开始时减少 1 层。',
    stealthDescription: '周期缓冲会在周期结束时提供等量缓冲，并在新周期开始时减少 1 层。',
  },
  {
    id: 'buffer',
    normalTerms: ['护层', 'Buffer'],
    stealthTerms: ['拦截'],
    normalDescription: '护层会防止下一次生命损失，然后减少 1 层。',
    stealthDescription: '拦截会防止下一次稳定度下降，然后减少 1 层。',
  },
  {
    id: 'ritual',
    normalTerms: ['仪式', 'Ritual'],
    stealthTerms: ['周期增幅'],
    normalDescription: '仪式会在你的回合结束时给予等量力量。',
    stealthDescription: '周期增幅会在周期结束时给予等量推进增幅。',
  },
  {
    id: 'replay',
    normalTerms: ['Replay', '复执'],
    stealthTerms: ['复执'],
    normalDescription: 'Replay 会让这张牌在支付一次费用后额外结算指定次数。',
    stealthDescription: '复执会让该操作项在支付一次成本后额外执行指定次数。',
  },
];

export function getKeywordDescription(term: string, mode: GameMode = 'normal'): string | undefined {
  const normalizedTerm = normalizeTerm(term);
  const entry = keywordDescriptions.find((candidate) =>
    [...candidate.normalTerms, ...candidate.stealthTerms].some((keyword) => normalizeTerm(keyword) === normalizedTerm),
  );

  if (!entry) {
    return undefined;
  }

  return mode === 'stealth' ? entry.stealthDescription : entry.normalDescription;
}

export function splitTextByKeywordDescriptions(text: string, mode: GameMode = 'normal'): KeywordTextSegment[] {
  const terms = getTermsForMode(mode);
  if (terms.length === 0 || text.length === 0) {
    return [{ text }];
  }

  const pattern = new RegExp(terms.map(escapeRegExp).join('|'), 'gi');
  const segments: KeywordTextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const matchedText = match[0];
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }

    segments.push({
      text: matchedText,
      description: getKeywordDescription(matchedText, mode),
    });
    lastIndex = match.index + matchedText.length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ text }];
}

function getTermsForMode(mode: GameMode): string[] {
  const terms = keywordDescriptions.flatMap((entry) =>
    mode === 'stealth' ? entry.stealthTerms : entry.normalTerms,
  );
  return [...new Set(terms)].sort((left, right) => right.length - left.length);
}

function normalizeTerm(term: string): string {
  return term.trim().toLocaleLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
