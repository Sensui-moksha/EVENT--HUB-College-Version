# EventHub - Coolify Deployment Guide

Complete guide to deploy EventHub on Coolify with optimized settings for fast uploads.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Cloudflare DNS Setup](#cloudflare-dns-setup)
3. [Coolify Configuration](#coolify-configuration)
4. [Environment Variables](#environment-variables)
5. [Build & Start Commands](#build--start-commands)
6. [Post-Deployment Checklist](#post-deployment-checklist)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- [ ] A Coolify instance running
- [ ] A Cloudflare account (free tier works)
- [ ] A domain name (e.g., `mictech.dpdns.org`)
- [ ] MongoDB Atlas account (free tier works) or self-hosted MongoDB
- [ ] Gmail account for sending emails (with App Password)
- [ ] Your Git repository URL

---

## Cloudflare DNS Setup

### For Fast Uploads (Recommended - Two Subdomains)

| Type | Name | Content | Proxy Status | Purpose |
|------|------|---------|--------------|---------|
| A | `events` | `YOUR_SERVER_IP` | ☁️ Proxied (Orange) | Frontend (CDN cached) |
| A | `api.events` | `YOUR_SERVER_IP` | ☁️ DNS Only (Grey) | API (Direct, fast uploads) |

> **Important:** Setting `api.events` to DNS Only bypasses Cloudflare's upload speed limits.

### For Simple Setup (Single Domain)

| Type | Name | Content | Proxy Status |
|------|------|---------|--------------|
| A | `events` | `YOUR_SERVER_IP` | ☁️ DNS Only (Grey) |

> Note: This gives fast uploads but no CDN caching for frontend.

---

## Coolify Configuration

### 1. Create New Application

1. Go to Coolify Dashboard → **Projects** → Select/Create Project
2. Click **+ New** → **Application**
3. Select your Git source (GitHub, GitLab, etc.)
4. Select your repository and branch (usually `main`)

### 2. General Settings

| Setting | Value |
|---------|-------|
| **Application Name** | `eventhub` (or any name) |
| **Build Pack** | Nixpacks |

### 3. Domains

Add your domains (both if using two-subdomain setup):

```
events.mictech.dpdns.org
api.events.mictech.dpdns.org
```

Or single domain:
```
events.mictech.dpdns.org
```

### 4. Build & Deploy Settings

| Setting | Value |
|---------|-------|
| **Base Directory** | `/` |
| **Install Command** | `npm ci && npm --prefix server ci` |
| **Build Command** | `npm run build` |
| **Publish Directory** | `/` |
| **Start Command** | `node --max-old-space-size=4096 server/index.js` |

### 5. Port Configuration

| Setting | Value |
|---------|-------|
| **Ports Exposes** | `5001` |
| **Port Mapping** | Leave default |

---

## Environment Variables

### Required Variables (Must Set)

```env
# ===========================================
# REQUIRED - Application will not work without these
# ===========================================

# Node Environment
NODE_ENV=production

# Server Port
PORT=5001

# MongoDB Connection String (from MongoDB Atlas)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/eventhub?retryWrites=true&w=majority

# Session Secret (generate a random 64-character string)
SESSION_SECRET=your-super-secure-random-string-at-least-64-characters-long-change-this

# QR Code Secret (generate a random 32-character string)
QR_CODE_SECRET=your-secure-qr-secret-key-32chars

# Frontend URL (your main domain)
FRONTEND_URL=https://events.mictech.dpdns.org
WEBSITE_URL=https://events.mictech.dpdns.org

# API URL for frontend (use api subdomain for fast uploads)
VITE_API_URL=https://api.events.mictech.dpdns.org
```

### Email Configuration (Required for OTP & Notifications)

```env
# ===========================================
# EMAIL - Gmail SMTP Settings
# ===========================================

# Gmail address
GMAIL_USER=your-email@gmail.com

# Gmail App Password (NOT your regular password!)
# Generate at: https://myaccount.google.com/apppasswords
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# App name shown in emails
APP_NAME=EventHub
```

### Optional Variables

```env
# ===========================================
# OPTIONAL - Defaults work fine
# ===========================================

# CORS - Allowed origins (comma-separated)
# If not set, uses FRONTEND_URL automatically
ALLOWED_ORIGINS=https://events.mictech.dpdns.org,https://api.events.mictech.dpdns.org

# Session Cookie Domain (for cross-subdomain auth)
# Leave empty if using single domain
SESSION_COOKIE_DOMAIN=.mictech.dpdns.org

# Media Cache Size (in MB, default 512)
MEDIA_CACHE_SIZE_MB=512

# Health Monitor Emails (comma-separated, for alerts)
HEALTH_MONITOR_EMAILS=admin@example.com
```

### Complete .env Template

Copy this entire block to Coolify's Environment Variables section:

```env
# === REQUIRED ===
NODE_ENV=production
PORT=5001
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/eventhub?retryWrites=true&w=majority
SESSION_SECRET=change-this-to-a-64-char-random-string-use-password-generator
QR_CODE_SECRET=change-this-32-char-random-string
FRONTEND_URL=https://events.mictech.dpdns.org
WEBSITE_URL=https://events.mictech.dpdns.org
VITE_API_URL=https://api.events.mictech.dpdns.org

# === EMAIL ===
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
APP_NAME=EventHub

# === OPTIONAL ===
ALLOWED_ORIGINS=https://events.mictech.dpdns.org,https://api.events.mictech.dpdns.org
SESSION_COOKIE_DOMAIN=.mictech.dpdns.org
MEDIA_CACHE_SIZE_MB=512
```

---

## Build & Start Commands

### Quick Reference

| Command | Purpose | Where Used |
|---------|---------|------------|
| `npm ci` | Install frontend dependencies | Coolify Install Command |
| `npm --prefix server ci` | Install backend dependencies | Coolify Install Command |
| `npm run build` | Build React frontend | Coolify Build Command |
| `node --max-old-space-size=4096 server/index.js` | Start server with 4GB heap | Coolify Start Command |

### Full Commands for Coolify

**Install Command:**
```bash
npm ci && npm --prefix server ci
```

**Build Command:**
```bash
npm run build
```

**Start Command:**
```bash
node --max-old-space-size=4096 server/index.js
```

### What Each Part Does

| Part | Explanation |
|------|-------------|
| `npm ci` | Clean install of frontend packages (faster than `npm install`) |
| `npm --prefix server ci` | Install packages in `server/` folder |
| `npm run build` | Runs Vite to build React app to `dist/` folder |
| `--max-old-space-size=4096` | Allows Node.js to use up to 4GB RAM (for large video processing) |
| `server/index.js` | Main backend file that serves both API and frontend |

---

## Post-Deployment Checklist

After deployment, verify everything works:

### 1. Check Application Logs
In Coolify → Your App → **Logs**, look for:
```
✅ Connected to MongoDB
✅ GridFS bucket initialized
🚀 Server running on port 5001
```

### 2. Test Endpoints

| Test | URL | Expected |
|------|-----|----------|
| Frontend | `https://events.mictech.dpdns.org` | Login page loads |
| API Health | `https://api.events.mictech.dpdns.org/api/health` | `{"status":"ok"}` |
| Database | `https://api.events.mictech.dpdns.org/api/health/status` | Shows DB connected |

### 3. Test Upload Speed

1. Login as admin/organizer
2. Go to Gallery → Upload a 10MB+ file
3. Check upload speed (should be > 1 Mbps with DNS-only API subdomain)

### 4. Test Email

1. Go to Register page
2. Enter email and request OTP
3. Check inbox for OTP email

---

## Troubleshooting

### Common Issues

#### 1. "Cannot connect to MongoDB"
```
Error: MongoNetworkError
```
**Fix:** 
- Check `MONGODB_URI` is correct
- In MongoDB Atlas → Network Access → Add IP `0.0.0.0/0` (allow all)

#### 2. "CORS Error" in browser console
```
Access-Control-Allow-Origin
```
**Fix:**
- Add both domains to `ALLOWED_ORIGINS`
- Set `SESSION_COOKIE_DOMAIN=.mictech.dpdns.org` (note the leading dot)

#### 3. Upload stuck at 0% or fails
```
ERR_HTTP2_PROTOCOL_ERROR
```
**Fix:**
- Set API subdomain to DNS Only (grey cloud) in Cloudflare
- Check rate limits aren't too strict

#### 4. "Session not persisting" / "Login not working"
**Fix:**
- Set `SESSION_COOKIE_DOMAIN=.mictech.dpdns.org`
- Ensure both domains are in `ALLOWED_ORIGINS`

#### 5. Build fails with "Out of memory"
```
FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed
```
**Fix:**
- Increase Coolify container memory limit to 4GB+
- Or add to build command: `NODE_OPTIONS=--max-old-space-size=4096 npm run build`

#### 6. Emails not sending
**Fix:**
- Verify `GMAIL_APP_PASSWORD` is an App Password, not regular password
- Generate at: https://myaccount.google.com/apppasswords
- Enable 2FA on Gmail first

### Useful Debug Commands

Run these in Coolify terminal or logs:

```bash
# Check environment variables are set
echo $MONGODB_URI
echo $NODE_ENV

# Test MongoDB connection
node -e "require('mongoose').connect(process.env.MONGODB_URI).then(() => console.log('OK')).catch(e => console.log(e))"

# Check disk space (for uploads)
df -h

# Check memory usage
free -m
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        USER BROWSER                          │
└─────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
┌─────────────────────┐             ┌─────────────────────┐
│   events.mictech    │             │ api.events.mictech  │
│   (Cloudflare CDN)  │             │   (DNS Only)        │
│   Orange Cloud ☁️   │             │   Grey Cloud ☁️     │
└─────────────────────┘             └─────────────────────┘
            │                                   │
            │         ┌───────────────┐         │
            └────────►│   COOLIFY     │◄────────┘
                      │   Container   │
                      │               │
                      │ ┌───────────┐ │
                      │ │  Node.js  │ │
                      │ │  Server   │ │
                      │ │ (port 5001)│ │
                      │ └─────┬─────┘ │
                      │       │       │
                      │       ▼       │
                      │ ┌───────────┐ │
                      │ │  dist/    │ │
                      │ │ (React)   │ │
                      │ └───────────┘ │
                      └───────┬───────┘
                              │
                              ▼
                      ┌───────────────┐
                      │ MongoDB Atlas │
                      │   (GridFS)    │
                      └───────────────┘
```

---

## Quick Start Summary

1. **Cloudflare DNS:**
   - `events` → Your IP → Proxied (orange)
   - `api.events` → Your IP → DNS Only (grey)

2. **Coolify Domains:**
   ```
   events.mictech.dpdns.org
   api.events.mictech.dpdns.org
   ```

3. **Coolify Commands:**
   - Install: `npm ci && npm --prefix server ci`
   - Build: `npm run build`
   - Start: `node --max-old-space-size=4096 server/index.js`

4. **Key Environment Variables:**
   ```env
   NODE_ENV=production
   PORT=5001
   MONGODB_URI=your-mongodb-uri
   SESSION_SECRET=random-64-chars
   FRONTEND_URL=https://events.mictech.dpdns.org
   VITE_API_URL=https://api.events.mictech.dpdns.org
   GMAIL_USER=your-email
   GMAIL_APP_PASSWORD=your-app-password
   ```

5. **Deploy & Test!**

---

*Last updated: February 2026*
