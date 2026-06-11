import type { KeyboardEvent } from 'react';
import type { CardDefinition, GameMode } from '../../game/types';
import { splitTextByKeywordDescriptions } from '../terminology/keywordDescriptions';
import { getTerminology } from '../terminology/terminology';

interface CardViewProps {
  card: CardDefinition;
  mode?: GameMode;
  disabled?: boolean;
  onClick?: () => void;
}

const typeLabels: Record<CardDefinition['type'], string> = {
  attack: '攻击',
  skill: '技能',
  power: '能力',
  curse: '诅咒',
};

export function CardView({ card, mode = 'normal', disabled = false, onClick }: CardViewProps) {
  const terminology = getTerminology(mode);
  const displayName = mode === 'stealth' ? card.lowProfileName : card.name;
  const description = mode === 'stealth' ? card.lowProfileDescription : card.description;
  const typeLabel = mode === 'stealth' && card.type === 'curse' ? '异常项' : mode === 'stealth' ? terminology.card : typeLabels[card.type];
  const costLabel =
    card.cost === 'X' ? 'X' : card.cost === 'unplayable' ? '—' : String(card.cost);
  const interactive = Boolean(onClick);
  const handleClick = () => {
    if (!disabled) {
      onClick?.();
    }
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || disabled) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      aria-disabled={disabled || undefined}
      className={`card-button ${card.type}`}
      data-disabled={disabled || undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive && !disabled ? 0 : undefined}
    >
      <span className="card-header">
        <span className="card-name">{displayName}</span>
        <span className="card-cost">{costLabel}</span>
      </span>
      <span className="card-type">{typeLabel}</span>
      <p aria-label={description} className="card-description" data-description={description}>
        {splitTextByKeywordDescriptions(description, mode).map((segment, index) =>
          segment.description ? (
            <span
              aria-label={`${segment.text}: ${segment.description}`}
              className="mechanic-keyword"
              data-tooltip={segment.description}
              key={`${segment.text}-${index}`}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              tabIndex={0}
              title={segment.description}
            >
              {segment.text}
            </span>
          ) : (
            segment.text
          ),
        )}
      </p>
    </div>
  );
}
