import type React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FastingZoneBarProps {
  hoursFasted: number;
}

const ZONES = [
  { name: 'Anabolic', start: 0, end: 4, desc: 'Rising blood sugar.' },
  { name: 'Catabolic', start: 4, end: 16, desc: 'Blood sugar falls.' },
  { name: 'Fat Burning', start: 16, end: 24, desc: 'Ramping up fat burn.' },
  { name: 'Ketosis', start: 24, end: 72, desc: 'Running on ketones.' },
  { name: 'Deep Ketosis', start: 72, end: 1000, desc: 'Autophagy peaks.' },
];

const FastingZoneBar: React.FC<FastingZoneBarProps> = ({ hoursFasted }) => {
  const { t } = useTranslation();
  const currentZoneIndex = ZONES.findIndex((z) => hoursFasted < z.end);
  const activeIndex =
    currentZoneIndex === -1 ? ZONES.length - 1 : currentZoneIndex;

  return (
    <div className="w-full space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {t('fasting.metabolicState', 'Metabolic State')}
      </p>
      <div className="flex h-2 w-full gap-0.5">
        {ZONES.map((zone, index) => {
          const isActive = index === activeIndex;
          return (
            <TooltipProvider key={zone.name}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'h-full flex-1 rounded-full transition-colors duration-500 cursor-help',
                      isActive ? 'bg-metric-fasting' : 'bg-surface-2'
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="font-medium">{zone.name}</div>
                  <div className="text-xs">
                    {zone.start}-{zone.end} hours
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {zone.desc}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
      <div className="flex justify-between text-xs font-medium text-muted-foreground">
        <span>0h</span>
        <span>16h</span>
        <span>24h</span>
        <span>72h+</span>
      </div>
    </div>
  );
};

export default FastingZoneBar;
