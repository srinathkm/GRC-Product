# GRC Dashboard – Docker Deployment Design

This document describes how to build and run the GRC (Governance, Risk, Compliance) Dashboard in a Docker environment. It covers architecture, Dockerfiles, Docker Compose, environment variables, and operational steps for both development and production-style runs.

---

## 1. Overview

- **Application:** GRC Dashboard – React (Vite) front end + Express (Node.js) back end; regulatory changes, parent holdings, OpCos, onboarding, UBO, ESG, multi-jurisdiction, analysis.
- **Purpose:** Run the full stack (and optionally PostgreSQL) in containers for consistent, reproducible environments.
- **Outcome:** One-command startup for local or CI; same layout can be extended for production (secrets, TLS, managed DB).

---

## 2. Prerequisites

- **Docker** 24+ (or Docker Desktop)
- **Docker Compose** v2+ (e.g. `docker compose` plugin)
- **Git** (repo clone)

Optional for local dev without Docker for front end: Node.js 20+, npm.

---

## 3. Repository Structure (Relevant to Docker)

```
regulation-changes-dashboard/
├── client/                 # React (Vite) front end
│   ├── package.json
│   ├── vite.config.*
│   └── src/
├── server/                 # Express back end
│   ├── package.json
│   ├── index.js
│   ├── data/               # JSON data (file-based; replace with DB for enterprise)
│   └── routes/
├── package.json            # Root: install:all, build, dev, start
├── docker-compose.yml      # To be created
├── Dockerfile.server       # To be created (backend image)
├── Dockerfile.client       # Optional (frontend image)
├── .env.example            # To be created (template)
└── grc_deploy.md           # This document
```

---

## 4. Docker Architecture

### 4.1 Services

| Service    | Role                                                                 | Image / Build            | Port (host) |
|-----------|----------------------------------------------------------------------|---------------------------|-------------|
| **backend**  | Express API (changes, companies, chat, PDF, email, UBO, analysis)   | Build from `Dockerfile.server` | 3001        |
| **frontend** | Static React build (optional; can be served by backend)            | Build from `Dockerfile.client`  | 80 or 5173 |
| **db**       | PostgreSQL 15+ (optional; for future DB migration)                 | `postgres:15-alpine`      | 5432        |

### 4.2 Two Deployment Modes

- **Mode A – Backend serves front end (simplest):** Build the client with `npm run build` on the host or in CI; copy `client/dist` into the backend image (or mount in dev). Single container serves both API and static assets. No separate frontend container.
- **Mode B – Separate frontend container:** Build a static image (nginx serving `client/dist`) and run backend + frontend; use a reverse proxy or frontend proxy to `/api` if needed.

This document describes **Mode A** as the default and **Mode B** as optional.

---

## 5. Dockerfile for Backend (Required)

Create **`Dockerfile.server`** in the repository root (or under `server/` and adjust paths).

```dockerfile
# Dockerfile.server
FROM node:20-alpine AS base
WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy server source
COPY server/ ./server/

# Optional: copy built client for production (Mode A)
# COPY client/dist ./server/public/

EXPOSE 3001
ENV NODE_ENV=production
WORKDIR /app/server
CMD ["node", "index.js"]
```

**Notes:**

- For **Mode A production:** Uncomment the `COPY client/dist` line and ensure the client is built before building this image (e.g. in CI: `npm run build` then `docker build -f Dockerfile.server .`).
- The server currently binds to `127.0.0.1`. For Docker it must listen on `0.0.0.0`. Either set `PORT` and use `app.listen(PORT, '0.0.0.0', ...)` or set an env such as `BIND=0.0.0.0` and use it in `server/index.js`.
- If the app serves static files in production, add in `server/index.js`:  
  `app.use(express.static(join(__dirname, 'public')));`  
  and ensure `client/dist` is copied to `server/public` in the image.

---

## 6. Dockerfile for Frontend (Optional – Mode B)

Create **`Dockerfile.client`** only if you run a separate frontend container.

```dockerfile
# Dockerfile.client
FROM node:20-alpine AS builder
WORKDIR /app
COPY client/package*.json ./client/
RUN cd client && npm ci
COPY client/ ./client/
COPY package.json package-lock.json ./
RUN cd client && npm run build

FROM nginx:alpine
COPY --from=builder /app/client/dist /usr/share/nginx/html
RUN echo 'server { root /usr/share/nginx/html; index index.html; location / { try_files $uri $uri/ /index.html; } location /api { proxy_pass http://backend:3001; proxy_http_version 1.1; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

This assumes the frontend container can resolve the hostname `backend` (Docker Compose service name). Adjust `proxy_pass` if the backend service name or port differs.

---

## 7. Docker Compose Configuration

Create **`docker-compose.yml`** in the repository root.

### 7.1 Full Example (Backend + PostgreSQL; Frontend Optional)

```yaml
# docker-compose.yml
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.server
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - BIND=0.0.0.0
      # File-based data (current app); no DB required yet
      # - DATABASE_URL=postgres://grc:grc@db:5432/grc
    env_file:
      - .env
    # When DB is introduced, uncomment:
    # depends_on:
    #   db:
    #     condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "-O", "-", "http://localhost:3001/api/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 10s

  # Optional: separate frontend (Mode B)
  # frontend:
  #   build:
  #     context: .
  #     dockerfile: Dockerfile.client
  #   ports:
  #     - "8080:80"
  #   depends_on:
  #     - backend

  # Optional: PostgreSQL (for future DB migration)
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: grc
      POSTGRES_PASSWORD: grc
      POSTGRES_DB: grc
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U grc -d grc"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 5s

volumes:
  pgdata:
```

### 7.2 Development Override (Optional)

Create **`docker-compose.override.yml`** for development:

- Mount `./server` into the backend container so code changes apply without rebuilding.

Example override (backend only, with volume):

```yaml
# docker-compose.override.yml (example)
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.server
    volumes:
      - ./server:/app/server
    environment:
      - NODE_ENV=development
```

---

## 8. Environment Variables

### 8.1 Create `.env.example` (No Secrets)

Create **`.env.example`** in the repo root. Copy to `.env` and fill in values.

```env
# Server
NODE_ENV=development
PORT=3001
BIND=0.0.0.0

# CORS (comma-separated origins or "true" for reflect)
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# AI / LLM (optional – leave empty to disable)
OPENAI_API_KEY=
# For LLM-agnostic setup (future):
# LLM_BASE_URL=https://api.openai.com/v1
# LLM_API_KEY=
# LLM_MODEL=gpt-4o-mini

# Database (optional – when migrating from JSON)
# DATABASE_URL=postgres://grc:grc@db:5432/grc

# Email (optional – for "Send changes by email")
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASS=
# SMTP_FROM=noreply@example.com
```

### 8.2 Variable Reference

| Variable          | Required | Description |
|-------------------|----------|-------------|
| `NODE_ENV`        | No       | `development` or `production`; default `production` in Docker. |
| `PORT`            | No       | Backend port; default `3001`. |
| `BIND`            | No       | Bind address; use `0.0.0.0` in Docker. |
| `CORS_ORIGIN`     | No       | Allowed origins for CORS; `true` = reflect request origin. |
| `OPENAI_API_KEY`  | No       | Enables chat, change lookup, UBO extraction, analysis AI. |
| `DATABASE_URL`    | No       | When moving to PostgreSQL; format `postgres://user:pass@host:5432/dbname`. |
| `SMTP_*` / `SMTP_FROM` | No | For email delivery of regulatory changes. |

---

## 9. Volumes and Persistence

- **PostgreSQL data:** Use a named volume `pgdata` (as in the Compose example) so data survives container restarts.
- **Server file-based data:** The app currently uses `server/data/*.json`. If you mount `./server` in dev, those files persist on the host. In a production image, they live inside the image (or you can mount a volume for `server/data` if you keep file storage temporarily).

---

## 10. Networking

- **Default Compose network:** All services join one network; backend reaches DB at hostname `db` and port `5432`.
- **Ports:** Backend `3001`, DB `5432`; frontend (Mode B) e.g. `8080:80`.
- **From host:** Use `http://localhost:3001` for API; `http://localhost:5173` when running the Vite dev server on the host.

---

## 11. Build and Run Commands

### 11.1 One-time setup

```bash
cd regulation-changes-dashboard
cp .env.example .env
# Edit .env as needed
npm run install:all
```

### 11.2 Build client (for Mode A – backend serves front end)

```bash
npm run build
```

### 11.3 Build Docker images

```bash
docker compose build
```

### 11.4 Run all services

```bash
docker compose up -d
```

- Backend: http://localhost:3001  
- API health: http://localhost:3001/api/health  
- PostgreSQL: localhost:5432 (user `grc`, db `grc`; when app uses DB)

### 11.5 View logs and stop

```bash
docker compose logs -f backend
docker compose down
```

### 11.6 Development (backend in Docker, client on host)

```bash
docker compose up -d db backend
cd client && npm run dev
```

Ensure the Vite proxy (if any) points to `http://localhost:3001` for `/api`.

---

## 12. Server Change Required for Docker

The server currently listens on `127.0.0.1`. Update **`server/index.js`** so the bind address is configurable:

- Replace: `app.listen(PORT, '127.0.0.1', () => { ... });`
- With: `const bind = process.env.BIND || '127.0.0.1';` and `app.listen(PORT, bind, () => { ... });`

Set `BIND=0.0.0.0` in Docker (as in the Compose example).

---

## 13. Production Considerations

- **Secrets:** Do not commit `.env` with real keys. Use Docker secrets, Kubernetes secrets, or a vault and inject env into the backend container.
- **TLS:** Put the backend (and frontend if separate) behind a reverse proxy (nginx, Traefik, or cloud LB) that terminates HTTPS.
- **Database:** Prefer a managed PostgreSQL instance and set `DATABASE_URL` to that; remove or don't start the `db` service in production.
- **Health:** The Compose file uses `/api/health` for the backend healthcheck; keep this endpoint and optionally add a DB connectivity check when using PostgreSQL.

---

## 14. Summary Checklist

- [ ] Add `Dockerfile.server` (and optionally `Dockerfile.client` for Mode B).
- [ ] Add `docker-compose.yml` with `backend` and optionally `db` and `frontend`.
- [ ] Add `.env.example` and copy to `.env`; configure `BIND=0.0.0.0` and any API keys.
- [ ] Change server listen address to use `BIND` in `server/index.js`.
- [ ] For Mode A: build client, copy `client/dist` into backend image, serve from `server/public`.
- [ ] Run `docker compose build` and `docker compose up -d`.
- [ ] Verify http://localhost:3001/api/health and that the app loads (via backend-served UI or host-run Vite with API proxy).

This design document provides everything needed to set up the GRC Dashboard in a Docker environment. Adjust service names, ports, and env vars to match your exact repo and deployment pipeline.
