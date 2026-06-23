import { statusLabel } from '../../game/engine/effects';
import type { EnemyCombatantState, GameMode, StatusId } from '../../game/types';
import { getTerminology } from '../terminology/terminology';
import { StatusPill } from './StatusPill';

interface EnemyPanelProps {
  enemy: EnemyCombatantState;
  mode?: GameMode;
  selected?: boolean;
  onSelect?: () => void;
}

export function EnemyPanel({ enemy, mode = 'normal', selected = false, onSelect }: EnemyPanelProps) {
  const terminology = getTerminology(mode);
  const statuses = Object.entries(enemy.statuses).filter(([, amount]) => (amount ?? 0) > 0);
  const displayName = mode === 'stealth' ? enemy.lowProfileName ?? enemy.name : enemy.name;
  const defeated = enemy.defeated || enemy.hp <= 0;
  const title = mode === 'stealth' ? `${terminology.enemy}: ${displayName}` : displayName;
  const defeatedLabel = mode === 'stealth' ? '已完成' : '已击败';

  return (
    <section
      className="panel enemy-panel"
      aria-label={title}
      data-defeated={defeated}
      data-selected={selected && !defeated}
      role={onSelect && !defeated ? 'button' : undefined}
      tabIndex={onSelect && !defeated ? 0 : undefined}
      onClick={!defeated ? onSelect : undefined}
      onKeyDown={(event) => {
        if (!onSelect || defeated) {
          return;
        }

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <h3>
        {title}
        {defeated ? <span className="defeated-label"> {defeatedLabel}</span> : null}
      </h3>
      <div className="stat-line">
        <strong>
          {terminology.hp} {Math.max(0, enemy.hp)}/{enemy.maxHp}
        </strong>
        <span className="pile-chip">
          {terminology.block} {enemy.block}
        </span>
      </div>
      <span className="intent-chip">{defeated ? defeatedLabel : formatIntent(enemy, mode)}</span>
      <div className="status-list">
        {statuses.length === 0
          ? '无状态'
          : statuses.map(([status, amount]) => (
              <StatusPill amount={amount ?? 0} key={status} mode={mode} status={status as StatusId} />
            ))}
      </div>
    </section>
  );
}

function formatIntent(enemy: EnemyCombatantState, mode: GameMode): string {
  const terminology = getTerminology(mode);
  const label = mode === 'stealth' ? stealthIntentLabel(enemy.intent.type) : enemy.intent.label;
  const details = [
    enemy.intent.damage ? `${enemy.intent.damage} ${terminology.damage}` : undefined,
    enemy.intent.block ? `${enemy.intent.block} ${terminology.block}` : undefined,
    enemy.intent.status ? `${enemy.intent.status.amount} ${statusLabel(enemy.intent.status.id)}` : undefined,
  ].filter(Boolean);

  return details.length > 0 ? `${label}: ${details.join(' / ')}` : label;
}

function stealthIntentLabel(type: EnemyCombatantState['intent']['type']): string {
  if (type === 'attack') {
    return 'Advance';
  }
  if (type === 'defend') {
    return 'Buffer';
  }
  if (type === 'debuff') {
    return 'Marker';
  }
  if (type === 'mixed') {
    return 'Combined';
  }
  return 'Pending';
}
