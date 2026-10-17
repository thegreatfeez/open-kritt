# Agent skill: Flash Loan Interaction

Attach when the target integrates with a flash loan provider, or has any balance-dependent
accounting (exchange rates, thresholds, quorum) that could be manipulated atomically.

- **slug**: `flash-loan-interaction`
- **name**: Flash Loan Interaction
- **description**: Atomic-manipulation and flash-loan-accessible precondition analysis, including defense audits.
- **source_url**: derived from the Plamen FLASH_LOAN_INTERACTION skill

## Content (paste into the skill editor)

```
For every flash-loan-accessible state variable or precondition in this protocol:

0. External flash susceptibility: for every external protocol this contract reads state
   from (a DEX pool's reserves/spot price, another vault's share price, a lending market's
   utilization), can a third party flash-manipulate that state before calling into this
   protocol? Spot state is manipulable; time-weighted state generally is not. If yes, model
   the full sequence: borrow -> manipulate the external state -> call our function that
   reads it -> extract value -> restore -> repay, and estimate whether the manipulation
   cost is less than the extractable value using the pool's real liquidity.

1. Flash-loan-accessible state inventory: enumerate every state read this protocol makes
   that can be moved within one transaction by flash-borrowed capital - direct token
   balance (`balanceOf(address(this))`), `totalSupply` if mint/burn is permissionless, pool
   reserves, oracle spot price, or any threshold/quorum computed from a balance.

2. For each one, write out the concrete atomic attack sequence (borrow, manipulate, call
   target function, extract, restore, repay) and compute net profit at realistic loan
   sizes. If it isn't profitable alone, check whether chaining multiple calls in the same
   flash-loan transaction (deposit -> manipulate rate -> withdraw; stake -> trigger reward
   calc -> unstake; borrow -> manipulate collateral price -> liquidate -> repay) produces a
   state neither call alone could reach.

3. Flash-triggered debounce/DoS: for any permissionless function with a cooldown or
   debounce shared across users (a global timestamp, not per-user), can an attacker
   flash-borrow just to trigger that cooldown and block legitimate callers? Is the
   consumption permanent or does it auto-expire?

4. Defense audit: for each attack path found, check what actually defends against it -
   reentrancy guard, same-block prevention, TWAP instead of spot price (and is the TWAP
   window long enough relative to pool liquidity), a minimum lock/cooldown, a
   before/after balance snapshot, or a flash-loan fee that exceeds the possible profit.

5. Defense parity: if the same user action (stake, withdraw, claim, exit) exists in more
   than one contract or code path, do they all have the same flash-loan defenses? If one
   path lacks a cooldown that another path relies on for protection, the undefended path
   can be used to bypass the defended one's protection entirely.

Quantify every viable attack with real numbers - actual pool liquidity, actual fee rates,
actual loan-size limits - not hypothetical amounts.
```
