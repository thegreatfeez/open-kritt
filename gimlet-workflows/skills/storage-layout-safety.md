# Agent skill: Storage Layout Safety

Attach for EVM targets that use a proxy, are upgradeable, use a diamond pattern, or use
inline assembly with `sstore`/`sload`/`tstore`/`tload`. This class of bug is EVM-specific -
type-safe VMs (Move, Solana's account model) prevent it at the runtime level.

- **slug**: `storage-layout-safety`
- **name**: Storage Layout Safety
- **description**: Memory-vs-storage confusion, proxy storage collisions, assembly slot safety, storage semantic corruption, and hardcoded-offset calldata smuggling.
- **source_url**: derived from the Plamen STORAGE_LAYOUT_SAFETY skill

## Content (paste into the skill editor)

```
For contracts using proxies, upgradeability, diamonds, or inline assembly storage access:

1. Memory vs storage confusion: for every function operating on a struct, array, or
   mapping, is the local reference declared `storage` or `memory`? If it is `memory` but
   the function's intent is to persist a change, that write is silently lost. For function
   parameters of struct/array type, is the parameter `memory` (a copy - changes don't
   persist to the caller's original) when the function seems to expect to mutate it?

2. Proxy layout: do the proxy's own storage slots (admin, implementation, beacon) overlap
   with the implementation's state variables? For EIP-1967, verify the slot computation
   matches spec. Across an upgrade (V1 -> V2), are existing variables kept in the same
   slots with new variables only appended (never reordered or inserted), is inheritance
   order unchanged, and are any reserved `__gap` slots consumed correctly by new
   variables? For diamond/EIP-2535 patterns, does each facet use a genuinely unique storage
   namespace, and could two facets collide?

3. Assembly storage safety: for every `sstore`/`sload`, is the target slot hardcoded,
   derived from a constant, or influenced by external/user input? If input-influenced,
   can an attacker target an arbitrary slot, and is the value bounds-checked first? For
   packed slots (multiple variables sharing one 32-byte slot), does the assembly correctly
   mask/shift so a write doesn't corrupt neighboring values? If transient storage
   (`tstore`/`tload`, EIP-1153) is used, is it correctly distinguished from permanent
   storage - is anything that should survive the transaction accidentally stored
   transiently?

4. Storage semantic corruption: when a mapping entry or array element is deleted, are ALL
   auxiliary structures updated (index arrays, counters, totals, role flags), or can stale
   entries remain in an enumeration array? For manual bit-packing, does clearing a bit use
   a proper mask (`&= ~(1 << n)`) rather than accidentally zeroing the whole word? For any
   variable read before it is ever explicitly written, is the default value (0,
   address(0), false) a state the code actually handles correctly, or does it create a
   permanent DoS (`require(x > 0)` on a value nobody ever set) or an open-access window
   (`if (admin == address(0)) { unrestricted }`)?

5. Calldata smuggling (hardcoded offset into ABI-encoded data): ABI encoding is a convention,
   not an EVM-enforced format - dynamic types (`bytes`, `string`, `T[]`) use offset pointers,
   so their content can legally sit anywhere the pointer says. Any code that reads via a
   HARDCODED byte offset instead of following the pointer - `calldataload(N)` in assembly,
   `mload(add(data, N))` on a bytes variable, `data[N:N+32]` byte-slicing with a literal N,
   or hardcoded offset arithmetic into a nested `bytes` field after `abi.decode` - is
   assuming canonical encoding that a caller does not have to provide. Grep for
   `calldataload(` and `mload(add(` with numeric literals, and any fixed-offset slicing on
   decoded `bytes`. For every hit, check which of these applies: (a) dual-read divergence -
   the SAME logical value is also read elsewhere via `abi.decode`/pointer-following, and a
   non-canonical encoding makes the two reads disagree (e.g. an auth check sees one address,
   the execution path sees another) - this is the most severe case; (b) single-read
   assumption violation - only the hardcoded-offset read exists today, but the value is
   security-critical and the offset pointer is never validated as canonical, meaning it's
   reading attacker-controlled bytes as if they were a trusted field (a latent version of
   (a) - any future addition of a second decode path on the same data creates the divergence
   above); (c) revert injection - attacker-crafted non-canonical encoding lands the
   hardcoded read on data that reverts (zero address, overflow, out-of-bounds), letting an
   attacker selectively DoS an operation that canonical encoding would have let through; (d)
   hash divergence - the contract hashes raw calldata or a manually-packed slice of it (for
   signature verification, dedup, or identity) - non-canonical encoding produces a different
   hash for a logically-identical input, breaking replay protection or signature checks.
   Also check the asymmetry where calldata that decodes successfully via `abi.decode` when
   read directly from calldata can fail (or decode differently) once copied to memory and
   re-decoded there - the memory decoder is stricter. Do not report a hardcoded-offset read
   into a STATIC-type field (fixed position regardless of pointers), or one where the offset
   pointer is validated as canonical before the read.

Report the exact slot/variable trace for anything you flag - this class of bug is only
convincing with a concrete slot computation, not a general description.
```
