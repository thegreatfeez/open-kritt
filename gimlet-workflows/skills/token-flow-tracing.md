# Agent skill: Token Flow Tracing (multi-token depth)

Attach for protocols handling more than one token type, or with staking-receipt / wrapped /
migrated tokens. The base entry/exit and donation-attack checks already run as part of the
workflow's token_flow investigation step - this skill adds the deeper multi-token and
side-effect checks worth a dedicated pass.

- **slug**: `token-flow-tracing`
- **name**: Token Flow Tracing (multi-token depth)
- **description**: Type-separation, cross-token interaction, and transfer side-effect analysis for multi-token or receipt-token protocols.
- **source_url**: derived from the Plamen TOKEN_FLOW_TRACING skill

## Content (paste into the skill editor)

```
For a protocol that handles more than one token type (native/wrapped, legacy/migrated,
base/receipt, or multiple unrelated assets):

1. Type separation: are different token types tracked in separate state variables and
   handled by separate code paths? Can a function meant for TokenX be reached with TokenY?
   Within a single function that branches on token type for one thing (e.g. accepting
   input), do ALL branches (refund, fee collection, return path) handle both types
   consistently, or does one branch silently assume only one type?

2. Unsolicited transfer matrix: for every external token type the protocol can hold, query,
   or receive as a side effect (not just its primary token), can it be sent to the contract
   without going through a normal deposit function? If so, does it change tracked
   accounting, does it block an admin operation that assumes a zero balance, and does it
   trigger any side effect (a reward claim, a state change)?

3. External call return-type verification: for every external call that returns a token or
   value, does the protocol verify it received the token type it expected (not a legacy
   version, not a wrapped variant, not a bridged-vs-canonical variant, not a different
   decimal precision)?

4. Transfer side effects: does the token being handled have transfer hooks (ERC777,
   ERC1363) or is it a staking-receipt token (e.g. a rebasing or interest-bearing receipt)
   where a plain transfer can trigger a reward claim or a rebase as a side effect? If a
   side effect produces or claims a token, is it the type the protocol expects, and does
   the protocol account for it? Treat any external behavior you cannot verify as
   potentially adversarial rather than assuming it is benign.

5. Self-transfer: for any transfer-like function, can sender and recipient be the same
   address, and if so, does that update accounting (fees credited, rewards claimed,
   snapshots updated) without any real token movement?
```
