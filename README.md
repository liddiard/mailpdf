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

| Variable                | Description                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `LOB_API_KEY_TEST`      | Lob test API key (used in demo mode)                                                                             |
| `LOB_API_KEY`           | Lob live API key                                                                                                 |
| `STRIPE_API_KEY_TEST`   | Stripe test secret key (used in demo mode)                                                                       |
| `STRIPE_API_KEY`        | Stripe live secret key                                                                                           |
| `AWS_REGION`            | AWS region for SES (e.g. `us-east-1`)                                                                            |
| `AWS_ACCESS_KEY_ID`     | AWS access key ID for sending email via SES                                                                      |
| `AWS_SECRET_ACCESS_KEY` | AWS secret access key for sending email via SES                                                                  |
| `ADMIN_EMAIL`           | Email address that receives administrator error alerts                                                           |
| `PORT`                  | Port the server listens on and that Docker Compose publishes (optional; defaults to `3000`, or `6245` in Docker) |
| `NODE_ENV`              | Set to `production` to enable rate limiting and hide stack traces (optional)                                     |

## Docker

The app runs as a single container that serves both the API and the built client
on one port (default `6245`). A [multi-stage `Dockerfile`](Dockerfile) builds the
Vite client with all dependencies, then ships a slim Alpine-based runtime image
containing only production dependencies and Ghostscript. The container runs as the
non-root `node` user and reports its status via the `/healthz` endpoint.

[`compose.yaml`](compose.yaml) defines two services:

- **`app`** — the Express server + static client. Uploaded PDFs are stored in the
  `uploads` named volume so they survive restarts.
- **`cleanup`** — a small Alpine sidecar that deletes uploads older than one day
  every hour, so the volume does not grow without bound.

### Configuration

Copy the example environment file and fill in your production secrets:

```sh
cp .env.example .env
```

`PORT` is both the port the server listens on inside the container and the port
Compose publishes on the host. It defaults to `6245`, so the app is reachable at
`http://localhost:6245`. To expose it on a different port, set `PORT` in `.env`.

`NODE_ENV` is forced to `production` by Compose regardless of the value in
`.env`, enabling rate limiting and hiding error stack traces.

### Run

```sh
# Build the image and start the app + cleanup sidecar in the background
docker compose up -d --build

# Show status and follow the app logs
docker compose ps
docker compose logs -f app

# Verify the container is healthy
curl http://localhost:6245/healthz

# Stop the stack (the uploads volume is preserved)
docker compose down
```

To deploy an update, rebuild the image and recreate the containers:

```sh
docker compose up -d --build
```

`docker compose down -v` also removes the `uploads` volume; use it only when you
intend to discard uploaded files.

### Deploying to a remote host

Build the image on the machine of your choice and make it available to the VPS,
either by pushing to a registry:

```sh
docker build -t registry.example.com/mailpdf:latest .
docker push registry.example.com/mailpdf:latest
```

or by transferring a tarball directly (no registry required):

```sh
docker build -t mailpdf:latest .
docker save mailpdf:latest | gzip > mailpdf.tar.gz
# ...copy mailpdf.tar.gz to the VPS...
gunzip -c mailpdf.tar.gz | docker load
```

On the VPS, create the `.env` file next to `compose.yaml`. If you pushed to a
registry, set `image:` in `compose.yaml` to the registry tag, then pull and start
without rebuilding:

```sh
docker compose pull
docker compose up -d --no-build
```

For the tarball workflow the loaded `mailpdf:latest` tag already matches
`image:`, so just run `docker compose up -d --no-build`.

By default Compose publishes the port on all interfaces. To make the app
reachable only through nginx, bind it to localhost by changing `ports:` in
`compose.yaml` to:

```yaml
ports:
  - '127.0.0.1:${PORT:-6245}:${PORT:-6245}'
```

### Reverse proxy (nginx)

Terminate TLS and forward requests to the published host port. Two things to keep
in mind:

- The app accepts uploads up to **25 MB** (see `sizeLimit` in
  [`app.ts`](app.ts)); set `client_max_body_size 25m;` (or larger) in nginx so it
  does not reject requests before they reach the app.
- The app enables Express's `trust proxy` (set to `1`) when `NODE_ENV=production`,
  so `express-rate-limit` sees the real client IP from nginx's `X-Forwarded-For`
  header. Make sure nginx sets that header (the server block below does).

A minimal server block:

```nginx
server {
  listen 443 ssl;
  server_name mailpdf.example.com;

  ssl_certificate     /etc/letsencrypt/live/mailpdf.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/mailpdf.example.com/privkey.pem;

  client_max_body_size 25m;

  location / {
    proxy_pass http://127.0.0.1:6245;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## Routes

- POST /upload
- POST /verify_address
- POST /checkout
- POST /finalize
- GET /track/{packageID}

## Todo

- Email sending
- Testing
