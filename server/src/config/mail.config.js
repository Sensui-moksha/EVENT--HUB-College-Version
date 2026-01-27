/**
 * Mail Configuration Module
 * Configures Nodemailer with Gmail SMTP service
 */

import nodemailer from 'nodemailer';

// Validate required environment variables
const validateMailConfig = () => {
  const required = ['GMAIL_USER', 'GMAIL_APP_PASSWORD'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn(`⚠️ Missing mail configuration: ${missing.join(', ')}`);
    console.warn('Email functionality will be disabled');
    return false;
  }
  return true;
};

// Create reusable transporter object using Gmail SMTP
const createTransporter = () => {
  if (!validateMailConfig()) {
    return null;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    // Production-ready settings
    pool: true, // Use pooled connections
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5, // 5 messages per second max
  });

  return transporter;
};

// Verify transporter connection
const verifyConnection = async (transporter) => {
  if (!transporter) {
    // ...removed console log for production...
    return false;
  }

  try {
    await transporter.verify();
    // ...removed console log for production...
    return true;
  } catch (error) {
    console.error('❌ Mail server connection failed:', error.message);
    return false;
  }
};

// Mail configuration object
const mailConfig = {
  from: {
    name: process.env.APP_NAME || 'EventHub',
    address: process.env.GMAIL_USER,
  },
  get fromString() {
    return `"${this.from.name}" <${this.from.address}>`;
  },
};

// Create and export transporter instance
let transporter = null;

const initializeMailTransporter = async () => {
  transporter = createTransporter();
  if (transporter) {
    await verifyConnection(transporter);
  }
  return transporter;
};

const getTransporter = () => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

export {
  createTransporter,
  verifyConnection,
  mailConfig,
  initializeMailTransporter,
  getTransporter,
};
