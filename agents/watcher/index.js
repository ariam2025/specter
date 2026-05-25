import fs from 'fs';

const DEXSCREENER = 'https://api.dexscreener.com';
const MIN_VOL_24H  = 10000;
const MIN_LIQ      = 5000;
const SPIKE_THRESHOLD = 3.0;

async function fetchTokens() {
  // Get top boosted tokens on Base
  const boostRes = await fetch(`${DEXSCREENER}/token-boosts/top/v1`);
  const boostData = await boostRes.json();

  const addresses = (Array.isArray(boostData) ? boostData : [])
    .filter(t => t.chainId === 'base')
    .slice(0, 15)
    .map(t => t.tokenAddress)
    .filter(Boolean);

  // Fallback: search WETH pairs if no boosted tokens
  if (!addresses.length) {
    const fallback = await fetch(`${DEXSCREENER}/token-search/v1?q=WETH&chain=base`);
    const fallbackData = await fallback.json();
    const pairs = (fallbackData.pairs || []).slice(0, 10);
    return pairs.map(extractMetrics).filter(Boolean);
  }

  const tokens = [];
  for (const address of addresses) {
    await sleep(80);
    try {
      const res = await fetch(`${DEXSCREENER}/token-pairs/v1/base/${address}`);
      const data = await res.json();
      if (!data?.pairs) continue;
      for (const pair of data.pairs) {
        const t = extractMetrics(pair);
        if (t) tokens.push(t);
      }
    } catch {
      // skip failed address
    }
  }

  // Deduplicate by pairAddress
  const seen = new Set();
  return tokens.filter(t => {
    if (seen.has(t.pairAddress)) return false;
    seen.add(t.pairAddress);
    return true;
  });
}

function extractMetrics(pair) {
  const vol24h = pair.volume?.h24  || 0;
  const vol1h  = pair.volume?.h1   || 0;
  const vol6h  = pair.volume?.h6   || 0;
  const liq    = pair.liquidity?.usd || 0;

  if (vol24h < MIN_VOL_24H || liq < MIN_LIQ) return null;

  const spikeRatio = vol24h > 0
    ? parseFloat((vol1h / (vol24h / 24)).toFixed(2))
    : 0;

  return {
    symbol:      pair.baseToken?.symbol  || 'UNKNOWN',
    name:        pair.baseToken?.name    || '',
    address:     pair.baseToken?.address || '',
    pairAddress: pair.pairAddress        || '',
    dex:         pair.dexId              || '',
    priceUsd:    parseFloat(pair.priceUsd || 0),
    mcap:        pair.marketCap || pair.fdv || 0,
    vol1h, vol6h, vol24h,
    liqUsd:      liq,
    change1h:    pair.priceChange?.h1  || 0,
    change6h:    pair.priceChange?.h6  || 0,
    change24h:   pair.priceChange?.h24 || 0,
    buys1h:      pair.txns?.h1?.buys   || 0,
    sells1h:     pair.txns?.h1?.sells  || 0,
    spikeRatio,
    url:         pair.url   || '',
    chain:       'base',
  };
}

export async function runWatcher() {
  console.log('[WATCHER] scanning Base Network...');

  try {
    const tokens = await fetchTokens();
    const spikes = tokens
      .filter(t => t.spikeRatio >= SPIKE_THRESHOLD)
      .sort((a, b) => b.spikeRatio - a.spikeRatio);

    const timestamp = new Date().toISOString();

    fs.writeFileSync('data/tokens.json', JSON.stringify({
      timestamp, chain: 'base',
      count: tokens.length,
      spikeCount: spikes.length,
      tokens,
      spikes,
    }, null, 2));

    fs.writeFileSync('data/spikes.json', JSON.stringify({
      timestamp,
      spikeCount: spikes.length,
      spikes,
    }, null, 2));

    console.log(`[WATCHER] ${tokens.length} tokens tracked, ${spikes.length} spikes detected`);
    if (spikes.length) {
      spikes.slice(0, 3).forEach(s =>
        console.log(`  ⚡ $${s.symbol} — ${s.spikeRatio}x spike`)
      );
    }

    return spikes;
  } catch (err) {
    console.error('[WATCHER] error:', err.message);
    return [];
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Standalone run
if (process.argv[1]?.includes('watcher')) {
  runWatcher().catch(console.error);
}
