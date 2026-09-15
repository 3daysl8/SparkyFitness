import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CheckTarget({ done }: { done: boolean }) {
  return (
    <span
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
        done
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-muted-foreground/50 text-transparent'
      )}
    >
      <Check
        key={String(done)}
        strokeWidth={3}
        className={cn('h-3 w-3', done && 'animate-check-pop')}
      />
    </span>
  );
}
