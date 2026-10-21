// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { AI_PROVIDERS, fetchAllUsage, toProviderUsage, type UsageProvider } from '.';

test('a failing provider becomes an error card and the others still load', async () => {
  const broken: UsageProvider = {
    id: 'broken',
    title: 'Broken',
    sourceType: 'organization-api-usage',
    fetchUsage: () => Promise.reject(new Error('network down')),
  };
  const usage = await fetchAllUsage([AI_PROVIDERS[0], broken]);
  expect(usage.map((u) => u.state)).toEqual(['demo', 'error']);
  expect(usage[1]).toMatchObject({ providerId: 'broken', sourceType: 'organization-api-usage', errorCode: 'fetch-failed' });
});

test('demo providers carry no figures that could pass as live data', async () => {
  for (const u of await fetchAllUsage(AI_PROVIDERS)) {
    expect(u).toMatchObject({ state: 'demo', sourceType: 'demo', updatedAt: null });
    expect(u.primaryValue).not.toMatch(/\d/);
  }
});

test('connected usage shows dollars and tokens; failures show why, never a figure', () => {
  const ok = toProviderUsage('openai', 'OpenAI', 'week', {
    state: 'connected', costUsd: 12.345, inputTokens: 1_200_000, outputTokens: 340_000, requests: 812, updatedAt: '2026-10-21T10:00:00Z', errorCode: null,
  });
  expect(ok).toMatchObject({ primaryValue: '$12.35', detail: '1.2M in · 340K out tokens · 812 requests', sourceType: 'organization-api-usage', usagePeriod: 'Last 7 days' });

  const anthropic = toProviderUsage('anthropic', 'Claude', 'today', {
    state: 'connected', costUsd: 0, inputTokens: 10, outputTokens: 2, requests: null, updatedAt: null, errorCode: null,
  });
  expect(anthropic.detail).not.toMatch(/requests/);

  const noKey = toProviderUsage('anthropic', 'Claude', 'today', {
    state: 'unavailable', costUsd: null, inputTokens: 0, outputTokens: 0, requests: null, updatedAt: null, errorCode: 'no-key',
  });
  expect(noKey).toMatchObject({ primaryValue: '—', state: 'unavailable', errorCode: 'no-key' });
  expect(noKey.detail).toMatch(/Settings/);
});
