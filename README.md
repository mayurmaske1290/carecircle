# CareCircle

**CareCircle** is a family coordination assistant that turns scheduling conflicts into a proposed, user-approved action plan. It includes a polished simulated Alexa+-style web experience, a REST API, an MCP server exposed over Streamable HTTP, optional Amazon Bedrock integration, and a separate open-source MCP smoke-test utility.

> **Hackathon honesty note:** This repository does not claim to connect to the production Alexa+ service. The web UI is a simulated Alexa+ experience, a route described in the hackathon brief. The MCP endpoint is independently available for compatible MCP clients. Do not describe this as an official Alexa+ integration unless you complete and verify that integration through Amazon's approved path.

## Features

- Conversational family coordination demo with sample household data.
- Deterministic availability/conflict checking (not an LLM guess).
- Plan preview and explicit approval before a task is persisted.
- Task creation, completion, deletion, household availability editing.
- Browser dashboard with task status and upcoming schedule.
- Persistent local database using a JSON file on the server.
- MCP Streamable HTTP endpoint at `/mcp` with tools:
  - `get_household`
  - `check_availability`
  - `propose_family_plan`
  - `create_task`
  - `list_tasks`
  - `complete_task`
- Optional Amazon Bedrock Converse API integration for wording a response. Core coordination works without AWS credentials.
- CORS/Origin checks, input validation, bounded request size, and clear error handling.
- Separate `opensource-mcp-smoke-test/` utility, licensed MIT, for checking a reachable MCP endpoint's health/tool listing. Publish it as a separate public repository if entering the Open Source mini challenge.

## Requirements

- Node.js 20 or later (Node 22 recommended)
- npm 10+
- Optional: AWS credentials and a Bedrock-enabled region/model if enabling Bedrock

## Run locally

```bash
npm install
cp server/.env.example server/.env
npm run dev
```

- Web app: http://localhost:5173
- API health: http://localhost:8787/api/health
- MCP endpoint: http://localhost:8787/mcp

Windows PowerShell:
```powershell
npm install
Copy-Item server/.env.example server/.env
npm run dev
```

To make a production build and run the server:
```bash
npm run build
npm start
```
The server serves the built frontend from `client/dist` when that folder exists.

## Optional Amazon Bedrock integration

Set these in `server/.env` and configure AWS credentials using your normal AWS credential provider (environment variables, AWS profile, or IAM role):

```env
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=amazon.nova-micro-v1:0
```

The server uses the AWS SDK `ConverseCommand` if both values are configured and AWS credentials are available. Otherwise it falls back to deterministic, locally generated guidance. Do not commit credentials or `.env` files. Verify model access and regional availability in your AWS account before demoing.

## MCP details

- Transport: Streamable HTTP
- Endpoint: `/mcp`
- SDK: official `@modelcontextprotocol/sdk`
- Tools use Zod schemas and return text plus structured content where supported.
- Test with a compatible MCP Inspector/client pointed at `http://localhost:8787/mcp`.
- For remote use, deploy the server behind HTTPS and configure `ALLOWED_ORIGINS` appropriately. Don't expose a demo endpoint with broad permissions or real personal data.

## API overview

- `GET /api/health`
- `GET /api/household`
- `PUT /api/household`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `POST /api/plan`
- `POST /api/assistant`

The app is a single-demo-household prototype. It is not a multi-tenant production service; add authentication and per-household authorization before real use.

## Testing

```bash
npm test
npm run build
```

Tests cover scheduling conflict detection, availability recommendations, and task validation. For the smoke test utility:

```bash
cd opensource-mcp-smoke-test
npm install
npm test
node index.mjs http://localhost:8787/mcp
```

## Submission checklist

- [ ] Verify the app in a clean browser session.
- [ ] Test approve, reject, complete, delete, no-available-member and reload flows.
- [ ] Deploy the app/server and verify the remote URL.
- [ ] Verify `/mcp` with an MCP Inspector/client if claiming the MCP-server route.
- [ ] Record a demo under the required time limit and accurately label the experience as simulated unless the real Alexa+ integration is verified.
- [ ] For AWS Builder, show the actual Bedrock integration and document the model/service call.
- [ ] For Open Source, publish `opensource-mcp-smoke-test/` as a separate public repository or make a qualifying contribution. Include the contribution URL, repository URL, GitHub username, and concise description in the submission.
- [ ] Submit on Devpost before the deadline.

## Architecture

```text
React/Vite UI
   ├── REST API (/api/*) ── coordination engine ── JSON persistence
   └── simulated assistant UI
MCP-compatible client ── Streamable HTTP (/mcp) ── same coordination tools
Optional Bedrock Converse API ── response phrasing only
```

## License

MIT. See `LICENSE`.
