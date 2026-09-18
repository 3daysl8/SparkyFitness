import { useAuth } from '@/hooks/useAuth';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import SleepEntrySection from './SleepEntrySection';
import SleepVitalsHud from './SleepVitalsHud';
import DayNavigator from '@/components/DayNavigator';
import { CheckInForm } from './CheckInForm';
import { RecentActivity } from './RecentActivity';
import { CheckInTopRow } from './CheckInTopRow';
import { useCheckInLogic } from '@/hooks/CheckIn/useCheckInLogic';
import { useSearchParams } from 'react-router-dom';
import { CheckInPhotos } from './CheckInPhotos';
import { useCheckInPhotoDates } from '@/hooks/CheckIn/useCheckInPhotos';
import { useState } from 'react';
import { EditFastDialog } from '../Fasting/EditFastDialog';
import { useUpdateFastMutation } from '@/hooks/Fasting/useFasting';
import { FastingLog } from '@/types/fasting';
import { CombinedMeasurement } from '@/types/checkin';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { SegmentedControl } from '@/components/biometric/SegmentedControl';
import { Timer, Activity, Moon, Camera, Clock, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Medications from '../Medications/Medications';

const CheckIn = () => {
  const { user } = useAuth();
  const { activeUserId } = useActiveUser();
  const { convertWeight, convertMeasurement } = usePreferences();

  const currentUserId = activeUserId || user?.id;

  const {
    bodyFatPercentage,
    boneMassKg,
    bodyWaterPercentage,
    muscleMassKg,
    bmr,
    customCategories,
    customNotes,
    customValues,
    customPlaceholders,
    handleCalculateBodyFat,
    handleDeleteMeasurementClick,
    handleSubmit,
    height,
    hips,
    loading,
    mood,
    moodNotes,
    moodTags,
    neck,
    placeholders,
    recentMeasurements,
    selectedDate,
    setBodyFatPercentage,
    setBoneMassKg,
    setBodyWaterPercentage,
    setMuscleMassKg,
    setBmr,
    setCustomNotes,
    setCustomValues,
    setHeight,
    setHips,
    setMood,
    setMoodNotes,
    setMoodTags,
    setNeck,
    setSelectedDate,
    setSteps,
    setUseMostRecentForCalculation,
    setWaist,
    setWeight,
    shouldConvertCustomMeasurement,
    steps,
    useMostRecentForCalculation,
    waist,
    weight,
    handleSaveMood,
    isSavingMood,
  } = useCheckInLogic(currentUserId);

  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const photoDates = useCheckInPhotoDates();

  const [editingFast, setEditingFast] = useState<FastingLog | null>(null);
  const [isEditFastOpen, setIsEditFastOpen] = useState(false);
  const { mutateAsync: updateFast } = useUpdateFastMutation();

  const handleEditFastClick = (measurement: CombinedMeasurement) => {
    if (measurement.originalFast) {
      setEditingFast(measurement.originalFast);
      setIsEditFastOpen(true);
    }
  };

  const activeTab = searchParams.get('tab') || 'measurements';

  const handleTabChange = (value: string) => {
    setSearchParams((prev) => {
      prev.set('tab', value);
      return prev;
    });
  };

  return (
    <div className="space-y-6">
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-border">
          {/* Tab Selector on the Left */}
          <SegmentedControl
            className="lg:w-auto"
            value={activeTab}
            onChange={handleTabChange}
            options={[
              {
                value: 'measurements',
                label: t('checkIn.tabs.measurements', 'Measurements'),
                icon: Activity,
              },
              {
                value: 'log',
                label: t('medications.tabs.log', 'Log'),
                icon: Clock,
              },
              {
                value: 'cabinet',
                label: t('medications.tabs.cabinet', 'Cabinet'),
                icon: Package,
              },
              {
                value: 'fasting',
                label: t('checkIn.tabs.fasting', 'Fasting & Mood'),
                icon: Timer,
              },
              {
                value: 'sleep',
                label: t('checkIn.tabs.sleep', 'Sleep'),
                icon: Moon,
              },
              {
                value: 'photos',
                label: t('checkIn.tabs.photos', 'Photos'),
                icon: Camera,
              },
            ]}
          />

          {/* Date Filter on the Right */}
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto lg:justify-end">
            <DayNavigator
              selectedDate={selectedDate}
              onDateChange={(dateString) => {
                setSelectedDate(dateString);
                setSearchParams((prev) => {
                  prev.set('date', dateString);
                  return prev;
                });
              }}
              markedDates={photoDates}
              markedDatesLabel={t(
                'checkIn.photos.calendarLegend',
                'Progress photos'
              )}
              className="grid-cols-none flex mb-0 items-center gap-2"
            />
          </div>
        </div>

        <TabsContent value="log" className="focus-visible:outline-none">
          <Medications view="today" />
        </TabsContent>

        <TabsContent value="cabinet" className="focus-visible:outline-none">
          <Medications view="cabinet" />
        </TabsContent>

        <TabsContent
          value="fasting"
          className="focus-visible:outline-none space-y-6"
        >
          <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {t('checkIn.tabs.fasting', 'Fasting & Mood')}
          </h2>
          <CheckInTopRow
            mood={mood}
            moodNotes={moodNotes}
            moodTags={moodTags}
            setMood={setMood}
            setMoodNotes={setMoodNotes}
            setMoodTags={setMoodTags}
            onSaveMood={handleSaveMood}
            isSavingMood={isSavingMood}
          />
          <RecentActivity
            convertMeasurement={convertMeasurement}
            convertWeight={convertWeight}
            handleDeleteMeasurementClick={handleDeleteMeasurementClick}
            recentMeasurements={recentMeasurements.filter(
              (m) => m.type === 'fasting'
            )}
            shouldConvertCustomMeasurement={shouldConvertCustomMeasurement}
            handleEditFastClick={handleEditFastClick}
            title={t('checkIn.recentFasts', 'Recent Fasts')}
            description={t(
              'checkIn.recentFastsDescription',
              'Your latest fasting logs and status.'
            )}
          />
        </TabsContent>

        <TabsContent
          value="measurements"
          className="focus-visible:outline-none space-y-6"
        >
          <CheckInForm
            bodyFatPercentage={bodyFatPercentage}
            boneMassKg={boneMassKg}
            bodyWaterPercentage={bodyWaterPercentage}
            muscleMassKg={muscleMassKg}
            bmr={bmr}
            customCategories={customCategories}
            customNotes={customNotes}
            customPlaceholders={customPlaceholders}
            customValues={customValues}
            handleCalculateBodyFat={handleCalculateBodyFat}
            handleSubmit={handleSubmit}
            height={height}
            hips={hips}
            loading={loading}
            neck={neck}
            placeholders={placeholders}
            setBodyFatPercentage={setBodyFatPercentage}
            setBoneMassKg={setBoneMassKg}
            setBodyWaterPercentage={setBodyWaterPercentage}
            setMuscleMassKg={setMuscleMassKg}
            setBmr={setBmr}
            setCustomNotes={setCustomNotes}
            setCustomValues={setCustomValues}
            setHeight={setHeight}
            setHips={setHips}
            setNeck={setNeck}
            setSteps={setSteps}
            setUseMostRecentForCalculation={setUseMostRecentForCalculation}
            setWaist={setWaist}
            setWeight={setWeight}
            shouldConvertCustomMeasurement={shouldConvertCustomMeasurement}
            steps={steps}
            useMostRecentForCalculation={useMostRecentForCalculation}
            waist={waist}
            weight={weight}
          />
          <RecentActivity
            convertMeasurement={convertMeasurement}
            convertWeight={convertWeight}
            handleDeleteMeasurementClick={handleDeleteMeasurementClick}
            recentMeasurements={recentMeasurements.filter(
              (m) => m.type === 'standard' || m.type === 'custom'
            )}
            shouldConvertCustomMeasurement={shouldConvertCustomMeasurement}
            title={t('checkIn.recentMeasurements', 'Recent Measurements')}
            description={t(
              'checkIn.recentMeasurementsDescription',
              'Your latest logged weight, body metrics, and custom categories.'
            )}
          />
        </TabsContent>

        <TabsContent
          value="sleep"
          className="focus-visible:outline-none space-y-6"
        >
          <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {t('checkIn.tabs.sleep', 'Sleep')}
          </h2>
          <SleepVitalsHud
            key={`vitals-${selectedDate}`}
            selectedDate={selectedDate}
          />
          <SleepEntrySection key={selectedDate} selectedDate={selectedDate} />
        </TabsContent>

        <TabsContent value="photos" className="focus-visible:outline-none">
          <CheckInPhotos selectedDate={selectedDate} />
        </TabsContent>
      </Tabs>

      <EditFastDialog
        isOpen={isEditFastOpen}
        onClose={() => setIsEditFastOpen(false)}
        fast={editingFast}
        onSave={updateFast}
      />
    </div>
  );
};

export default CheckIn;
