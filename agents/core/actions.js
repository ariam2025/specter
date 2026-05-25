import fs from 'fs';
import path from 'path';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO         = process.env.GITHUB_REPOSITORY || 'ariam2025/specter';

export async function executeAction(name, input) {
  switch (name) {
    case 'think':
      console.log(`[THINK] ${input.thought?.slice(0, 120)}`);
      return { ok: true };

    case 'read_file': {
      try {
        const content = fs.readFileSync(input.path, 'utf8');
        return { content: content.slice(0, 6000) };
      } catch (e) {
        return { error: e.message };
      }
    }

    case 'write_file': {
      try {
        const dir = path.dirname(input.path);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(input.path, input.content, 'utf8');
        return { ok: true, path: input.path };
      } catch (e) {
        return { error: e.message };
      }
    }

    case 'list_files': {
      try {
        const dir = input.path || '.';
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        return { files: entries.map(e => (e.isDirectory() ? e.name + '/' : e.name)) };
      } catch (e) {
        return { error: e.message };
      }
    }

    case 'fetch_url': {
      try {
        const res = await fetch(input.url, {
          headers: { 'User-Agent': 'SPECTER-agent/1.0' },
          signal: AbortSignal.timeout(10000),
        });
        const text = await res.text();
        // Strip HTML tags
        const clean = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        return { content: clean.slice(0, 4000), status: res.status };
      } catch (e) {
        return { error: e.message };
      }
    }

    case 'web_search': {
      try {
        const q = encodeURIComponent(input.query);
        const res = await fetch(
          `https://api.duckduckgo.com/?q=${q}&format=json&no_redirect=1&no_html=1`,
          { headers: { 'User-Agent': 'SPECTER-agent/1.0' } }
        );
        const data = await res.json();
        const results = [
          data.AbstractText,
          ...(data.RelatedTopics || []).slice(0, 5).map(t => t.Text),
        ].filter(Boolean).join('\n\n');
        return { results: results.slice(0, 2000) || 'No results found.' };
      } catch (e) {
        return { error: e.message };
      }
    }

    case 'update_memory': {
      const fileMap = { self: 'memory/self.md', focus: 'memory/focus.md', learnings: 'memory/learnings.md' };
      const filePath = fileMap[input.file];
      if (!filePath) return { error: 'Unknown memory file' };
      try {
        fs.writeFileSync(filePath, input.content, 'utf8');
        return { ok: true, file: filePath };
      } catch (e) {
        return { error: e.message };
      }
    }

    case 'write_journal': {
      try {
        const date = new Date().toISOString().split('T')[0];
        const dir  = `memory/cycles/${date}`;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const ts   = new Date().toISOString().replace(/[:.]/g, '-');
        const file = `${dir}/${ts}.md`;
        fs.writeFileSync(file, input.content, 'utf8');
        return { ok: true, file };
      } catch (e) {
        return { error: e.message };
      }
    }

    case 'create_issue': {
      if (!GITHUB_TOKEN) return { error: 'No GITHUB_TOKEN' };
      try {
        const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
          method: 'POST',
          headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({
            title:  input.title,
            body:   input.body,
            labels: input.labels || ['signal'],
          }),
        });
        const data = await res.json();
        return { ok: true, number: data.number, url: data.html_url };
      } catch (e) {
        return { error: e.message };
      }
    }

    case 'comment_issue': {
      if (!GITHUB_TOKEN) return { error: 'No GITHUB_TOKEN' };
      try {
        await fetch(`https://api.github.com/repos/${REPO}/issues/${input.issue_number}/comments`, {
          method: 'POST',
          headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({ body: input.body }),
        });
        return { ok: true };
      } catch (e) {
        return { error: e.message };
      }
    }

    case 'close_issue': {
      if (!GITHUB_TOKEN) return { error: 'No GITHUB_TOKEN' };
      try {
        if (input.comment) {
          await executeAction('comment_issue', {
            issue_number: input.issue_number,
            body: input.comment,
          });
        }
        await fetch(`https://api.github.com/repos/${REPO}/issues/${input.issue_number}`, {
          method: 'PATCH',
          headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({ state: 'closed' }),
        });
        return { ok: true };
      } catch (e) {
        return { error: e.message };
      }
    }

    case 'propose_trade': {
      if (!GITHUB_TOKEN) return { error: 'No GITHUB_TOKEN' };
      try {
        const conf = input.confidence || 'MEDIUM';
        const confEmoji = { HIGH: '🔴', MEDIUM: '🟡', LOW: '⚪' }[conf] || '🟡';
        const body = [
          `## SPECTER Trade Proposal`,
          ``,
          `| Field | Value |`,
          `|-------|-------|`,
          `| **Token** | $${input.symbol}${input.token_address ? ` (\`${input.token_address}\`)` : ''} |`,
          `| **DEX** | ${input.dex || 'unknown'} |`,
          `| **Spike Ratio** | ${input.spike_ratio}x |`,
          `| **Vol 1H** | $${Number(input.vol_1h).toLocaleString()} |`,
          `| **Price** | ${input.price_usd ? `$${input.price_usd}` : 'N/A'} |`,
          `| **Suggested Size** | $${input.suggested_usd} |`,
          `| **Confidence** | ${confEmoji} ${conf} |`,
          ``,
          `### Analysis`,
          input.analysis,
          ``,
          `### Risks`,
          input.risks,
          ``,
          `---`,
          `### How to respond`,
          `- **Approve:** Comment \`APPROVE $<amount>\` (e.g. \`APPROVE $50\`) to execute`,
          `- **Reject:** Comment \`REJECT\` to dismiss this proposal`,
          ``,
          `*Autonomous proposal by SPECTER // ${new Date().toISOString()}*`,
        ].join('\n');

        const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
          method: 'POST',
          headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({
            title:  `${confEmoji} TRADE PROPOSAL: $${input.symbol} — ${input.spike_ratio}x spike [${conf}]`,
            body,
            labels: ['trade-proposal'],
          }),
        });
        const data = await res.json();
        return { ok: true, number: data.number, url: data.html_url };
      } catch (e) {
        return { error: e.message };
      }
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
