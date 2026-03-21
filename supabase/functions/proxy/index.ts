// ═══════════════════════════════════════════════════════════
// 이슈 유튜브 제작툴 — Supabase Edge Function (API Proxy v3)
// Supabase Auth + profiles.approval_status 기반 인증
// ═══════════════════════════════════════════════════════════
// 배포: supabase functions deploy proxy --no-verify-jwt
// ═══════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS: 허용된 Origin만 ──
const ALLOWED_ORIGINS = [
  "https://issue-youtube-tool.vercel.app",
  "null",  // Electron file:// 에서 Origin이 "null"로 전송됨
  "file://",
  "http://localhost:3000", // 개발용
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.some(o => origin === o || origin.startsWith(o)) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

let _corsHeaders: Record<string, string> = {};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ..._corsHeaders, "Content-Type": "application/json" },
  });
}

function rawResponse(body: ReadableStream | ArrayBuffer | null, headers: Record<string, string> = {}, status = 200) {
  return new Response(body, { status, headers: { ..._corsHeaders, ...headers } });
}

function getServiceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function getUserClient(authHeader: string) {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } });
}

// ── Auth 검증 + 승인 상태 확인 ──
async function validateUser(authHeader: string) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return { _error: "no_bearer" };
  
  try {
    const userClient = getUserClient(authHeader);
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) return { _error: "getUser_failed" };

    const svc = getServiceClient();
    const { data: profile, error: profErr } = await svc.from("profiles")
      .select("id, email, full_name, name, cohort, role, approval_status")
      .eq("id", user.id).single();

    if (!profile) return { _error: "no_profile" };
    if (profile.approval_status !== "승인완료") return { ...profile, rejected: true };
    return profile;
  } catch (err) {
    console.error("[Auth] error:", (err as Error).message);
    return { _error: "exception" };
  }
}

// ── Rate Limiting ──
// ── Rate Limiting (DB 기반, fallback: 하드코딩) ──
const DEFAULT_LIMITS: Record<string, { limit: number; window: number }> = {
  youtube: { limit: 100, window: 3600 }, llm: { limit: 60, window: 3600 },
  tts: { limit: 30, window: 3600 }, elevenlabs: { limit: 20, window: 3600 }, gas: { limit: 60, window: 3600 },
  trends: { limit: 30, window: 3600 },
};

async function getRateConfig(svc: any, endpoint: string) {
  try {
    const { data } = await svc.from("rate_config")
      .select("max_requests, window_seconds")
      .eq("endpoint", endpoint)
      .single();
    if (data) return { limit: data.max_requests, window: data.window_seconds };
  } catch (_) { /* DB 실패 시 기본값 사용 */ }
  return DEFAULT_LIMITS[endpoint] || { limit: 50, window: 3600 };
}

async function checkRate(svc: any, userId: string, endpoint: string) {
  const c = await getRateConfig(svc, endpoint);
  const since = new Date(Date.now() - c.window * 1000).toISOString();
  const { count } = await svc.from("usage_logs").select("*", { count: "exact", head: true })
    .eq("user_id", userId).eq("endpoint", endpoint).gte("created_at", since);
  return { allowed: (count || 0) < c.limit, current: count || 0, max: c.limit };
}

async function logUsage(svc: any, userId: string, endpoint: string, status = 200, ms = 0, errorDetail = "") {
  await svc.from("usage_logs").insert({ 
    user_id: userId, endpoint, status_code: status, response_ms: ms,
    ...(errorDetail ? { error_details: errorDetail } : {})
  });
}

// ── Slack 에러 알림 ──
async function notifySlack(endpoint: string, status: number, errorMsg: string, userId = "") {
  const webhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
  if (!webhookUrl) return; // 웹훅 미설정 시 무시
  try {
    const text = `🚨 *이슈유튜브 에러*\n• 엔드포인트: \`${endpoint}\`\n• 상태: ${status}\n• 에러: ${errorMsg}\n• 유저: ${userId.substring(0, 8) || "unknown"}\n• 시간: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`;
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (_) { /* Slack 알림 실패해도 서비스 영향 없음 */ }
}

// ══════════════════════════════════════════════
// Main Handler
// ══════════════════════════════════════════════
Deno.serve(async (req) => {
  _corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: _corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/proxy/, "");
  const svc = getServiceClient();

  if (path === "/" || path === "/health" || path === "") return json({ status: "ok", version: "3.0.0-auth" });

  // ── 공개 엔드포인트: 회원가입 / 로그인 ──
  if (path === "/auth/signup" && req.method === "POST") {
    // IP 기반 간단한 rate limit (1분에 5회)
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const since = new Date(Date.now() - 60000).toISOString();
    const { count } = await svc.from("usage_logs").select("*", { count: "exact", head: true })
      .eq("endpoint", "signup").eq("user_id", ip).gte("created_at", since);
    if ((count || 0) >= 5) return json({ error: "가입 요청이 너무 많습니다. 잠시 후 다시 시도하세요." }, 429);
    await svc.from("usage_logs").insert({ user_id: ip, endpoint: "signup", status_code: 200, response_ms: 0 });
    return handleSignup(req, svc);
  }
  if (path === "/auth/login" && req.method === "POST") {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const since = new Date(Date.now() - 300000).toISOString(); // 5분
    const { count } = await svc.from("usage_logs").select("*", { count: "exact", head: true })
      .eq("endpoint", "login").eq("user_id", ip).gte("created_at", since);
    if ((count || 0) >= 10) {
      notifySlack("login", 429, `Brute force 의심: IP ${ip}, ${count}회 시도`, ip);
      return json({ error: "로그인 시도가 너무 많습니다. 5분 후 다시 시도하세요." }, 429);
    }
    await svc.from("usage_logs").insert({ user_id: ip, endpoint: "login", status_code: 200, response_ms: 0 });
    return handleLogin(req, svc);
  }

  // ── Admin (Bearer 토큰 + role=admin만 허용) ──
  if (path.startsWith("/admin/")) {
    const authHeader = req.headers.get("Authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      const adminUser = await validateUser(authHeader);
      if (adminUser && !(adminUser as any)._error && !(adminUser as any).rejected && adminUser.role === "admin") {
        return handleAdmin(path, req, svc);
      }
      if (adminUser && adminUser.role !== "admin") {
        return json({ error: "관리자 권한이 없습니다", code: "NOT_ADMIN" }, 403);
      }
    }
    return json({ error: "관리자 인증이 필요합니다" }, 403);
  }

  // ── 인증 필요 ──
  const authHeader = req.headers.get("Authorization") || "";
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json({ error: "로그인이 필요합니다", code: "AUTH_REQUIRED" }, 401);
  }
  
  const user = await validateUser(authHeader);
  if (!user || (user as any)._error) {
    return json({ error: "로그인이 필요합니다", code: "AUTH_REQUIRED" }, 401);
  }
  if ((user as any).rejected) return json({ error: "관리자 승인 대기 중입니다", code: "APPROVAL_PENDING" }, 403);

  const userId = user.id;
  try {
    if (path.startsWith("/api/youtube/")) return handleYouTube(path, url, svc, userId);
    if (path === "/api/trends") {
      const trendRate = await checkRate(svc, userId, "trends");
      if (!trendRate.allowed) return json({ error: "요청 한도 초과", code: "RATE_LIMIT" }, 429);
      const trendResult = await handleTrends();
      await logUsage(svc, userId, "trends", trendResult.status, 0);
      return trendResult;
    }
    if (path.startsWith("/api/llm")) return handleLLM(req, svc, userId);
    if (path.startsWith("/api/tts")) return handleTTS(req, svc, userId);
    if (path.startsWith("/api/elevenlabs/")) return handleElevenLabs(path, req, svc, userId);
    if (path.startsWith("/api/gas")) return handleGAS(url, svc, userId);
    if (path === "/api/me") return json(user);
    return json({ error: "Not found" }, 404);
  } catch (err) { 
    const msg = (err as Error).message;
    await notifySlack(path, 500, msg, userId);
    await logUsage(svc, userId, path, 500, 0, msg);
    return json({ error: msg }, 500); 
  }
});

// ── Auth Handlers ──
async function handleSignup(req: Request, svc: any) {
  const { email, password, name, phone, cohort } = await req.json();
  if (!email || !password) return json({ error: "이메일과 비밀번호를 입력하세요" }, 400);
  if (password.length < 6) return json({ error: "비밀번호는 6자 이상이어야 합니다" }, 400);

  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    if (error.message.includes("already")) return json({ error: "이미 가입된 이메일입니다" }, 409);
    return json({ error: error.message }, 400);
  }

  await svc.from("profiles").upsert({
    id: data.user.id, email, full_name: name || "", name: name || "",
    phone: phone || "", cohort: cohort || "", role: "user",
    approval_status: "대기중", must_change_password: false,
  });

  return json({ message: "회원가입 완료. 관리자 승인 후 이용 가능합니다.", status: "대기중" });
}

async function handleLogin(req: Request, svc: any) {
  const { email, password } = await req.json();
  if (!email || !password) return json({ error: "이메일과 비밀번호를 입력하세요" }, 400);

  const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data, error } = await anonClient.auth.signInWithPassword({ email, password });
  if (error) return json({ error: "이메일 또는 비밀번호가 올바르지 않습니다" }, 401);

  const { data: profile } = await svc.from("profiles")
    .select("full_name, name, cohort, role, approval_status")
    .eq("id", data.user.id).single();
  if (!profile) return json({ error: "프로필을 찾을 수 없습니다" }, 404);

  return json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in,
    user: {
      id: data.user.id, email: data.user.email,
      name: profile.full_name || profile.name || "",
      cohort: profile.cohort || "", role: profile.role || "user",
      approval_status: profile.approval_status,
    },
  });
}

// ── Admin Handlers ──
async function handleAdmin(path: string, req: Request, svc: any) {
  if (path === "/admin/users") {
    const { data } = await svc.from("profiles")
      .select("id, email, full_name, name, phone, cohort, role, approval_status, created_at")
      .order("created_at", { ascending: false });
    return json(data || []);
  }
  if (path === "/admin/approve" && req.method === "POST") {
    const body = await req.json();
    if (!body.user_id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.user_id)) return json({ error: "유효하지 않은 사용자 ID" }, 400);
    const { data } = await svc.from("profiles").update({ approval_status: "승인완료" }).eq("id", body.user_id).select().single();
    if (!data) return json({ error: "사용자를 찾을 수 없습니다" }, 404);
    return json({ message: "승인 완료", user: data });
  }
  if (path === "/admin/reject" && req.method === "POST") {
    const body = await req.json();
    if (!body.user_id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.user_id)) return json({ error: "유효하지 않은 사용자 ID" }, 400);
    const { data } = await svc.from("profiles").update({ approval_status: "대기중" }).eq("id", body.user_id).select().single();
    if (!data) return json({ error: "사용자를 찾을 수 없습니다" }, 404);
    return json({ message: "승인 취소", user: data });
  }
  if (path === "/admin/stats") {
    const { data } = await svc.from("profiles").select("approval_status");
    const total = data?.length || 0;
    const approved = data?.filter((p: any) => p.approval_status === "승인완료").length || 0;
    return json({ total, approved, pending: total - approved });
  }

  // ── 사용량 통계 ──
  if (path === "/admin/usage") {
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get("days") || "7");
    const since = new Date(Date.now() - days * 86400000).toISOString();

    // 엔드포인트별 총 호출 수
    const { data: logs } = await svc.from("usage_logs")
      .select("endpoint, status_code, response_ms, created_at, user_id")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10000);

    if (!logs) return json({ endpoints: {}, topUsers: [], daily: [], totalCalls: 0, estimatedCost: 0 });

    // 엔드포인트별 집계
    const endpoints: Record<string, { count: number; errors: number; avgMs: number }> = {};
    const userCounts: Record<string, number> = {};
    const dailyCounts: Record<string, Record<string, number>> = {};

    for (const log of logs) {
      const ep = log.endpoint;
      if (!endpoints[ep]) endpoints[ep] = { count: 0, errors: 0, avgMs: 0 };
      endpoints[ep].count++;
      if (log.status_code >= 400) endpoints[ep].errors++;
      endpoints[ep].avgMs += log.response_ms || 0;

      // 유저별
      userCounts[log.user_id] = (userCounts[log.user_id] || 0) + 1;

      // 일별
      const day = log.created_at.substring(0, 10);
      if (!dailyCounts[day]) dailyCounts[day] = {};
      dailyCounts[day][ep] = (dailyCounts[day][ep] || 0) + 1;
    }

    // 평균 응답 시간 계산
    for (const ep of Object.keys(endpoints)) {
      endpoints[ep].avgMs = Math.round(endpoints[ep].avgMs / endpoints[ep].count);
    }

    // 상위 유저 (ID → 이메일 매핑)
    const topUserIds = Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 10);
    const userIds = topUserIds.map(u => u[0]);
    const { data: profiles } = await svc.from("profiles")
      .select("id, email, full_name, name").in("id", userIds);
    const profileMap: Record<string, any> = {};
    (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });

    const topUsers = topUserIds.map(([id, count]) => ({
      email: profileMap[id]?.email || id.substring(0, 8),
      name: profileMap[id]?.full_name || profileMap[id]?.name || "",
      count,
    }));

    // 일별 데이터 (최근 N일)
    const daily = Object.entries(dailyCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, eps]) => ({ date, ...eps, total: Object.values(eps).reduce((a, b) => a + b, 0) }));

    // 예상 비용 (대략적)
    const costMap: Record<string, number> = {
      llm: 0.015, // Claude ~$0.015/call avg
      tts: 0.006, // Google TTS ~$0.006/call avg
      elevenlabs: 0.03, // ElevenLabs ~$0.03/call avg
      youtube: 0.0001, // YouTube ~$0.0001/call
      gas: 0, // GAS free
    };
    let estimatedCost = 0;
    for (const [ep, info] of Object.entries(endpoints)) {
      estimatedCost += (costMap[ep] || 0) * info.count;
    }

    return json({
      totalCalls: logs.length,
      endpoints,
      topUsers,
      daily,
      estimatedCost: Math.round(estimatedCost * 100) / 100,
      period: { days, since },
    });
  }

  // ── Rate Limit 설정 조회/수정 ──
  if (path === "/admin/rate-config") {
    if (req.method === "POST") {
      const body = await req.json();
      if (!body.endpoint || !body.max_requests || !body.window_seconds) {
        return json({ error: "endpoint, max_requests, window_seconds 필수" }, 400);
      }
      if (body.max_requests < 1 || body.max_requests > 10000) return json({ error: "max_requests는 1~10000 범위" }, 400);
      if (body.window_seconds < 60 || body.window_seconds > 86400) return json({ error: "window_seconds는 60~86400 범위" }, 400);
      const { data, error } = await svc.from("rate_config").upsert({
        endpoint: body.endpoint,
        max_requests: body.max_requests,
        window_seconds: body.window_seconds,
        description: body.description || "",
        updated_at: new Date().toISOString(),
      }, { onConflict: "endpoint" }).select().single();
      if (error) return json({ error: error.message }, 500);
      return json({ message: "설정 저장 완료", config: data });
    }
    // GET
    const { data } = await svc.from("rate_config").select("*").order("endpoint");
    return json(data || []);
  }

  return json({ error: "Unknown admin endpoint" }, 404);
}

// ── YouTube Proxy ──
async function handleYouTube(path: string, url: URL, svc: any, userId: string) {
  const rate = await checkRate(svc, userId, "youtube");
  if (!rate.allowed) return json({ error: "요청 한도 초과", code: "RATE_LIMIT" }, 429);
  const start = Date.now();
  const sub = path.replace("/api/youtube/", "");
  if (!["search", "videos", "channels"].includes(sub)) return json({ error: "Unsupported" }, 400);
  const params = new URLSearchParams(url.search);
  params.delete("key");

  // ── 캐싱: search 엔드포인트만 캐싱 (가장 비싼 호출) ──
  if (sub === "search") {
    const cacheKey = "search:" + (params.get("q") || "") + ":" + (params.get("publishedAfter") || "").substring(0, 10) + ":" + (params.get("maxResults") || "5");
    try {
      // 캐시 조회
      const { data: cached } = await svc.from("youtube_cache")
        .select("result")
        .eq("cache_key", cacheKey)
        .gt("expires_at", new Date().toISOString())
        .single();
      if (cached) {
        await logUsage(svc, userId, "youtube_cache", 200, Date.now() - start);
        return json(cached.result);
      }
    } catch (_) { /* 캐시 미스 — 정상 */ }

    // 캐시 미스 → YouTube API 호출
    params.set("key", Deno.env.get("YOUTUBE_API_KEY")!);
    const resp = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    const data = await resp.json();
    await logUsage(svc, userId, "youtube", resp.status, Date.now() - start);
    if (!resp.ok) return json({ error: "YouTube API 오류", code: "UPSTREAM_ERROR", upstream_status: resp.status }, 502);

    // 캐시 저장 (6시간 유효)
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    await svc.from("youtube_cache").upsert({
      cache_key: cacheKey,
      endpoint: "search",
      result: data,
      expires_at: expiresAt,
    }, { onConflict: "cache_key" }).then(() => {}).catch(() => {});

    return json(data);
  }

  // ── videos, channels는 캐싱 없이 바로 호출 (1 unit으로 저렴) ──
  params.set("key", Deno.env.get("YOUTUBE_API_KEY")!);
  const resp = await fetch(`https://www.googleapis.com/youtube/v3/${sub}?${params}`);
  const data = await resp.json();
  await logUsage(svc, userId, "youtube", resp.status, Date.now() - start);
  if (!resp.ok) return json({ error: "YouTube API 오류", code: "UPSTREAM_ERROR", upstream_status: resp.status }, 502);
  return json(data);
}

// ── Google Trends (API 키 불필요) ──
async function handleTrends() {
  const svc = getServiceClient();
  // 캐시 조회 (10분 유효)
  try {
    const { data: cached } = await svc.from("youtube_cache")
      .select("result")
      .eq("cache_key", "trends:kr")
      .gt("expires_at", new Date().toISOString())
      .single();
    if (cached) return json(cached.result);
  } catch (_) { /* 캐시 미스 */ }

  try {
    const resp = await fetch("https://trends.google.com/trending/rss?geo=KR");
    if (!resp.ok) return json({ error: "Google Trends 오류", code: "UPSTREAM_ERROR" }, 502);
    const xml = await resp.text();
    const titles: string[] = [];
    const regex = /<item>[\s\S]*?<title>([^<]+)<\/title>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      const kw = match[1].trim();
      if (kw && titles.length < 20) titles.push(kw);
    }
    const trafficRegex = /<ht:approx_traffic>([^<]+)<\/ht:approx_traffic>/g;
    const traffics: string[] = [];
    while ((match = trafficRegex.exec(xml)) !== null) {
      traffics.push(match[1].trim());
    }
    const koRegex = /[가-힣]/;
    const keywords = titles
      .map((t, i) => ({ keyword: t, traffic: traffics[i] || '', source: 'google_trends', rank: 0 }))
      .filter(k => koRegex.test(k.keyword))
      .map((k, i) => ({ ...k, rank: i + 1 }));
    const result = { keywords, source: "google_trends", geo: "KR", count: keywords.length };

    // 캐시 저장 (10분)
    await svc.from("youtube_cache").upsert({
      cache_key: "trends:kr", endpoint: "trends", result,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }, { onConflict: "cache_key" }).catch(() => {});

    return json(result);
  } catch (err) {
    console.error("[Trends] error:", (err as Error).message);
    notifySlack("trends", 502, (err as Error).message);
    return json({ error: "Google Trends 연결 실패" }, 502);
  }
}

// ── LLM Proxy ──
async function handleLLM(req: Request, svc: any, userId: string) {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const rate = await checkRate(svc, userId, "llm");
  if (!rate.allowed) return json({ error: "요청 한도 초과", code: "RATE_LIMIT" }, 429);
  const start = Date.now();
  const body = await req.json();
  const prompt = body.prompt;
  if (!prompt) return json({ error: "prompt required" }, 400);
  if (prompt.length > 30000) return json({ error: "Too long" }, 400);

  const provider = (body.provider || "claude").toLowerCase();
  const ALLOWED_CLAUDE_MODELS = ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"];
  const ALLOWED_GEMINI_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash"];

  let resp: Response;
  if (provider === "claude") {
    const apiKey = Deno.env.get("CLAUDE_API_KEY");
    if (!apiKey) return json({ error: "Claude API 키가 서버에 설정되지 않았습니다", code: "MISSING_KEY" }, 502);
    const model = ALLOWED_CLAUDE_MODELS.includes(body.model) ? body.model : ALLOWED_CLAUDE_MODELS[0];
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: Math.min(body.max_tokens || 4096, 8192), messages: [{ role: "user", content: prompt }] }),
    });
  } else {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "Gemini API 키가 서버에 설정되지 않았습니다", code: "MISSING_KEY" }, 502);
    const model = ALLOWED_GEMINI_MODELS.includes(body.model) ? body.model : ALLOWED_GEMINI_MODELS[0];
    resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
  }
  const data = await resp.json();
  await logUsage(svc, userId, "llm", resp.status, Date.now() - start);
  // upstream API 에러는 502로 래핑 (401/403이 우리 인증과 충돌 방지)
  if (!resp.ok) {
    console.error("[LLM] upstream error:", resp.status);
    notifySlack("llm", resp.status, `AI API ${resp.status}`, userId);
    return json({ error: "AI API 오류", code: "UPSTREAM_ERROR", upstream_status: resp.status }, 502);
  }
  return json(data);
}

// ── TTS Proxy ──
async function handleTTS(req: Request, svc: any, userId: string) {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const rate = await checkRate(svc, userId, "tts");
  if (!rate.allowed) return json({ error: "요청 한도 초과" }, 429);
  const start = Date.now();
  const body = await req.json();
  if (!body.input?.text) return json({ error: "텍스트가 필요합니다" }, 400);
  if (body.input.text.length > 5000) return json({ error: "Too long" }, 400);
  // 허용 필드만 추출
  const sanitizedBody = {
    input: { text: body.input.text },
    voice: { languageCode: body.voice?.languageCode || "ko-KR", name: body.voice?.name, ssmlGender: body.voice?.ssmlGender },
    audioConfig: { audioEncoding: body.audioConfig?.audioEncoding || "MP3", speakingRate: Math.min(Math.max(body.audioConfig?.speakingRate || 1.0, 0.5), 2.0), pitch: Math.min(Math.max(body.audioConfig?.pitch || 0, -10), 10) }
  };
  const resp = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${Deno.env.get("GOOGLE_TTS_KEY")}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sanitizedBody) });
  const data = await resp.json();
  await logUsage(svc, userId, "tts", resp.status, Date.now() - start);
  if (!resp.ok) { notifySlack("tts", resp.status, `TTS API ${resp.status}`, userId); return json({ error: "TTS API 오류", code: "UPSTREAM_ERROR", upstream_status: resp.status, detail: data }, 502); }
  return json(data);
}

// ── ElevenLabs Proxy ──
async function handleElevenLabs(path: string, req: Request, svc: any, userId: string) {
  const rate = await checkRate(svc, userId, "elevenlabs");
  if (!rate.allowed) return json({ error: "요청 한도 초과" }, 429);
  const start = Date.now();
  const sub = path.replace("/api/elevenlabs/", "");
  if (sub.startsWith("tts/")) {
    const voiceId = sub.replace("tts/", "");
    if (!/^[a-zA-Z0-9_-]+$/.test(voiceId)) return json({ error: "Invalid voice ID" }, 400);
    // body 파싱 + 허용 필드만 추출 (크레딧 보호)
    let elBody: any;
    try { elBody = await req.json(); } catch (_) { return json({ error: "Invalid request body" }, 400); }
    if (!elBody.text || typeof elBody.text !== "string") return json({ error: "텍스트가 필요합니다" }, 400);
    if (elBody.text.length > 5000) return json({ error: "텍스트가 너무 깁니다 (5000자 제한)" }, 400);
    const sanitizedEl = {
      text: elBody.text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    };
    const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST", headers: { "Content-Type": "application/json", "xi-api-key": Deno.env.get("ELEVENLABS_KEY")! },
      body: JSON.stringify(sanitizedEl) });
    await logUsage(svc, userId, "elevenlabs", resp.status, Date.now() - start);
    if (!resp.ok) notifySlack("elevenlabs", resp.status, `ElevenLabs TTS ${resp.status} voice:${voiceId}`, userId);
    return rawResponse(resp.body, { "Content-Type": resp.headers.get("Content-Type") || "audio/mpeg" }, resp.status);
  }
  if (sub === "voices/add") {
    // 파일 크기 제한 (10MB)
    const contentLength = parseInt(req.headers.get("content-length") || "0");
    if (contentLength > 10 * 1024 * 1024) return json({ error: "파일이 너무 큽니다 (10MB 제한)" }, 400);
    const resp = await fetch("https://api.elevenlabs.io/v1/voices/add", { method: "POST", headers: { "xi-api-key": Deno.env.get("ELEVENLABS_KEY")! }, body: req.body });
    const data = await resp.json();
    await logUsage(svc, userId, "elevenlabs", resp.status, Date.now() - start);
    if (!resp.ok) return json({ error: "ElevenLabs API 오류", code: "UPSTREAM_ERROR", detail: data }, 502);
    return json(data);
  }
  if (sub === "voices") {
    const resp = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": Deno.env.get("ELEVENLABS_KEY")! } });
    const data = await resp.json();
    if (!resp.ok) return json({ error: "ElevenLabs API 오류", code: "UPSTREAM_ERROR" }, 502);
    const voices = (data.voices || []).map((v: any) => ({ voice_id: v.voice_id, name: v.name, category: v.category, labels: v.labels }));
    return json({ voices, count: voices.length });
  }
  return json({ error: "Unsupported" }, 400);
}

// ── GAS Proxy ──
async function handleGAS(url: URL, svc: any, userId: string) {
  const rate = await checkRate(svc, userId, "gas");
  if (!rate.allowed) return json({ error: "요청 한도 초과" }, 429);
  const gasUrl = Deno.env.get("GAS_URL");
  if (!gasUrl) return json({ error: "GAS not configured" }, 500);
  // action 화이트리스트
  const action = url.searchParams.get("action") || "";
  if (!["issuelink", "subtitle"].includes(action)) return json({ error: "허용되지 않은 action입니다" }, 400);
  // 허용 파라미터만 전달
  const allowedParams: Record<string, string[]> = { issuelink: ["action","cat"], subtitle: ["action","videoId"] };
  const safeParams = new URLSearchParams();
  (allowedParams[action] || []).forEach(k => { const v = url.searchParams.get(k); if (v) safeParams.set(k, v); });

  // issuelink는 30분 캐시 (자주 안 바뀜)
  if (action === "issuelink") {
    const cacheKey = "gas:issuelink:" + (url.searchParams.get("cat") || "all");
    try {
      const { data: cached } = await svc.from("youtube_cache")
        .select("result").eq("cache_key", cacheKey)
        .gt("expires_at", new Date().toISOString()).single();
      if (cached) { await logUsage(svc, userId, "gas_cache", 200, 0); return json(cached.result); }
    } catch (_) { /* 캐시 미스 */ }

    const start = Date.now();
    const resp = await fetch(`${gasUrl}?${safeParams}`, { redirect: "follow" });
    const data = await resp.json();
    await logUsage(svc, userId, "gas", resp.status, Date.now() - start);
    if (!resp.ok) return json({ error: "GAS API 오류", code: "UPSTREAM_ERROR", detail: data }, 502);

    // 캐시 저장 (30분)
    await svc.from("youtube_cache").upsert({
      cache_key: cacheKey, endpoint: "gas", result: data,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }, { onConflict: "cache_key" }).catch(() => {});

    return json(data);
  }

  // subtitle은 캐싱 안 함 (영상별로 다름)
  const start = Date.now();
  const resp = await fetch(`${gasUrl}?${safeParams}`, { redirect: "follow" });
  const data = await resp.json();
  await logUsage(svc, userId, "gas", resp.status, Date.now() - start);
  if (!resp.ok) return json({ error: "GAS API 오류", code: "UPSTREAM_ERROR", detail: data }, 502);
  return json(data);
}
