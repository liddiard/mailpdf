# Mail a PDF Online

Mail a physical letter by uploading a PDF. The app uses [Lob](https://lob.com/) for
mailing, [Stripe](https://stripe.com/) for payment, and [Amazon SES](https://aws.amazon.com/ses/)
for email.

## Requirements

- Node.js >= 24.15.0 and npm >= 11.5.1
- [Ghostscript](https://www.ghostscript.com/) (`gs`) installed and on your `PATH`
  (used to count pages and resize PDFs)
  - macOS: `brew install ghostscript`
  - Debian/Ubuntu: `sudo apt-get install ghostscript`

## Local development setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create your local environment file from the example and fill in the values:

   ```sh
   cp .env.example .env
   ```

   The server loads `.env` automatically. The file is git-ignored; only
   `.env.example` is committed. See [Environment variables](#environment-variables)
   for what each value is used for.

3. Start the Express API and the Vite dev server together:

   ```sh
   npm run dev
   ```

   - Client (Vite): http://localhost:5173
   - Server (Express): http://localhost:3000

   Vite proxies the API routes (`/upload`, `/verify_address`, `/checkout`,
   `/finalize`, `/track`, `/uploads`) to the Express server, so open the app at
   the Vite URL during development.

   Append `?demo` (or include `demo` anywhere in the URL) to use the test Lob
   and Stripe keys without sending real mail or charging real cards.

### Other commands

- `npm run dev:server` — run only the Express API (with `--watch`)
- `npm run dev:client` — run only the Vite dev server
- `npm run typecheck` — type-check the client and server with `tsc`
- `npm run lint` — lint the codebase with ESLint
- `npm run format` — format the codebase with Prettier
- `npm run format:check` — check formatting without writing changes
- `npm run build` — type-check and build the client into `dist/`
- `npm start` — run the production server (serves the built client from `dist/`)

The server is written in TypeScript and runs directly via Node's native type
stripping (no server build step). See [`tsconfig.node.json`](tsconfig.node.json)
for the server compiler options and [`tsconfig.app.json`](tsconfig.app.json) for
the client.

### Git hooks

`npm install` installs a [Husky](https://typicode.github.io/husky/) `pre-commit`
hook (via the `prepare` script). Before each commit it runs
[`lint-staged`](https://github.com/lint-staged/lint-staged), which lints and
formats the files being committed with ESLint and Prettier, then type-checks the
whole project with `tsc`. Code style is single-quoted strings with no
semicolons (`semi: false`) and no trailing commas.

## Environment variables

All variables are documented in [`.env.example`](.env.example).

| Variable                | Description                                                                  |
| ----------------------- | ---------------------------------------------------------------------------- |
| `LOB_API_KEY_TEST`      | Lob test API key (used in demo mode)                                         |
| `LOB_API_KEY`           | Lob live API key                                                             |
| `STRIPE_API_KEY_TEST`   | Stripe test secret key (used in demo mode)                                   |
| `STRIPE_API_KEY`        | Stripe live secret key                                                       |
| `AWS_REGION`            | AWS region for SES (e.g. `us-east-1`)                                        |
| `AWS_ACCESS_KEY_ID`     | AWS access key ID for sending email via SES                                  |
| `AWS_SECRET_ACCESS_KEY` | AWS secret access key for sending email via SES                              |
| `ADMIN_EMAIL`           | Email address that receives administrator error alerts                       |
| `PORT`                  | Port the server listens on (optional; defaults to `3000`)                    |
| `NODE_ENV`              | Set to `production` to enable rate limiting and hide stack traces (optional) |

## Setup ([Dokku](http://dokku.viewdocs.io/dokku/))

- Install Node.js >= 24.15.0 and npm >= 11.5.1
- Install Ghostscript in your container
- Set the required environment variables (see [`.env.example`](.env.example)):
  `LOB_API_KEY_TEST`, `LOB_API_KEY`, `STRIPE_API_KEY_TEST`, `STRIPE_API_KEY`,
  `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `ADMIN_EMAIL`
- Set Nginx max upload size to the max upload size specified in (app.ts) by following [this example](http://dokku.viewdocs.io/dokku/configuration/nginx/#customizing-via-configuration-files-included-by-the-default-tem)
- Set up a [one-off process](http://dokku.viewdocs.io/dokku/deployment/one-off-processes/) to delete old uploads. This example deletes files older than 1 day: `find uploads/* -mtime +1 -exec rm {} \;`.

## Routes

- POST /upload
- POST /verify_address
- POST /checkout
- POST /finalize
- GET /track/{packageID}

## Todo

- Email sending
- Testing
- http://dokku.viewdocs.io/dokku/deployment/one-off-processes/
