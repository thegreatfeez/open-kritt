# Post-script: Gimlet + security-scan verification (contest/bounty calibrated)

Updated 2026-08-03: Challenge 7 (authorization subject) and the committed-invariant
requirement on Challenge 6 are adapted from the `identity` risk axis in the open-source
Plamen project's v2.2.4 multi-axis coverage pass; the hardened Challenge 3 PoC-skip
taxonomy is adapted from Plamen's v2.2.4 force-by-default PoC gate. The prior id (7) was
locked by an old scan and force-updated directly at the DB level rather than re-created,
since a plain content/name change can't retroactively affect that scan's already-computed
results - see README "Rebrand and cleanup."

Create this under **Post-scripts -> New post-script** in the open-kritt UI, or via the
import script (see README). Runs once per de-duplicated finding, after ranking, with real
tool access to a checked-out copy of the repo - it can compile and run a reproduction, not
just re-reason on paper.

## Prompt content

```
Re-verify this finding before it is treated as real. Do not trust the original description -
independently re-derive whether it holds. This audit targets a contest or bug-bounty
submission, so precision matters more than volume: a wrong CONFIRMED becomes a false
positive in front of judges, and a wrong FALSE_POSITIVE throws away a real payout.

Finding: {{summary}} ({{vulnerability_type}}) at {{file_path}}:{{line}}
Explanation given: {{explanation}}
Claimed trigger flow: {{trigger_flow}}
Claimed malicious input: {{malicious_input_example}}
Claimed actor: {{malicious_actor}}
Scan target: {{repo_full}} at {{commit_sha}}. Scope: {{repo_scope}}.

## Gates (must pass before any challenge below is worth running)

Gate 1 - Reachability: trace an actual call path from a real entry point to this exact
code location in the checked-out workspace. If none exists, stop: FALSE_POSITIVE.

Gate 2 - Real-bounds: substitute the protocol's actual constants (real decimals, real
fee/parameter values read from source, realistic supply/TVL ranges) into the expression
that triggers the bug. If it only occurs outside feasible real-world ranges, stop:
FALSE_POSITIVE.

## Devil's-advocate challenges (both gates passed - now try to kill the finding)

Challenge 1 - Protection elsewhere: search the ENTIRE codebase, including parent contracts
and libraries, for a mechanism that already prevents this - a reentrancy guard, a modifier
checked earlier in the call chain, input validation upstream, SafeERC20-style handling.
Found one that actually applies here -> demote at least one level (see Classification).

Challenge 2 - Economic infeasibility: compute the minimum capital required, the gas cost of
the attack transaction, the maximum extractable value, and whether the attack itself could
be front-run or sandwiched by someone else before the attacker profits. Cost >= profit ->
demote.

Challenge 3 - Attack dry run: write out the literal step-by-step sequence (attacker starts
with X, calls function A with parameters B, state changes to C, calls function D, ends with
Y, profit = Y - X). If you cannot complete this concretely, demote. Executing a minimal
reproduction (test, script, or direct call sequence) in the workspace is the DEFAULT, not
optional - a written dry run alone caps `_chip_evidence` at `CODE-TRACE` and the verdict at
CONTESTED, never CONFIRMED. You may skip actual execution only for one of these named
reasons (state which one, concretely, in `_reserved_poc`): `FULLY_TRUSTED_DESIGN` (only a
fully-trusted governance actor could trigger this, acting within its own stated powers - not
a semi-trusted role), `DEPLOY_OR_TX_ORDERING` (depends on deployment/tx ordering outside your
control), `EXTERNAL_DEP_NO_FORK` (needs an external protocol/oracle you have no fork or mock
for), `LIVE_ARTIFACT_REQUIRED` (needs a separately-deployed live artifact you don't have),
or `SPEC_DOCS_NO_STATE_DELTA` (pure spec/docs mismatch, no on-chain state to assert). If you
attempted execution and it genuinely could not assert the harm without any of these blocking
you, that's real signal the finding is weaker than claimed - reflect that in the verdict,
don't quietly fall back to a dry run instead.

Challenge 4 - Design intent: check code comments, variable names, and any README/docs for
evidence this behavior is intentional or a documented tradeoff/known limitation. If so,
still name the concrete real-world consequence for a user or the protocol (fund loss,
lockout, unfair treatment) before you dismiss it - "by design" alone does not clear a
finding that still causes real harm; if it causes no real harm and is genuinely
intentional, demote.

Challenge 5 - Severity validation (HIGH/CRITICAL only): can you name a comparable
real-world exploit? Would this realistically be rated High/Medium in a Code4rena or
Sherlock-style contest, or is it inflated? Is the impact quantifiable, not just "could lead
to loss"? If severity can't be justified at this level, downgrade the severity you report
even if the finding itself survives.

Challenge 6 - Inversion: actively try to prove the code is SAFE. Argue the opposite side.
What would have to be true for this NOT to be a vulnerability? If you can convincingly prove
safety, kill the finding: FALSE_POSITIVE. Whenever this challenge (or any other) kills or
demotes the finding, you MUST commit the specific guard as a falsifiable statement, not a
vague "it's handled elsewhere" - name the exact relation, picking whichever of these could
actually FAIL if the code were broken (do not pick one that's trivially true by
construction, e.g. a 1:1 passthrough that can never diverge): value conservation across the
operation, the amount requested equals the amount delivered, the amount approved covers the
amount spent, no revert/mis-round at the boundary value, a round-trip (deposit-then-withdraw,
wrap-then-unwrap) returns to the original state, or a cached value cannot be read once past
its freshness bound. Record this in `_reserved_poc` alongside the inversion argument -
"I checked and it's fine" without naming the specific breakable relation does not clear the
finding.

Challenge 7 - Authorization subject: whose identity or consent actually authorizes this
effect on the target? If the function has a target/recipient/owner/`onBehalfOf`-style
parameter distinct from the caller, confirm there is a real consent or authorization check
binding that SPECIFIC party to this call - not merely a role check on the caller, and not an
assumption that "only the right caller would ever call this." Can msg.sender act using
another party's identity, balance, or allowance without that party's consent? If yes, this is
not survivable regardless of how the other challenges went - demote or kill only if you can
show the binding check genuinely exists and covers every code path.

## Evidence discipline (mock-rejection rule)

A claim that the bug does NOT exist (used in any challenge above to demote or kill) is only
valid if backed by verified, real (non-mock) behavior or an executed reproduction that
failed for a substantive reason. If your only basis for dismissing the finding is a mock, a
test double, or an unverified assumption about external behavior, you do not have enough
evidence to clear it - report CONTESTED instead of FALSE_POSITIVE, and say exactly what
verification is missing.

## Classification

- Survived all 6 challenges with concrete, executed or fully-traced evidence -> CONFIRMED
- Likely real, but you could not fully execute/prove it (e.g. no build environment) -> PARTIAL
- Failed 1-2 challenges, or evidence is mock-only -> CONTESTED
- Failed 3+ challenges, or Challenge 6 proved safety -> FALSE_POSITIVE

## Discoverability rating (contest/bounty calibration)

Payout in contests and bug bounties is often split or zeroed among duplicate submissions.
Rate how likely another auditor or bug hunter is to independently find this same issue, so
effort goes where it's actually worth it:

- HIGH: a textbook, name-it-in-one-word bug (classic reentrancy with no guard, tx.origin
  auth, unchecked low-level call return, missing zero-address check, floating pragma,
  missing access control on an obviously-privileged function) - or something a default
  Slither/Aderyn run would flag immediately.
- MEDIUM: requires reading actual business logic and reasoning across 2-3 functions, but is
  a check an experienced auditor makes as a matter of course (rounding direction on a fee
  split, first-deposit share inflation, stale price usage).
- LOW: requires chaining multiple findings, protocol-specific economic modeling, an unusual
  multi-step sequence, or cross-contract reasoning not obvious from any single function.
  These are the ones most likely to be uniquely yours - worth the most write-up care.

Be honest, not generous - the goal is a trustworthy, well-calibrated list, not a long one.
```

## Output format

| Key | Type | Meaning |
| --- | --- | --- |
| `_chip_verdict` | string | `CONFIRMED`, `PARTIAL`, `CONTESTED`, or `FALSE_POSITIVE` per the Classification rules above |
| `_chip_evidence` | string | `POC-PASS` (executed and observed), `POC-FAIL` (executed, did not reproduce), `CODE-TRACE` (reasoning only), or `MOCK-ONLY` (only mock/unverified evidence available) |
| `_chip_discoverability` | string | `HIGH`, `MEDIUM`, or `LOW` per the Discoverability rating section |
| `reasoning` | string | 3-5 sentences: which challenges it failed/survived and why the verdict follows |
| `_reserved_poc` | string | Markdown: the reproduction you wrote/ran and its real output, or the attack dry-run if execution wasn't possible, or the inversion argument if you killed the finding |

`_chip_verdict`, `_chip_evidence`, and `_chip_discoverability` all surface as chips in the
findings list (open-kritt shows up to 3 chips per finding, so all three fit) - sort/scan for
`CONFIRMED` + `POC-PASS` + `LOW` discoverability first; those are your highest-value,
least-likely-to-be-duplicated submissions.
