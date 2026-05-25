import fs from 'fs';

const DEXSCREENER      = 'https://api.dexscreener.com';
const BANKR_LAUNCHES   = 'https://api.bankr.bot/token-launches';
const SPIKE_THRESHOLD  = 3.0;
const MAX_LAUNCHES     = 40;   // how many recent Bankr tokens to scan
const BATCH_DELAY_MS   = 80;   // polite delay between DexScreener calls

// Lower thresholds for fresh Bankr tokens (they're new — volume is still building)
const MIN_VOL_1H = 500;
const MIN_LIQ    = 300;

async function fetchBankrLaunches() {
  const res = await fetch(`${BANKR_LAUNCHES}?limit=${MAX_LAUNCHES}`, {
    headers: { 'User-Agent': 'SPECTER-agent/1.0' },
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json();
  return (data.launches || [])
    .filter(l => l.chain === 'base' && l.status === 'deployed' && l.tokenAddress)
    .slice(0, MAX_LAUNCHES);
}

async function enrichWithDexScreener(launch) {
  await sleep(BATCH_DELAY_MS);
  try {
    const res = await fetch(
      `${DEXSCREENER}/token-pairs/v1/base/${launch.tokenAddress}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await res.json();
    const pairs = data?.pairs || [];
    if (!pairs.length) return null;

    // Pick the pair with highest 1h volume
    const best = pairs.reduce((a, b) =>
      (b.volume?.h1 || 0) > (a.volume?.h1 || 0) ? b : a, pairs[0]
    );

    return buildToken(best, launch);
  } catch {
    return null;
  }
}

function buildToken(pair, launch) {
  const vol24h = pair.volume?.h24 || 0;
  const vol1h  = pair.volume?.h1  || 0;
  const vol6h  = pair.volume?.h6  || 0;
  const liq    = pair.liquidity?.usd || 0;

  if (vol1h < MIN_VOL_1H && liq < MIN_LIQ) return null;

  // spikeRatio: how much louder this hour is vs the average hour
  const spikeRatio = vol24h > 0
    ? parseFloat((vol1h / (vol24h / 24)).toFixed(2))
    : vol1h > 0 ? 99 : 0; // brand new token with volume but no 24h baseline

  const ageMs  = Date.now() - (launch.timestamp || 0);
  const ageH   = parseFloat((ageMs / 3_600_000).toFixed(1));

  return {
    symbol:      pair.baseToken?.symbol  || launch.tokenSymbol || 'UNKNOWN',
    name:        pair.baseToken?.name    || launch.tokenName   || '',
    address:     launch.tokenAddress,
    pairAddress: pair.pairAddress || '',
    dex:         pair.dexId || '',
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
    url:         pair.url || `https://dexscreener.com/base/${launch.tokenAddress}`,
    chain:       'base',
    source:      'bankr',
    // Bankr-specific social metadata
    ageHours:    ageH,
    launchedAt:  new Date(launch.timestamp || 0).toISOString(),
    tweetUrl:    launch.tweetUrl    || null,
    websiteUrl:  launch.websiteUrl  || null,
    xUsername:   launch.feeRecipient?.xUsername || launch.deployer?.xUsername || null,
    xAvatar:     launch.feeRecipient?.xProfileImageUrl || null,
    launchType:  launch.launchType  || null,
    activityId:  launch.activityId  || null,
  };
}

export async function runWatcher() {
  console.log('[WATCHER] scanning Bankr launches on Base...');

  try {
    // Step 1: get recent Bankr token launches
    const launches = await fetchBankrLaunches();
    console.log(`[WATCHER] ${launches.length} Bankr launches fetched`);

    // Step 2: enrich each with DexScreener market data
    const results = [];
    for (const launch of launches) {
      const token = await enrichWithDexScreener(launch);
      if (token) results.push(token);
    }

    // Step 3: deduplicate by pairAddress
    const seen = new Set();
    const tokens = results.filter(t => {
      const key = t.pairAddress || t.address;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Step 4: detect spikes
    const spikes = tokens
      .filter(t => t.spikeRatio >= SPIKE_THRESHOLD || t.spikeRatio === 99)
      .sort((a, b) => b.spikeRatio - a.spikeRatio);

    const timestamp = new Date().toISOString();

    fs.writeFileSync('data/tokens.json', JSON.stringify({
      timestamp,
      chain: 'base',
      source: 'bankr',
      count: tokens.length,
      spikeCount: spikes.length,
      tokens,
      spikes,
    }, null, 2));

    fs.writeFileSync('data/spikes.json', JSON.stringify({
      timestamp,
      source: 'bankr',
      spikeCount: spikes.length,
      spikes,
    }, null, 2));

    console.log(`[WATCHER] ${tokens.length} tokens tracked, ${spikes.length} spikes detected`);
    if (spikes.length) {
      spikes.slice(0, 5).forEach(s =>
        console.log(`  ⚡ $${s.symbol} — ${s.spikeRatio}x spike | age: ${s.ageHours}h | ${s.xUsername ? '@' + s.xUsername : 'no twitter'}`)
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
