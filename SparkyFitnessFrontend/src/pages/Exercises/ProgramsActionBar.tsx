import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface ProgramsActionBarProps {
  onAddSchedule: () => void;
  onCreateProgram: () => void;
}

const ProgramsActionBar = ({
  onAddSchedule,
  onCreateProgram,
}: ProgramsActionBarProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={onAddSchedule} className="gap-2">
        <Plus className="h-4 w-4" />
        {t('exercise.workoutsPage.addTrainingSchedule', 'Training Schedule')}
      </Button>
      <Button onClick={onCreateProgram} className="gap-2">
        <Plus className="h-4 w-4" />
        {t('exercise.workoutsPage.createProgram', 'Create Program')}
      </Button>
    </div>
  );
};

export default ProgramsActionBar;
