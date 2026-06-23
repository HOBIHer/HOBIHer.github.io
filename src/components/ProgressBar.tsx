interface ProgressBarProps {
  value: number
  tone?: 'gold' | 'hp' | 'qi' | 'jade'
  label?: string
}

export function ProgressBar({ value, tone = 'gold', label }: ProgressBarProps) {
  return (
    <div className="progress" aria-label={label}>
      <div className={`progress__fill progress__fill--${tone}`} style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  )
}
