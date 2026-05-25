export const tools = [
  {
    name: 'think',
    description: 'Log a reasoning step without changing state. Use this to plan before acting.',
    input_schema: {
      type: 'object',
      properties: {
        thought: { type: 'string', description: 'Your reasoning' }
      },
      required: ['thought']
    }
  },
  {
    name: 'read_file',
    description: 'Read a file from the repository.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to repo root' }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Write content to a file in the repository.',
    input_schema: {
      type: 'object',
      properties: {
        path:    { type: 'string', description: 'File path relative to repo root' },
        content: { type: 'string', description: 'Content to write' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'list_files',
    description: 'List files in a directory.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path', default: '.' }
      },
      required: []
    }
  },
  {
    name: 'fetch_url',
    description: 'Fetch content from a URL. Returns text (first 4000 chars).',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' }
      },
      required: ['url']
    }
  },
  {
    name: 'web_search',
    description: 'Search the web via DuckDuckGo. Use for token research, news, social signals.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' }
      },
      required: ['query']
    }
  },
  {
    name: 'update_memory',
    description: 'Update one of the agent memory files.',
    input_schema: {
      type: 'object',
      properties: {
        file:    { type: 'string', enum: ['self', 'focus', 'learnings'], description: 'Which memory file to update' },
        content: { type: 'string', description: 'New full content for the file' }
      },
      required: ['file', 'content']
    }
  },
  {
    name: 'write_journal',
    description: 'Write a journal entry for this cycle to memory/cycles/.',
    input_schema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Journal entry content' }
      },
      required: ['content']
    }
  },
  {
    name: 'create_issue',
    description: 'Create a GitHub issue to flag a notable signal.',
    input_schema: {
      type: 'object',
      properties: {
        title:  { type: 'string', description: 'Issue title' },
        body:   { type: 'string', description: 'Issue body with analysis' },
        labels: { type: 'array', items: { type: 'string' }, description: 'Labels' }
      },
      required: ['title', 'body']
    }
  },
  {
    name: 'comment_issue',
    description: 'Comment on an open GitHub issue.',
    input_schema: {
      type: 'object',
      properties: {
        issue_number: { type: 'number', description: 'Issue number' },
        body:         { type: 'string', description: 'Comment body' }
      },
      required: ['issue_number', 'body']
    }
  },
  {
    name: 'close_issue',
    description: 'Close a GitHub issue.',
    input_schema: {
      type: 'object',
      properties: {
        issue_number: { type: 'number', description: 'Issue number' },
        comment:      { type: 'string', description: 'Optional closing comment' }
      },
      required: ['issue_number']
    }
  },
  {
    name: 'propose_trade',
    description: 'Create a trade proposal that requires human approval before execution. Use this when you detect a high-confidence signal worth trading.',
    input_schema: {
      type: 'object',
      properties: {
        symbol:          { type: 'string', description: 'Token symbol, e.g. GHOST' },
        token_address:   { type: 'string', description: 'Contract address on Base' },
        dex:             { type: 'string', description: 'DEX where the token trades' },
        spike_ratio:     { type: 'number', description: 'Spike ratio detected' },
        vol_1h:          { type: 'number', description: '1h volume in USD' },
        price_usd:       { type: 'number', description: 'Current price' },
        suggested_usd:   { type: 'number', description: 'Suggested trade size in USD' },
        confidence:      { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'], description: 'Signal confidence level' },
        analysis:        { type: 'string', description: 'Full analysis reasoning' },
        risks:           { type: 'string', description: 'Key risks for this trade' }
      },
      required: ['symbol', 'spike_ratio', 'vol_1h', 'suggested_usd', 'confidence', 'analysis', 'risks']
    }
  },
];
