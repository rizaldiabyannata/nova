//! Organization API usage from the official admin endpoints (PRD §11, M4).
//! Keys live in the OS credential store and never reach the webview or the log (NFR-005, FR-009).
//! This is API usage, not ChatGPT/Claude subscription quota (FR-008): nothing here claims a plan limit.

use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

use chrono::{DateTime, Datelike, Duration as Days, TimeZone, Utc};
use serde::{Deserialize, Serialize};

const KEYRING_SERVICE: &str = "dev.nova.desktop";
/// Usage reports lag ~5 min and the PRD asks for conservative refresh.
const CACHE_FOR: Duration = Duration::from_secs(5 * 60);
/// Enough pages for a month of daily buckets; stops a misbehaving `has_more` from looping forever.
const MAX_PAGES: usize = 5;

/// Mirrors the frontend `ProviderState` names (minus `demo`).
#[derive(Serialize, Clone, Copy, PartialEq, Debug)]
#[serde(rename_all = "kebab-case")]
pub enum State {
    Connected,
    Unavailable,
    PermissionRequired,
    RateLimited,
    Error,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Usage {
    state: State,
    cost_usd: Option<f64>,
    input_tokens: u64,
    output_tokens: u64,
    /// Anthropic's usage report has no request count.
    requests: Option<u64>,
    /// RFC 3339; None when nothing was fetched.
    updated_at: Option<String>,
    error_code: Option<String>,
}

impl Usage {
    fn failed(state: State, code: &str) -> Self {
        Usage { state, cost_usd: None, input_tokens: 0, output_tokens: 0, requests: None, updated_at: None, error_code: Some(code.into()) }
    }
}

#[derive(Clone, Copy)]
enum Provider {
    Anthropic,
    OpenAi,
}

impl Provider {
    fn parse(id: &str) -> Result<Self, String> {
        match id {
            "anthropic" => Ok(Provider::Anthropic),
            "openai" => Ok(Provider::OpenAi),
            _ => Err(format!("unknown provider {id}")),
        }
    }
    fn id(self) -> &'static str {
        match self {
            Provider::Anthropic => "anthropic",
            Provider::OpenAi => "openai",
        }
    }
}

fn entry(p: Provider) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, &format!("{}-admin-key", p.id())).map_err(|e| e.to_string())
}

fn read_key(p: Provider) -> Result<Option<String>, String> {
    match entry(p)?.get_password() {
        Ok(k) => Ok(Some(k)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// An empty key removes the stored one.
#[tauri::command(async)]
pub fn ai_set_key(provider: String, key: String) -> Result<(), String> {
    let p = Provider::parse(&provider)?;
    let key = key.trim();
    let e = entry(p)?;
    let res = if key.is_empty() {
        match e.delete_credential() {
            Err(keyring::Error::NoEntry) => Ok(()),
            r => r,
        }
    } else {
        e.set_password(key)
    };
    CACHE.lock().unwrap().retain(|(id, _), _| *id != p.id());
    res.map_err(|e| {
        log::warn!("could not store the {} key: {e}", p.id());
        e.to_string()
    })
}

#[tauri::command(async)]
pub fn ai_has_key(provider: String) -> Result<bool, String> {
    Ok(read_key(Provider::parse(&provider)?)?.is_some())
}

/// Start of the period in UTC, matching the providers' UTC day buckets.
fn period_start(period: &str, now: DateTime<Utc>) -> Result<DateTime<Utc>, String> {
    let today = Utc.with_ymd_and_hms(now.year(), now.month(), now.day(), 0, 0, 0).unwrap();
    match period {
        "today" => Ok(today),
        "week" => Ok(today - Days::days(6)),
        "month" => Ok(Utc.with_ymd_and_hms(now.year(), now.month(), 1, 0, 0, 0).unwrap()),
        _ => Err(format!("unknown period {period}")),
    }
}

/// (provider id, period) → when fetched, what came back.
type Cache = HashMap<(&'static str, String), (Instant, Usage)>;
static CACHE: LazyLock<Mutex<Cache>> = LazyLock::new(Default::default);

#[tauri::command]
pub async fn ai_usage(provider: String, period: String) -> Result<Usage, String> {
    let p = Provider::parse(&provider)?;
    let start = period_start(&period, Utc::now())?;
    let cache_key = (p.id(), period);
    if let Some((at, u)) = CACHE.lock().unwrap().get(&cache_key) {
        if at.elapsed() < CACHE_FOR {
            return Ok(u.clone());
        }
    }
    let key = match tauri::async_runtime::spawn_blocking(move || read_key(p)).await.map_err(|e| e.to_string())? {
        Ok(Some(k)) => k,
        Ok(None) => return Ok(Usage::failed(State::Unavailable, "no-key")),
        Err(e) => {
            log::warn!("credential store unavailable: {e}");
            return Ok(Usage::failed(State::Error, "keyring"));
        }
    };
    let usage = match fetch(p, &key, start).await {
        Ok(u) => u,
        Err(f) => {
            // Status only: never the key or the response body.
            log::warn!("{} usage failed: {}", p.id(), f.code);
            Usage::failed(f.state, &f.code)
        }
    };
    // Failures are cached too, so a rate limit or bad key isn't retried on every page view.
    CACHE.lock().unwrap().insert(cache_key, (Instant::now(), usage.clone()));
    Ok(usage)
}

struct Failure {
    state: State,
    code: String,
}

fn failure_for(status: u16) -> Failure {
    let (state, code) = match status {
        401 => (State::Unavailable, "key-rejected"),
        403 => (State::PermissionRequired, "forbidden"),
        429 => (State::RateLimited, "rate-limited"),
        _ => (State::Error, "http"),
    };
    Failure { state, code: if code == "http" { format!("http-{status}") } else { code.into() } }
}

async fn fetch(p: Provider, key: &str, start: DateTime<Utc>) -> Result<Usage, Failure> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|_| Failure { state: State::Error, code: "client".into() })?;
    let days = ((Utc::now() - start).num_days() + 1).clamp(1, 31).to_string();
    let (cost, tokens) = match p {
        Provider::Anthropic => {
            let starting_at = start.to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
            let q = [("starting_at", starting_at.as_str()), ("bucket_width", "1d"), ("limit", days.as_str())];
            let get = |path: &'static str| {
                let client = client.clone();
                let q = q.map(|(k, v)| (k, v.to_string()));
                move |page: Option<String>| {
                    let mut r = client
                        .get(format!("https://api.anthropic.com/v1/organizations/{path}"))
                        .header("x-api-key", key)
                        .header("anthropic-version", "2023-06-01")
                        .query(&q);
                    if let Some(page) = page {
                        r = r.query(&[("page", page)]);
                    }
                    r
                }
            };
            let cost = pages(get("cost_report")).await?;
            let usage = pages(get("usage_report/messages")).await?;
            (anthropic_cost(&cost), anthropic_tokens(&usage))
        }
        Provider::OpenAi => {
            let q = [("start_time", start.timestamp().to_string()), ("bucket_width", "1d".into()), ("limit", days)];
            let get = |path: &'static str| {
                let client = client.clone();
                let q = q.clone();
                move |page: Option<String>| {
                    let mut r = client.get(format!("https://api.openai.com/v1/organization/{path}")).bearer_auth(key).query(&q);
                    if let Some(page) = page {
                        r = r.query(&[("page", page)]);
                    }
                    r
                }
            };
            let cost = pages(get("costs")).await?;
            let usage = pages(get("usage/completions")).await?;
            (openai_cost(&cost), openai_tokens(&usage))
        }
    };
    Ok(Usage {
        state: State::Connected,
        cost_usd: Some(cost),
        input_tokens: tokens.input,
        output_tokens: tokens.output,
        requests: tokens.requests,
        updated_at: Some(Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)),
        error_code: None,
    })
}

/// Shared page envelope: both providers use `data` + `has_more` + `next_page`.
#[derive(Deserialize)]
struct Page<B> {
    data: Vec<B>,
    #[serde(default)]
    has_more: bool,
    next_page: Option<String>,
}

#[derive(Deserialize)]
struct Bucket<R> {
    results: Vec<R>,
}

async fn pages<R: for<'de> Deserialize<'de>>(request: impl Fn(Option<String>) -> reqwest::RequestBuilder) -> Result<Vec<R>, Failure> {
    let mut out = Vec::new();
    let mut page = None;
    for _ in 0..MAX_PAGES {
        let res = request(page.take()).send().await.map_err(|e| Failure {
            state: State::Error,
            code: if e.is_timeout() { "timeout".into() } else { "network".into() },
        })?;
        if !res.status().is_success() {
            return Err(failure_for(res.status().as_u16()));
        }
        let body: Page<Bucket<R>> = res.json().await.map_err(|_| Failure { state: State::Error, code: "bad-response".into() })?;
        out.extend(body.data.into_iter().flat_map(|b| b.results));
        match body.next_page {
            Some(next) if body.has_more => page = Some(next),
            _ => break,
        }
    }
    Ok(out)
}

#[derive(Default, Debug, PartialEq)]
struct Tokens {
    input: u64,
    output: u64,
    requests: Option<u64>,
}

#[derive(Deserialize)]
struct AnthropicCost {
    amount: String,
}

/// Amounts are USD decimal strings in cents.
fn anthropic_cost(rows: &[AnthropicCost]) -> f64 {
    rows.iter().filter_map(|r| r.amount.parse::<f64>().ok()).sum::<f64>() / 100.0
}

#[derive(Deserialize, Default)]
#[serde(default)]
struct CacheCreation {
    ephemeral_1h_input_tokens: u64,
    ephemeral_5m_input_tokens: u64,
}

#[derive(Deserialize)]
struct AnthropicUsage {
    #[serde(default)]
    uncached_input_tokens: u64,
    #[serde(default)]
    cache_read_input_tokens: u64,
    #[serde(default)]
    cache_creation: CacheCreation,
    #[serde(default)]
    output_tokens: u64,
}

fn anthropic_tokens(rows: &[AnthropicUsage]) -> Tokens {
    rows.iter().fold(Tokens::default(), |t, r| Tokens {
        input: t.input
            + r.uncached_input_tokens
            + r.cache_read_input_tokens
            + r.cache_creation.ephemeral_1h_input_tokens
            + r.cache_creation.ephemeral_5m_input_tokens,
        output: t.output + r.output_tokens,
        requests: None,
    })
}

#[derive(Deserialize)]
struct OpenAiAmount {
    value: f64,
}

#[derive(Deserialize)]
struct OpenAiCost {
    amount: OpenAiAmount,
}

fn openai_cost(rows: &[OpenAiCost]) -> f64 {
    rows.iter().map(|r| r.amount.value).sum()
}

#[derive(Deserialize)]
struct OpenAiUsage {
    #[serde(default)]
    input_tokens: u64,
    #[serde(default)]
    output_tokens: u64,
    #[serde(default)]
    num_model_requests: u64,
}

fn openai_tokens(rows: &[OpenAiUsage]) -> Tokens {
    rows.iter().fold(Tokens { requests: Some(0), ..Default::default() }, |t, r| Tokens {
        input: t.input + r.input_tokens,
        output: t.output + r.output_tokens,
        requests: t.requests.map(|n| n + r.num_model_requests),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn results<R: for<'de> Deserialize<'de>>(json: &str) -> Vec<R> {
        let page: Page<Bucket<R>> = serde_json::from_str(json).unwrap();
        page.data.into_iter().flat_map(|b| b.results).collect()
    }

    #[test]
    fn anthropic_sums_every_input_kind_and_converts_cents() {
        let usage = results::<AnthropicUsage>(
            r#"{"data":[{"starting_at":"2026-10-01T00:00:00Z","results":[
                {"uncached_input_tokens":1500,"cache_read_input_tokens":200,
                 "cache_creation":{"ephemeral_1h_input_tokens":10,"ephemeral_5m_input_tokens":5},
                 "output_tokens":500,"model":"claude-opus-5-5"}]},
              {"starting_at":"2026-10-02T00:00:00Z","results":[{"uncached_input_tokens":100,"output_tokens":50}]}],
             "has_more":false,"next_page":null}"#,
        );
        assert_eq!(anthropic_tokens(&usage), Tokens { input: 1815, output: 550, requests: None });
        let cost = results::<AnthropicCost>(
            r#"{"data":[{"results":[{"amount":"123.5","currency":"USD"},{"amount":"76.5","currency":"USD"}]}],"has_more":false}"#,
        );
        assert_eq!(anthropic_cost(&cost), 2.0);
    }

    #[test]
    fn openai_sums_tokens_requests_and_dollars() {
        let usage = results::<OpenAiUsage>(
            r#"{"object":"page","data":[{"results":[{"input_tokens":1000,"output_tokens":200,"num_model_requests":3}]},
              {"results":[{"input_tokens":10,"output_tokens":2,"num_model_requests":1,"input_cached_tokens":4}]}],
             "has_more":false,"next_page":null}"#,
        );
        assert_eq!(openai_tokens(&usage), Tokens { input: 1010, output: 202, requests: Some(4) });
        let cost = results::<OpenAiCost>(r#"{"data":[{"results":[{"amount":{"value":0.25,"currency":"usd"}},{"amount":{"value":1.5,"currency":"usd"}}]}]}"#);
        assert_eq!(openai_cost(&cost), 1.75);
    }

    #[test]
    fn statuses_map_to_provider_states() {
        assert_eq!(failure_for(401).state, State::Unavailable);
        assert_eq!(failure_for(403).state, State::PermissionRequired);
        assert_eq!(failure_for(429).state, State::RateLimited);
        assert_eq!(failure_for(500).code, "http-500");
    }

    #[test]
    fn periods_start_at_utc_midnight() {
        let now = Utc.with_ymd_and_hms(2026, 10, 21, 15, 30, 0).unwrap();
        assert_eq!(period_start("today", now).unwrap(), Utc.with_ymd_and_hms(2026, 10, 21, 0, 0, 0).unwrap());
        assert_eq!(period_start("week", now).unwrap(), Utc.with_ymd_and_hms(2026, 10, 15, 0, 0, 0).unwrap());
        assert_eq!(period_start("month", now).unwrap(), Utc.with_ymd_and_hms(2026, 10, 1, 0, 0, 0).unwrap());
        assert!(period_start("year", now).is_err());
    }
}
