# Gimlet contest ranker

Rank findings by Impact x Likelihood, then apply the downgrade modifiers below. Ties within the same tier break toward the finding requiring fewer preconditions.

## 1. Base tier by Impact x Likelihood

- Impact = High (direct fund loss, permanent fund lock, protocol insolvency) x Likelihood = High (no prerequisites, anyone can trigger) -> Critical
- Impact = High x Likelihood = Medium (specific conditions must hold) -> High
- Impact = High x Likelihood = Low (unlikely or complex setup) -> Medium
- Impact = Medium (conditional fund loss, protocol breakage, incorrect accounting) x Likelihood = High -> High
- Impact = Medium x Likelihood = Medium -> Medium
- Impact = Medium x Likelihood = Low -> Medium
- Impact = Low (broken views, incorrect non-fund data) x Likelihood = High -> Medium
- Impact = Low x Likelihood = Medium or Low -> Low
- Impact = Informational (code quality, style, unused code, missing events with no economic consequence) -> Informational regardless of likelihood

## 2. Always rank above everything else, regardless of tier

1. A finding with a working, executed reproduction (a test that passed, a script that was actually run and observed) always outranks a finding of the same tier that is reasoning-only.
2. Unauthenticated, no-precondition fund extraction always ranks first within Critical.
3. A chain that combines two findings into a working end-to-end attack ranks above either finding alone, at the severity of the combined attack.

## 3. Downgrade modifiers (apply after the base tier lookup, in order)

1. On-chain-only impact with no off-chain or user-facing consequence (no effect on a frontend, indexer, or monitoring system) -> drop one tier.
2. The impact is confined to a view/read function with no state consequence -> cap at Medium regardless of the base tier.
3. The only way to trigger the attack is for a fully trusted actor (a DAO, governance timelock, or protocol multisig acting per its own admin powers) to deliberately act against the protocol's own stated trust assumptions -> drop one tier, floor at Informational. Do NOT apply this downgrade to a semi-trusted role (operator, keeper, bot, oracle relayer) - their limited trust is already captured by the Likelihood axis above, not by this modifier.
4. The only supporting evidence is a mock, a test double, or an unverified assumption about external/production behavior, with no executed reproduction against real behavior -> cap at Low and note the evidence gap in the writeup.

## 4. Worst-state severity

Always score a finding using the worst realistic operational state the protocol can reach, not the state you happened to test first: maximum deposits, minimum liquidity, paused/unpaused, a role having just changed a parameter, or a market having just moved sharply. A finding that looks Low under "normal" conditions but is High at a plausible extreme is a High finding.

## 5. Anti-normalization

A behavior labeled "by design" or "intended" in code comments or documentation is not automatically low severity. If a concrete user or the protocol still loses funds, gets locked out, or is treated unfairly as a direct result, rank it by that consequence, not by the fact that the mechanism was intentional.

## 6. Burden of proof on external assumptions (do not invert it)

When a finding's harm mechanism is CONFIRMED for the in-scope code, and the ONLY thing that
could make it safe is an unresearched, out-of-scope, or not-inspectable EXTERNAL factor
(a counterparty's honesty, an external contract's undocumented behavior, an off-chain
consumer's decoding logic), do NOT default it to Informational/Low "pending research into
that external piece." That inverts the burden of proof. Score it at the WORST realistic
external condition instead, note explicitly which external condition is assumed and why it
is unresearched, and treat it as a verification obligation rather than a severity discount.
Demoting for this reason requires POSITIVE in-scope evidence that the safe external
condition actually holds - the mere possibility that it might hold does not rebut a
mechanism already proven in-scope. (Example: a message encoded for one execution environment
and sent to a consumer on another - the mismatch is confirmed at send time even if the
receiving side's decoder is external and unverifiable; that is not an Informational note, it
is the actual bug.) This does not override modifier 4 above - if your only evidence for the
finding EXISTING is itself a mock or unverified assumption, that finding is still
evidence-capped. This section only blocks discounting a finding whose harm mechanism is
already proven, just because proving the external side too is out of reach.

## 7. Contest/bounty discoverability tie-break

This ranker is used for contest and bug-bounty submissions, where payout is often split or zeroed among duplicate findings. Within the same severity tier, order findings from least to most likely to be independently found by another auditor, so the ones most worth careful write-up time surface first:

1. Order last within its tier: a textbook, name-it-in-one-word bug (classic reentrancy with no guard, tx.origin auth, unchecked low-level call return, missing zero-address check, floating pragma, missing access control on an obviously-privileged function), or anything a default Slither/Aderyn run would flag immediately - these are the most likely duplicates.
2. Order in the middle: findings that require reading real business logic across 2-3 functions but are checks an experienced auditor makes routinely (rounding direction on a fee split, first-deposit share inflation, stale price usage).
3. Order first within its tier: findings that require chaining multiple findings, protocol-specific economic modeling, an unusual multi-step sequence, or cross-contract reasoning not obvious from any single function - these are the ones most likely to be uniquely yours.

Severity always outranks discoverability - a Critical textbook bug still outranks a Low novel one. This tie-break only reorders findings within the same tier.
