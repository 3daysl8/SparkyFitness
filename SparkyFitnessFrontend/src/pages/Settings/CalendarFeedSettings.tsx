import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useCalendarFeeds,
  useCreateCalendarFeed,
  useDeleteCalendarFeed,
  useUpdateCalendarFeed,
} from '@/hooks/useCalendar';
import { AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const DEFAULT_FEED_COLORS = [
  '#3b82f6',
  '#f97316',
  '#22c55e',
  '#a855f7',
  '#ef4444',
];

export default function CalendarFeedSettings() {
  const { t } = useTranslation();
  const { data: feeds = [], isLoading } = useCalendarFeeds();
  const createFeed = useCreateCalendarFeed();
  const updateFeed = useUpdateCalendarFeed();
  const deleteFeed = useDeleteCalendarFeed();

  const [name, setName] = useState('');
  const [icsUrl, setIcsUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleAdd = async () => {
    if (!name.trim() || !icsUrl.trim()) return;
    setIsSaving(true);
    try {
      await createFeed.mutateAsync({
        name: name.trim(),
        ics_url: icsUrl.trim(),
        color: DEFAULT_FEED_COLORS[feeds.length % DEFAULT_FEED_COLORS.length],
      });
      setName('');
      setIcsUrl('');
      toast({
        title: t('settings.calendar.addedTitle', 'Calendar added'),
        description: t(
          'settings.calendar.addedDesc',
          'Your Home dashboard agenda will pick it up on the next refresh.'
        ),
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('settings.calendar.errorTitle', 'Could not add calendar'),
        description:
          err instanceof Error
            ? err.message
            : t('settings.calendar.addError', 'Check the URL and try again.'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFeed.mutateAsync(id);
    } catch {
      toast({
        variant: 'destructive',
        title: t(
          'settings.calendar.deleteErrorTitle',
          'Could not remove calendar'
        ),
      });
    }
  };

  return (
    <>
      <AccordionTrigger
        className="flex items-center gap-2 p-4 hover:no-underline"
        description={t(
          'settings.calendar.description',
          'Subscribe to a Google, Apple, or Outlook calendar (.ics link) to show your schedule on the Home dashboard'
        )}
      >
        <CalendarDays className="h-5 w-5" />
        {t('settings.calendar.title', 'Calendar Feeds')}
      </AccordionTrigger>
      <AccordionContent className="space-y-4 p-4 pt-0">
        {isLoading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-10 rounded bg-muted/40" />
          </div>
        ) : (
          <div className="space-y-2">
            {feeds.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t('settings.calendar.empty', 'No calendars connected yet.')}
              </p>
            )}
            {feeds.map((feed) => (
              <div
                key={feed.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: feed.color ?? '#94a3b8' }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{feed.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {feed.ics_url}
                  </p>
                </div>
                <Switch
                  checked={feed.is_enabled}
                  onCheckedChange={(checked) =>
                    updateFeed.mutate({
                      id: feed.id,
                      body: { is_enabled: checked },
                    })
                  }
                  aria-label={t(
                    'settings.calendar.toggleEnabled',
                    'Enable this calendar'
                  )}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/5 hover:text-destructive"
                  onClick={() => handleDelete(feed.id)}
                  aria-label={t('common.delete', 'Delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 border-t pt-4">
          <Label className="text-sm font-semibold">
            {t('settings.calendar.addTitle', 'Add a calendar')}
          </Label>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_2fr_auto]">
            <Input
              placeholder={t(
                'settings.calendar.namePlaceholder',
                'Name (e.g. Work)'
              )}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder={t(
                'settings.calendar.urlPlaceholder',
                'https://calendar.google.com/.../basic.ics'
              )}
              value={icsUrl}
              onChange={(e) => setIcsUrl(e.target.value)}
            />
            <Button
              onClick={handleAdd}
              disabled={isSaving || !name.trim() || !icsUrl.trim()}
            >
              <Plus className="mr-2 h-4 w-4" />
              {isSaving
                ? t('common.saving', 'Saving...')
                : t('common.add', 'Add')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t(
              'settings.calendar.privateUrlHint',
              'Use the "Secret address in iCal format" from Google Calendar, the private ICS link from Outlook, or a public .ics share link from Apple Calendar. The feed URL is fetched by this server every 15 minutes and never shared elsewhere.'
            )}
          </p>
        </div>
      </AccordionContent>
    </>
  );
}
