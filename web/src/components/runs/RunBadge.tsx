interface RunBadgeProps {
  discipline: 'run' | 'gym' | 'cycle';
}

const BADGE_CONFIG = {
  run:   { icon: '🏃', label: 'Run',     color: 'bg-blue-100 text-blue-700' },
  gym:   { icon: '💪', label: 'Gym',     color: 'bg-orange-100 text-orange-700' },
  cycle: { icon: '🚴', label: 'Cycling', color: 'bg-green-100 text-green-700' },
};

export function RunBadge({ discipline }: RunBadgeProps) {
  const badge = BADGE_CONFIG[discipline];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
      <span aria-hidden="true">{badge.icon}</span>
      <span>{badge.label}</span>
    </span>
  );
}
