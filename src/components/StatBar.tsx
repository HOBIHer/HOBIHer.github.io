import { ProgressBar } from './ProgressBar'

interface StatBarProps {
  label: string
  value: number
  max: number
  tone: 'hp' | 'qi' | 'gold' | 'jade'
}

export function StatBar({ label, value, max, tone }: StatBarProps) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  return (
    <div className="stat-bar">
      <div className="stat-bar__row">
        <span>{label}</span>
        <strong>
          {Math.floor(value)} / {Math.floor(max)}
        </strong>
      </div>
      <ProgressBar value={pct} tone={tone} label={label} />
    </div>
  )
}
