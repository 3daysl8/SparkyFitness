-- Focus recurrence: lets a 'daily' focus with no period_date act as a
-- standing recurring habit instead of a one-off scheduled item. NULL/empty
-- recurrence_days_of_week means every day; recurrence_end_date is optional.
ALTER TABLE focuses
  ADD COLUMN recurrence_days_of_week SMALLINT[],
  ADD COLUMN recurrence_end_date DATE;
