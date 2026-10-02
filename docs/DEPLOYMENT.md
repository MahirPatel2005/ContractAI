# ContractAI Deployment Guide

This guide covers step-by-step instructions for deploying ContractAI to production across various platforms.

---

## Environment Variables Required

| Variable | Required? | Example Value | Description |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | **Yes** | `postgresql://user:pass@host:5432/contract_ai?sslmode=require` | PostgreSQL connection string |
| `GEMINI_API_KEY` | Optional | `AIzaSy...` | Enables live Gemini 2.0 Flash generation |
| `GEMINI_BASE_URL`| Optional | `https://generativelanguage.googleapis.com/v1beta` | Gemini API endpoint |
| `GEMINI_MODEL` | Optional | `gemini-2.0-flash` | Model version |
| `STORAGE_DIR` | Optional | `/tmp/storage/documents` | Custom path for file storage (defaults to `.storage/documents`) |

---

## Method 1: Vercel + Neon / Supabase (Recommended — Easiest & Free)

This is the fastest deployment method with a global CDN, automatic SSL, and zero server maintenance.

### Step 1: Create a Free PostgreSQL Database
1. Go to [Neon.tech](https://neon.tech) (or [Supabase.com](https://supabase.com)) and sign up for a free account.
2. Create a new project named `contract-ai`.
3. Copy the pooled PostgreSQL connection string:
   ```text
   postgresql://user:password@ep-xyz-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

### Step 2: Push Your Code to GitHub
1. Create a repository on GitHub (e.g. `https://github.com/<your-username>/contract-ai`).
2. In your terminal, link and push:
   ```bash
   git remote add origin https://github.com/<your-username>/contract-ai.git
   git branch -M main
   git push -u origin main
   ```

### Step 3: Run Database Migrations
Before or immediately after deploying, apply your Prisma migrations to your remote database:
```bash
DATABASE_URL="<your-neon-or-supabase-url>" npx prisma migrate deploy
```

### Step 4: Deploy on Vercel
1. Go to [Vercel.com](https://vercel.com) and click **"Add New Project"**.
2. Select your `contract-ai` GitHub repository.
3. Under **Environment Variables**, add:
   - `DATABASE_URL`: Your Neon/Supabase PostgreSQL connection string.
   - `GEMINI_API_KEY`: Your Gemini API key.
   - `GEMINI_BASE_URL`: `https://generativelanguage.googleapis.com/v1beta`
   - `GEMINI_MODEL`: `gemini-2.0-flash`
4. Click **Deploy**. Vercel will automatically build the Next.js app and assign a live production URL (`https://your-app.vercel.app`).

---

## Method 2: Railway (All-in-One: App + Postgres in One Click)

Railway hosts both the Next.js application and the PostgreSQL database in the same cloud dashboard.

1. Go to [Railway.app](https://railway.app) and click **"New Project"**.
2. Select **"Provision PostgreSQL"**.
3. In the same project, click **"New"** $\to$ **"GitHub Repo"** $\to$ choose `contract-ai`.
4. Under the Web service settings:
   - In **Variables**, click **"Add Reference"** and select `DATABASE_URL` from the PostgreSQL service.
   - Add `GEMINI_API_KEY`.
   - In **Build Command**, enter:
     ```bash
     npx prisma migrate deploy && npm run build
     ```
   - In **Start Command**, enter:
     ```bash
     npm start
     ```
5. In **Networking**, click **"Generate Domain"** to get your public URL.

---

## Method 3: Docker / Docker Compose (VPS, DigitalOcean, AWS EC2)

ContractAI includes a multi-stage `Dockerfile` and `docker-compose.yml` for self-hosting.

### Single-Command Launch with Docker Compose
1. Clone the repository onto your server:
   ```bash
   git clone https://github.com/<your-username>/contract-ai.git
   cd contract-ai
   ```
2. Create an `.env` file on your server:
   ```bash
   echo "GEMINI_API_KEY=your_key_here" > .env
   ```
3. Launch the application and PostgreSQL database:
   ```bash
   docker compose up -d --build
   ```
4. The service will automatically:
   - Start PostgreSQL 15 on port 5432
   - Apply Prisma migrations (`npx prisma migrate deploy`)
   - Start ContractAI on `http://localhost:3000`

---

## Post-Deployment Verification Checklist

Once deployed, verify your production instance:
- [ ] Visit `https://your-domain.com` — the Document Library renders cleanly.
- [ ] Upload a PDF/DOCX contract — processing passes through `queued` $\to$ `extracting` $\to$ `chunking` $\to$ `ready`.
- [ ] Open the contract and ask a question — response streams with verified green citation cards.
- [ ] Test the side-by-side contract comparison view.
- [ ] Propose and download a tracked-change DOCX redline.
