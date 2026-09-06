# Open kritt command
- `./kritt` is the main CLI entrypoint for open·kritt. It has a few subcommands:
- `./kritt start` — starts the engine and web UI in Docker containers (or just the engine if you pass `--no-ui`).
- `./kritt stop` — stops the engine and web UI containers.
- `./kritt setup` — runs the initial setup wizard (or re-runs it if you pass `--force`).
  



# open·kritt Scan Guide — what every setting actually does

This is a plain-English reference for every field on the "New scan" page, plus the engine
runtime knobs on the "Settings" page, based on how the code actually uses each value (not
just the label text). Read this before you click "New scan" so you know exactly what
you're choosing.

---

## 1 · Workflow

The playbook the AI agents follow. It's a fixed sequence of prompts ("steps") — e.g. the
"Cosmos ABCI Panic Halt Review" workflow has 5 steps, the "Solana Program Security Review"
workflow has 2 depths. Each step can build on the output of
earlier steps. This is the single biggest driver of *what* the scan looks for — pick the
workflow that matches the vulnerability class you actually care about.

**open·kritt is chain-agnostic.** The core pipeline (repo -> prompt DAG -> AI harness ->
findings -> post-scripts -> ranker) has zero chain-coupled code. EVM/Solidity, Cosmos, Solana,
and general web/cloud security are all treated as content — workflows, skills, post-scripts,
and rankers are data (DB rows), not code. The engine image pre-installs
Foundry/Aderyn (EVM) and Solana CLI/Anchor (Solana) tooling, but the harness can install
additional chain tooling at scan time for any ecosystem.

---

## 2 · Target

**Remote vs Local** — where the code being scanned comes from.

- **Remote**: `repository` is a GitHub repo (`owner/repo` or a full GitHub URL).
  `commit_sha` pins which commit to scan (leave as `HEAD` for the latest commit on the
  default branch).
- **Local**: pick a repo already mounted on your machine under the configured local-repos
  path. open·kritt takes **one snapshot** of the folder the moment the scan starts
  (including uncommitted/untracked files, excluding `.git`) and scans that snapshot. Git
  isn't required for local repos. Later changes to the folder won't be picked up — start a
  new scan to capture them.

**repo_scope** — a free-text field, *not* a dropdown. Whatever you type here gets injected
directly into the workflow's prompts wherever they reference `{{repo_scope}}`. Default is
`"full repository"`. You can narrow it with plain English, e.g. `"only the contracts in
src/vaults/"` or `"focus on the withdrawal and liquidation logic"` — the AI reads this as an
instruction, so write it the way you'd tell a human auditor where to focus.

---

## 3 · Dependencies (optional)

Extra repos (remote or local) scanned **alongside** the target — for context, not as the
main subject. Use this for libraries or shared contracts the target depends on, so the
agent can see how external calls actually behave instead of guessing.

---

## 4 · Configuration

A JSON blob controlling scan mechanics. The two keys that ship by default:

- `max_files` — hard cap on how many files get pulled into the scan (default `4000`).
  Prevents runaway scans on huge monorepos.
- `include_tests` — whether test files/directories are included (default `false`). Turn
  this on only if you specifically want the AI reviewing test code too.

**maximum model jobs** (the "1 to unlimited" field): a hard cap on the number of individual
LLM-calling tasks the whole scan is allowed to spend, across both the main workflow *and*
post-processing. A single workflow step can fan out into many jobs (e.g. one per file or
per candidate finding), so this isn't the same as "number of steps." Once the cap is hit
(and nothing is still running), the scan **auto-stops** with status `stopped` and a
`job_limit_reached` reason — it doesn't error, it just calls it done early. Internal
retries don't count against the cap.

- Leave blank (`unlimited`) for a full, uncapped run.
- Set it to `1` as a cheap smoke test — proves the model/provider/workflow plumbing works
  end-to-end before you commit to the cost of a full scan.
- Set it to a small number (e.g. `20`) if you want partial results without full spend on a
  large repo.

---

## 5 · Extra

Some workflows and post-scripts reference `{{extra.some_key}}` placeholders in their
prompts. If the one you picked has any, this section lists them and **you must fill in
every one** — the field is red/required until you do. Example: the "Is Malicious Actor in
scope" post-script needs `extra.bug_bounty_url` — the actual live bug-bounty program page
(Immunefi/HackenProof/Cantina/etc.) for the target you're scanning, so it can check whether
a finding's assumed attacker role is actually eligible for a payout under that program's
rules. If the target has no live bounty program, this specific post-script isn't the right
fit for this scan.

---

## 6 · Model & Harness

- **model_provider** — which backend actually serves the model: `codex` (OpenAI/ChatGPT
  account), `claude` (Anthropic/Claude Code subscription or API key), `openrouter`, or
  `deepseek` (DeepSeek's own API, driven through the Claude Code harness via DeepSeek's
  Anthropic-compatible endpoint).
- **harness** — which CLI tool actually drives the agent: `codex` (Codex CLI) or
  `claude-code` (Claude Code CLI). **Not every provider supports every harness** — this is
  hardcoded in the app:

  | Provider | Allowed harness |
  |---|---|
  | `codex` | codex |
  | `claude` | claude-code |
  | `openrouter` | claude-code, codex |
  | `deepseek` | claude-code only |

  `deepseek` has no Codex-side wiring at all — every DeepSeek scan/depth must use the
  `claude-code` harness. The engine points Claude Code's `ANTHROPIC_BASE_URL`/
  `ANTHROPIC_AUTH_TOKEN` at your `DEEPSEEK_BASE_URL`/`DEEPSEEK_API_KEY` under the hood.
- **model** — the exact model ID. For providers with a live catalog it's a dropdown; for
  `openrouter`/`deepseek` it's free text since those are custom/aggregated endpoints, but
  `deepseek` does have a couple of pre-seeded suggestions (`deepseek-v4-pro[1m]`,
  `deepseek-v4-flash`) so you don't have to remember exact IDs. Anything else still needs
  to be typed exactly.
- **thinking_effort** — reasoning depth for the main workflow (`default`, `low`, `medium`,
  `high`, `xhigh`, `max`, `ultra`, subject to what the chosen model actually supports).
  Higher = more thorough but slower and more expensive per call.
- **post_processing_thinking_effort** — a *separate* reasoning-effort dial, used only
  during post-processing (triage, enrichment, and your selected post-scripts) — not the
  main workflow steps. You can run the main scan at `medium` and post-processing at `high`
  (or vice versa) independently.
- **"One model for all depths" vs "Customize by depth"** — workflow steps are grouped into
  "depths" (roughly: how deep/derived a step is in the workflow's chain — later steps often
  consume earlier steps' output). By default one model configuration covers every depth.
  "Customize by depth" lets you assign a *different* model/provider/harness/effort per
  depth — e.g. a cheap/fast model for broad candidate-finding steps, and a stronger model
  only for the deep verification steps. Shows up on the scan detail page as "DEPTH
  OVERRIDES."

---

## 7 · Agent Skills (optional)

Extra methodology packs installed into every executor agent for this scan — think of them
as bolt-on expertise (e.g. a specific vulnerability-class checklist) beyond what the
workflow's own prompts already cover. Select any number; each selected skill's full
instructions get loaded into the agent's context for every job in the scan.

---

## 8 · Post-Scripts

Validation/enrichment steps that run *after* the main workflow, against whatever findings
survived triage. You can select multiple — **the first one you select is stored as the
scan's "primary" post-script**, but all selected ones run. Example:
"Is Malicious Actor in scope" (see Extra, above) re-checks each finding's assumed attacker
against a real bounty program's scope rules.

---

## 9 · Severity Ranker

Rules that tell the AI how to grade severity (Critical/High/Medium/Low/etc.) for whatever
it finds. You can pick any number of saved rankers — their rules get concatenated in the
order you select them — and then add your own scan-specific markdown rules on top (these
are appended last, so they can override the general rankers for this one scan). Example
scan-specific rule: *"Treat anything reachable from the public checkout flow as at least
High."* There's a "Combined ruleset" preview so you can see exactly what the AI will
receive before you launch.

---

## If a scan is already running

You'll get a popup asking whether to:
- **Queue** — wait behind the currently running scan(s), or
- **Start immediately** — run concurrently, sharing the engine's worker pool
  (`ENGINE_WORKER_COUNT` in `.env`, default 2) with whatever's already running.

---

## Settings page (engine runtime)

This is a separate page from "New scan" — it tunes how the engine itself behaves across
*all* scans, not one scan's configuration. Every field maps to an `ENGINE_*` variable in
`.env`, but editing it here writes to a **live runtime-config file**
(`ENGINE_RUNTIME_CONFIG_PATH`, layered on top of `.env`) instead — so changes here take
effect without editing `.env` by hand. Precedence when the engine reads a value: Settings
page (live) → container's actual process environment → `.env` file → built-in default.

All of these apply **immediately, live, no restart needed** — except
`workspaceSetupConcurrency`, which needs the engine container recreated
(`docker compose up -d --force-recreate engine`, or a full `./kritt start`) to take effect.

| Setting | `.env` var | Range (recommended max) | What it actually does |
|---|---|---|---|
| Engine worker slots | `ENGINE_WORKER_COUNT` | 0–128 (10) | Total capacity shared across every scan's workflow steps *and* post-processing jobs. Set to `0` to pause picking up any new work without killing jobs already running — useful for a clean pause. |
| Concurrent scan pool | `ENGINE_MAX_CONCURRENT_SCANS` | 1–128 (4) | How many scans can be *actively* running at once. Anything beyond this waits in the queue (see "If a scan is already running" above) until a slot frees up. |
| Workers per scan | `ENGINE_MAX_WORKERS_PER_SCAN` | 0–128 (10) | Hard cap on how many of the shared worker slots any *single* scan can use at once. `0` means "share automatically and fairly" across whatever scans are active, instead of a fixed per-scan limit. |
| Workers per account | `ENGINE_WORKERS_PER_ACCOUNT` | 1–128 (15) | Cap on concurrent root model calls using the *same provider credential*, across all scans combined — protects one API key/account from being hammered by too many parallel requests. Separate from a Codex session's own subagent cap (next row). |
| Autoscale scan workers on capacity errors | `ENGINE_AUTOSCALE_SCAN_WORKERS_ON_PROVIDER_CAPACITY` | on/off | When a provider returns a temporary capacity/rate-limit error (or Codex hits its own subagent limit), automatically drop *that scan's* worker cap by one and retry, rather than failing outright. Does not kick in for hard account-quota errors — those need a real fix (more quota, a different key), not fewer workers. |
| Codex subagents per session | `ENGINE_CODEX_MAX_SUBAGENTS_PER_SESSION` | 1–5 (5) | How many child agents one Codex scan session is allowed to run concurrently *inside itself* (Codex's own internal parallelism, separate from the engine's worker pool). |
| Minimum free storage | `ENGINE_MIN_FREE_STORAGE_GB` | 0–1024 GiB | The disk-space floor that triggers the "Low storage" pause you may have already seen — new scan containers won't start below this much free space, though already-running ones aren't interrupted. |
| Ignore low-storage safeguard | `ENGINE_IGNORE_LOW_STORAGE` | on/off | Bypasses the check above entirely. Turning this on risks filling the host disk completely, which can take down scans *and* the rest of the stack (Postgres included) — leave it off unless you specifically accept that risk. |
| Workspace setup concurrency | `ENGINE_WORKSPACE_SETUP_CONCURRENCY` | 1–32 (4) | How many repo checkouts / workspace preparations can happen at the same time. Lower this if you're seeing Docker, disk, or network bursts when several scans start close together. **Needs an engine container restart to apply** — the only setting on this page that does. |
| Model-call retries | `ENGINE_RETRY_COUNT` | 0–10 (2) | Extra attempts for a single workflow-step or post-script call that fails in a retryable way. This is per-call retry, not a whole-scan resume — a scan that fails outright still needs to be manually restarted/duplicated. |
| Model-call timeout | `ENGINE_HARNESS_TIMEOUT_SECONDS` | 60–86400 sec (7200 = 2h) | Maximum time any single harness invocation (one Codex/Claude call) is allowed to run before it's killed as timed out. Raise this for workflows with very large/slow individual steps. |

There's also a **"Scheduling roadmap"** section on this page listing capabilities that exist
in the data model but aren't switched on yet (e.g. "Whole-scan auto-resume" — automatically
retrying an entire failed scan with backoff). These are informational only; nothing to
configure there today.

---

## Practical notes learned the hard way (this setup, as of now)

- **DeepSeek is driven entirely through the Claude Code harness**, using a single
  `DEEPSEEK_API_KEY` and an optional `DEEPSEEK_BASE_URL` (defaults to
  `https://api.deepseek.com/anthropic` when left blank). Claude Code's SDK talks to it via
  `ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN` under the hood — the engine wires that up
  automatically, you don't need to think about it, just pick `deepseek` as the provider and
  `claude-code` as the harness (see Model & Harness above).
- Before committing to a big/expensive scan on a new setup, set **maximum model jobs to
  `1`** first — it's the cheapest possible way to prove the model provider and workflow are
  actually wired correctly before spending real time/tokens on a full run.
- If a scan pauses with a **"Low storage"** banner, that's Docker's own safety check
  (`ENGINE_MIN_FREE_STORAGE_GB` in `.env`, default 20 GiB free required) — it's not an
  error, the scan resumes automatically once disk space is freed.
