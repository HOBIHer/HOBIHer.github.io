import type { CombatantState, GameMode } from '../../game/types';
import { getTerminology } from '../terminology/terminology';
import { StatusPill } from './StatusPill';

interface PlayerPanelProps {
  player: CombatantState;
  energy: number;
  maxEnergy: number;
  mode?: GameMode;
}

export function PlayerPanel({ player, energy, maxEnergy, mode = 'normal' }: PlayerPanelProps) {
  const terminology = getTerminology(mode);

  return (
    <section className="panel" aria-label="玩家">
      <h2>{player.name}</h2>
      <div className="stat-line">
        <strong>
          {terminology.hp} {player.hp}/{player.maxHp}
        </strong>
        <span className="pile-chip">
          {terminology.block} {player.block}
        </span>
        <span className="energy-chip">
          {terminology.energy} {energy}/{maxEnergy}
        </span>
      </div>
      <StatusList mode={mode} statuses={player.statuses} />
    </section>
  );
}

function StatusList({ mode, statuses }: { mode: GameMode; statuses: CombatantState['statuses'] }) {
  const entries = Object.entries(statuses).filter(([, amount]) => (amount ?? 0) > 0);

  if (entries.length === 0) {
    return <div className="status-list">无状态</div>;
  }

  return (
    <div className="status-list">
      {entries.map(([status, amount]) => (
        <StatusPill
          amount={amount ?? 0}
          key={status}
          mode={mode}
          status={status as keyof CombatantState['statuses']}
        />
      ))}
    </div>
  );
}
