# Agent skill: Semi-Trusted Role Analysis

Attach when the target has a bot/operator/keeper role, or any role weaker than full
governance (look for `onlyBot`, `onlyOperator`, `onlyKeeper`, `BOT_ROLE`, `OPERATOR_ROLE`,
`KEEPER_ROLE`, or similar).

- **slug**: `semi-trusted-roles`
- **name**: Semi-Trusted Role Analysis
- **description**: Insider-abuse and keeper/bot exploitation analysis, in both directions - role harming users and users exploiting the role.
- **source_url**: derived from the Plamen SEMI_TRUSTED_ROLES skill

## Content (paste into the skill editor)

```
For every semi-trusted role (bot, operator, keeper - anything weaker than full multisig
governance):

1. Inventory every function that role can call, what state it modifies, what external
   calls it makes, and what parameters it accepts without validation.

2. Direction A - role harms users: can the role act at a harmful time (front-run a user,
   delay execution to hurt them)? Can it pass harmful parameters that aren't validated
   (max slippage, wrong recipient)? Can it skip a required step, or harm users purely by
   NOT acting? If the role's key were fully compromised, what is the maximum extractable
   value, and is there a way to revoke the role quickly - does a revocation function even
   exist?

3. Direction B - users exploit the role (do not skip this - it is usually the more
   interesting half): is the role's behavior predictable (scheduled, triggered by an
   observable event)? Can a user front-run or back-run it profitably? Can a user
   manipulate state to violate one of the role's function preconditions, causing it to
   revert and leaving the system stuck without the role's action (griefing)? Can a user
   force the role into a suboptimal choice by manipulating the state it decides from? If
   the protocol's exchange rate only updates when the role acts (discrete updates), can a
   user monitor for the role's pending transaction and position themselves at the stale
   rate beforehand?

4. Precondition griefability: for every function the role calls, list its preconditions
   and ask whether a user can manipulate state to violate them (e.g. a precondition of
   "balance > 0" that a user can defeat by withdrawing everything first). Extend this to
   ALL admin/privileged functions, not just this role's - can a user create state (a
   pending withdrawal, a non-zero balance from an unsolicited transfer) that blocks an
   admin operation entirely?

5. Mitigations: is there a timelock, is the role a multisig, are there rate limits? Treat
   "the role is economically aligned via staked collateral" and "action requires the user
   to move first" as valid mitigations, but state them explicitly rather than assuming
   them.

Any admin/privileged function with a user-griefable precondition that blocks a critical
operation is at least Medium severity even if the role itself never acts maliciously.
```
