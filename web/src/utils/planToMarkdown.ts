import type { PlanData } from '../hooks/usePlan';

export function planToMarkdown(plan: PlanData): string {
  const lines: string[] = [];
  const title = plan.objective
    ? plan.objective.charAt(0).toUpperCase() + plan.objective.slice(1).replace('-', ' ')
    : 'Training Plan';
  lines.push(`# ${title}`);
  if (plan.targetDate) {
    lines.push(`*Target date: ${plan.targetDate}*`);
  }
  for (const phase of plan.phases) {
    lines.push('');
    lines.push(`## ${phase.name}`);
    if (phase.description) lines.push(`*${phase.description}*`);
    for (const week of phase.weeks) {
      lines.push('');
      lines.push(`### Week ${week.weekNumber}`);
      for (const day of week.days) {
        if (day.type === 'rest') {
          lines.push(`- Rest`);
          continue;
        }
        const dayLabel = day.label ? `Day ${day.label}` : '';
        const obj = day.objective
          ? `${day.objective.value} ${day.objective.unit}`
          : '';
        const status = day.completed ? ' ✓' : day.skipped ? ' _(skipped)_' : '';
        const text = `${obj}${obj && day.guidelines ? ' -- ' : ''}${day.guidelines}`;
        const wrapped = (day.completed || day.skipped) ? `~~${text}~~` : text;
        lines.push(`- **${dayLabel}**${status} ${wrapped}`);
      }
    }
  }
  return lines.join('\n');
}
