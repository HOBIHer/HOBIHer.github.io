import { statusLabel } from '../../game/engine/effects';
import type { GameMode, StatusId } from '../../game/types';
import { getStatusDescription } from '../terminology/statusDescriptions';

interface StatusPillProps {
  status: StatusId;
  amount: number;
  mode?: GameMode;
}

export function StatusPill({ status, amount, mode = 'normal' }: StatusPillProps) {
  const label = statusLabel(status);
  const description = getStatusDescription(status, mode);

  return (
    <span
      aria-label={`${label} ${amount}。${description}`}
      className="status-chip status-pill"
      tabIndex={0}
      title={description}
    >
      {label} {amount}
      <span className="status-tooltip" role="tooltip">
        {description}
      </span>
    </span>
  );
}
