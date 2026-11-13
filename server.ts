import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
app.use(express.json({ limit: '15mb' }));

// Initialize server-side Gemini client if key is available
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Simple in-memory rate limiter for API routes
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, maxRequests = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count += 1;
  return true;
}

// Health & capabilities check
app.get('/api/health', (_req, res) => {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
  const hasGiphy = Boolean(process.env.GIPHY_API_KEY);
  const hasTenor = Boolean(process.env.TENOR_API_KEY);
  const hasTurn = Boolean(process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL);
  res.json({
    ok: true,
    service: 'CHIT CHAT',
    capabilities: {
      geminiAI: hasGemini,
      gifs: hasGiphy || hasTenor,
      gifProvider: hasGiphy ? 'giphy' : hasTenor ? 'tenor' : null,
      turnServer: hasTurn,
    },
  });
});

// WebRTC STUN/TURN ICE server configuration
app.get('/api/rtc/ice-servers', (_req, res) => {
  const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    iceServers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }

  res.json({
    iceServers,
    turnConfigured: Boolean(process.env.TURN_URL),
  });
});

// Authorized GIPHY / Tenor GIF API proxy (no fake placeholder GIFs)
interface GifResult {
  id: string;
  title: string;
  previewUrl: string;
  url: string;
  width: number;
  height: number;
}

async function fetchFromGifProvider(endpoint: 'trending' | 'search', query = '', limit = 24): Promise<{ configured: boolean; provider?: string; gifs: GifResult[]; error?: string }> {
  const giphyKey = process.env.GIPHY_API_KEY;
  const tenorKey = process.env.TENOR_API_KEY;

  if (!giphyKey && !tenorKey) {
    return {
      configured: false,
      gifs: [],
      error: 'GIF API key not configured. Add GIPHY_API_KEY or TENOR_API_KEY in environment secrets to load live animated GIFs.',
    };
  }

  if (giphyKey) {
    const url =
      endpoint === 'trending'
        ? `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(giphyKey)}&limit=${limit}&rating=pg-13`
        : `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(giphyKey)}&q=${encodeURIComponent(query)}&limit=${limit}&rating=pg-13`;

    const resp = await fetch(url);
    if (!resp.ok) {
      return { configured: true, provider: 'giphy', gifs: [], error: `GIPHY API returned status ${resp.status}` };
    }
    const json = (await resp.json()) as {
      data?: Array<{
        id: string;
        title?: string;
        images?: {
          fixed_height?: { url: string; width: string; height: string };
          original?: { url: string; width: string; height: string };
        };
      }>;
    };
    const gifs: GifResult[] = (json.data || [])
      .filter((item) => item.images?.fixed_height?.url || item.images?.original?.url)
      .map((item) => ({
        id: item.id,
        title: item.title || 'GIF',
        previewUrl: item.images?.fixed_height?.url || item.images?.original?.url || '',
        url: item.images?.original?.url || item.images?.fixed_height?.url || '',
        width: Number(item.images?.fixed_height?.width || 200),
        height: Number(item.images?.fixed_height?.height || 200),
      }));
    return { configured: true, provider: 'giphy', gifs };
  }

  const tenorUrl =
    endpoint === 'trending'
      ? `https://tenor.googleapis.com/v2/featured?key=${encodeURIComponent(tenorKey!)}&client_key=chitchat_web&limit=${limit}`
      : `https://tenor.googleapis.com/v2/search?key=${encodeURIComponent(tenorKey!)}&client_key=chitchat_web&q=${encodeURIComponent(query)}&limit=${limit}`;

  const resp = await fetch(tenorUrl);
  if (!resp.ok) {
    return { configured: true, provider: 'tenor', gifs: [], error: `Tenor API returned status ${resp.status}` };
  }
  const json = (await resp.json()) as {
    results?: Array<{
      id: string;
      content_description?: string;
      media_formats?: {
        tinygif?: { url: string; dims?: number[] };
        gif?: { url: string; dims?: number[] };
      };
    }>;
  };
  const gifs: GifResult[] = (json.results || [])
    .filter((item) => item.media_formats?.tinygif?.url || item.media_formats?.gif?.url)
    .map((item) => ({
      id: item.id,
      title: item.content_description || 'GIF',
      previewUrl: item.media_formats?.tinygif?.url || item.media_formats?.gif?.url || '',
      url: item.media_formats?.gif?.url || item.media_formats?.tinygif?.url || '',
      width: item.media_formats?.tinygif?.dims?.[0] || 200,
      height: item.media_formats?.tinygif?.dims?.[1] || 200,
    }));

  return { configured: true, provider: 'tenor', gifs };
}

app.get('/api/gifs/trending', async (req, res) => {
  const ip = req.ip || 'global';
  if (!checkRateLimit(`gif:${ip}`, 60, 60_000)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
  }
  try {
    const result = await fetchFromGifProvider('trending');
    if (!result.configured) return res.status(503).json(result);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ configured: true, gifs: [], error: err instanceof Error ? err.message : 'Failed to load GIFs' });
  }
});

app.get('/api/gifs/search', async (req, res) => {
  const ip = req.ip || 'global';
  if (!checkRateLimit(`gif:${ip}`, 60, 60_000)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
  }
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    return res.json({ configured: true, gifs: [] });
  }
  try {
    const result = await fetchFromGifProvider('search', q);
    if (!result.configured) return res.status(503).json(result);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ configured: true, gifs: [], error: err instanceof Error ? err.message : 'GIF search failed' });
  }
});

// Server-side Message Translation via Gemini
app.post('/api/ai/translate', async (req, res) => {
  const ip = req.ip || 'global';
  if (!checkRateLimit(`ai:${ip}`, 40, 60_000)) {
    return res.status(429).json({ error: 'Translation rate limit exceeded.' });
  }
  const { text, targetLanguage } = req.body as { text?: string; targetLanguage?: string };
  if (!text || typeof text !== 'string' || !targetLanguage || typeof targetLanguage !== 'string') {
    return res.status(400).json({ error: 'text and targetLanguage are required.' });
  }
  if (text.length > 4000) {
    return res.status(400).json({ error: 'Text exceeds maximum length of 4000 characters.' });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({ error: 'GEMINI_API_KEY is not configured in server secrets.' });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Translate the following chat message accurately into ${targetLanguage}. Return ONLY the translated text without quotes, explanations, or extra formatting.\n\nMessage:\n${text}`,
    });
    return res.json({ translatedText: (response.text || '').trim(), targetLanguage });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Translation failed.' });
  }
});

// Server-side Voice Note Transcription via Gemini
app.post('/api/ai/transcribe', async (req, res) => {
  const ip = req.ip || 'global';
  if (!checkRateLimit(`ai:${ip}`, 20, 60_000)) {
    return res.status(429).json({ error: 'Transcription rate limit exceeded.' });
  }
  const { audioBase64, mimeType, mediaUrl } = req.body as {
    audioBase64?: string;
    mimeType?: string;
    mediaUrl?: string;
  };

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({ error: 'GEMINI_API_KEY is not configured in server secrets.' });
  }

  try {
    let base64Data = audioBase64 || '';
    let resolvedMime = mimeType || 'audio/webm';

    if (!base64Data && mediaUrl && typeof mediaUrl === 'string' && mediaUrl.startsWith('https://')) {
      const audioResp = await fetch(mediaUrl);
      if (!audioResp.ok) {
        return res.status(400).json({ error: 'Unable to fetch audio file for transcription.' });
      }
      resolvedMime = audioResp.headers.get('content-type') || resolvedMime;
      const arrBuf = await audioResp.arrayBuffer();
      base64Data = Buffer.from(arrBuf).toString('base64');
    }

    if (!base64Data) {
      return res.status(400).json({ error: 'Audio payload or valid HTTPS mediaUrl is required.' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: resolvedMime.split(';')[0],
              data: base64Data,
            },
          },
          { text: 'Transcribe this voice message verbatim. Return only the spoken words.' },
        ],
      },
    });
    return res.json({ transcript: (response.text || '').trim() });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Transcription failed.' });
  }
});

// Create HTTP server and attach WebSocket Server for real-time presence, typing & WebRTC relay
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

interface ClientSocket extends WebSocket {
  uid?: string;
  isAlive?: boolean;
}

const userConnections = new Map<string, Set<ClientSocket>>();

function sendToUser(uid: string, payload: unknown) {
  const sockets = userConnections.get(uid);
  if (!sockets) return;
  const raw = JSON.stringify(payload);
  for (const sock of sockets) {
    if (sock.readyState === WebSocket.OPEN) {
      sock.send(raw);
    }
  }
}

wss.on('connection', (ws: ClientSocket) => {
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (rawData) => {
    try {
      const msg = JSON.parse(rawData.toString()) as {
        type: string;
        uid?: string;
        targetUids?: string[];
        chatId?: string;
        activity?: 'typing' | 'recording' | 'uploading' | 'idle';
        payload?: unknown;
      };

      if (msg.type === 'auth' && msg.uid) {
        ws.uid = msg.uid;
        if (!userConnections.has(msg.uid)) {
          userConnections.set(msg.uid, new Set());
        }
        userConnections.get(msg.uid)!.add(ws);
        ws.send(JSON.stringify({ type: 'auth:ok', uid: msg.uid }));
        return;
      }

      if (!ws.uid) return;

      if (msg.type === 'chat:activity' && Array.isArray(msg.targetUids) && msg.chatId) {
        for (const targetUid of msg.targetUids) {
          if (targetUid !== ws.uid) {
            sendToUser(targetUid, {
              type: 'chat:activity',
              fromUid: ws.uid,
              chatId: msg.chatId,
              activity: msg.activity || 'idle',
            });
          }
        }
        return;
      }

      if (msg.type === 'rtc:signal' && Array.isArray(msg.targetUids)) {
        for (const targetUid of msg.targetUids) {
          if (targetUid !== ws.uid) {
            sendToUser(targetUid, {
              type: 'rtc:signal',
              fromUid: ws.uid,
              payload: msg.payload,
            });
          }
        }
        return;
      }

      if (msg.type === 'presence:ping' && Array.isArray(msg.targetUids)) {
        const onlineMap: Record<string, boolean> = {};
        for (const targetUid of msg.targetUids) {
          const conns = userConnections.get(targetUid);
          onlineMap[targetUid] = Boolean(conns && conns.size > 0);
        }
        ws.send(JSON.stringify({ type: 'presence:state', onlineMap }));
      }
    } catch {
      // Ignore malformed payloads
    }
  });

  ws.on('close', () => {
    if (ws.uid) {
      const set = userConnections.get(ws.uid);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          userConnections.delete(ws.uid);
        }
      }
    }
  });
});

// Heartbeat interval to clean up dead sockets
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    const client = ws as ClientSocket;
    if (client.isAlive === false) {
      client.terminate();
      continue;
    }
    client.isAlive = false;
    client.ping();
  }
}, 30_000);

wss.on('close', () => {
  clearInterval(heartbeat);
});

// Vite dev middleware or production static assets
async function attachFrontend() {
  if (!isProduction && fs.existsSync(path.join(__dirname, 'vite.config.ts'))) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`CHIT CHAT server listening on http://0.0.0.0:${PORT}`);
  });
}

attachFrontend();
