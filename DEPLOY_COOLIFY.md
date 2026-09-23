# Deploying Konst Design CRM on Coolify

Complete step-by-step guide. No prior Coolify experience required.

---

## What you need before starting

| Item | Where to get it |
|------|----------------|
| Coolify server running | Your VPS with Coolify installed |
| Domain name pointed to your server | DNS A record → your server IP |
| GitHub repo access | `digitalvetri/interior-ulagam` |
| GROQ API key | Already in your `.env.local` |
| Better Auth secret | Run: `openssl rand -base64 32` |

---

## Step 1 — Point your domain to the Coolify server

In your domain registrar (GoDaddy / Namecheap / Cloudflare), add an **A record**:

```
Type:  A
Name:  crm          (makes crm.konstdesign.in)
Value: <your Coolify server IP>
TTL:   300
```

Wait 5–10 minutes for DNS to propagate before deploying.

---

## Step 2 — Add GitHub to Coolify

1. Open Coolify at `https://your-coolify-server`
2. Go to **Settings → Source** (top navigation)
3. Click **Add** → **GitHub App**
4. Follow the GitHub OAuth flow — allow access to the `interior-ulagam` repository
5. Click **Save**

---

## Step 3 — Create a new Project

1. Click **Projects** in the left sidebar
2. Click **+ New Project**
3. Name it: `Konst Design CRM`
4. Click **Create**

---

## Step 4 — Add the application

1. Inside the project, click **+ New Resource**
2. Choose **Application**
3. Choose **Docker Compose**
4. Select your GitHub source (set up in Step 2)
5. Select repository: `interior-ulagam`
6. Branch: `main`
7. **Docker Compose File:** type `docker-compose.coolify.yml`
8. Click **Save**

---

## Step 5 — Configure the domain

1. In the application settings, find **Domains**
2. Add your domain: `https://crm.konstdesign.in`
3. Set **Port**: `3000`
4. Enable **Force HTTPS**: yes
5. Coolify will automatically issue a Let's Encrypt SSL certificate

---

## Step 6 — Set environment variables

In Coolify's application page, click the **Environment Variables** tab.
Add each variable below. **Every row marked REQUIRED must have a real value.**

### Infrastructure secrets (generate these now)

Run this command in any terminal to generate secure passwords:
```bash
openssl rand -base64 24
```
Run it **separately** for each password — never reuse the same value.

| Variable | Value | Notes |
|----------|-------|-------|
| `POSTGRES_USER` | `interioos` | Fixed — don't change |
| `POSTGRES_PASSWORD` | *(generate one)* | REQUIRED |
| `POSTGRES_DB` | `interior_studio` | Fixed — don't change |
| `APP_DB_PASSWORD` | *(generate one)* | REQUIRED — different from POSTGRES_PASSWORD |
| `MINIO_ROOT_USER` | `interioos` | Fixed — don't change |
| `MINIO_ROOT_PASSWORD` | *(generate one, min 8 chars)* | REQUIRED |

### Application secrets

| Variable | Value | Notes |
|----------|-------|-------|
| `BETTER_AUTH_SECRET` | *(run `openssl rand -base64 32`)* | REQUIRED — 32+ chars |
| `APP_URL` | `https://crm.konstdesign.in` | Your exact domain with https:// |
| `S3_PUBLIC_URL` | `https://crm.konstdesign.in/api/public` | REQUIRED — must end in `/api/public` |

### AI

| Variable | Value |
|----------|-------|
| `GROQ_API_KEY` | *(paste your Groq API key — already in your `.env.local`)* |
| `GOOGLE_AI_API_KEY` | *(leave blank for now)* |

### WhatsApp (fill when ready, leave blank for now)

| Variable | Value |
|----------|-------|
| `WHATSAPP_PHONE_NUMBER_ID` | *(from Meta Developer Console)* |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | *(from Meta Developer Console)* |
| `WHATSAPP_ACCESS_TOKEN` | *(System User token from Meta)* |
| `WHATSAPP_VERIFY_TOKEN` | `konstdesign-wa-webhook-2026` |
| `WHATSAPP_APP_SECRET` | *(from Meta App settings)* |

### Razorpay (fill when ready, leave blank for now)

| Variable | Value |
|----------|-------|
| `RAZORPAY_KEY_ID` | *(from Razorpay Dashboard)* |
| `RAZORPAY_KEY_SECRET` | *(from Razorpay Dashboard)* |
| `RAZORPAY_WEBHOOK_SECRET` | *(from Razorpay Dashboard)* |

### Worker settings

| Variable | Value |
|----------|-------|
| `WORKER_CONCURRENCY` | `5` |
| `CRON_TZ` | `Asia/Kolkata` |

---

## Step 7 — Configure build settings

Still in the Coolify application page:

1. Click the **Build** tab
2. Set **Build Pack**: `Docker Compose`  
3. Confirm **Docker Compose File**: `docker-compose.coolify.yml`
4. Under **Pre-Deploy Command**: leave empty (the `migrate` service runs automatically)

---

## Step 8 — Deploy

1. Click the **Deploy** button (top right)
2. Watch the build logs — the first build takes **5–10 minutes** (installs packages, compiles Next.js)
3. You'll see these stages in the logs:
   - `postgres` → healthy
   - `redis` → healthy
   - `minio` → healthy
   - `minio-init` → creates buckets, exits
   - `migrate` → runs DB migrations, exits
   - `worker` → starts background job processor
   - `app` → starts, health check passes ✓

4. Once the health check passes, Coolify marks the deployment **Running**

---

## Step 9 — Create the first admin user

The app has no users yet. SSH into your Coolify server and run:

```bash
# Find the running app container
docker ps | grep interioos-app

# Open a shell in it
docker exec -it <container-id> sh

# Inside the container — create the owner account
node -e "
const res = await fetch('http://localhost:3000/api/v1/auth/register', {
  method: 'POST',
  headers: {'content-type':'application/json'},
  body: JSON.stringify({
    fullName: 'Mohammed Sheriff',
    email: 'sheriff@konstdesign.in',
    password: 'ChangeMe@123',
    role: 'owner'
  })
});
console.log(await res.json());
"
exit
```

> **Important:** Change the password immediately after first login.

---

## Step 10 — Verify everything works

Open `https://crm.konstdesign.in` in your browser:

- [ ] Login page loads (HTTPS padlock visible)
- [ ] Login with the credentials from Step 9
- [ ] Dashboard loads with no errors
- [ ] Click the sparkles button (bottom right) → AI assistant opens
- [ ] Type "hello" → AI responds

---

## Step 11 — Set up automatic deployments (optional)

Coolify can redeploy automatically whenever you push to `main`:

1. In the Coolify application page, click **Webhooks**
2. Copy the webhook URL
3. In GitHub: go to your repo → **Settings → Webhooks → Add webhook**
4. Paste the Coolify webhook URL
5. Content type: `application/json`
6. Events: **Just the push event**
7. Click **Add webhook**

Now every `git push origin main` triggers a redeploy automatically.

---

## Troubleshooting

### Build fails: "S3_PUBLIC_URL is not set"
→ Make sure you added `S3_PUBLIC_URL=https://crm.konstdesign.in/api/public` in environment variables

### App starts but login fails (connection refused)
→ The `migrate` service may have failed. Check build logs for migration errors.
→ Most common cause: wrong `POSTGRES_PASSWORD` or `APP_DB_PASSWORD`.

### "AI service unavailable" in the chatbot
→ Check that `GROQ_API_KEY` is correctly set in environment variables.

### Files / quote PDFs not loading
→ Confirm `S3_PUBLIC_URL` ends exactly in `/api/public` (no trailing slash).
→ Check MinIO is healthy: `docker logs interioos-minio-1`

### Coolify shows "Unhealthy" after deploy
→ Check app logs: `docker logs interioos-app-1 --tail 50`
→ Most common: `APP_DB_PASSWORD` doesn't match what was set during migration.

---

## Updating the app

```bash
# On your local machine — make changes, then:
git add .
git commit -m "feat: ..."
git push origin main
# → Coolify auto-deploys (if webhook is set up) OR click Deploy in Coolify UI
```

Migrations run automatically on each deploy before the app starts.

---

## Backup

The `postgres_data` and `minio_data` are Docker named volumes managed by Coolify.
To back them up manually:

```bash
# Postgres dump
docker exec interioos-postgres-1 pg_dump -U interioos interior_studio | gzip > backup_$(date +%Y%m%d).sql.gz

# Download from server to local
scp user@your-server:/path/to/backup_*.sql.gz .
```

---

*Built by DigitalVetri for Konst Design*
