# Deployment quick guide

## Render (single service)
1. Push the repository to GitHub.
2. Create a Render Web Service from the repository and use `render.yaml`, or enter:
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
3. Set `HOST=0.0.0.0`, `PORT=10000` (Render sets PORT), and `ALLOWED_ORIGINS=https://YOUR-RENDER-SERVICE.onrender.com` (plus any deployed frontend origin).
4. If you deploy a separate Vercel frontend, set its API proxy or deploy the frontend and backend together. The simplest supported setup is the single Render service, which serves `client/dist` and `/api/*` from one origin.
5. Verify `https://YOUR-SERVICE/api/health` and `https://YOUR-SERVICE/mcp`.

The included JSON file store is suitable for a hackathon demo, not durable production storage on ephemeral hosts. Use a managed database and authentication before real family use.

## AWS Bedrock
Set `AWS_REGION` and `BEDROCK_MODEL_ID` in the hosting environment, then configure credentials using the platform's secret manager or IAM role. Never commit access keys. Verify that the model is enabled in your account and region. Bedrock is optional; deterministic coordination continues to work without it.
