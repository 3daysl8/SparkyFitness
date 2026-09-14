-- Optional time-of-day for a one-off scheduled daily focus (the To-Do List
-- card), letting the home dashboard show tasks in time order and render a
-- time badge. NULL means "no time assigned" (untimed task), same convention
-- as period_date already uses for "unscheduled".
ALTER TABLE focuses
  ADD COLUMN due_time TIME;
