import fs from 'fs';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO         = process.env.GITHUB_REPOSITORY || 'ariam2025/specter';

export async function gatherContext(spikes = []) {
  const memory = readMemory();
  const state  = readState();
  const issues = await fetchIssues();
  const commits = await fetchCommits();
  const pendingTrades = await fetchPendingTradeApprovals(issues);

  const marketSummary = buildMarketSummary(spikes);

  return {
    memory,
    state,
    issues,
    commits,
    spikes,
    pendingTrades,
    marketSummary,
    now: new Date().toISOString(),
    initialMessage: buildInitialMessage(state, spikes, issues, pendingTrades),
  };
}

function readMemory() {
  const read = f => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
  return {
    self:      read('memory/self.md'),
    focus:     read('memory/focus.md'),
    learnings: read('memory/learnings.md'),
  };
}

function readState() {
  try {
    const raw = fs.readFileSync('memory/state.json', 'utf8');
    return JSON.parse(raw);
  } catch {
    return { cycle: 0, born: new Date().toISOString(), chain: 'base', chainId: 8453 };
  }
}

async function fetchIssues() {
  if (!GITHUB_TOKEN) return [];
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/issues?state=open&per_page=20`,
      { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
    );
    const issues = await res.json();
    if (!Array.isArray(issues)) return [];

    // Auto-label new visitor issues
    for (const issue of issues) {
      if (!issue.labels?.length) {
        const title = issue.title?.toLowerCase() || '';
        const label = title.startsWith('[directive]') ? 'directive'
          : title.startsWith('[self]') ? 'self'
          : 'visitor';
        await fetch(
          `https://api.github.com/repos/${REPO}/issues/${issue.number}/labels`,
          {
            method: 'POST',
            headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' },
            body: JSON.stringify({ labels: [label] }),
          }
        );
      }
    }

    return issues.map(i => ({
      number: i.number,
      title: i.title,
      body: (i.body || '').slice(0, 500),
      labels: (i.labels || []).map(l => l.name),
      created: i.created_at,
    }));
  } catch {
    return [];
  }
}

async function fetchPendingTradeApprovals(issues) {
  if (!GITHUB_TOKEN) return [];
  const tradeIssues = issues.filter(i => i.labels.includes('trade-proposal'));
  if (!tradeIssues.length) return [];

  const approvals = [];
  for (const issue of tradeIssues) {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${REPO}/issues/${issue.number}/comments?per_page=50`,
        { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
      );
      const comments = await res.json();
      if (!Array.isArray(comments)) continue;

      for (const c of comments) {
        const body = (c.body || '').trim().toUpperCase();
        const approveMatch = body.match(/^APPROVE\s+\$?(\d+(?:\.\d+)?)/);
        if (approveMatch) {
          approvals.push({
            issue_number: issue.number,
            title: issue.title,
            amount_usd: parseFloat(approveMatch[1]),
            approved_by: c.user?.login,
            approved_at: c.created_at,
          });
          break;
        }
        if (body.startsWith('REJECT')) {
          approvals.push({
            issue_number: issue.number,
            title: issue.title,
            rejected: true,
            rejected_by: c.user?.login,
          });
          break;
        }
      }
    } catch {
      // skip
    }
  }
  return approvals;
}

async function fetchCommits() {
  if (!GITHUB_TOKEN) return [];
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/commits?per_page=10`,
      { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
    );
    const commits = await res.json();
    if (!Array.isArray(commits)) return [];
    return commits.map(c => ({
      sha:     c.sha?.slice(0, 7),
      message: c.commit?.message?.split('\n')[0],
      date:    c.commit?.author?.date,
    }));
  } catch {
    return [];
  }
}

function buildMarketSummary(spikes) {
  if (!spikes.length) return 'No spikes detected this cycle. Market is silent.';
  const lines = [`${spikes.length} spike(s) detected on Base Network (source: Bankr launches):`];
  spikes.slice(0, 5).forEach(s => {
    const age     = s.ageHours != null ? ` | age: ${s.ageHours}h` : '';
    const social  = s.xUsername ? ` | @${s.xUsername}` : '';
    const buySell = s.buys1h && s.sells1h ? ` | buy/sell: ${s.buys1h}/${s.sells1h}` : '';
    lines.push(`  - $${s.symbol}: ${s.spikeRatio}x spike | vol1h $${fmt(s.vol1h)} | liq $${fmt(s.liqUsd)} | ${s.change24h >= 0 ? '+' : ''}${s.change24h?.toFixed(1)}% 24h${age}${buySell}${social}`);
  });
  return lines.join('\n');
}

function buildInitialMessage(state, spikes, issues, pendingTrades = []) {
  const parts = [`Cycle #${state.cycle} starting.`];
  if (spikes.length) parts.push(`Watcher detected ${spikes.length} spike(s) on Base Network.`);
  else parts.push('No active spikes detected this cycle.');

  const approved = pendingTrades.filter(t => !t.rejected);
  const rejected = pendingTrades.filter(t => t.rejected);
  if (approved.length) {
    parts.push(`PRIORITY: ${approved.length} trade proposal(s) have been APPROVED and are waiting for execution.`);
  }
  if (rejected.length) {
    parts.push(`${rejected.length} trade proposal(s) were REJECTED — close those issues.`);
  }

  if (issues.length) parts.push(`${issues.length} open issue(s) need attention.`);
  parts.push('Begin your cycle: think, analyze, journal, ride on.');
  return parts.join(' ');
}

function fmt(n) {
  if (!n) return '0';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.round(n).toString();
}
