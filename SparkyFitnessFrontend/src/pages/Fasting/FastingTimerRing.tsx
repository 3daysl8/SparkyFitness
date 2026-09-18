import type React from 'react';
import { useEffect, useState, useMemo } from 'react';
import { CircularProgress } from '@/components/ui/circular-progress';

interface FastingTimerRingProps {
  startTime: Date;
  targetEndTime: Date;
  size?: number;
}

const milestoneHours = [0, 16, 24, 72];

function getZone(hours: number) {
  if (hours < 4) return { name: 'Anabolic' };
  if (hours < 16) return { name: 'Catabolic' };
  if (hours < 24) return { name: 'Fat Burning' };
  return { name: 'Ketosis' };
}

const FastingTimerRing: React.FC<FastingTimerRingProps> = ({
  startTime,
  targetEndTime,
  size = 220,
}) => {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const totalDurationMs = Math.max(
    1,
    targetEndTime.getTime() - startTime.getTime()
  );
  const elapsedMs = Math.max(0, now.getTime() - startTime.getTime());
  const progress = Math.min(100, (elapsedMs / totalDurationMs) * 100);

  const formatTime = (ms: number) => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const hoursFasted = elapsedMs / (1000 * 60 * 60);
  const zone = useMemo(() => getZone(hoursFasted), [hoursFasted]);

  // Milestone ticks sit on the same 270deg open arc as the ring itself
  // (gap centered at the bottom), scaled against the 72h outer milestone.
  // Matches CircularProgress's own fixed 36-unit viewBox / r=15.9155 ring.
  const sweep = 270;
  const RADIUS = 15.9155;
  const angleForHour = (hour: number) => 360 - sweep / 2 + (hour / 72) * sweep;
  const tickPoint = (hour: number, r: number) => {
    const rad = (angleForHour(hour) * Math.PI) / 180;
    return { x: 18 + r * Math.sin(rad), y: 18 - r * Math.cos(rad) };
  };

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <CircularProgress
        value={progress}
        size={size}
        strokeWidth={4}
        sweep={sweep}
        className="text-metric-fasting"
        trackClassName="text-surface-2"
      />

      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        className="pointer-events-none absolute inset-0"
      >
        {milestoneHours.map((h) => {
          const inner = tickPoint(h, RADIUS - 3);
          const outer = tickPoint(h, RADIUS + 3);
          return (
            <line
              key={h}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              className="stroke-border-strong"
              strokeWidth={0.6}
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      <div className="absolute z-10 flex flex-col items-center text-center px-4">
        <div className="metric-num text-2xl text-foreground">
          {formatTime(elapsedMs)}
        </div>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1">
          <span className="size-1.5 shrink-0 rounded-full bg-metric-fasting" />
          <span className="text-xs font-medium text-foreground">
            {zone.name}
          </span>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {progress >= 100 ? 'Goal Reached' : `${Math.round(progress)}%`}
        </div>
      </div>
    </div>
  );
};

export default FastingTimerRing;
