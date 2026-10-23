#!/usr/bin/env node
/**
 * Tiny MCP Streamable HTTP smoke tester for hackathon prototypes.
 * Uses JSON-RPC initialize and tools/list requests. No third-party dependencies.
 */
const endpoint = process.argv[2];
if (!endpoint) {
  console.error("Usage: node index.mjs https://your-mcp-server.example/mcp");
  process.exit(2);
}
let parsed;
try { parsed = new URL(endpoint); } catch { console.error("Invalid endpoint URL"); process.exit(2); }
if (!['http:', 'https:'].includes(parsed.protocol)) { console.error("Endpoint must use HTTP or HTTPS"); process.exit(2); }
async function rpc(url, body, sessionId) {
  const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
  if (sessionId) headers['mcp-session-id'] = sessionId;
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
  const session = response.headers.get('mcp-session-id');
  let result;
  if (text.trim().startsWith('data:')) {
    for (const line of text.split(/\r?\n/)) if (line.startsWith('data:')) { try { result = JSON.parse(line.slice(5).trim()); } catch {} }
  } else { try { result = JSON.parse(text); } catch {} }
  return { result, session };
}
try {
  const init = await rpc(endpoint, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'carecircle-mcp-smoke-test', version: '1.0.0' } } });
  if (init.result?.error) throw new Error(init.result.error.message || 'Initialize failed');
  const session = init.session;
  await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...(session ? { 'mcp-session-id': session } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }), signal: AbortSignal.timeout(8000) }).catch(() => {});
  const listed = await rpc(endpoint, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, session);
  if (listed.result?.error) throw new Error(listed.result.error.message || 'tools/list failed');
  const tools = listed.result?.result?.tools ?? listed.result?.tools ?? [];
  console.log(JSON.stringify({ ok: true, endpoint, server: init.result?.result?.serverInfo ?? init.result?.serverInfo ?? null, protocolVersion: init.result?.result?.protocolVersion ?? init.result?.protocolVersion ?? null, toolCount: tools.length, tools: tools.map(t => ({ name: t.name, description: t.description })) }, null, 2));
  if (!tools.length) process.exitCode = 1;
} catch (e) {
  console.error(`MCP smoke test failed: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
}
