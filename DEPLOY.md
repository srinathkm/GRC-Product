# Docker deployment (minimal steps)

Deploy Raqib as a single Docker container. The image builds the React client and serves it with the Express API on one port.

## Prerequisites

- **Docker** and **Docker Compose** (v2+) on the host.
- The host should have a **static IP** (or hostname) if others will access it.

## Option A: One-command deploy (recommended)

1. Copy or clone the project to the server (no need to run `npm install` on the host).

2. From the project root, run:

   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

   This will:
   - Create `.env` from `.env.example` if `.env` does not exist
   - Build the Docker image (client + server)
   - Start the container in the background

3. Open **http://localhost:3001** on the host, or **http://\<host-ip\>:3001** from other machines (ensure port 3001 is allowed in the firewall).

## Option B: Manual steps

```bash
# 1. Create env (optional; needed for API keys / SMTP)
cp .env.example .env
# Edit .env if you need OPENAI_API_KEY, SMTP, etc.

# 2. Build and run
docker compose build
docker compose up -d
```

## What to copy when moving to another host

Copy the whole project folder (or a tarball of it). You do **not** need to copy:

- `node_modules` (anywhere)
- `client/node_modules`, `server/node_modules`
- `.git` (optional; omit for a smaller package)

**Minimum set of files for deployment:**

- `client/` (source only; no `client/node_modules`)
- `server/` (source only; no `server/node_modules`)
- `Dockerfile.server`
- `docker-compose.yml`
- `.env.example`
- `deploy.sh`
- `package.json`, `package-lock.json` (root)
- `client/package.json`, `client/package-lock.json`
- `server/package.json`, `server/package-lock.json`
- `.dockerignore`

Creating a tarball for transfer (from the project root, excludes node_modules and .git):

```bash
tar --exclude='node_modules' --exclude='client/node_modules' --exclude='server/node_modules' --exclude='.git' -czvf raqib-docker.tar.gz .
```

On the target host:

```bash
mkdir raqib && cd raqib && tar -xzvf /path/to/raqib-docker.tar.gz
./deploy.sh
```

## Useful commands

| Action        | Command                    |
|---------------|----------------------------|
| View logs     | `docker compose logs -f`   |
| Stop          | `docker compose down`      |
| Restart       | `docker compose restart`   |
| Rebuild       | `docker compose build --no-cache && docker compose up -d` |

## Macvlan: container with its own static IP

**Requires a Linux host** (macvlan is not supported on Docker Desktop for Mac in the same way). The container gets its own IP on your LAN so others reach it at `http://<container-ip>:3001` without using the host’s IP.

### 1. Find the host’s interface and LAN details

On the host:

```bash
ip route
# or: ip addr
```

Note the main interface (e.g. `eth0`, `ens18`) and your subnet/gateway (e.g. `192.168.1.0/24`, gateway `192.168.1.1`).

### 2. Create the macvlan network (once)

Pick a **static IP for the container** that is outside your router’s DHCP range and not used by anything else (e.g. `192.168.1.100`). Create the network once:

```bash
docker network create -d macvlan \
  -o parent=eth0 \
  --subnet=192.168.1.0/24 \
  --gateway=192.168.1.1 \
  raqib-macvlan
```

- Replace `eth0` with your interface (e.g. `eth0`, `ens18`).
- Replace `192.168.1.0/24` and `192.168.1.1` with your LAN subnet and gateway.

### 3. Attach the app to the macvlan network

In `docker-compose.yml`:

1. **Remove** the `ports:` block for the `app` service (traffic will go to the container’s IP only).
2. **Uncomment** the `networks:` section under `app` and at the bottom of the file.
3. Set `ipv4_address` to your chosen IP (e.g. `192.168.1.100`):

```yaml
services:
  app:
    # ... build, image, environment, env_file, healthcheck ...
    networks:
      raqib-macvlan:
        ipv4_address: 192.168.1.100

networks:
  raqib-macvlan:
    external: true
```

### 4. Start the stack

```bash
docker compose up -d --build
```

Access the app at **http://192.168.1.100:3001** (from other machines on the LAN). The host itself often cannot reach that IP (macvlan limitation); use another device or the host’s own IP with port publishing if you keep `ports:` for local access.

### 5. Optional: keep host port as well

To reach the app both at the container IP and at the host (e.g. `http://host-ip:3001`), keep `ports: - "3001:3001"` and add the macvlan network as a second network. The container will have two IPs; both will work.

---

## Environment

- `.env` is loaded by Compose. Copy from `.env.example` and set `OPENAI_API_KEY` (and optionally SMTP) if you use those features.
- The app listens on `0.0.0.0:3001` inside the container so it accepts connections on the host’s IP.
