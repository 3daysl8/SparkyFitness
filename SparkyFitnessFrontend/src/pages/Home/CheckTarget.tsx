import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CheckTarget({ done }: { done: boolean }) {
  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
        done
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-muted-foreground/30 text-transparent'
      )}
    >
      <Check
        key={String(done)}
        className={cn('h-4 w-4', done && 'animate-check-pop')}
      />
    </span>
  );
}
