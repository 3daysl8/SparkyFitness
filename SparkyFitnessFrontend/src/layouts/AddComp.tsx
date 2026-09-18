import type React from 'react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AddCompItem {
  value: string;
  label: string;
  icon: LucideIcon;
  fullWidth?: boolean;
}

interface AddCompProps {
  isVisible: boolean;
  onClose: () => void;
  items: AddCompItem[];
  onNavigate: (value: string) => void;
  title?: string;
}

const AddComp: React.FC<AddCompProps> = ({
  isVisible,
  onClose,
  items,
  onNavigate,
  title,
}) => {
  const { t } = useTranslation();

  if (!isVisible) {
    return null;
  }

  const handleItemClick = (value: string) => {
    onNavigate(value);
    onClose();
  };

  //full width support
  const regularItems = items.filter((item) => !item.fullWidth);
  const fullWidthItems = items.filter((item) => item.fullWidth);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-background/60 backdrop-blur-sm animate-sheet-scrim-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-t-3xl border-t border-border-strong bg-card/80 backdrop-blur-xl max-h-[70vh] sm:max-h-[500px] overflow-y-auto pointer-events-auto p-6 pb-20 sm:pb-6 animate-sheet-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground text-xl font-bold p-2 rounded-full hover:bg-surface-2 transition-colors"
          aria-label="Close"
        >
          &times;
        </button>

        <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground mb-4 text-center mt-2">
          {title || t('addComp.quickActions', 'Quick Actions')}
        </h2>

        {/* Regular grid items */}
        {regularItems.length > 0 && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            {regularItems.map((item) => (
              <Button
                key={item.value}
                variant="outline"
                className="flex flex-col items-center justify-center h-24 text-center bg-surface-2 border-border text-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-200"
                onClick={() => handleItemClick(item.value)}
              >
                <item.icon className="h-6 w-6 mb-1" strokeWidth={1.5} />
                <span className="text-sm font-semibold">{item.label}</span>
              </Button>
            ))}
          </div>
        )}

        {/* Full-width items */}
        {fullWidthItems.length > 0 && (
          <div className="flex flex-col gap-3 mt-4">
            {fullWidthItems.map((item) => (
              <Button
                key={item.value}
                variant="outline"
                className="flex items-center justify-center h-16 w-full text-center bg-surface-2 border-border text-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-200"
                onClick={() => handleItemClick(item.value)}
              >
                <item.icon className="h-6 w-6 mr-2" strokeWidth={1.5} />
                <span className="text-base font-semibold">{item.label}</span>
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AddComp;
