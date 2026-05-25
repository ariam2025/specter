import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { runWatcher } from '../watcher/index.js';
import { gatherContext } from './context.js';
import { tools } from './tools.js';
import { executeAction } from './actions.js';
import { buildSystemPrompt } from './prompt.js';

const MAX_STEPS = 40;

async function run() {
  const client = new Anthropic();

  console.log('[SPECTER] ══════════════════════════════════');
  console.log('[SPECTER] cycle starting...');

  // 1. Run watcher — fresh market data
  const spikes = await runWatcher();

  // 2. Gather full context
  const context = await gatherContext(spikes);
  console.log(`[SPECTER] context ready — cycle #${context.state.cycle}`);

  // 3. Agent loop
  const messages = [{ role: 'user', content: context.initialMessage }];
  const proof    = [];
  let steps = 0;

  while (steps < MAX_STEPS) {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 4096,
      system:     buildSystemPrompt(context),
      tools,
      messages,
    });

    proof.push({ step: steps, response: response.content });

    const toolUses = response.content.filter(b => b.type === 'tool_use');
    console.log(`[SPECTER] step ${steps} — stop: ${response.stop_reason} — tools: ${toolUses.map(t => t.name).join(', ') || 'none'}`);

    if (response.stop_reason === 'end_turn' || !toolUses.length) break;

    messages.push({ role: 'assistant', content: response.content });

    const results = [];
    for (const t of toolUses) {
      const result = await executeAction(t.name, t.input);
      results.push({ type: 'tool_result', tool_use_id: t.id, content: JSON.stringify(result) });
    }
    messages.push({ role: 'user', content: results });
    steps++;
  }

  // 4. Save proof
  const date = new Date().toISOString().split('T')[0];
  const cycle = context.state.cycle;
  const proofDir = `proofs/${date}`;
  if (!fs.existsSync(proofDir)) fs.mkdirSync(proofDir, { recursive: true });
  fs.writeFileSync(`${proofDir}/cycle-${cycle}.json`, JSON.stringify(proof, null, 2));

  // 5. Update state
  const state = context.state;
  state.cycle   = cycle + 1;
  state.lastRun = new Date().toISOString();
  if (!state.born) state.born = state.lastRun;
  fs.writeFileSync('memory/state.json', JSON.stringify(state, null, 2));

  console.log(`[SPECTER] cycle #${cycle} complete — ${steps} steps`);
  console.log('[SPECTER] ══════════════════════════════════');
}

run().catch(err => {
  console.error('[SPECTER] fatal:', err);
  process.exit(1);
});
