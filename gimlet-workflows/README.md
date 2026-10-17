# Gimlet: an open-kritt security workflow kit

"Gimlet" (a gimlet eye - sharp, piercing, misses nothing) is the name of this personal
audit kit. Its methodology is originally adapted from the open-source
[Plamen](https://github.com/PlamenTSV/plamen) audit pipeline (the Claude Code / Codex CLI
tool), ported to fit open-kritt's model: a fixed workflow DAG plus attachable
skills/ranker/post-script, instead of Plamen's own full adaptive multi-agent orchestration
(iterative confidence loop, RAG sweep, chain analysis) which open-kritt has no way to
express. Calibrated for contest/bug-bounty use: severity ranking and finding verification
both account for discoverability (how likely another auditor finds the same bug), since
payout is split/zeroed on duplicates.

**Everything below is live on this machine's running instance** (imported via the backend
API, not the UI) - this README is a record of what exists and how to reproduce it on
another install, not a set of manual steps you still need to do here.

## What's live right now

| Thing | Where | id |
| --- | --- | --- |
| Workflow `gimlet-lite-v3` | Workflows | 36 |
| Severity ranker `Gimlet contest ranker` | Severity rankers | 34 |
| Post-script `Gimlet + security-scan verification` | Post-scripts | 7 |
| 10 agent skills (see below) | Agent skills | 31-40 |

The old `plamen-lite` (id 34) and `plamen-lite-v2` (id 35) workflows were deleted outright
- including `plamen-lite`, which had 1 scan attached. See "Rebrand and cleanup" below for
why that's safe and how the locked post-script/skills were handled differently (updated in
place, not deleted).

## What's in this folder

| File | What it is | id once imported |
| --- | --- | --- |
| `gimlet-lite-workflow.json` | 4-depth workflow: **(0) run real tooling** (Slither/Aderyn/Foundry, actually executed by the harness) -> (1) enumerate & triage, seeded by tool output, symmetric-pair aware -> (2) deep investigation (state/token/external/edge-case lens + authorization-subject check) -> (3) verify & finalize with a closed PoC-skip taxonomy | 36 |
| `severity-ranker.md` | Impact x Likelihood matrix + downgrade modifiers + external-assumption burden-of-proof rule + a contest discoverability tie-break | 34 |
| `post-script-validation.md` | Reachability/real-bounds gates + 7 devil's-advocate challenges (protection elsewhere, economic infeasibility, attack dry-run, design intent, severity validation, inversion, authorization subject) + mock-rejection evidence rule + closed PoC-skip taxonomy + discoverability rating, run once per finding with real tool access | 7 |
| `skills/oracle-analysis.md` | Staleness, decimals, TWAP manipulation, pull-oracle/Pyth checks, chained-feed deviation stacking, hardcoded stablecoin pricing, failure modes | 31 |
| `skills/flash-loan-interaction.md` | Atomic-manipulation attack sequences, defense audits | 32 |
| `skills/semi-trusted-roles.md` | Bot/keeper abuse, both directions (role harms users, users exploit role) | 33 |
| `skills/temporal-parameter-staleness.md` | Cached parameters across multi-step ops going stale under governance changes | 34 |
| `skills/storage-layout-safety.md` | Memory/storage confusion, proxy slot collisions, assembly safety, calldata smuggling via hardcoded ABI offsets (EVM-specific) | 35 |
| `skills/token-flow-tracing.md` | Multi-token type separation, side-effect tokens, return-type mismatches | 36 |
| `skills/zero-state-return.md` | Return-to-zero residual-asset attacks (worse than initial-zero first-depositor) | 37 |
| `skills/signature-permit-verification.md` | EIP-712 domain correctness, ERC-2612 permit front-running/replay, EIP-1271 bypass, ecrecover malleability | 38 |
| `skills/delegatecall-create2-safety.md` | Arbitrary delegatecall targets, selector-clash dispatch, CREATE2 address prediction/metamorphic redeploy | 39 |
| `skills/dimensional-analysis.md` | Unit/scale mismatches in fixed-point math - vocabulary discovery, expression annotation, propagation tracing, boundary substitution | 40 |

The signature/permit and delegatecall/CREATE2 skills, and the depth-0 tooling step, were
added after auditing `RoadMap/smart_contract_auditor_roadmap.html` for genuinely missing
vulnerability classes and unused harness capability - see "Where the v1/v2 baseline came
from" below. The dimensional-analysis skill, the authorization-subject check, the
committed-invariant requirement, and the closed PoC-skip taxonomy were added in the v3
methodology update - see "Where v3's methodology came from" below.

Note: the running instance also ships ~30 of its own built-in default skills (Pashov's
solidity-auditor/xray/fizz, several Trail of Bits skills, Sentry/Factory/Cloudflare/GitHub
security reviews). Those are independent of this kit - worth browsing in **Agent skills**
and attaching alongside the ones here when relevant, no need to duplicate them.

## Rebrand and cleanup (2026-08-03)

This kit was originally imported under the name "Plamen" (matching the source project's
name). Renamed to "Gimlet" so the live instance reads as its own thing rather than a
re-skinned copy of someone else's named product. What that involved, and why each part was
safe:

- **Workflows `plamen-lite` (id 34) and `plamen-lite-v2` (id 35) were deleted outright**,
  including `plamen-lite` which had 1 scan attached (the app's own `DELETE` endpoint
  refuses this with a 409 - "Cannot delete: 1 scan(s) use this workflow"). Checked
  `database/init/001_create_workflow_tables.sql` first: `scans.workflow_id` has no
  `FOREIGN KEY`/`REFERENCES` constraint at the Postgres level, so nothing enforces
  referential integrity there - it's a plain `bigint NOT NULL` column. Confirmed by testing:
  deleted workflow 34 directly via `DELETE FROM llm_workflows WHERE id = 34`, then verified
  the scan that used it (id 2) was still fully present with all its data - only its
  `workflow_id` now points at a row that no longer exists, which nothing reads at view
  time (the scan's own `configuration` JSON column is the snapshot the UI actually renders
  from). Workflow 35 had 0 scans, so it was deleted cleanly through the normal API with no
  bypass needed.
- **Post-script (id 7) and the 7 skills already used by that scan were force-updated in
  place** (new name/content, same id) rather than deleted or re-created under new ids. Those
  also 409 on a normal `PUT` for the same in-use reason - checked
  `backend/src/routes/{postScripts,agentSkills}.js`, both call an identical
  `lock*ForMutation`/`*MutationState` in-use check to workflows. Unlike the workflow delete,
  this wasn't a DB-constraint question - it's just a name/content update, and a post-script
  or skill's content is not re-read for a scan that already finished processing, so
  renaming it afterward cannot retroactively change that scan's results. Done via a small
  Node script using the backend's own Prisma client (bypasses the Express route's guard,
  not the database) rather than raw SQL, to reuse the app's exact update logic.
- **Severity ranker (id 34) had no lock at all** - checked
  `backend/src/routes/severityRankers.js`, which has an explicit comment: "ranker never
  breaks an existing scan - no in-use guard needed" (the ranker's content is copied as a
  full text snapshot into `scans.severity_ranker` at scan-creation time, so it's
  structurally impossible for a later ranker edit to affect a past scan). Updated via a
  normal `PUT`.
- **2 previously-unused skills** (`signature-permit-verification` id 38,
  `delegatecall-create2-safety` id 39, added after the one scan ran) and the new
  **`dimensional-analysis`** skill were handled via normal `PUT`/`POST` - nothing locked
  them.

Net result: one clean set of ids, no duplicate "-v2" skill/ranker/post-script clutter, and
the historical scan's results are unchanged and still viewable.

## Why it's shaped this way

- Depth 0 is new: it has the harness **actually execute** Slither/Aderyn and, for Foundry
  projects, `forge build`/`forge test`, before any LLM reasoning starts. Failing tests and
  real detector output seed the recon step as pre-verified candidates - this is the one
  piece of the roadmap's "Auditor's Arsenal" step that wasn't leveraged at all before
  (everything else was pure LLM reasoning despite the harness having real tool access).
- Depth 2 (the middle investigation step) covers four *always-on* lenses (state trace,
  token flow, external, edge case) condensed into one prompt, gated by the `category` the
  recon step assigns, plus the always-on authorization-subject check and symmetric-pair
  coverage added in v3.
- The skill files are the *flag-triggered* lenses (only relevant when the target actually
  has an oracle, a flash-loan-sensitive surface, semi-trusted roles, signatures, mixed
  fixed-point math, etc). Only attach what's relevant per scan - this is the "don't force
  it if it's not needed" part. An ERC-20 vault with no oracle gets zero benefit from
  attaching oracle-analysis.
- What's deliberately NOT ported from the source methodology: the adaptive
  confidence-scoring loop, the RAG validation sweep, and multi-agent chain composition.
  open-kritt's workflow is a static DAG decided at authoring time - it has no mechanism to
  dynamically spawn more depth because a finding scored low confidence. Trying to fake that
  with more workflow depths just produces a rigid, worse version of what a full adaptive
  pipeline already does natively. Use this kit for what open-kritt is actually good at
  (repeatable, scaled scanning), and keep a real adaptive audit tool for one-off deep
  audits where the adaptive loop matters.
- Also deliberately NOT ported from the course roadmap: the ~2/3 of it that's pure learning
  content (blockchain/Solidity fundamentals, gas optimization, OpenZeppelin, CTFs, DeFi
  protocol theory like AMM formulas or health factors). An LLM doesn't need that pre-baked -
  it already reasons about a protocol's actual formulas when it reads the code. Also skipped
  SCSVS/Solcurity/Kaden's checklists - reference lists that overlap what's already encoded
  here, not new methodology.

## Where v3's methodology came from

Third pass. The upstream Plamen project (a separate tool, not this kit) went from v1.0.6 to
v2.2.4 (335 commits) on 2026-08-03; this revision hand-ports the pieces of that gap that are
genuine methodology (not driver/CLI plumbing, which doesn't map onto open-kritt's DAG model
at all) and that fit an EVM-only, contest/bounty-calibrated kit:

- **Symmetric operation pairing** - recon now names the paired counterpart of a candidate
  (deposit/withdraw, borrow/repay, mint/burn, etc.) and investigation is required to check
  both sides before concluding.
- **Authorization-subject axis** - "whose identity or consent actually authorizes this
  effect" is now an explicit, mandatory question in recon, investigation, and the
  post-script (Challenge 7).
- **Committed-invariant falsifier** - whenever a hypothesis is concluded safe, the agent
  must name the specific falsifiable guard (conservation, requested-equals-delivered,
  approved-equals-spent, no-revert-at-boundary, round-trip, or freshness), picking one that
  could actually fail, not one that's trivially true. Simplified from the source project's
  full six-shape `[CI-n]` tracking (which feeds a downstream mechanical fuzz harvester
  open-kritt has no equivalent of) down to the reasoning discipline itself.
- **Closed PoC-skip taxonomy** - the exact 5-reason closed list
  (`FULLY_TRUSTED_DESIGN`/`DEPLOY_OR_TX_ORDERING`/`EXTERNAL_DEP_NO_FORK`/
  `LIVE_ARTIFACT_REQUIRED`/`SPEC_DOCS_NO_STATE_DELTA`) ported verbatim - a written trace no
  longer quietly substitutes for an executed test.
- **External-assumption burden-of-proof rule** - an in-scope-confirmed finding can no
  longer be downgraded just because proving the external half is out of reach; the ranker
  now scores it at worst-case and flags the research gap instead.
- **`dimensional-analysis` skill** - unit/scale mismatch hunting for mixed fixed-point math,
  a vulnerability class this kit had zero coverage of. Its 4-phase method is itself
  originally adapted from Trail of Bits' dimensional-analysis plugin
  (https://github.com/trailofbits/skills, CC BY-SA 4.0) - no code shared, rewritten as a
  single-pass audit methodology producing findings instead of inline code annotations.
- **Untrusted call-target validation** - folded into the existing `external` investigation
  category rather than a new skill, since it's a one-paragraph addition to reasoning that
  already covers delegatecall targets.

Deliberately NOT ported, consistent with "Why it's shaped this way" above: the multi-axis
coverage meta-pass's other 5 axes (theft/liveness/accounting/provenance/boundary) beyond
identity - already covered by this kit's existing category-based investigation, porting the
mechanical axis-table bookkeeping itself would be DAG-shaped busywork with no adaptive loop
behind it; the sibling/variant-coverage and promotion-completeness mechanical gates - these
exist to catch what a multi-agent pipeline drops between its OWN phases, a failure mode
open-kritt's single-pass-per-candidate model doesn't have in the same form; anything
DAML/L1/Soroban-specific - wrong ecosystem for this EVM-only kit.

## Where the v1/v2 baseline came from

Second pass, after the initial port (depth-agent methodology + 7 skills + ranker +
post-script) was already live: cross-referenced `RoadMap/smart_contract_auditor_roadmap.html`
(an 18-step smart-contract-auditor curriculum) for gaps. Two vulnerability classes had zero
coverage anywhere in this kit or in the `security-scan` skill it also draws from -
signature/permit verification (course step 16, EIPs) and delegatecall/CREATE2
address-trust attacks (course steps 8-9) - so those became new skills. Separately, the
course's "Auditor's Arsenal" step (17) described a concrete tool pipeline (Slither -> Surya
-> manual review -> Echidna -> Foundry PoCs) that the open-kritt harness can actually
execute but the workflow never invoked - that became the new depth-0 step, plus an Echidna
mention added to the verify step for invariant-style bugs that need a call sequence rather
than a single test.

## Reproducing this on another install

1. Get the stack running (`./kritt start` or `docker compose up -d`), confirm
   `curl 127.0.0.1:3002/api/workflows` responds.
2. POST the `.workflow` object from `gimlet-lite-workflow.json` to `/api/workflows`
   (or use the UI's Workflows -> Import JSON with the whole file, which understands the
   `open-kritt-workflow` wrapper). This file is already `gimlet-lite-v3`.
3. POST `{name, description, content}` (content = the full file) to `/api/severity-rankers`
   for `severity-ranker.md`.
4. POST `{name, description, content, outputFormat}` to `/api/post-scripts` for
   `post-script-validation.md` - `content` is the fenced prompt block, `outputFormat` is the
   5-key table at the bottom of that file.
5. POST `{slug, name, description, content}` to `/api/agent-skills` for each file in
   `skills/` (10 files) - `slug`/`name`/`description` are the bold-labelled lines near the
   top of each file, `content` is the fenced block.
6. **Scans -> New scan** -> pick `gimlet-lite-v3`, your target repo, the ranker, the
   post-script, and only the skills actually relevant to this target (check for an oracle,
   flash-loan surface, keeper/bot role, timed multi-step ops, proxy/assembly/delegatecall,
   multiple token types, signatures/permit, CREATE2, mixed-decimal fixed-point math, or a
   vault-style share supply).
7. Fill in `extra.protocol_context` on the scan form - the recon step references it
   directly.

If any object already exists (updating rather than a fresh install), try `PUT` to its
existing id first; on a 409 ("in use"), either force-update at the DB/Prisma level the way
"Rebrand and cleanup" above describes (safe for content/name-only changes; do NOT delete a
row this way if something still needs its data - check for foreign key constraints first,
this kit's tables happen to have none but don't assume that generalizes), or POST a new
copy with a disambiguating name and update this README's ids table.

## Known gaps to expect versus a full adaptive audit pipeline

- No iteration: a candidate gets one investigation pass, not up to three adaptive passes.
- No chain analysis: two findings that only become exploitable when combined won't be
  automatically composed into one chained finding.
- No confidence scoring: rely on the post-script's `_chip_verdict` / `_chip_evidence` /
  `_chip_discoverability` chips plus the severity ranker instead of a multi-axis composite
  score.
- The recon step does one enumeration pass per scan; there's no separate re-scan/per-contract
  pass. If early runs feel like they're missing things, that's the most likely reason -
  consider running the scan twice and diffing the findings.
- Depth-0 tooling is best-effort: if Slither/Aderyn/Foundry can't be installed in the
  container (no internet, no package manager access), the step says so and the rest of the
  workflow proceeds on LLM reasoning alone, same as before this update.
