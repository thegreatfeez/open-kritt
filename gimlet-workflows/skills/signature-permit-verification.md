# Agent skill: Signature & Permit Verification

Attach when the target uses `ecrecover`, EIP-712 (`permit`, off-chain order signing, meta-tx),
ERC-2612 permit, or `isValidSignature`/EIP-1271 for smart-contract wallet signatures. Not
currently covered by any other skill in this kit - signature bugs are a common, well-defined
finding class in contests and are cheap to check systematically.

- **slug**: `signature-permit-verification`
- **name**: Signature & Permit Verification
- **description**: EIP-712 domain correctness, ERC-2612 permit front-running/replay, EIP-1271 bypass, and ecrecover/signature malleability checks.

## Content (paste into the skill editor)

```
For every signature-verification path (raw ecrecover, EIP-712 typed data, ERC-2612 permit,
or EIP-1271 contract-wallet signatures):

1. Zero-address bypass: `ecrecover` returns `address(0)` on a malformed/invalid signature
   instead of reverting. Does every caller explicitly check the recovered address is not
   `address(0)` before treating it as authenticated? If a signer/admin slot can ever equal
   `address(0)` (e.g. uninitialized), a garbage signature would "authenticate" as that slot.

2. Signature malleability: for any raw `ecrecover` usage (not going through a hardened
   library), is the `s` value constrained to the lower half of the curve order and `v`
   constrained to {27, 28}? Without this, a single signature has a second mathematically
   valid (r, s') pair - if anything derives an identifier FROM the signature itself (e.g. a
   hash used as a replay-protection key), the two variants bypass that protection.

3. Domain separator correctness: does the EIP-712 domain separator include `chainId` and
   `verifyingContract`, and is it computed fresh (not cached at construction time only) if
   the chain could fork or the contract could be redeployed at a predictable address? A
   cached domain separator computed once at deploy time is stale after a chain split -
   signatures become replayable across the forked chain.

4. Deadline / expiry: does `permit()` (or any off-chain-signed action) enforce a deadline
   that the CALLER cannot silently bypass by simply not checking it? Is the deadline
   compared with the correct operator (`<=` vs `<`) and against `block.timestamp`?

5. Nonce management: is the nonce strictly tied to (signer, action/purpose) so a signature
   valid for one action cannot be replayed for a different one? Is the nonce incremented
   BEFORE any external call or state change that could reenter and reuse the same nonce?
   For permit-style signatures, can the same signature be submitted twice if the nonce
   increment happens after an external call?

6. Permit front-running (griefing, not fund loss): can anyone observe a user's signed
   `permit()` call in the mempool and submit it first on the user's behalf? If the calling
   contract's flow is `permit()` then `transferFrom()` in one transaction, and an attacker
   front-runs just the `permit()` call, does the user's own subsequent transaction now
   revert (griefing), and does the calling contract handle that gracefully (e.g. wrapping
   permit in try/catch) or does it break the user's intended transaction?

7. EIP-1271 contract-signature bypass: for any check against a smart-contract wallet's
   `isValidSignature()`, does the caller verify the RETURN VALUE equals the exact magic
   value (`0x1626ba7e`), not just that the call didn't revert? Can the target contract's
   `isValidSignature` be influenced by reentrancy or external state to return the magic
   value for a signature that shouldn't be considered valid?

8. Cross-contract / cross-chain replay: does the signed payload bind to a specific
   contract instance (via `address(this)` in the domain or message) and chain (via
   `chainId`)? If the same signing key or the same message format is used across multiple
   deployments (e.g. a factory pattern deploying many identical contracts), can a
   signature valid for one instance be replayed on another?

Report the exact function and line for any gap - this class of bug is only convincing with
a concrete missing check, not a general "signatures should be validated carefully."
```
