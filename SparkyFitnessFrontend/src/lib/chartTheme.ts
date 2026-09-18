/**
 * Shared recharts styling so every chart reads off the same dark-biometric
 * tokens (see agent-docs/design-system.md) instead of each file hand-rolling
 * its own axis/grid/tooltip colours.
 */

export const chartTheme = {
  grid: {
    stroke: 'hsl(var(--border))',
    strokeDasharray: '3 3',
  },
  axis: {
    stroke: 'hsl(var(--foreground-dim))',
    tick: { fill: 'hsl(var(--foreground-dim))', fontSize: 11 },
  },
  tooltip: {
    contentStyle: {
      backgroundColor: 'hsl(var(--card))',
      border: '1px solid hsl(var(--border-strong))',
      borderRadius: 'var(--radius)',
      boxShadow: 'none',
      fontSize: 12,
    },
    labelStyle: { color: 'hsl(var(--foreground))' },
    itemStyle: { color: 'hsl(var(--muted-foreground))' },
    cursor: { fill: 'hsl(var(--surface-2))' },
  },
  legend: {
    wrapperStyle: { fontSize: 12, color: 'hsl(var(--muted-foreground))' },
  },
  colors: {
    recovery: 'hsl(var(--metric-recovery))',
    workout: 'hsl(var(--metric-workout))',
    sleep: 'hsl(var(--metric-sleep))',
    water: 'hsl(var(--metric-water))',
    fasting: 'hsl(var(--metric-fasting))',
  },
} as const;
