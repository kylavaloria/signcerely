#!/usr/bin/env node
/**
 * Rewrites the "Test results" table in README.md from the latest finished run
 * of each test workflow on main. Run by .github/workflows/test-results.yml
 * after every test run; can also be run locally with the GitHub CLI signed in:
 *
 *   node scripts/update-test-results.mjs            # update README.md
 *   node scripts/update-test-results.mjs --print    # only print the table
 *
 * Needs `gh` (uses GH_TOKEN in Actions). No npm packages.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REPO = process.env.GITHUB_REPOSITORY || "kylavaloria/signcerely";
const README = fileURLToPath(new URL("../README.md", import.meta.url));
const START = "<!-- test-results:start -->";
const END = "<!-- test-results:end -->";

const SUITES = [
  {
    workflow: "app.yml",
    name: "Unit tests",
    tool: "Vitest",
    covers: "Sign-in messages, invite keys, who may sign, document rules, file names, the signed copy, error messages, contract calls",
    parse: vitest,
  },
  {
    workflow: "contract.yml",
    name: "Contract tests",
    tool: "Rust",
    covers: "Signing order, approvals, invite proofs, one wallet per spot, decline, cancel, final fingerprint, events",
    parse: cargo,
  },
  {
    workflow: "e2e.yml",
    name: "End-to-end",
    tool: "Playwright",
    covers: "A real browser against a local Supabase and a private Stellar network: signing in order through to verify, only the invited person can sign, decline with a reason, one confirmed email per account",
    parse: playwright,
  },
  {
    workflow: "testnet-integration.yml",
    name: "Testnet integration",
    tool: "Vitest",
    covers: "The real signing flow against the deployed testnet contract",
    parse: vitest,
  },
];

const gh = (args) => execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

/** Log lines without the job/step prefix, timestamp or colour codes. */
function logLines(runId) {
  return gh(["run", "view", String(runId), "--repo", REPO, "--log"])
    .replace(/\x1b\[[0-9;]*m/g, "")
    .split("\n")
    .map((l) => l.replace(/^.*?\d{4}-\d\d-\d\dT[\d:.]+Z ?/, ""));
}

function vitest(lines) {
  const out = { passed: 0, failed: 0, skipped: 0 };
  for (const l of lines) {
    const m = l.match(/^\s*Tests\s+(.+?)\s*\(\d+\)\s*$/);
    if (!m) continue;
    for (const part of m[1].split("|")) {
      const [, n, kind] = part.trim().match(/^(\d+)\s+(\w+)/) ?? [];
      if (kind === "passed") out.passed += +n;
      else if (kind === "failed") out.failed += +n;
      else if (kind === "skipped" || kind === "todo") out.skipped += +n;
    }
  }
  return out;
}

function cargo(lines) {
  const out = { passed: 0, failed: 0, skipped: 0 };
  for (const l of lines) {
    const m = l.match(/test result: \w+\. (\d+) passed; (\d+) failed; (\d+) ignored/);
    if (!m) continue;
    out.passed += +m[1];
    out.failed += +m[2];
    out.skipped += +m[3];
  }
  return out;
}

function playwright(lines) {
  // Summary lines at the end of a run, e.g. "  4 passed (1.2m)", "  1 failed", "  2 flaky".
  const out = { passed: 0, failed: 0, skipped: 0 };
  for (const l of lines) {
    const m = l.match(/^\s+(\d+) (passed|failed|flaky|skipped|did not run)\b/);
    if (!m) continue;
    if (m[2] === "passed" || m[2] === "flaky") out.passed += +m[1];
    else if (m[2] === "failed") out.failed += +m[1];
    else out.skipped += +m[1];
  }
  return out;
}

function latestRun(workflow) {
  const runs = JSON.parse(
    gh(["run", "list", "--repo", REPO, "--workflow", workflow, "--branch", "main", "--status", "completed", "--limit", "10", "--json", "databaseId,conclusion,updatedAt,url"]),
  );
  // Skip cancelled runs: they say nothing about the tests.
  return runs.find((r) => r.conclusion !== "cancelled" && r.conclusion !== "skipped") ?? null;
}

const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function result(run, counts) {
  if (!run) return "⏳ Not run yet";
  const ok = run.conclusion === "success";
  const parts = [];
  if (counts.failed) parts.push(`${counts.failed} failed`);
  if (counts.passed) parts.push(`${counts.passed} passed`);
  if (counts.skipped) parts.push(`${counts.skipped} skipped`);
  const text = parts.length ? parts.join(", ") : ok ? "passed" : run.conclusion.replace(/_/g, " ");
  return `${ok ? "✅" : "❌"} [${text}](${run.url})`;
}

function staticChecks(run) {
  if (!run) return "⏳ Not run yet";
  const jobs = JSON.parse(gh(["api", `repos/${REPO}/actions/runs/${run.databaseId}/jobs`]));
  const steps = jobs.jobs.flatMap((j) => j.steps ?? []);
  const step = (name) => steps.find((s) => s.name.includes(name))?.conclusion;
  const lint = step("npm run lint");
  const types = step("npm run typecheck");
  const build = step("npm run build");
  const all = [lint, types, build];
  const ok = all.every((c) => c === "success");
  const text = ok ? "no errors" : all.some((c) => c === "failure") ? "errors found" : "didn't finish";
  return `${ok ? "✅" : "❌"} [${text}](${run.url})`;
}

function buildTable() {
  const rows = [];
  let appRun = null;
  for (const s of SUITES) {
    const run = latestRun(s.workflow);
    if (s.workflow === "app.yml") appRun = run;
    const counts = run ? s.parse(logLines(run.databaseId)) : { passed: 0, failed: 0, skipped: 0 };
    // The testnet tests are skipped inside the unit-test job and run in their own job.
    if (s.workflow === "app.yml") counts.skipped = 0;
    rows.push(`| **${s.name}** (${s.tool}) | ${s.covers} | ${result(run, counts)} | ${run ? fmtDate(run.updatedAt) : "–"} |`);
  }
  rows.push(`| **Lint, types and build** (ESLint, TypeScript, Next.js) | The whole web app | ${staticChecks(appRun)} | ${appRun ? fmtDate(appRun.updatedAt) : "–"} |`);
  return [
    "| Suite | What it covers | Latest result on `main` | Run |",
    "|---|---|---|---|",
    ...rows,
    "",
    "_Updated automatically after every test run on `main`. Click a result to open that run._",
  ].join("\n");
}

const table = buildTable();
if (process.argv.includes("--print")) {
  console.log(table);
} else {
  const readme = readFileSync(README, "utf8");
  const a = readme.indexOf(START);
  const b = readme.indexOf(END);
  if (a < 0 || b < a) throw new Error(`README.md needs ${START} and ${END} markers`);
  const next = readme.slice(0, a + START.length) + "\n" + table + "\n" + readme.slice(b);
  if (next !== readme) {
    writeFileSync(README, next);
    console.log("README.md updated");
  } else console.log("README.md already up to date");
}
