# Agent skill: Zero-State Return

Attach for vaults, staking pools, or any share/LP-style accounting where total supply can
legitimately reach zero after normal operation (not just at deployment).

- **slug**: `zero-state-return`
- **name**: Zero-State Return
- **description**: Checks the RETURN to a zero-supply state, not just the initial zero state - often worse because of residual assets.
- **source_url**: derived from the Plamen ZERO_STATE_RETURN skill

## Content (paste into the skill editor)

```
Beyond the standard first-depositor / initial-zero-state check, verify what happens when
the protocol returns to a zero-supply state after normal operation (all users withdrew,
all shares were burned):

1. Can the protocol actually reach totalSupply == 0 through normal use (no funds
   permanently locked preventing full exit)?

2. When it does, what persists? Check specifically for: accrued rewards that were never
   claimed, protocol fees sitting in the contract, dust balances, and any pending
   withdrawal/claim that was mid-flight when the last user exited.

3. If anything persists with value greater than zero, the NEXT depositor after the
   return-to-zero effectively inherits it for a tiny deposit - compute the actual exchange
   rate a 1-wei-equivalent deposit would receive given the real residual amount. This is
   often a worse first-depositor attack than the initial deployment case, because an
   attacker can manufacture the return-to-zero state on demand (wait for or induce a mass
   exit) and pre-seed it with a large residual via a donation just before re-entering.

4. Check any admin "reset" style function (emergencyWithdraw, rescueTokens, pause+drain,
   migrate) for what state it leaves behind - does it actually zero everything it should,
   or can it create the same kind of exploitable residual?

5. Check default/uninitialized values: for state read before it has ever been explicitly
   set (a `lastTimestamp` or `lastUpdate` that defaults to 0), does the first real call
   handle `block.timestamp - 0` or an equivalent division/subtraction correctly, or does it
   produce a nonsensical result?

Quantify with the protocol's real numbers: what residual amount is realistically
achievable, and what does that make the exchange rate for the next minimal deposit?
```
