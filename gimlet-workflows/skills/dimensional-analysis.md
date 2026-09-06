# Agent skill: Dimensional Analysis

New in this update (ported from Plamen v2.2.4's `dimensional-analysis` niche agent). Attach
when the target uses fixed-point math (`mulDiv`/`mulWad`/`divWad`/`rayMul`/`FullMath`) AND
mixes scale factors in the same scope (`1e6`/`1e8`/`10**N`/`decimals()`) - e.g. a protocol
that prices an 8-decimal Chainlink feed against an 18-decimal WAD balance, or accounts for
both 6-decimal USDC and 18-decimal tokens in the same formula. This is a unit/scale-mismatch
hunt, distinct from `oracle-analysis` (which covers staleness/manipulation, not arithmetic
scale) - attach both when the target has an oracle AND mixed-decimal math.

- **slug**: `dimensional-analysis`
- **name**: Dimensional Analysis
- **description**: Unit/scale mismatches in fixed-point arithmetic that mis-price funds by orders of magnitude - vocabulary discovery, expression annotation, cross-function propagation, boundary substitution.
- **source_url**: derived from the Plamen `dimensional-analysis` niche agent, whose 4-phase
  method (vocabulary discovery / expression annotation / propagation tracing / validation)
  is itself adapted from Trail of Bits' dimensional-analysis plugin
  (https://github.com/trailofbits/skills, CC BY-SA 4.0). No code shared; rewritten as a
  single-pass audit methodology producing findings instead of inline code annotations.

## Content (paste into the skill editor)

```
You are hunting unit/scale mismatches in fixed-point arithmetic - bugs where a value is
computed at the wrong decimal scale and funds get mispriced by orders of magnitude, not just
"slightly wrong." Work through these phases in order; each depends on the last.

## Common scales you'll see
WAD = 1e18 (most ERC20 amounts, Solady/OZ math) | RAY = 1e27 (Aave-style rates) |
BPS = 1e4 (fee rates) | USDC/USDT = 1e6 | WBTC = 1e8 | Chainlink answers = 1e8 (verify per
feed - not all feeds are 8-dec) | Uniswap V2 TWAP cumulative = Q112.112 | Uniswap V3/V4
sqrtPriceX96 = Q96.

## Algebra rules
`a * b`: scale(a) + scale(b). `a / b`: scale(a) - scale(b). `a + b` or `a - b`: operands
MUST share scale AND dimension (USD/ETH is not interchangeable with ETH). `mulWad(a,b) =
a*b/1e18`: result scale = scale(a)+scale(b)-18. `mulDiv(a,b,c) = a*b/c`: result scale =
scale(a)+scale(b)-scale(c). `rayMul(a,b) = a*b/1e27`: result scale = scale(a)+scale(b)-27.

## Phase 1: vocabulary discovery
Grep the in-scope source (skip test/lib/mocks) for every scale constant: `1e6, 1e8, 1e18,
1e27, 10**N, 10^N, WAD, RAY, BASE, UNIT, PRECISION, SCALE, DENOMINATOR, decimals(),
_decimals`. Build a table: constant -> numeric value -> inferred scale -> every location it
appears. Separately, survey every token/feed this contract handles and its actual decimals -
do NOT assume 18 for anything without checking. Flag any `decimals()` call made at runtime
and used directly in math without caching - it must be correct at EVERY call site, not just
the one you happen to check first.

## Phase 2: expression annotation
For every fixed-point expression (mulDiv/mulWad/divWad/rayMul, or a raw `*`/`/` involving a
Phase-1 constant), write out the inferred dimension of each operand and the resulting scale,
e.g. `price[USD/ETH, 8-dec] * amount[ETH, 18-dec] = [USD, 26-dec] -> needs /1e8, not /1e18`.
Specifically check: does `mulWad(a, b)` actually have BOTH operands at 18-dec (an 8-dec
Chainlink price fed in raw is a 1e10x error)? Does a `mulDiv(a,b,c)` denominator match what
the caller expects the result's scale to be? Is a raw `a / 1e18` applied to a value that
isn't actually WAD-scaled?

## Phase 3: propagation tracing
For each annotated expression: if the result is stored in a state variable, does the
variable's name imply a scale (e.g. `priceWad`), and does that match what was ACTUALLY
computed? Trace every downstream function that reads it - does it assume the implied scale?
For every cross-function/cross-contract call passing a fixed-point value, does the caller's
scale match the callee's assumed scale? For every token entry (deposit/transferFrom) and
exit (withdraw/transfer), is the amount normalized in and denormalized out correctly, and is
the normalization constant hardcoded (fragile if the token changes) or read live from
`decimals()` (must be verified correct)?

## Phase 4: validate and size the severity
Before refuting a candidate, reject these rationalizations explicitly - none of them clear a
mismatch on their own: "the formula looks right" (correct formula, wrong units, are two
different claims - state the units), "all tokens are 18-dec here" (verify per-token: USDC=6,
WBTC=8, Chainlink=8), "tests pass" (test mocks are commonly 18-dec; production tokens often
aren't), "this pattern is used elsewhere in the codebase too" (the bug may be systemic, not
disproven), "the ratio cancels out" (only if numerator AND denominator undergo IDENTICAL
scaling - prove it, don't assert it).

For every confirmed mismatch, substitute real boundary values to quantify the impact, e.g.
1 USDC (`1e6`) fed into a function expecting WAD input rounds to zero; a $1 Chainlink price
(`1e8`) fed in as WAD overstates by 10^10x. Size severity by the magnitude of the mismatch
scaled by what's at risk: a 6-dec-vs-18-dec confusion (10^12x) on a price or exchange rate is
Critical-tier; an 8-dec Chainlink price used raw as WAD (10^10x) is High-tier; a 100x-or-less
internal-weight mismatch is Medium/Low; anything confined to a view-only path caps at Low.

Report the exact expression, the inferred scale on each side, and the concrete boundary
value that demonstrates the mismatch - a unit-mismatch claim without a concrete number
behind it is not convincing.
```
