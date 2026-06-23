import { relicById } from '../../game/data/relics/relics';
import type { GameMode, RelicId } from '../../game/types';
import { getTerminology } from '../terminology/terminology';

interface RelicBarProps {
  relicIds: RelicId[];
  mode?: GameMode;
}

export function RelicBar({ relicIds, mode = 'normal' }: RelicBarProps) {
  const terminology = getTerminology(mode);
  const title = mode === 'stealth' ? '凭证区域' : '遗物区域';

  return (
    <section className="relic-bar" aria-label={title}>
      <div className="relic-bar-header">
        <strong>{terminology.relic}</strong>
        <span>{relicIds.length}</span>
      </div>
      {relicIds.length === 0 ? (
        <p className="relic-empty">{mode === 'stealth' ? '暂无凭证' : '没有遗物'}</p>
      ) : (
        <div className="relic-list" role="list">
          {relicIds.map((relicId) => {
            const relic = relicById[relicId];
            const name = mode === 'stealth' ? relic?.lowProfileName ?? relicId : relic?.name ?? relicId;
            const description =
              mode === 'stealth'
                ? relic?.lowProfileDescription ?? ''
                : relic?.description ?? '';

            return (
              <div className="relic-chip" key={relicId} role="listitem" tabIndex={0} title={description}>
                <span>{name}</span>
                {description ? <span className="relic-description">{description}</span> : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
