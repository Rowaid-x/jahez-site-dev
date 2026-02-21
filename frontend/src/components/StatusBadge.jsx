const statusStyles = {
  active: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  cancelled: 'bg-dark-500/20 text-dark-400 border-dark-500/30',
  paid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
  partial: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  fully_paid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  on_track: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
}

export default function StatusBadge({ status }) {
  const style = statusStyles[status] || statusStyles.pending
  const label = status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown'

  return (
    <span className={`
      inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
      border ${style}
    `}>
      {label}
    </span>
  )
}
