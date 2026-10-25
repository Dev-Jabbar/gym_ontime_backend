# Contributing

This is the original Express + MongoDB version of Gym Ontime. New work goes into the [NestJS rebuild](https://github.com/Dev-Jabbar/gym_ontime_nestjs_backend); this repository stays running and gets fixes.

## Set up

Prerequisites: Node.js 18+ (20 or newer recommended), Yarn, a MongoDB database (local or Atlas).

```bash
yarn install
cp .env.example .env     # fill in your own values; never commit .env
yarn dev                 # http://localhost:5000, restarts on change
```

Use your own database and a Paystack **test** key. Never use real customer data.

| Command | Purpose |
|---|---|
| `yarn dev` | Run with `nodemon` |
| `yarn build` | Compile to `dist/` |
| `yarn start` | Run the compiled build |
| `yarn seed:admin` | Seed the initial admin (see the warning in the README) |

There is no test suite or linter yet. Before opening a pull request run `yarn build` (it type-checks) and try the change by hand against a local database.

## Conventions

The code is layered and each folder has one job (see [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)):

- **routes** map a URL to a controller and contain no logic; **controllers** parse the request and shape the response; **services** hold business rules; **repositories** are the only code that talks to MongoDB.
- Validate request bodies with the Zod schemas in `src/validations/`.
- Throw `AppError` (message, status code) from services; do not return raw errors to the client.
- Protect routes with `protect()` or `protect(["role"])`. Put fixed paths such as `/me` or `/by-member/...` **before** `/:id` routes.
- Anything that touches seats must go through `reserveSeat`, `confirmSeat` and `releaseSeat`, so the check and the write stay one atomic database operation.
- Payments: every trigger (webhook, redirect check, cleanup job) must call `verifyPayment`; do not add a second implementation.
- The webhook route must stay **before** `express.json()` in `src/index.ts`, because it needs the raw body.

## Pull requests

Branch from `master`, keep the change focused, describe how you tested it, and never include secrets or `.env` files. Pushes to `master` deploy the hosted API.
