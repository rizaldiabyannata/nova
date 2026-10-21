import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../../config/storage';

export type ProviderState =
  | 'demo'
  | 'connected'
  | 'unavailable'
  | 'permission-required'
  | 'rate-limited'
  | 'error';

export interface ProviderUsage {
  providerId: string;
  title: string;
  primaryValue: string;
  detail: string;
  state: ProviderState;
  /** ISO timestamp of the data, null when there is none yet. */
  updatedAt: string | null;
  sourceType: 'demo' | 'organization-api-usage';
  usagePeriod?: string;
  errorCode?: string;
}

export type Period = 'today' | 'week' | 'month';

export const PERIOD_LABEL: Record<Period, string> = { today: 'Today (UTC)', week: 'Last 7 days', month: 'This month' };

export interface UsageProvider {
  id: string;
  title: string;
  sourceType: ProviderUsage['sourceType'];
  fetchUsage(period: Period): Promise<ProviderUsage>;
}

export const STATE_LABEL: Record<ProviderState, string> = {
  demo: 'Demo',
  connected: 'Connected',
  unavailable: 'Not connected',
  'permission-required': 'Permission required',
  'rate-limited': 'Rate limited',
  error: 'Error',
};

// Demo providers show no numbers at all, so nothing can be mistaken for live usage or quota (AC-02, R-02).
const demo = (id: string, title: string): UsageProvider => ({
  id,
  title,
  sourceType: 'demo',
  fetchUsage: async () => ({
    providerId: id,
    title,
    primaryValue: '—',
    detail: 'Demo mode. Not connected to the official usage API.',
    state: 'demo',
    updatedAt: null,
    sourceType: 'demo',
  }),
});

/** Mirrors `Usage` in src-tauri/src/ai.rs. */
export interface ApiUsage {
  state: Exclude<ProviderState, 'demo'>;
  costUsd: number | null;
  inputTokens: number;
  outputTokens: number;
  requests: number | null;
  updatedAt: string | null;
  errorCode: string | null;
}

const ERROR_DETAIL: Record<string, string> = {
  'no-key': 'Add an Admin API key in Settings › AI.',
  'key-rejected': 'The key was rejected. Check it in Settings › AI.',
  forbidden: 'This key cannot read usage. It needs to be an Admin key.',
  'rate-limited': 'Rate limited. Nova tries again in a few minutes.',
  timeout: 'The provider did not answer in time.',
  network: 'No connection to the provider.',
};

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const dollars = new Intl.NumberFormat('en', { style: 'currency', currency: 'USD' });

/** Turns the shell's numbers into a card; only `connected` ever shows a figure. */
export function toProviderUsage(id: string, title: string, period: Period, u: ApiUsage): ProviderUsage {
  const base = { providerId: id, title, state: u.state, updatedAt: u.updatedAt, sourceType: 'organization-api-usage' as const, usagePeriod: PERIOD_LABEL[period] };
  if (u.state !== 'connected') {
    return { ...base, primaryValue: '—', detail: ERROR_DETAIL[u.errorCode ?? ''] ?? 'Could not load usage.', errorCode: u.errorCode ?? undefined };
  }
  const detail = [`${compact.format(u.inputTokens)} in · ${compact.format(u.outputTokens)} out tokens`];
  if (u.requests !== null) detail.push(`${compact.format(u.requests)} requests`);
  return { ...base, primaryValue: u.costUsd === null ? '—' : dollars.format(u.costUsd), detail: detail.join(' · ') };
}

const live = (id: string, title: string): UsageProvider => ({
  id,
  title,
  sourceType: 'organization-api-usage',
  fetchUsage: async (period) => toProviderUsage(id, title, period, await invoke<ApiUsage>('ai_usage', { provider: id, period })),
});

// The browser preview has no shell to hold keys or call the APIs, so it stays on demo cards.
export const AI_PROVIDERS: UsageProvider[] = isTauri
  ? [live('anthropic', 'Claude'), live('openai', 'OpenAI')]
  : [demo('anthropic', 'Claude'), demo('openai', 'OpenAI')];

/** Fetches every provider; a failing one becomes an `error` card instead of breaking the rest (FR-007). */
export async function fetchAllUsage(providers: UsageProvider[], period: Period = 'today'): Promise<ProviderUsage[]> {
  const results = await Promise.allSettled(providers.map((p) => p.fetchUsage(period)));
  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : {
          providerId: providers[i].id,
          title: providers[i].title,
          primaryValue: '—',
          detail: 'Could not load usage.',
          state: 'error',
          updatedAt: null,
          sourceType: providers[i].sourceType,
          errorCode: 'fetch-failed',
        },
  );
}

/** Keys go straight to the OS credential store through the shell; the page never keeps them. Empty removes. */
export const saveKey = (provider: string, key: string) => invoke<void>('ai_set_key', { provider, key });
export const hasKey = (provider: string) => invoke<boolean>('ai_has_key', { provider });
