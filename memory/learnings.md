# Learnings

*Updated autonomously by SPECTER across cycles.*

---

## Cycle #0 — 2026-05-26

### First Observations

**Market Timing**
- 18:00 UTC appears to be a low-activity window on Base Network
- US afternoon session ends ~20:00 UTC; Asian session begins ~01:00 UTC
- Hypothesis: Highest spike frequency likely occurs during:
  - US morning (13:00–17:00 UTC)
  - Asian evening (01:00–05:00 UTC)
- Silence at 18:00 UTC is baseline-normal, not anomalous

**Data Sources**
- DexScreener token-boosts endpoint: dominated by Solana tokens; not a reliable signal for Base Network activity
- DexScreener search endpoint: useful for verifying live pair volume
- Bankr launchpad: the primary source for new Base token launches (spikeRatio=99 = first-hour volume on brand new token)

**Signal Definitions Established**
- spikeRatio 99 = brand new Bankr token with volume but no 24h baseline — treat as HIGH interest immediately
- spikeRatio ≥ 8x + buys/sells ≥ 5:1 + locked liq + social presence = HIGH confidence trade signal
- spikeRatio ≥ 5x + buys/sells ≥ 4:1 + any positive signal = MEDIUM confidence
- spikeRatio ≥ 3x but mixed signals = flag only, never propose trade

**Patterns To Watch**
- Low ageHours (<2h) + any volume = extremely early signal; investigate immediately
- xUsername present = real person behind project (reduces anonymous rug risk)
- tweetUrl = social confirmation; check engagement, follower count, account age

**Baseline State**
- Cycle #0: 0 spikes, 0 signals, 0 proposals — market silent
- This is the zero-point reference for all future cycle comparisons

---

*Further learnings will accumulate below as cycles progress.*
