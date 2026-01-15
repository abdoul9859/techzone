import express from 'express';
import pino from 'pino';
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const PORT = process.env.PORT || 3002;
const HOST = '0.0.0.0';
const app = express();
app.use(express.json({ limit: '1mb' }));

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Compatibility: /api/sendText { phone, text }
app.post('/api/sendText', async (req, res) => {
  try {
    if (!ready || !sock) return res.status(503).json({ error: 'WhatsApp not connected' });
    const { phone, text } = req.body || {};
    const num = normalizePhone(phone);
    if (!num || !text) return res.status(400).json({ error: 'phone and text required' });
    const jid = num.endsWith('@s.whatsapp.net') ? num : `${num}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text });
    res.json({ ok: true });
  } catch (e) {
    logger.error({ err: e }, 'Send error (api/sendText)');
    res.status(500).json({ error: 'send failed' });
  }
});

// /api/sendPdf { phone, htmlUrl, filename, caption }
// Download HTML, convert to PDF, send as WhatsApp document
app.post('/api/sendPdf', async (req, res) => {
  let browser = null;
  let pdfPath = null;
  let htmlPath = null;
  try {
    if (!ready || !sock) return res.status(503).json({ error: 'WhatsApp not connected' });
    const { phone, htmlUrl, filename, caption } = req.body || {};
    const num = normalizePhone(phone);
    if (!num || !htmlUrl) return res.status(400).json({ error: 'phone and htmlUrl required' });
    
    logger.info({ htmlUrl, phone: num }, 'Generating PDF from HTML');
    
    // Download HTML using wget to bypass CSP issues
    const tmpDir = '/tmp';
    htmlPath = path.join(tmpDir, `invoice-${Date.now()}.html`);
    const { execSync } = await import('child_process');
    
    try {
      execSync(`wget -q -O "${htmlPath}" "${htmlUrl}"`, { timeout: 30000 });
      logger.info({ htmlPath, size: fs.statSync(htmlPath).size }, 'HTML downloaded');
    } catch (wgetErr) {
      logger.error({ err: wgetErr }, 'wget failed, trying curl');
      execSync(`curl -s -o "${htmlPath}" "${htmlUrl}"`, { timeout: 30000 });
      logger.info({ htmlPath, size: fs.statSync(htmlPath).size }, 'HTML downloaded via curl');
    }
    
    // Launch puppeteer and convert local HTML to PDF
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    const page = await browser.newPage();
    
    // Load local HTML file
    await page.goto(`file://${htmlPath}`, { 
      waitUntil: 'networkidle2', 
      timeout: 20000
    });
    
    // Generate PDF in temp directory
    const pdfFilename = filename || `document-${Date.now()}.pdf`;
    pdfPath = path.join(tmpDir, pdfFilename);
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });
    await browser.close();
    browser = null;
    
    logger.info({ pdfPath, size: fs.statSync(pdfPath).size }, 'PDF generated');
    
    // Send PDF via WhatsApp
    const jid = num.endsWith('@s.whatsapp.net') ? num : `${num}@s.whatsapp.net`;
    const pdfBuffer = fs.readFileSync(pdfPath);
    await sock.sendMessage(jid, {
      document: pdfBuffer,
      mimetype: 'application/pdf',
      fileName: pdfFilename,
      caption: caption || ''
    });
    
    // Cleanup
    fs.unlinkSync(pdfPath);
    pdfPath = null;
    if (htmlPath && fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
    
    logger.info({ phone: num, filename: pdfFilename }, 'PDF sent successfully');
    res.json({ ok: true });
  } catch (e) {
    logger.error({ err: e }, 'Send PDF error');
    if (browser) try { await browser.close(); } catch {}
    if (pdfPath && fs.existsSync(pdfPath)) try { fs.unlinkSync(pdfPath); } catch {}
    if (htmlPath && fs.existsSync(htmlPath)) try { fs.unlinkSync(htmlPath); } catch {}
    res.status(500).json({ error: 'send failed', message: e.message });
  }
});

let sock = null;
let lastQr = null;
let ready = false;
let reconnecting = false;

const SESSION_DIR = process.env.WHATSAPP_SESSION_DIR || './session';
fs.mkdirSync(SESSION_DIR, { recursive: true });

async function startSocket() {
  if (reconnecting) return;
  reconnecting = true;
  try {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion();
    sock = makeWASocket({
      printQRInTerminal: false,
      auth: state,
      browser: ['Techzone', 'Chrome', '1.0.0'],
      version,
      logger,
    });

    sock.ev.on('connection.update', (update) => {
      const { connection, qr, lastDisconnect } = update;
      if (qr) {
        lastQr = qr;
        ready = false;
        logger.info('QR code updated and ready');
      }
      if (connection === 'open') {
        ready = true;
        lastQr = null;
        logger.info('WhatsApp connected');
      } else if (connection === 'close') {
        ready = false;
        lastQr = null;
        const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== 401);
        logger.warn({ err: lastDisconnect?.error }, 'WhatsApp disconnected');
        if (shouldReconnect) setTimeout(startSocket, 2000);
      }
    });

    sock.ev.on('creds.update', saveCreds);
  } catch (e) {
    logger.error({ err: e }, 'Failed to start socket');
  } finally {
    reconnecting = false;
  }
}

// Utilities
function normalizePhone(raw) {
  const s = String(raw || '').replace(/[^0-9]/g, '');
  if (!s) return '';
  // If already in international format starting with country code, keep as-is
  return s;
}

async function getQrPngDataUrl() {
  if (!lastQr) return null;
  const dataUrl = await QRCode.toDataURL(lastQr, { margin: 1, width: 300 });
  return dataUrl;
}

// Endpoints
app.get('/', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html><head><meta charset="utf-8"><title>WhatsApp Gateway</title></head><body style="font-family:system-ui;padding:20px"><h2>WhatsApp Gateway</h2><ul><li><a href="/status">/status</a></li><li><a href="/qr">/qr</a></li></ul><p>Use POST /send with JSON { phone, text }.</p></body></html>`);
});

app.get('/status', async (_req, res) => {
  res.json({ connected: ready, hasQr: !!lastQr });
});

app.get('/qr', async (_req, res) => {
  try {
    if (!lastQr) return res.status(404).json({ message: ready ? 'Already connected' : 'QR not available yet' });
    const dataUrl = await getQrPngDataUrl();
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>WhatsApp QR</title></head><body style="display:flex;align-items:center;justify-content:center;height:100vh;background:#f7f7f7"><div style="text-align:center"><h3>Scannez ce QR avec WhatsApp</h3><img src="${dataUrl}" alt="QR"/><p style="color:#666">Rafraîchir si expiré</p></div></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) {
    logger.error({ err: e }, 'QR generation error');
    res.status(500).json({ error: 'QR generation error' });
  }
});

app.post('/send', async (req, res) => {
  try {
    if (!ready || !sock) return res.status(503).json({ error: 'WhatsApp not connected' });
    const { phone, text } = req.body || {};
    const num = normalizePhone(phone);
    if (!num || !text) return res.status(400).json({ error: 'phone and text required' });
    const jid = num.endsWith('@s.whatsapp.net') ? num : `${num}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text });
    res.json({ ok: true });
  } catch (e) {
    logger.error({ err: e }, 'Send error');
    res.status(500).json({ error: 'send failed' });
  }
});

// Reset session to force a new QR
app.post('/reset', async (_req, res) => {
  try {
    ready = false; lastQr = null;
    if (sock?.end) { try { await sock.end(); } catch {}
    }
    // delete session files
    try {
      for (const f of fs.readdirSync(SESSION_DIR)) {
        fs.rmSync(path.join(SESSION_DIR, f), { recursive: true, force: true });
      }
    } catch {}
    setTimeout(startSocket, 200);
    res.json({ ok: true, message: 'Session reset, reload /qr in a few seconds' });
  } catch (e) {
    logger.error({ err: e }, 'reset failed');
    res.status(500).json({ error: 'reset failed' });
  }
});

// Start HTTP server immediately
app.listen(PORT, HOST, () => {
  logger.info(`WhatsApp free gateway listening on http://${HOST}:${PORT}`);
});

// Start WhatsApp socket connection in parallel
startSocket();
