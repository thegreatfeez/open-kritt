# Agent skill: Delegatecall & CREATE2 Safety

Attach for EVM targets using `delegatecall` (proxies, diamonds, plugin/module systems,
library patterns) or `CREATE2` (deterministic/counterfactual deployment, minimal-proxy
clones, precomputed pool/wallet addresses). Distinct from storage-layout-safety, which
covers slot collisions after a delegatecall is already trusted - this skill covers whether
the delegatecall TARGET or the CREATE2 ADDRESS's identity can be attacker-influenced at all.

- **slug**: `delegatecall-create2-safety`
- **name**: Delegatecall & CREATE2 Safety
- **description**: Arbitrary delegatecall targets, selector-clash dispatch bugs, and CREATE2 address-prediction / metamorphic-redeploy attacks.

## Content (paste into the skill editor)

```
For every use of `delegatecall` and every use of `CREATE2` (directly or via a
minimal-proxy/clone factory):

1. Delegatecall target trust: for each `delegatecall`, is the target address a hardcoded
   constant, an admin-set implementation slot, or something ELSE - a caller-supplied
   parameter, a value read from a mapping/registry that a semi-trusted or unprivileged
   actor can write to, or the result of an earlier computation an attacker can influence?
   `delegatecall` executes the target's code in the CALLER's storage context - if the
   attacker controls the target even partially, they effectively control every storage
   slot the calling contract has.

2. Module/plugin registries: in diamond (EIP-2535) or plugin architectures, who can
   register a new facet/module address, and is that registration itself protected? Can an
   attacker register a facet whose function selectors intentionally COLLIDE with an
   existing, more-trusted facet's selectors, causing the dispatcher to route a
   security-sensitive call to the attacker's code instead?

3. Library-style delegatecall: for contracts that delegatecall into "library" contracts,
   confirm the library's code is immutable and its address cannot be changed post-audit
   (no upgradeable "library" pointer that bypasses the real proxy upgrade path's
   protections - e.g. timelocks or multisig gates that the main upgrade path has but a
   side-channel library pointer does not).

4. CREATE2 address prediction: does the protocol precompute a CREATE2 address before
   deployment and treat it as trustworthy (counterfactual smart-contract wallets,
   deterministic pool addresses, precomputed escrow addresses)? Verify: does anything that
   later interacts with that address check the ACTUAL deployed bytecode/codehash, or does
   it just trust the address because the salt/deployer/init-code combination "should"
   produce known code?

5. Front-run-the-deployment: if a CREATE2 address is predictable and publicly known before
   deployment, can anyone else deploy DIFFERENT code to that same address first (using the
   same salt from a different, permissionless deployer contract, or by racing the intended
   deployer's transaction), such that the protocol's later interaction executes attacker
   code instead of the expected contract?

6. Metamorphic redeploy: can any contract in scope `SELFDESTRUCT` and later be redeployed
   via `CREATE2` to the SAME address with DIFFERENT bytecode? If any other part of the
   system stores that address once and treats it as a permanently trusted, immutable
   identity (an allowlist entry, a cached implementation address, a hardcoded integration
   partner), does it ever re-verify the code at that address, or would it silently keep
   trusting a completely different contract after a redeploy?

7. Minimal-proxy (EIP-1167) clones: for factories deploying clones, is the clone's
   implementation address itself immutable and trusted, and does `initialize()` on each
   clone have the same protections a constructor would (callable only once, no
   front-running window between clone deployment and initialization where an attacker
   could call `initialize()` first)?

Report the exact delegatecall/CREATE2 call site and trace where the target/salt/address
actually comes from - "delegatecall is used" alone is not a finding, an attacker-reachable
path to controlling the target or address is.
```
