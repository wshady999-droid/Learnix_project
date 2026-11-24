#!/usr/bin/env node
/**
 * Learnix Production Verification, Functional Test & Concurrent Load Suite
 *
 * Tests:
 * 1. Health & Public API endpoints (/api/health, /api/certificates/verify, /api/search auth guard)
 * 2. Public Pages TTFB & HTML Payload (/, /login, /signup, /forgot-password, /privacy, /terms, /verify-certificate)
 * 3. Protected Route Enforcement (/admin, /teacher, /student, /profile, /calendar, /messages redirect to /login?reason=session_expired)
 * 4. Input Validation & Security Guards (Contact API, Certificate Verification API)
 * 5. Concurrent Load & Stress Benchmarks (10, 50, and 100 concurrent users) measuring Avg, Median, P95, P99, RPS, and Error Rate.
 */

import { performance } from "node:perf_hooks";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3105";

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Number(sorted[idx].toFixed(2));
}

async function measureRequest(url, options = {}) {
  const start = performance.now();
  try {
    const res = await fetch(url, { redirect: "manual", ...options });
    await res.arrayBuffer();
    const durationMs = performance.now() - start;
    return { ok: true, status: res.status, durationMs, headers: res.headers };
  } catch (err) {
    const durationMs = performance.now() - start;
    return { ok: false, status: 0, durationMs, error: err?.message || String(err) };
  }
}

async function runLoadScenario(name, path, concurrency, totalRequests) {
  const latencies = [];
  let errors = 0;
  let completed = 0;

  const startSuite = performance.now();

  async function worker() {
    while (true) {
      const current = completed++;
      if (current >= totalRequests) break;
      const result = await measureRequest(`${BASE_URL}${path}`);
      latencies.push(result.durationMs);
      if (!result.ok || (result.status >= 500 && result.status < 600)) {
        errors++;
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const totalTimeSec = (performance.now() - startSuite) / 1000;
  latencies.sort((a, b) => a - b);

  const sum = latencies.reduce((acc, v) => acc + v, 0);
  const avg = latencies.length > 0 ? Number((sum / latencies.length).toFixed(2)) : 0;
  const median = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);
  const p99 = percentile(latencies, 99);
  const rps = Number((totalRequests / totalTimeSec).toFixed(1));
  const errorRate = Number(((errors / totalRequests) * 100).toFixed(2));

  console.log(
    `[LOAD] ${name} (${concurrency} concurrent / ${totalRequests} reqs): avg=${avg}ms | p50=${median}ms | p95=${p95}ms | p99=${p99}ms | RPS=${rps}/s | errors=${errorRate}%`,
  );

  return { name, concurrency, totalRequests, avg, median, p95, p99, rps, errorRate };
}

async function main() {
  console.log(`=== Learnix Production Verification & Load Benchmark (${BASE_URL}) ===\n`);

  const assertions = [];
  function recordAssertion(name, passed, detail) {
    assertions.push({ name, passed, detail });
    console.log(`[${passed ? "PASS" : "FAIL"}] ${name} — ${detail}`);
  }

  // Warmup request
  await measureRequest(`${BASE_URL}/api/health`);

  // 1. Health API
  const healthStart = performance.now();
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const healthTtfb = Number((performance.now() - healthStart).toFixed(2));
  const healthJson = await healthRes.json();
  recordAssertion(
    "GET /api/health returns 200 OK",
    healthRes.status === 200 && healthJson.status === "ok",
    `status=${healthRes.status}, TTFB=${healthTtfb}ms`,
  );

  // 2. Public Pages TTFB
  for (const route of ["/", "/login", "/signup", "/forgot-password", "/privacy", "/terms", "/verify-certificate"]) {
    // Warmup & measure
    await measureRequest(`${BASE_URL}${route}`);
    const res = await measureRequest(`${BASE_URL}${route}`);
    recordAssertion(
      `GET ${route} renders 200 OK`,
      res.status === 200,
      `status=${res.status}, TTFB=${res.durationMs.toFixed(2)}ms`,
    );
  }

  // 3. Protected Routes Auth Guard (unauthenticated requests must redirect 307 to /login?reason=session_expired)
  for (const protectedRoute of ["/admin", "/teacher", "/student", "/profile", "/calendar", "/messages"]) {
    const res = await measureRequest(`${BASE_URL}${protectedRoute}`);
    const location = res.headers?.get("location") || "";
    recordAssertion(
      `Protected route ${protectedRoute} enforces auth redirect`,
      (res.status === 307 || res.status === 302) && location.includes("/login"),
      `status=${res.status}, redirect=${location}, latency=${res.durationMs.toFixed(2)}ms`,
    );
  }

  // 4. Global Search API Auth Guard
  const searchUnauthRes = await fetch(`${BASE_URL}/api/search?q=math`);
  recordAssertion(
    "GET /api/search rejects unauthenticated requests with 401",
    searchUnauthRes.status === 401,
    `status=${searchUnauthRes.status}`,
  );

  // 5. Certificate Verification API Validation
  const certShortRes = await fetch(`${BASE_URL}/api/certificates/verify?code=123`);
  recordAssertion(
    "GET /api/certificates/verify validates short codes with 400",
    certShortRes.status === 400,
    `status=${certShortRes.status}`,
  );

  // 6. Contact API Validation
  const contactInvalidRes = await fetch(`${BASE_URL}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: "A", email: "invalid-email", subject: "Hi", message: "Short" }),
  });
  recordAssertion(
    "POST /api/contact rejects invalid payload with 400",
    contactInvalidRes.status === 400,
    `status=${contactInvalidRes.status}`,
  );

  console.log("\n=== Running Concurrent Load & Stress Benchmarks ===");
  await runLoadScenario("Landing Page (/)", "/", 10, 50);
  await runLoadScenario("Landing Page (/)", "/", 50, 150);
  await runLoadScenario("Landing Page (/)", "/", 100, 300);

  await runLoadScenario("Login Page (/login)", "/login", 10, 50);
  await runLoadScenario("Login Page (/login)", "/login", 50, 150);
  await runLoadScenario("Login Page (/login)", "/login", 100, 300);

  await runLoadScenario("Signup Page (/signup)", "/signup", 50, 150);
  await runLoadScenario("Health API (/api/health)", "/api/health", 100, 400);
  await runLoadScenario("Protected Guard (/student)", "/student", 50, 200);

  const failed = assertions.filter((a) => !a.passed);
  console.log(`\n=== Summary: ${assertions.length - failed.length}/${assertions.length} Functional Checks Passed ===`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Verification suite failed:", err);
  process.exit(1);
});
