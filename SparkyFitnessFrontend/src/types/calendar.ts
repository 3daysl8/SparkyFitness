export interface CalendarFeed {
  id: string;
  user_id: string;
  name: string;
  ics_url: string;
  color: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCalendarFeedInput {
  name: string;
  ics_url: string;
  color?: string | null;
  is_enabled?: boolean;
}

export type UpdateCalendarFeedInput = Partial<CreateCalendarFeedInput>;

export interface CalendarEvent {
  id: string;
  feedId: string;
  feedName: string;
  feedColor: string | null;
  title: string;
  start: string; // ISO 8601
  end: string; // ISO 8601
  allDay: boolean;
  location: string | null;
  description: string | null;
  isWorkout: boolean;
}
