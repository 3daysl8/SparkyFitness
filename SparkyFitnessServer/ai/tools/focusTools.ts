import { tool } from 'ai';
import { todayInZone } from '@workspace/shared';
import { log } from '../../config/logging.js';
import focusRepository from '../../models/focusRepository.js';
import focusService from '../../services/focusService.js';
import { ERRORS, formatZodError } from './errors.js';
import {
  dayString,
  formatConfirmation,
  formatList,
  formatJsonResult,
} from './formatting.js';
import { normalizeActionArgs } from './dates.js';
import {
  manageFocusSchema,
  manageFocusInput,
  type ManageFocusInput,
} from './schemas/focus.js';

const VALID_ACTIONS = [
  'list_domains',
  'create_domain',
  'list_focuses',
  'get_focus',
  'create_focus',
  'update_focus',
  'delete_focus',
  'checkin',
  'list_checkins',
  'get_today',
];

interface FocusRow {
  id: string;
  statement: string;
  timeframe: string;
  target_type: string;
  target_value: number | null;
  unit: string | null;
  period_date: string | null;
  status: string;
  parent_focus_id: string | null;
  recurrence_days_of_week: number[] | null;
  recurrence_end_date: string | null;
}

interface DomainRow {
  id: string;
  name: string;
}

interface CheckinRow {
  id: string;
  checkin_date: string;
  progress_value: number | null;
  completed: boolean | null;
  reflection_note: string | null;
}

function formatFocus(f: FocusRow): string {
  let text = `**${f.statement}** (${f.timeframe})`;
  if (f.target_type !== 'none' && f.target_value !== null) {
    text += ` — target: ${f.target_value}${f.unit ? ' ' + f.unit : ''}`;
  } else if (f.target_type === 'boolean') {
    text += ' — target: yes/no';
  }
  if (f.period_date) text += ` | ${dayString(f.period_date)}`;
  if (f.timeframe === 'daily' && !f.period_date) {
    const days = f.recurrence_days_of_week;
    text +=
      days && days.length > 0
        ? ` | recurring (days: ${days.join(',')})`
        : ' | recurring (every day)';
    if (f.recurrence_end_date)
      text += ` until ${dayString(f.recurrence_end_date)}`;
  }
  if (f.status !== 'active') text += ` (${f.status})`;
  text += `\n  ID: ${f.id}`;
  if (f.parent_focus_id) text += `\n  In service of: ${f.parent_focus_id}`;
  return text;
}

export function buildFocusTools(userId: string, tz: string) {
  return {
    sparky_manage_focus: tool({
      description: `Focus & motivation tracking: daily/weekly/long-term intentions across user-defined life domains (e.g. health, work, relationships), with optional numeric/boolean targets and check-in reflections.

Actions:
- list_domains()
- create_domain(name, color?, icon?)
- list_focuses(timeframe?, domain_id?, status?)
- get_focus(focus_id)
- create_focus(timeframe, statement, domain_id?, target_type?, target_value?, unit?, parent_focus_id?, period_date?, recurrence_days_of_week?, recurrence_end_date?) — for a standing recurring daily habit (e.g. "walk 10,000 steps every day except weekends"), omit period_date and use recurrence_days_of_week (0=Sun..6=Sat, omit for every day) and optionally recurrence_end_date
- update_focus(focus_id, statement?, domain_id?, target_type?, target_value?, unit?, parent_focus_id?, status?, recurrence_days_of_week?, recurrence_end_date?)
- delete_focus(focus_id)
- checkin(focus_id, date?, progress_value?, completed?, reflection_note?)
- list_checkins(focus_id, from_date?, to_date?)
- get_today(date?) — resolves everything for a given date (defaults to today) in one call: one-off focuses scheduled that day, recurring daily habits active that day (each with its done state and current streak), that week's focus, and all active long-term focuses. This is the primary call for a morning-briefing or daily-checklist style summary.`,
      inputSchema: manageFocusInput,
      execute: async (rawArgs) => {
        const normalized = normalizeActionArgs(
          rawArgs,
          tz,
          VALID_ACTIONS,
          (args: Record<string, unknown>) => {
            if (
              args.focus_id &&
              (args.progress_value !== undefined ||
                args.completed !== undefined ||
                args.reflection_note !== undefined)
            ) {
              return 'checkin';
            }
            if (args.focus_id && (args.from_date || args.to_date)) {
              return 'list_checkins';
            }
            if (
              args.focus_id &&
              (args.statement !== undefined ||
                args.status !== undefined ||
                args.target_type !== undefined ||
                args.target_value !== undefined)
            ) {
              return 'update_focus';
            }
            if (args.focus_id) return 'get_focus';
            if (args.statement !== undefined && args.timeframe !== undefined) {
              return 'create_focus';
            }
            if (args.name !== undefined) return 'create_domain';
            if (
              args.timeframe !== undefined ||
              args.domain_id !== undefined ||
              args.status !== undefined
            ) {
              return 'list_focuses';
            }
            return undefined;
          }
        ) as Record<string, unknown>;

        const parsed = manageFocusSchema.safeParse(normalized);
        if (!parsed.success) return formatZodError(parsed.error);
        const args: ManageFocusInput = parsed.data;
        try {
          switch (args.action) {
            case 'list_domains': {
              const domains: DomainRow[] =
                await focusRepository.listDomains(userId);
              return formatList(
                domains,
                'Focus Domains',
                (d) => `**${d.name}**\n  ID: ${d.id}`
              );
            }
            case 'create_domain': {
              const domain: DomainRow = await focusRepository.createDomain(
                userId,
                { name: args.name, color: args.color, icon: args.icon }
              );
              return formatConfirmation(
                `Domain **${domain.name}** created (ID: ${domain.id}).`
              );
            }
            case 'list_focuses': {
              const focuses: FocusRow[] = await focusRepository.listFocuses(
                userId,
                {
                  timeframe: args.timeframe,
                  domainId: args.domain_id ?? undefined,
                  status: args.status ?? 'active',
                }
              );
              return formatList(focuses, 'Focuses', formatFocus);
            }
            case 'get_focus': {
              const focus: FocusRow | null = await focusRepository.getFocus(
                userId,
                args.focus_id
              );
              if (!focus) return ERRORS.NOT_FOUND('Focus', args.focus_id);
              return formatFocus(focus);
            }
            case 'create_focus': {
              const focus: FocusRow = await focusRepository.createFocus(
                userId,
                {
                  timeframe: args.timeframe,
                  statement: args.statement,
                  domain_id: args.domain_id ?? undefined,
                  target_type: args.target_type,
                  target_value: args.target_value ?? undefined,
                  unit: args.unit ?? undefined,
                  parent_focus_id: args.parent_focus_id ?? undefined,
                  period_date: args.period_date ?? undefined,
                  recurrence_days_of_week:
                    args.recurrence_days_of_week ?? undefined,
                  recurrence_end_date: args.recurrence_end_date ?? undefined,
                }
              );
              return formatConfirmation(
                `Focus created: "${focus.statement}" (${focus.timeframe}, ID: ${focus.id}).`
              );
            }
            case 'update_focus': {
              const updated: FocusRow | null =
                await focusRepository.updateFocus(userId, args.focus_id, {
                  statement: args.statement,
                  domain_id: args.domain_id,
                  target_type: args.target_type,
                  target_value: args.target_value,
                  unit: args.unit,
                  parent_focus_id: args.parent_focus_id,
                  status: args.status,
                  recurrence_days_of_week: args.recurrence_days_of_week,
                  recurrence_end_date: args.recurrence_end_date,
                });
              if (!updated) return ERRORS.NOT_FOUND('Focus', args.focus_id);
              return formatConfirmation(
                `Focus updated: "${updated.statement}".`
              );
            }
            case 'delete_focus': {
              const ok = await focusRepository.deleteFocus(
                userId,
                args.focus_id
              );
              if (!ok) return ERRORS.NOT_FOUND('Focus', args.focus_id);
              return formatConfirmation('Focus deleted.');
            }
            case 'checkin': {
              const date = args.date || todayInZone(tz);
              const saved: CheckinRow = await focusRepository.upsertCheckin(
                userId,
                args.focus_id,
                date,
                {
                  progress_value: args.progress_value ?? undefined,
                  completed: args.completed ?? undefined,
                  reflection_note: args.reflection_note ?? undefined,
                }
              );
              return formatConfirmation(
                `Checked in for ${dayString(saved.checkin_date)}.`
              );
            }
            case 'list_checkins': {
              const checkins: CheckinRow[] = await focusRepository.listCheckins(
                userId,
                args.focus_id,
                {
                  startDate: args.from_date,
                  endDate: args.to_date,
                }
              );
              return formatList(checkins, 'Check-ins', (c) => {
                let text = `**${dayString(c.checkin_date)}**`;
                if (c.progress_value !== null)
                  text += ` — progress: ${c.progress_value}`;
                if (c.completed !== null)
                  text += ` — completed: ${c.completed ? 'yes' : 'no'}`;
                if (c.reflection_note) text += `\n  ${c.reflection_note}`;
                return text;
              });
            }
            case 'get_today': {
              const date = args.date || todayInZone(tz);
              const snapshot = await focusService.getToday(userId, date);
              return formatJsonResult(snapshot);
            }
            default:
              return ERRORS.INVALID_ACTION(
                (args as { action?: string }).action ?? 'unknown',
                VALID_ACTIONS
              );
          }
        } catch (error) {
          log('error', '[Focus Tool] Error:', error);
          return ERRORS.DB_ERROR(error);
        }
      },
    }),
  };
}
