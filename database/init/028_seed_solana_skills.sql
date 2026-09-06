-- Solana program security skills
INSERT INTO public.agent_skills (slug, name, description, content, source_url, license_spdx, attribution)
SELECT
    'solana-program-audit',
    'Solana program audit',
    'Solana program security review skill for Anchor and native BPF programs, covering account validation, CPI, PDA, signer checks, and arithmetic.',
    $skill$
Use this optional external skill reference for Solana program audits (Anchor or native).

Focus:
- Review all instruction handlers for account validation: missing signer checks, incorrect owner checks, wrong account type or writable flags, and missing PDA derivation verification.
- Trace CPI calls: verify the target program, accounts passed, seeds used for PDA signing, and whether the caller correctly constrains what the callee can do.
- Check arithmetic: integer overflow/underflow, rounding, decimal scaling, and price/oracle math.
- Review Anchor constraints: `#[account(...)]` macros, `init`, `close`, `seeds`, `bump`, `has_one`, `constraint`, `realloc`, and `space` for correctness.
- Check owner and authority checks: token account ownership, mint authority, delegate, freeze authority, and multi-sig setups.
- Verify PDA derivation: correct seeds, bump seed canonicalization, and that derived addresses match the expected program.
- Review close account safety: rent refunds, account data cleanup, and reinitialization attacks.
- Check for missing or incorrect `close` constraints leading to rent theft or account reuse.
- For Anchor programs, verify that `#[access_control]` and `#[account]` constraints are not bypassable through realloc or account discriminator mismatches.
- For native programs, verify manual `sol_invoke`/`sol_invoke_signed` CPI safety, manual account deserialization, and manual `is_signer`/`is_writable` checks.

Source/license:
- Original methodology derived from Solana security best practices and common audit findings.
- MIT licensed.
$skill$,
    NULL,
    'MIT',
    'Original Solana program audit methodology.'
WHERE NOT EXISTS (SELECT 1 FROM public.agent_skills WHERE slug = 'solana-program-audit');

INSERT INTO public.agent_skills (slug, name, description, content, source_url, license_spdx, attribution)
SELECT
    'solana-defi-review',
    'Solana DeFi review',
    'Solana DeFi protocol review skill covering AMMs, lending, staking, and cross-program invariant analysis.',
    $skill$
Use this optional external skill reference for Solana DeFi protocol audits.

Focus:
- Review AMM math: constant product formulas, fee calculations, price impact, slippage, and pool share accounting.
- Check lending protocol math: health factors, liquidation thresholds, interest rate models, and collateral valuation.
- Review staking and reward distribution: reward rate calculations, stake accounting, vesting, and lockup logic.
- Trace oracle usage: Pyth and Switchboard price feed integration, stale price checks, confidence intervals, and price deviation thresholds.
- Verify cross-program invariant consistency: total supply tracking, reserve accounting, and protocol-level asset conservation.
- Check for flash loan / atomic price manipulation: whether oracle prices can be manipulated within a single transaction, and whether TWAP or sanity checks are in place.
- Review token account management: mint/burn authority, freeze authority, token account ownership, and delegate permissions.
- Check initialization safety: one-time initialization guards, admin-only initialization, and reinitialization prevention.
- Review fee and treasury logic: protocol fee collection, referral fees, fee withdrawal permissions, and fee rate change limits.
- Check for precision loss in decimal conversions between different SPL token decimals.

Source/license:
- Original methodology derived from Solana DeFi audit best practices.
- MIT licensed.
$skill$,
    NULL,
    'MIT',
    'Original Solana DeFi review methodology.'
WHERE NOT EXISTS (SELECT 1 FROM public.agent_skills WHERE slug = 'solana-defi-review');

INSERT INTO public.agent_skills (slug, name, description, content, source_url, license_spdx, attribution)
SELECT
    'solana-runtime-review',
    'Solana runtime review',
    'Solana validator, runtime, and consensus-level security review skill for protocol-level vulnerabilities.',
    $skill$
Use this optional external skill reference for Solana validator, runtime, and protocol-level audits.

Focus:
- Review validator client code: block production, voting, fork choice, tower consensus, and leader schedule.
- Check runtime syscalls: `sol_invoke`, `sol_invoke_signed`, `sol_log`, `sol_log_data`, `sol_get_clock_sysvar`, and other BPF syscalls for correct behavior under edge cases.
- Review bank and account state management: rent collection, epoch scheduling, account data size changes, and state rollback on transaction failure.
- Check feature gate logic: feature activation, feature gate checks, and network upgrade safety.
- Review transaction processing: account locking, CU budget, transaction-wide limits, and instruction-level error handling.
- Check consensus-sensitive behavior: vote accounting, validator rewards, inflation schedule, and epoch boundary handling.
- Review cross-program invocation depth limits, account data size limits, and compute budget enforcement.
- Check for denial-of-service vectors: accounts that can be made too large to process, instruction count exhaustion, and expensive serialization paths.
- Verify snapshot and bank hash security: bank hash computation, snapshot format, and replay safety.

Source/license:
- Original methodology derived from Solana validator and runtime security research.
- MIT licensed.
$skill$,
    NULL,
    'MIT',
    'Original Solana runtime review methodology.'
WHERE NOT EXISTS (SELECT 1 FROM public.agent_skills WHERE slug = 'solana-runtime-review');