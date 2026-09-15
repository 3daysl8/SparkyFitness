import { tool } from 'ai';
import { z } from 'zod';
import {
  CHAT_TOOL_CATEGORY_SLUGS,
  type ChatToolCategorySlug,
} from '@workspace/shared';
import { formatZodError } from './errors.js';

/**
 * One-line capability summary per category, surfaced in the tool description
 * so the model can pick the right categories to enable, and reused by the
 * system prompt's dormant-domain listing.
 */
export const CATEGORY_SUMMARIES: Record<ChatToolCategorySlug, string> = {
  food: 'manage water containers (tools: sparky_manage_water_containers)',
  exercise:
    'log workouts, search exercises, view exercise diaries, exercise stats/analytics, workout plan templates, and the planned/scheduled workout list (tools: sparky_manage_exercise, sparky_list_exercises, sparky_get_exercise_details, sparky_search_exercises, sparky_get_exercise_diary, sparky_get_daily_exercise_totals, sparky_get_recent_exercise_entries, sparky_get_exercise_usage, sparky_get_exercise_progress, sparky_get_exercise_stats, sparky_manage_workout_plans, sparky_manage_planned_workouts)',
  checkin:
    'log weight, measurements, mood, sleep, fasting, check-ins, progress photos, and sleep-science analytics (tools: sparky_manage_checkin, sparky_manage_progress_photos, sparky_get_sleep_science)',
  goals: 'Focus goals/pillars and check-ins (tools: sparky_manage_focus)',
  reports:
    'daily/weekly summaries, progress reports, trends, TDEE, and the daily dashboard calorie-balance summary (tools: sparky_get_report, sparky_get_daily_report, sparky_get_dashboard)',
  coaching:
    'coaching plans, nudges, and check-in wizard (tools: sparky_generate_coaching_plan, sparky_get_health_summary, sparky_analyze_trends, sparky_get_30_day_trends, sparky_check_engagement, sparky_get_logging_streak, sparky_get_contextual_nudge, sparky_daily_checkin_wizard)',
  // Vision tools (food-photo estimation, label scanning) were hard-deleted
  // along with the food domain — nothing to escalate into here anymore.
  vision: 'no capabilities (food-photo/label vision tools were removed)',
  profile:
    'profile details, preferences, units, timezone, habits, connected integrations, and synced-data listing (tools: sparky_manage_profile, sparky_manage_habits, sparky_get_integrations, sparky_get_synced_data)',
  medications:
    'medication and supplement tracking (tools: sparky_manage_medications)',
};

const EnableToolsSchema = z.object({
  categories: z
    .array(z.enum(CHAT_TOOL_CATEGORY_SLUGS))
    .min(1)
    .describe('The tool categories to enable for the rest of this request.'),
});

export const ENABLE_TOOLS_TOOL_NAME = 'sparky_enable_tools';

/**
 * Chat-only escalation tool: when the request needs a tool domain that is not
 * currently loaded, the model calls this with the missing category slugs and
 * the server exposes those tools on the next agent step (see prepareStep in
 * services/chatService.ts). execute() is stateless — it only validates and
 * confirms — so the memoized tool map stays safely shareable across requests;
 * the actual widening is derived from the recorded tool call itself. Not part
 * of the MCP surface (MCP clients always see the full tool set).
 */
export function buildMetaTools() {
  return {
    [ENABLE_TOOLS_TOOL_NAME]: tool({
      description:
        'Enables additional tool categories when the current request needs tools that are not loaded. ' +
        'Call this BEFORE telling the user something cannot be done. Categories: ' +
        CHAT_TOOL_CATEGORY_SLUGS.map(
          (slug) => `${slug} (${CATEGORY_SUMMARIES[slug]})`
        ).join('; ') +
        '.',
      inputSchema: EnableToolsSchema,
      execute: async (rawArgs) => {
        const parsed = EnableToolsSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return formatZodError(parsed.error);
        }
        const categories = [...new Set(parsed.data.categories)];
        return `Enabled tool categories: ${categories.join(', ')}. The tools are now available — continue with the user's request.`;
      },
    }),
  };
}
