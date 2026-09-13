import ActiveProgramWidget from './ActiveProgramWidget';
import WorkoutPresetsManager from './WorkoutPresetsManager';
import WorkoutPlansManager from './WorkoutPlansManager';

const WorkoutsRoutinesTab = () => {
  return (
    <div className="space-y-6">
      <ActiveProgramWidget />
      <WorkoutPlansManager />
      <WorkoutPresetsManager />
    </div>
  );
};

export default WorkoutsRoutinesTab;
