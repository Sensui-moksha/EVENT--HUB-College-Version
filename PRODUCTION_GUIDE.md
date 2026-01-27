# EventHub Production Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Setup](#detailed-setup)
4. [Environment Configuration](#environment-configuration)
5. [Building for Production](#building-for-production)
6. [Running in Production](#running-in-production)
7. [Nginx Configuration](#nginx-configuration)
8. [PM2 Process Management](#pm2-process-management)
9. [SSL/HTTPS Setup](#sslhttps-setup)
10. [cPanel Deployment](#cpanel-deployment)
11. [**cPanel Frontend + College VM Backend (Recommended)**](#cpanel-frontend--college-vm-backend-recommended-setup)
12. [Linux VM with MongoDB (Standalone)](#linux-vm-with-mongodb-standalone)
13. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js**: v18.x or higher (v20.x recommended)
- **MongoDB**: v6.0 or higher (local or MongoDB Atlas)
- **npm** or **yarn**: Latest version
- **PM2** (optional): For production process management
- **Nginx** (optional): For reverse proxy and SSL termination

---

## Quick Start

### 1. Clone and Install
```bash
# Clone the repository
git clone <your-repo-url>
cd eventhub

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 2. Configure Environment
```bash
# Frontend (root directory)
cp .env.production.example .env.production

# Backend (server directory)
cp server/.env.production.example server/.env.production
```

Edit both `.env.production` files with your configuration.

### 3. Build Frontend
```bash
npm run build
```

### 4. Start Production Server
```bash
cd server
NODE_ENV=production node index.js
```

Or with PM2:
```bash
pm2 start server/index.js --name eventhub-api -i max
```

---

## Detailed Setup

### Frontend Configuration

Create `.env.production` in the root directory:

```env
# If backend is on the same domain (recommended):
VITE_API_URL=

# If backend is on a different domain:
VITE_API_URL=https://api.yourdomain.com

# Socket.IO URL (usually same as API)
VITE_SOCKET_URL=
```

### Backend Configuration

Create `server/.env.production`:

```env
NODE_ENV=production
PORT=5001

# MongoDB - Use a production database
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/eventhub

# Session Secret - Generate a secure random string
SESSION_SECRET=<64-character-random-hex-string>

# CORS - Specify your frontend domains
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Frontend URL
FRONTEND_URL=https://yourdomain.com
```

Generate a secure session secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Building for Production

### Frontend Build
```bash
# From root directory
npm run build
```

This creates a `dist` folder with optimized static files.

### Backend Preparation
```bash
cd server
npm install --production
```

---

## Running in Production

### Option 1: Direct Node.js
```bash
cd server
NODE_ENV=production node index.js
```

### Option 2: PM2 (Recommended)
```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
cd server
pm2 start index.js --name eventhub-api --env production

# Enable startup on system boot
pm2 startup
pm2 save

# Monitor
pm2 monit
```

### Option 3: Docker (Advanced)
Create a `Dockerfile` for containerized deployment.

---

## Nginx Configuration

### Single Domain Setup (Frontend + Backend)

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL Certificates
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Frontend static files
    root /var/www/eventhub/dist;
    index index.html;
    
    # Handle SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API Proxy
    location /api {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeouts for uploads
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Socket.IO
    location /socket.io {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Media files (uploads)
    location /uploads {
        proxy_pass http://localhost:5001;
        proxy_set_header Host $host;
        proxy_cache_valid 200 1d;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Separate Domain Setup (API on subdomain)

Frontend Nginx (`yourdomain.com`):
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    root /var/www/eventhub/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Backend Nginx (`api.yourdomain.com`):
```nginx
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## PM2 Process Management

### PM2 Ecosystem File

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'eventhub-api',
    script: './server/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 5001
    },
    max_memory_restart: '500M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true
  }]
};
```

### PM2 Commands
```bash
# Start with ecosystem file
pm2 start ecosystem.config.js --env production

# Restart
pm2 restart eventhub-api

# Stop
pm2 stop eventhub-api

# View logs
pm2 logs eventhub-api

# Monitor
pm2 monit
```

---

## SSL/HTTPS Setup

### Using Let's Encrypt (Certbot)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal test
sudo certbot renew --dry-run
```

---

## Troubleshooting

### CORS Errors

**Symptom**: Browser shows CORS error when making API requests.

**Solution**:
1. Check `ALLOWED_ORIGINS` in server `.env.production`
2. Ensure the origin includes protocol: `https://yourdomain.com`
3. Verify Nginx is passing correct headers

### Connection Refused

**Symptom**: Frontend can't connect to API.

**Solution**:
1. Check if server is running: `pm2 status`
2. Verify PORT matches Nginx proxy_pass
3. Check firewall rules: `sudo ufw status`

### Session Issues

**Symptom**: Users get logged out unexpectedly.

**Solution**:
1. Ensure `SESSION_SECRET` is set and consistent
2. Check cookie settings in production
3. Verify Nginx is passing headers correctly

### Socket.IO Not Connecting

**Symptom**: Real-time features don't work.

**Solution**:
1. Check Nginx WebSocket configuration
2. Ensure `/socket.io` location block exists
3. Verify Connection and Upgrade headers are passed

### File Upload Failures

**Symptom**: Large file uploads fail.

**Solution**:
1. Increase Nginx `client_max_body_size`:
   ```nginx
   client_max_body_size 50M;
   ```
2. Increase proxy timeouts
3. Check disk space and permissions

### Database Connection Issues

**Symptom**: Server can't connect to MongoDB.

**Solution**:
1. Verify `MONGODB_URI` is correct
2. Check network access (MongoDB Atlas whitelist)
3. Ensure MongoDB service is running

---

## cPanel Deployment

### Overview
cPanel hosting typically doesn't support Node.js natively. You have two options:

### Option 1: cPanel with Node.js Support (CloudLinux)

Some hosts offer Node.js via CloudLinux. Check if your host supports this.

#### Step 1: Access Node.js Setup
1. Log into cPanel
2. Find "Setup Node.js App" under Software section
3. Click "Create Application"

#### Step 2: Configure Application
```
Node.js version: 18.x or 20.x
Application mode: Production
Application root: eventhub/server
Application URL: yourdomain.com
Application startup file: index.js
```

#### Step 3: Upload Files
1. Use File Manager or FTP to upload:
   - `server/` folder contents to `eventhub/server/`
   - Built `dist/` folder to `public_html/` or subdomain folder

#### Step 4: Set Environment Variables
In cPanel Node.js app settings, add:
```
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/eventhub
SESSION_SECRET=your-secret-key
ALLOWED_ORIGINS=https://yourdomain.com
```

#### Step 5: Install Dependencies
Click "Run NPM Install" in cPanel Node.js interface, or via SSH:
```bash
cd ~/eventhub/server
npm install --production
```

#### Step 6: Start Application
Click "Start App" in cPanel interface.

---

## cPanel Frontend + College VM Backend (Recommended Setup)

This setup is ideal when:
- You have cPanel hosting for the frontend (public website)
- Backend runs on a local Ubuntu VM in your college/organization
- You want to keep the database local for security/compliance

### Architecture Overview

Since both cPanel and the backend VM are on the **same college network**, you can directly connect them using the VM's local IP address - no tunneling required!

```
┌─────────────────────────────────────────────────────────────────┐
│                    College Network                               │
│                                                                  │
│  ┌─────────────────────┐         ┌─────────────────────────┐   │
│  │   cPanel Server     │         │   Ubuntu VM             │   │
│  │  (Frontend - React) │◄───────►│  (Backend + MongoDB)    │   │
│  │                     │  HTTP   │                         │   │
│  │  192.168.1.100      │         │  192.168.1.50:5001      │   │
│  │  or college domain  │         │  (local network IP)     │   │
│  └─────────────────────┘         └─────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Step 1: Get Your VM's IP Address

On your Ubuntu VM, find the local IP:
```bash
# Get IP address
ip addr show | grep "inet "

# Or simpler
hostname -I
```

You'll see something like `192.168.1.50` or `10.0.0.50` - this is your VM's local IP.

### Step 2: Setup Backend on College Ubuntu VM

#### 2.1 Install Required Software
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install MongoDB
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
   sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt update && sudo apt install -y mongodb-org
sudo systemctl start mongod && sudo systemctl enable mongod

# Install PM2
sudo npm install -g pm2
```

#### 2.2 Clone and Setup Backend
```bash
# Create directory
mkdir -p /opt/eventhub
cd /opt/eventhub

# Clone only server folder or copy files
git clone <your-repo-url> .
cd server
npm install --production
```

#### 2.3 Configure Backend Environment
Create `/opt/eventhub/server/.env`:
```env
NODE_ENV=production
PORT=5001

# Local MongoDB
MONGODB_URI=mongodb://127.0.0.1:27017/eventhub

# Session secret (generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
SESSION_SECRET=your-64-character-random-secret

# IMPORTANT: Allow your cPanel domain/IP
# Use the actual domain or cPanel server IP
ALLOWED_ORIGINS=http://192.168.1.100,http://yourdomain.com,https://yourdomain.com

# Frontend URL for emails/links
FRONTEND_URL=http://yourdomain.com
```

#### 2.4 Open Firewall Port (Allow connections from cPanel server)
```bash
# Allow port 5001 from local network
sudo ufw allow from 192.168.0.0/16 to any port 5001
# Or allow from specific cPanel server IP
sudo ufw allow from 192.168.1.100 to any port 5001

# Check status
sudo ufw status
```

#### 2.5 Start Backend with PM2
```bash
cd /opt/eventhub/server
pm2 start index.js --name eventhub-api
pm2 save
pm2 startup  # Follow instructions to enable on boot
```

#### 2.6 Test Backend is Running
```bash
# From the VM itself
curl http://localhost:5001/api/health

# From another machine on the same network
curl http://192.168.1.50:5001/api/health
```

### Step 3: Build and Deploy Frontend to cPanel

#### 3.1 Configure Frontend Environment

Create `.env.production` in your project root (on your local machine):
```env
# Use the VM's local IP address directly
VITE_API_URL=http://192.168.1.50:5001

# Socket.IO URL (same as API)
VITE_SOCKET_URL=http://192.168.1.50:5001
```

**Replace `192.168.1.50` with your actual VM IP address!**

#### 3.2 Build Frontend
```bash
# In project root on your local machine
npm install
npm run build
```

This creates a `dist/` folder with optimized files.

#### 3.3 Upload to cPanel

**Method 1: File Manager (Easiest)**
1. Log into cPanel
2. Go to **File Manager** → `public_html`
3. Delete existing files (except `.htaccess` if you want to keep it)
4. Click **Upload** and upload all contents from your `dist/` folder
5. Or ZIP the `dist/` folder, upload, and extract

**Method 2: FTP**
Use FileZilla or any FTP client:
- Host: Your cPanel domain
- Username: Your cPanel username
- Password: Your cPanel password
- Upload `dist/*` contents to `public_html/`

#### 3.4 Create .htaccess for SPA Routing

Create `.htaccess` in `public_html/`:
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  
  # Handle SPA routing - redirect all to index.html
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>

# Security headers
<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  Header set X-Frame-Options "SAMEORIGIN"
</IfModule>

# Enable Gzip compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/css application/javascript application/json
</IfModule>

# Cache static assets
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
</IfModule>
```

### Step 4: Test the Connection

1. **Open your cPanel website** in a browser
2. **Open DevTools** (F12) → Network tab
3. **Try to login or load events**
4. Check that API requests go to `http://192.168.1.50:5001`
5. No CORS errors should appear in Console

### Troubleshooting (Same Network Setup)

#### "Failed to fetch" or Connection Refused
**Solution:**
1. Check VM is running: `pm2 status`
2. Check backend port is open: `sudo ufw status`
3. Test from cPanel server: `curl http://VM_IP:5001/api/health`

#### CORS Errors
**Solution:**
1. Add cPanel server IP to `ALLOWED_ORIGINS` in backend `.env`
2. Restart backend: `pm2 restart eventhub-api`

#### Can't Access from Outside College Network
This setup only works **within the college network**. For external access, see the section below.

---

## External Access (Optional): Expose Backend to Internet

If you need the app to work **outside the college network** (e.g., from home), you'll need to expose the backend. Choose ONE method:

### Option A: Cloudflare Tunnel (Recommended - Free & Secure)

Cloudflare Tunnel creates a secure connection without opening ports.

```bash
# Install cloudflared
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# Login to Cloudflare (opens browser)
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create eventhub-api

# Configure tunnel
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

Add to `config.yml`:
```yaml
tunnel: <TUNNEL_ID>
credentials-file: /home/<user>/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: api.yourdomain.com
    service: http://localhost:5001
  - service: http_status:404
```

Add DNS record:
```bash
cloudflared tunnel route dns eventhub-api api.yourdomain.com
```

Run tunnel as service:
```bash
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

Your backend is now accessible at `https://api.yourdomain.com`

**Update frontend** `.env.production`:
```env
VITE_API_URL=https://api.yourdomain.com
VITE_SOCKET_URL=https://api.yourdomain.com
```

Rebuild and re-upload to cPanel.

### Option B: ngrok (Quick Setup - Free tier available)

```bash
# Install ngrok
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
  sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && \
  echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
  sudo tee /etc/apt/sources.list.d/ngrok.list && \
  sudo apt update && sudo apt install ngrok

# Authenticate (get token from ngrok.com dashboard)
ngrok config add-authtoken <your-auth-token>

# Start tunnel (for testing)
ngrok http 5001

# For production, use ngrok with custom domain (paid)
# or create a systemd service
```

Create ngrok service for persistence:
```bash
sudo nano /etc/systemd/system/ngrok.service
```

Add:
```ini
[Unit]
Description=ngrok tunnel
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/ngrok http 5001 --log=stdout
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable ngrok
sudo systemctl start ngrok
```

**Note**: Free ngrok URLs change on restart. For stable URL, use paid plan or Cloudflare Tunnel.

### Option C: Port Forwarding (If college IT allows)

1. Get VM's local IP: `ip addr show`
2. Forward external port 5001 to VM's IP:5001 on college router
3. Use college's public IP or set up Dynamic DNS
4. Update frontend `.env.production` with the public IP/domain

---

### Maintenance Commands

**On College VM:**
```bash
# Check backend status
pm2 status

# View logs
pm2 logs eventhub-api

# Restart backend
pm2 restart eventhub-api

# Check MongoDB
sudo systemctl status mongod
```

**Updating Frontend:**
1. Make changes locally
2. Update `.env.production` if API URL changed
3. Run `npm run build`
4. Upload new `dist/` contents to cPanel `public_html/`

**Updating Backend:**
```bash
cd /opt/eventhub/server
git pull  # or copy new files
npm install --production
pm2 restart eventhub-api
```

---

## Linux VM with MongoDB (Standalone)

### Complete Setup Guide for Ubuntu/Debian VPS

This guide covers setting up EventHub on a fresh Linux VM (Ubuntu 22.04 LTS recommended).

### Step 1: Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl wget git build-essential

# Create a user for the app (optional but recommended)
sudo adduser eventhub
sudo usermod -aG sudo eventhub
```

### Step 2: Install Node.js

```bash
# Install Node.js 20.x via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version
```

### Step 3: Install MongoDB

```bash
# Import MongoDB GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg \
   --dearmor

# Add MongoDB repository (Ubuntu 22.04)
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
   sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install MongoDB
sudo apt update
sudo apt install -y mongodb-org

# Start MongoDB and enable on boot
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify MongoDB is running
sudo systemctl status mongod
```

### Step 4: Secure MongoDB

```bash
# Connect to MongoDB
mongosh

# Create admin user
use admin
db.createUser({
  user: "admin",
  pwd: "your-secure-admin-password",
  roles: ["root"]
})

# Create application user
use eventhub
db.createUser({
  user: "eventhub_user",
  pwd: "your-secure-app-password",
  roles: ["readWrite"]
})

exit
```

Enable authentication in MongoDB:
```bash
sudo nano /etc/mongod.conf
```

Add/modify:
```yaml
security:
  authorization: enabled

net:
  port: 27017
  bindIp: 127.0.0.1  # Only local connections
```

Restart MongoDB:
```bash
sudo systemctl restart mongod
```

### Step 5: Install Nginx

```bash
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Step 6: Configure Firewall

```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH, HTTP, HTTPS
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'

# Check status
sudo ufw status
```

### Step 7: Clone and Setup Application

```bash
# Clone repository
cd /var/www
sudo git clone <your-repo-url> eventhub
sudo chown -R $USER:$USER eventhub
cd eventhub

# Install frontend dependencies and build
npm install
npm run build

# Setup backend
cd server
npm install --production
```

### Step 8: Configure Environment

```bash
# Create backend .env
nano /var/www/eventhub/server/.env
```

Add:
```env
NODE_ENV=production
PORT=5001
MONGODB_URI=mongodb://eventhub_user:your-secure-app-password@127.0.0.1:27017/eventhub
SESSION_SECRET=your-64-character-random-secret
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

### Step 9: Install PM2 and Start Server

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start application
cd /var/www/eventhub/server
pm2 start index.js --name eventhub-api

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd
# Follow the instructions it gives you
```

### Step 10: Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/eventhub
```

Add:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL will be configured by Certbot
    
    root /var/www/eventhub/dist;
    index index.html;

    # Increase upload limit
    client_max_body_size 50M;

    # Frontend SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxy
    location /api {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Socket.IO
    location /socket.io {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Uploads directory
    location /uploads {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/eventhub /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 11: Setup SSL with Certbot

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### Step 12: MongoDB Backup (Recommended)

Create a backup script:
```bash
sudo nano /opt/backup-mongodb.sh
```

Add:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
mongodump --uri="mongodb://eventhub_user:password@127.0.0.1:27017/eventhub" --out="$BACKUP_DIR/backup_$DATE"
# Keep only last 7 days of backups
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} +
```

Make executable and schedule:
```bash
sudo chmod +x /opt/backup-mongodb.sh
sudo crontab -e
# Add: 0 2 * * * /opt/backup-mongodb.sh
```

### Useful Commands

```bash
# Check application status
pm2 status

# View logs
pm2 logs eventhub-api

# Restart application
pm2 restart eventhub-api

# Check MongoDB status
sudo systemctl status mongod

# Check Nginx status
sudo systemctl status nginx

# View Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

---

## Health Checks

### API Health Endpoint
```bash
curl https://yourdomain.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 12345,
  "database": "connected"
}
```

### MongoDB Health
```bash
# In server logs, check for:
# "MongoDB connected successfully"
```

---

## Security Checklist

- [ ] Use HTTPS (SSL/TLS certificates)
- [ ] Set secure `SESSION_SECRET`
- [ ] Configure `ALLOWED_ORIGINS` for CORS
- [ ] Enable rate limiting
- [ ] Use strong MongoDB credentials
- [ ] Keep Node.js and dependencies updated
- [ ] Set up firewall rules
- [ ] Use PM2 for process management
- [ ] Enable access logging
- [ ] Regular backups of MongoDB

---

## Performance Tips

1. **Enable Gzip compression** in Nginx
2. **Use CDN** for static assets
3. **Enable HTTP/2** in Nginx
4. **Scale with PM2 cluster mode**
5. **Use MongoDB indexes** appropriately
6. **Cache static files** with long expiry
7. **Video streaming**: Backend supports HTTP Range requests for chunked video loading

---

## Support

For issues, please:
1. Check server logs: `pm2 logs eventhub-api`
2. Check browser console for frontend errors
3. Verify environment configuration
4. Review Nginx error logs: `/var/log/nginx/error.log`
