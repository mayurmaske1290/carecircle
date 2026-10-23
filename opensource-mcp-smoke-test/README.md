# MCP Streamable HTTP Smoke Test

A tiny, dependency-free Node.js CLI that sends MCP `initialize` and `tools/list` JSON-RPC requests to a Streamable HTTP endpoint and prints a concise JSON report. Useful for quickly verifying a hackathon MCP server before recording a demo.

## Run

```bash
node index.mjs https://your-server.example/mcp
npm test
```

Requires Node.js 20+. It does not prove complete MCP conformance, tool correctness, authentication security, or Alexa+ connectivity. It is a smoke test only. Do not run against endpoints you do not own or have permission to test.

## What it checks

- Endpoint URL is valid and uses HTTP(S).
- MCP initialization request gets a successful response.
- `tools/list` returns at least one tool.
- Prints server info, protocol version, and tool names.

## Open Source mini challenge note

This folder is a separately licensable project. To claim the challenge, publish this folder as its own public GitHub repository (or submit a qualifying public contribution) during the hackathon window and provide the required URLs and GitHub username. Merely keeping this folder inside CareCircle does not prove the separate-public-project requirement is satisfied.

## License

MIT. See `LICENSE`.
