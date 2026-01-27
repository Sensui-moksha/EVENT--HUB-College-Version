# Step-by-Step Guide: Backend & Frontend Integration and Hosting

## 1. Prepare Your Codebase
- Remove all console.log statements and debug code.
- Delete unnecessary folders: `Public/screenshots`, `.vscode`, `node_modules`, `uploads` (if not needed), and any temp/test files.
- Ensure your `.env` files are set up for production (see below).

## 2. Backend Setup (Node.js + MongoDB on Ubuntu VM)
- Use your Ubuntu VM for MongoDB and backend server (see previous instructions).
- In your backend `.env`:
  ```
  MONGODB_URI=mongodb://<VM_IP>:27017/<yourdbname>
  PORT=5001
  ```
- Start backend on Ubuntu VM:
  ```bash
  npm install
  npm run start
  ```
- Use PM2 to keep backend running and auto-restart on reboot:
  ```bash
  sudo npm install -g pm2
  pm2 start server/index.js --name eventhub-backend
  pm2 save
  pm2 startup
  # Follow instructions printed by pm2 startup
  ```
- Make sure your backend is accessible via public IP and port (open firewall, port-forward if needed).

## 3. Frontend Setup (React/Vite)

## 3. Frontend Setup (React/Vite)
### A. Build Frontend
- In your frontend `.env`:
  ```
  VITE_API_BASE_URL=http://<backend_ip>:<backend_port>
  ```
- Build static files:
  ```bash
  npm install
  npm run build
  ```
- Output will be in the `dist/` folder.

### B. Hosting Frontend on CPanel
- Log in to CPanel.
- Go to File Manager > public_html (or your domain root).
- Upload contents of your `dist/` folder (not the folder itself, just the files inside).
- Make sure `index.html` is at the root.
- If using a custom domain, update DNS settings as needed.

## 4. Integration: Connect Frontend (CPanel) to Backend (Ubuntu VM)
- Since your college network is interconnected, use your VM’s private IP.
- In your frontend `.env` (on CPanel), set:
  ```
  VITE_API_BASE_URL=http://<your-ubuntu-vm-private-ip>:<backend-port>
  ```
  Example:
  ```
  VITE_API_BASE_URL=http://192.168.0.3:5001
  ```
- Build your frontend and upload the dist/ files to CPanel.
- Test by opening your frontend site and checking if it can fetch data from the backend.
- Ensure your backend firewall allows connections from the college network:
  ```bash
  sudo ufw allow 5001
  ```
- If you ever need external/public access, use Cloudflare Tunnel or request a public IP.

## 5. Cloudflare Tunneling (Optional)
- Use Cloudflare Tunnel to expose your backend securely if you don’t have a public IP.
- Follow Cloudflare Tunnel docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/

## 6. Final Checklist
- [ ] All console.log/debug code removed
- [ ] Unnecessary folders/files deleted
- [ ] .env files set for production
- [ ] Backend running on Ubuntu VM with PM2
- [ ] Frontend built and uploaded to CPanel
- [ ] API URL in frontend points to backend (Ubuntu VM)
- [ ] MongoDB running and accessible
- [ ] Firewall/ports configured
- [ ] (Optional) Cloudflare Tunnel set up

---

If you need help with any step, let me know!
