
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import os from 'os';

function printAllNetworkAddresses(port: number) {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  // ...removed console logs for production...
}

function AllNetworkAddressesPlugin() {
  return {
    name: 'all-network-addresses',
    configureServer(server: any) {
      server.httpServer?.once('listening', () => {
        const address = server.httpServer.address();
        const port = typeof address === 'object' && address ? address.port : 5173;
        printAllNetworkAddresses(port);
      });
    },
  };
}

// Get local network IP for proxy target
function getLocalNetworkIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const BACKEND_PORT = 5001;
  const localIP = getLocalNetworkIP();
  
  // Use the local network IP for proxy target to work with LAN access
  // This ensures proxy works whether accessing via localhost or network IP
  const backendTarget = `http://${localIP}:${BACKEND_PORT}`;
  const wsTarget = `ws://${localIP}:${BACKEND_PORT}`;
  
  // ...removed console logs for production...
  
  return {
  plugins: [react(), AllNetworkAddressesPlugin()],
  publicDir: 'Public', // Specify the public directory
  
  // Base URL - automatically uses correct path in production
  base: '/',
  
  server: {
    host: true, // Allow LAN access
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: wsTarget,
        ws: true,
      },
      '/uploads': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
  
  // Production build configuration
  build: {
    outDir: 'dist',
    sourcemap: mode === 'development',
    // Optimize for production
    minify: 'terser' as const,
    terserOptions: {
      compress: {
        drop_console: mode === 'production', // Remove console.logs in production
      },
    } as any,
    rollupOptions: {
      output: {
        // Split chunks for better caching
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          utils: ['date-fns', 'exceljs'],
        },
      },
    },
  },
  
  // Preview server (for testing production build locally)
  preview: {
    host: true,
    port: 4173,
  },
  
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
}});
