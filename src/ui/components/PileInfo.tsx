import { useState } from 'react';
import { warriorCardById } from '../../game/data/cards/warrior';
import type { CardInstance, CombatState, GameMode } from '../../game/types';
import { getTerminology } from '../terminology/terminology';

export type PileKind = 'draw' | 'discard' | 'exhaust';

interface PileInfoProps {
  combat: CombatState;
  mode?: GameMode;
}

const pileLabels: Record<PileKind, { normal: string; stealth: string }> = {
  draw: { normal: '抽牌堆', stealth: '待处理项' },
  discard: { normal: '弃牌堆', stealth: '已处理项' },
  exhaust: { normal: '消耗堆', stealth: '归档项' },
};

export function PileInfo({ combat, mode = 'normal' }: PileInfoProps) {
  const terminology = getTerminology(mode);
  const [selectedPile, setSelectedPile] = useState<PileKind>();
  const selectedCards = selectedPile ? getPileCards(combat, selectedPile) : [];

  return (
    <div className="pile-info" aria-label="牌堆信息">
      <div className="pile-row">
        {(['draw', 'discard', 'exhaust'] as PileKind[]).map((pile) => (
          <button className="pile-chip pile-button" key={pile} onClick={() => setSelectedPile(pile)}>
            {getPileLabel(pile, mode)} {getPileCards(combat, pile).length}
          </button>
        ))}
        <span className="pile-chip">
          {terminology.card} {combat.hand.length}
        </span>
      </div>

      {selectedPile ? (
        <section className="pile-viewer" aria-label={getPileLabel(selectedPile, mode)}>
          <div className="pile-viewer-header">
            <h3>{getPileLabel(selectedPile, mode)}</h3>
            <button className="secondary-button" onClick={() => setSelectedPile(undefined)}>
              关闭
            </button>
          </div>
          {selectedCards.length > 0 ? (
            <ul className="pile-card-list">
              {selectedCards.map((cardInstance) => {
                const card = warriorCardById[cardInstance.definitionId];
                const name = mode === 'stealth' ? card.lowProfileName : card.name;
                const description = mode === 'stealth' ? card.lowProfileDescription : card.description;
                return (
                  <li className="pile-card-item" key={cardInstance.instanceId} title={description}>
                    <strong>{name}</strong>
                    <span>
                      {terminology.energy} {card.cost}
                    </span>
                    <p>{description}</p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="settings-note">
              {mode === 'stealth' ? '暂无操作项。' : '暂无卡牌。'}
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}

export function getPileCards(combat: CombatState, pile: PileKind): CardInstance[] {
  if (pile === 'draw') {
    return combat.drawPile;
  }

  if (pile === 'discard') {
    return combat.discardPile;
  }

  return combat.exhaustPile;
}

export function getPileLabel(pile: PileKind, mode: GameMode = 'normal'): string {
  return mode === 'stealth' ? pileLabels[pile].stealth : pileLabels[pile].normal;
}
