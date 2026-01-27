#!/usr/bin/env node

/**
 * Cross-platform development server starter
 * This script ensures the project runs consistently across Windows, macOS, and Linux
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');


const isWindows = os.platform() === 'win32';

console.log(`🚀 Starting EventHub development servers on ${os.platform()}...`);

// Detect and print all local network IPs with Vite port
function printNetworkAddresses(port = 5173) {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  console.log('🌐 Accessible on your network:');
  addresses.forEach(ip => {
    console.log(`   ➜  http://${ip}:${port}/`);
  });
  console.log(`   ➜  Local:   http://localhost:${port}/`);
}

printNetworkAddresses(5173);

// Function to spawn a process with proper platform handling
function spawnProcess(command, args, options = {}) {
  const processOptions = {
    stdio: 'inherit',
    shell: isWindows,
    ...options
  };

  if (isWindows) {
    return spawn('cmd', ['/c', command, ...args], processOptions);
  } else {
    return spawn(command, args, processOptions);
  }
}

// Start frontend and backend using npm run dev
console.log('🚀 Starting both frontend and backend servers...');
const dev = spawnProcess('npm', ['run', 'dev'], {
  cwd: process.cwd(),
  env: { ...process.env, NODE_ENV: 'development' }
});

// Handle process termination
const cleanup = () => {
  console.log('\n🛑 Shutting down servers...');
  dev.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

// Handle errors
dev.on('error', (error) => {
  console.error('❌ Development servers error:', error);
});

console.log('✅ Cross-platform development script ready!');
console.log('📱 Press Ctrl+C to stop all servers');