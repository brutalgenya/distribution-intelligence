# Web application

React operations interface for the Fastify API in `../api`.

## Run locally

```bash
cp .env.example .env
npm ci
npm run dev
```

The Vite development server proxies `/api` requests to `http://localhost:4000` by default. Run the API and demo seed first, then enter the printed user and organisation IDs in the session panel.

## Routes

The interface includes command-centre, decisions, workflow, outcomes, investigation, data operations, support recovery, supply execution, buyer actions, integrations, policy governance, approvals, activation and tenant administration views.
