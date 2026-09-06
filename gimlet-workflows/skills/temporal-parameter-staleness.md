# Agent skill: Temporal Parameter Staleness

Attach when the target has multi-step operations spanning transactions (request/claim,
deposit/lock/withdraw, propose/vote/execute) with governance-adjustable parameters like an
interval, epoch, delay, cooldown, or unbonding period.

- **slug**: `temporal-parameter-staleness`
- **name**: Temporal Parameter Staleness
- **description**: Finds cached parameters in multi-step flows that become stale when governance changes them mid-operation.
- **source_url**: derived from the Plamen TEMPORAL_PARAMETER_STALENESS skill

## Content (paste into the skill editor)

```
For every operation that spans more than one transaction (an initiate step and a later
completion step):

1. For each parameter used across the steps, is it cached at the initiate step, and is it
   governance-changeable? If it is cached AND changeable AND never re-checked at
   completion, that is a red flag.

2. Model BOTH directions of change - a parameter that increases between steps, and one
   that decreases. They usually have different impacts (e.g. a decreasing unbonding delay
   lets an early joiner exit sooner than intended; an increasing one traps a user who
   already initiated for longer than they agreed to).

3. Retroactive application: does a fee or rate parameter change apply to positions or
   operations that were already accrued/initiated before the change, or only to new ones?
   Changes that retroactively affect existing state are more severe.

4. Severity depends on: who is affected (one user vs. everyone with a pending operation),
   whether the impact is bounded by a min/max range on the parameter, whether it can be
   exploited intentionally by governance front-running its own change, and whether the
   user has a recovery path (cancel and re-initiate).

Do not flag immutable parameters, or parameters where a hard-coded min/max bound already
limits the blast radius to something clearly acceptable - state the bound explicitly when
you rule something out for that reason.
```
