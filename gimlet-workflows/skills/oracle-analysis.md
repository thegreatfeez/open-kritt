# Agent skill: Oracle Analysis

Attach this skill only when the target reads a price/rate feed (Chainlink, TWAP, a custom
oracle, Pyth, Band, or a spot price read from a DEX pool).

- **slug**: `oracle-analysis`
- **name**: Oracle Analysis
- **description**: Staleness, decimal normalization, TWAP manipulation, and failure-mode checks for any oracle-dependent logic.
- **source_url**: derived from the Plamen ORACLE_ANALYSIS skill

## Content (paste into the skill editor)

```
For every oracle or external price/rate feed this protocol consumes:

1. Oracle inventory: identify every oracle source, what function reads it, which protocol
   functions consume that data, and what decision is made from it (pricing, liquidation
   threshold, reward rate, rebase trigger). Hardcoded stablecoin pricing check: does the
   protocol skip the oracle lookup for ANY asset and hardcode its price to a constant (e.g.
   `return 1e8` for USDC, `price = PRECISION` for DAI, or an oracle mapping that silently
   excludes specific tokens)? Every asset needs dynamic pricing - stablecoins depeg, and a
   hardcoded price fails silently exactly when it matters most.

2. Staleness: for each oracle, is `updatedAt` (or equivalent) checked, and is a maximum
   staleness enforced? If not, trace the impact of the consumer using data that is stale by
   multiple heartbeats - unfair liquidations, mispriced mints, stale-price arbitrage, wrong
   reward distribution. For Chainlink specifically: are ALL of `latestRoundData()`'s return
   values checked (price > 0, updatedAt != 0, answeredInRound >= roundId)? On an L2, is a
   sequencer-uptime feed checked?

3. Pull-based oracles (Pyth, Redstone, and similar - where users or keepers supply price
   data inside the transaction rather than the protocol pulling from a stored feed):
   timestamp monotonicity - does the protocol reject an update whose timestamp is OLDER than
   the previously stored timestamp? Without this, an attacker can roll a price backward
   within the allowed staleness window (e.g. price is $3000 now; attacker submits a $2900
   update timestamped 3 minutes ago, still inside the staleness tolerance, and triggers a
   liquidation at the stale-but-accepted price). Pyth confidence interval - Pyth returns a
   price plus a `conf` (confidence) bracket; if the protocol uses the raw `price` without
   accounting for `conf`, it can price collateral/debt up to `conf` away from the true value
   in the attacker's favor - the safe pattern is `price - conf` when pricing collateral and
   `price + conf` when pricing debt, always the pessimistic side. Also check that
   `price.price` is validated `> 0` (it's a signed `int64`) and that `price.expo` (typically
   a negative exponent) is applied correctly when converting to the protocol's own decimals.

4. Decimal normalization: for each oracle-to-consumer data flow, does the code call
   `decimals()` dynamically or hardcode a normalization constant (1e18, 1e8, 1e6, etc.)? If
   hardcoded, does it match the oracle's actual decimals, and what breaks if the oracle is
   swapped or upgraded to a different decimal count? Grep for `10**`, `1e[0-9]+`, and
   `decimals()` in every oracle-consumer file and check each hit against the oracle's real
   decimal count.

5. If a TWAP is used: what is the window length versus the pool's liquidity (a window under
   ~30 minutes on a pool with under ~$10M TVL is a manipulation red flag)? Does TWAP lag
   behind spot in a way an attacker can predict and front-run? What happens during
   cold-start (zero or one observation, or the window not yet elapsed) - does it return 0,
   revert, or a sensible fallback?

6. Threshold/deviation checks: for any `maxDeviation`/`priceDeviation`-style check, what is
   the deviation measured against - a previous on-chain price, a TWAP, an external oracle,
   or a hardcoded value? Is that reference itself manipulable or able to go stale (e.g. an
   admin-settable "last recorded price" that, once stale, makes all future prices look
   "within deviation")? Chained-feed deviation stacking: if the protocol derives a price
   through a CHAIN of multiple feeds (e.g. wBTC->BTC->ETH->TOKEN needs a wBTC/BTC feed, a
   BTC/ETH feed, and a TOKEN/ETH feed), each feed's individual deviation tolerance compounds
   across the chain - sum the maximum deviation of every feed in the chain to get the real
   worst-case total deviation, and compare that sum against the protocol's liquidation
   margin or LTV buffer. Example: three feeds at 0.5% + 2% + 2% tolerance = 4.5% total
   possible deviation; if the liquidation threshold sits only 5% above the LTV, the
   compounded oracle chain can already be 4.5% off before anything triggers, leaving under
   1% of real safety margin.

7. Failure modes: for each oracle, what happens on a zero return, a revert, extremely stale
   data, an extreme/outlier value, and (for Chainlink) a negative price? Is there a circuit
   breaker to pause oracle-dependent operations if the oracle misbehaves?

Report the specific data-flow trace (file:line) for anything you flag, and quantify impact
using the protocol's real constants, not placeholders.
```
