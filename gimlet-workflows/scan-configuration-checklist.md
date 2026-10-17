# Scan configuration checklist (gimlet-lite-v3)

> **Purpose**: Whenever a new protocol needs an open-kritt scan (local folder or GitHub
> link), work through this file to decide the scan form's settings. This is meant to be
> read fresh in any session, in any working directory - it does not assume prior
> conversation context.
>
> **Ordering**: The numbered sections below mirror the "Create scan" UI form's own
> step numbers 1-9 exactly (`frontend/src/pages/CreateScan.jsx`), in the order they
> appear on screen, so you can answer this checklist top to bottom while filling the form
> top to bottom. If the UI's step numbers or labels ever change, re-grep
> `frontend/src/pages/CreateScan.jsx` for `<Label>N ·` before trusting this file's order.

## Model access (current constraint - update this section if it changes)

**Updated 2026-08-30**: one provider is configured and usable in this setup.

- **DeepSeek** (`DEEPSEEK_API_KEY`, driven through the `codex` harness) - no known
  reliability issues. Authenticated live model catalog with `deepseek-flash` as the
  default and `deepseek-v4-pro` for deeper work. No base URL is needed.

## Step 0 · Gather this first (not a form field)

Ask for (or determine from the repo itself) if not already given - none of this maps to a
single form field, it informs several steps below:
1. **Target**: local folder path or GitHub `owner/repo` + commit/branch.
2. **Scope**: is this a contest with a defined in-scope file list (Code4rena/Sherlock/
   Cantina-style), or a bug bounty with no fixed scope? If scoped, get the exact file
   list. If out-of-scope dependencies can still be reported (common on bounties, rare on
   contests), note that.
3. **Prior audits**: does a previous audit report exist for this codebase? If so, what did
   it already cover - feed this into Step 5's `extra.protocol_context` so the scan is
   pushed toward what hasn't been looked at, not what's already been found and fixed.
4. **Trust model**: who is fully trusted (DAO/multisig/timelock) vs semi-trusted
   (operator/keeper/bot) vs untrusted (any user)? Get this from docs/README if available,
   otherwise infer from role names in code and say so explicitly as an assumption.
5. **Bounty/contest program rules**: for a bug bounty (e.g. Immunefi) or contest, pull the
   stated impact exclusions, confirmed in-scope/reward-eligible asset list, and any
   severity tie-break rule from the program page - this feeds Step 9's scan-specific rules.
6. **Local-folder pre-warm (local repos only, do this BEFORE starting the scan)**: if the
   target is a folder under `local_repos/` and its build/dependency artifacts
   (`node_modules/`, `out/`, `cache/`, etc.) were deleted or never generated, `cd` into it
   on the host and run its normal install/build once (`yarn install` or `npm install`, then
   `forge build`, or the project's equivalent) before creating the scan. Why: open-kritt
   takes ONE snapshot of a local-repo folder per scan, at scan start, and reuses that same
   cached snapshot for every depth (D0-D3) - so a cold `via_ir` Foundry compile inside D0's
   tooling step can eat a large chunk of the 2-hour per-task timeout
   (`ENGINE_HARNESS_TIMEOUT_SECONDS`), and if it dies there it's redone from scratch on
   retry (see below). A warm local `forge build` first means the scan's own `forge build`
   call just reuses Foundry's on-disk cache and finishes in seconds instead of tens of
   minutes. **This only helps a scan that hasn't started yet** - running it against a
   scan that's already in progress is harmless (it touches the host folder, not the
   scan's already-taken/cached snapshot) but won't speed up that scan's remaining depths,
   since they reuse the same fixed per-scan snapshot taken at start, not a live read of the
   host folder.

## Step 1 · WORKFLOW

Always `gimlet-lite-v3` (the old `plamen-lite`/`plamen-lite-v2` workflows were deleted
outright, including the one with a scan attached - see README "Rebrand and cleanup" for
why that was safe). If a future edit creates `gimlet-lite-v4` etc. because a scan locks v3,
use the newest numbered version.

v3 adds (originally ported from the open-source Plamen project's v2.2.4 methodology - see
README "Where this v3 methodology came from"):
symmetric-operation-pair coverage in recon + investigation, an authorization-subject check
(whose identity/consent actually authorizes a state-changing effect), a falsifiable-guard
requirement whenever a hypothesis is concluded safe (name the specific breakable relation,
not "protected elsewhere"), and a closed-taxonomy PoC-skip gate in verification (only 5 named
reasons justify not executing a reproduction). The severity ranker and post-script were
updated to match (R10 external-assumption burden-of-proof rule; Challenge 7 in the
post-script).

## Step 2 · TARGET

- **repository / local repository**: the GitHub `owner/repo` (or URL) or local folder path
  from Step 0.1.
- **commit_sha**: pin one if the contest/bounty specifies a commit; otherwise leave
  `HEAD`.
- **repo_scope**: the exact in-scope file list if the contest defines one; otherwise "full
  repository." State explicitly whether out-of-scope dependencies are reportable (per
  Step 0.2).

## Step 3 · DEPENDENCIES (optional · scanned alongside the target)

Add any external protocol this target actually integrates with (a DEX, lending market,
oracle) as a dependency repo so the agent reads real interfaces instead of assuming them -
a lot of the obscure bugs live at integration boundaries.

When a concrete repo/URL for that integration is identifiable (from imports, docs, or the
contest/bounty page), give it as a **ready-to-paste line**, not just "consider adding a
dependency" - e.g. `github.com/aave/aave-v3-core` for an Aave integration. If no specific
external repo can be identified, say so explicitly rather than leaving the recommendation
vague ("no dependency repo needed - integration is via a standard interface only"). Leaving
this section empty is a valid answer when there's genuinely no identifiable external repo -
it does not block the scan.

## Step 4 · CONFIGURATION

JSON block (defaults to `{"max_files": 4000, "include_tests": false}` - edit the same
object):
- `repeat_runs: 2` - every task reruns with an explicit instruction to add genuinely new
  results, not restate the first pass. Direct counter to attention saturation, most useful
  at depths 1 and 2. Cost roughly doubles; worth it for the "nobody else found it" goal.
- `max_files` / `include_tests`: leave at the defaults shown above unless the repo is
  unusually large or test files are specifically relevant to the audit.

Separate field on this same step:
- **maximum model jobs**: leave `unlimited` - don't cap depth-2/3 spawns artificially.

## Step 5 · EXTRA

One `extra.*` textarea per `{{extra.…}}` key the selected workflow/post-scripts reference
(currently just `extra.protocol_context` for `gimlet-lite-v3` + the Gimlet post-script -
re-check if either changes). Required, not optional - the field shows red/`required` until
filled.

- `extra.protocol_context`: protocol type, trust assumptions (who's fully trusted vs
  semi-trusted, from Step 0.4), and what a prior audit (if any) already covered (Step 0.3),
  so the scan is pushed toward unexplored territory instead of re-finding known issues.
  Also fold in anything from Step 7's "protocol-type-specific angles" list that applies
  even without a dedicated skill: vaults (ERC-4626 symmetry, first-depositor/donation),
  lending (health factor, liquidation bonus, interest rate kink), AMM/DEX (constant-product
  or stableswap invariant, concentrated liquidity tick math), governance (flash-loan
  voting, quorum manipulation, malicious proposal encoding), account abstraction
  (UserOperation validation, paymaster trust, bundler griefing).

## Step 6 · MODEL & HARNESS

Turn on **Customize by depth**. `harness: codex` for EVERY depth.

### DeepSeek-only configuration

| Depth | Task | Model | Effort |
|---|---|---|---|
| 0 (tooling) | Runs Slither/Aderyn/Foundry, summarizes | `deepseek-flash` - mechanical, reasoning tier doesn't matter | `low` |
| 1 (recon) | Enumerates + classifies candidates | `deepseek-v4-pro` | `high` |
| 2 (deep investigation) | Where bugs get found | `deepseek-v4-pro` | `high` |
| 3 (verify) | Gates + real PoC execution | `deepseek-v4-pro` - the `codex` harness is what actually drives PoC execution | `high`/`max` |

**Single vendor, no cross-vendor diversity** - each depth varies reasoning TIER/effort, not vendor. This reintroduces some of the attention-saturation risk the old 3-vendor rotation was designed to counter.

**Rotate `repeat_runs` up (Step 4) as the substitute for cross-model diversity** - it doesn't restore genuine model diversity, but it does force each task to add genuinely new findings rather than restate the first pass, which is the same failure mode the vendor rotation was mitigating.

**No cross-vendor diversity available** with either provider alone (see Model access
above) - each varies reasoning TIER/effort by depth, not vendor. This reintroduces some
of the attention-saturation risk the old 3-vendor rotation (`gpt-5.6-sol` /
`claude-opus-4.8` / `claude-opus-4.5`) was designed to counter.

**Rotate `repeat_runs` up (Step 4) as the substitute for cross-model diversity** while
only one vendor is active per scan - it doesn't restore genuine model diversity, but it
does force each task to add genuinely new findings rather than restate the first pass,
which is the same failure mode the vendor rotation was mitigating.

## Step 7 · AGENT SKILLS (optional)

Read enough of the target (state variables, imports, function signatures, natspec) to
answer each row. Tick = attach that skill on the scan. Do not skip a row - "probably not
relevant" still needs a stated reason, since a wrongly-skipped skill is a bug that never
gets investigated at all.

| Trigger (any evidence in code/docs) | Attach skill |
|---|---|
| Reads a price/rate feed (Chainlink, TWAP, custom oracle, Pyth, Band, or a DEX spot price) | `oracle-analysis` |
| Integrates a flash loan provider, OR has balance-dependent accounting (exchange rates, thresholds, quorum) reachable in one transaction | `flash-loan-interaction` |
| Has a bot/operator/keeper role weaker than full governance (`onlyBot`, `onlyOperator`, `onlyKeeper`, `BOT_ROLE`, etc.) | `semi-trusted-roles` |
| Has multi-step operations spanning transactions (request/claim, deposit/lock/withdraw) with a governance-adjustable interval/epoch/delay/cooldown | `temporal-parameter-staleness` |
| Uses a proxy, is upgradeable, uses a diamond pattern, or has inline assembly with `sstore`/`sload`/`tstore`/`tload` | `storage-layout-safety` |
| Handles more than one token type (native/wrapped, legacy/migrated, base/receipt) or a staking-receipt token | `token-flow-tracing` |
| Has share/LP-style accounting where total supply can return to zero after normal use (not just at deployment) | `zero-state-return` |
| Uses `ecrecover`, EIP-712 typed data, ERC-2612 `permit`, or `isValidSignature`/EIP-1271 | `signature-permit-verification` |
| Uses `delegatecall`, a diamond/plugin/module registry, or `CREATE2` (deterministic deployment, minimal-proxy clones, precomputed addresses) | `delegatecall-create2-safety` |
| Uses fixed-point math (`mulDiv`/`mulWad`/`divWad`/`rayMul`/`FullMath`) AND mixes scale factors in the same scope (`1e6`/`1e8`/`10**N`/`decimals()`) - e.g. an 8-dec price feed multiplied against an 18-dec balance, or both 6-dec and 18-dec tokens in one formula | `dimensional-analysis` |

Then from the ~30 built-in skills already on the instance, attach these four regardless of
protocol type (Solidity-general, not situational):
- `trail-of-bits-variant-analysis` - sweeps for sibling instances once one bug pattern is found. Best single fit for "catch what everyone stops looking for after finding one."
- `pashov-xray` - independent pre-audit recon (protocol overview, invariants, integrations), different angle than this workflow's own recon step.
- `pashov-fizz` - Echidna/Medusa invariant-fuzz suite generation, complements the Echidna mention already in the verify step.
- `trail-of-bits-fp-check` - independently-worded false-positive elimination, stacks with the post-script's 6 devil's-advocate challenges.

Situational built-ins (attach only if relevant): `trail-of-bits-entry-point-analyzer`
(second opinion on entry points, cheap to add), `trail-of-bits-static-analysis` (if
Semgrep/CodeQL add value beyond Slither/Aderyn), `trail-of-bits-audit-context-building` (for
very large/unfamiliar codebases needing a context pass before hunting), `pashov-solidity-
auditor` (general second-lens redundancy, fine to include if budget allows).
Skip the rest (web app/CI/C++/Solana/malware-detection skills - wrong domain for Solidity).

## Step 8 · POST-SCRIPTS

Always attach `Gimlet + security-scan verification` (id 7 on this instance) - it's the
devil's-advocate/verification post-script that runs after ranking; no reason to omit it.
The first selected post-script is stored as the scan's primary if more than one is picked.

## Step 9 · SEVERITY RANKER

Always attach `Gimlet contest ranker` (id 34 on this instance) - it's what makes findings
correctly prioritized for a contest/bounty submission. Rankers concatenate in the order
selected if more than one is picked.

`scan-specific rules` (the free-text `rankerExtra` field below the ranker list, appended
after the selected rankers and able to override them for this one scan): this is a
severity/scope-calibration layer, not a discovery layer - use it to encode program-specific
rules the general "Gimlet contest ranker" can't know. Draft **ready-to-paste markdown**
whenever the source material supports it, typically pulled from Step 0.5:
- A bug-bounty program's stated exclusions (e.g. Immunefi) - out-of-scope impact
  categories (oracle data-accuracy, pure governance/economic attacks, theoretical
  misconfig not live in prod, third-party RPC issues) should become explicit
  "do NOT report X unless Y" lines so the ranker doesn't inflate severity on something
  that will just get rejected.
- The program's confirmed in-scope/reward-eligible asset list - call those out by name so
  they aren't under-weighted, and flag findings in unlisted/adjacent contracts as
  "UNCONFIRMED-ASSET" so the user double-checks eligibility before submitting.
- A contest's stated severity tie-break rules (e.g. "treat anything reachable from the
  public entrypoint as at least High") when the contest page states one.
If none of that source material is available for a given target, say so explicitly
("no program-specific exclusions found - leave scan-specific rules blank") rather than
inventing generic filler.

## Quick answer template

When asked "what combination is best for this codebase," answer should cover, in the same
1-9 order as the form itself:
1. **Workflow**: `gimlet-lite-v3` (or newest).
2. **Target**: repo/path, commit_sha, and `repo_scope`.
3. **Dependencies**: ready-to-paste repo/URL if an external integration is identifiable,
   else an explicit "none identified" statement.
4. **Configuration**: `repeat_runs`, `max_files`/`include_tests` if deviating from
   defaults, and maximum model jobs.
5. **Extra**: a drafted `extra.protocol_context` paragraph (trust model, prior-audit
   coverage, protocol-type-specific angles).
6. **Model & harness**: the per-depth model/effort assignment (or a stated deviation and
   why).
7. **Agent skills**: which skills from the trigger table are ticked, with the one-line
   trigger evidence found in the actual code for each.
8. **Post-scripts**: confirm `Gimlet + security-scan verification` is attached.
9. **Severity ranker**: confirm `Gimlet contest ranker` is attached, plus a ready-to-paste
   `scan-specific rules` draft whenever program exclusions/in-scope assets/tie-break rules
   were found in Step 0.5 - or an explicit "none found" statement if not.

Don't just describe what a field is for - produce the actual text the user can paste in
wherever ready-to-paste content is called for (Steps 3 and 9 especially). If the
underlying info isn't available for a given field, say so explicitly instead of skipping it
silently.
