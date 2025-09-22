const http = require('http');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { randomUUID } = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const PUBLIC_DIR = ROOT_DIR;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

const defaultState = {
  referenceData: {
    coaches: ['Alex Morgan', 'Priya Patel', 'Jonas Eriksen'],
    coachees: ['Jordan Lee', 'Mina Chen', 'Samuel Ortiz', 'Taylor Brooks'],
    sessionTypes: ['1:1 Coaching', 'Career Planning', 'Onboarding Support', 'Performance Review'],
    focusAreas: ['Leadership', 'Communication', 'Strategy', 'Well-being'],
    statuses: ['Scheduled', 'Completed', 'Rescheduled', 'Cancelled'],
  },
  sessions: [],
};

let stateCache = null;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function ensureState() {
  if (stateCache) {
    return stateCache;
  }

  try {
    const raw = await fsp.readFile(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    stateCache = normalizeState(parsed);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('Unable to read state file, using defaults instead.', error);
    }
    stateCache = clone(defaultState);
    await persistState();
  }

  return stateCache;
}

async function persistState() {
  if (!stateCache) return;
  const snapshot = clone(stateCache);
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.writeFile(STATE_FILE, JSON.stringify(snapshot, null, 2), 'utf8');
}

function normalizeState(raw) {
  const referenceData = {};
  const rawReference = raw && typeof raw === 'object' ? raw.referenceData || {} : {};
  for (const key of Object.keys(defaultState.referenceData)) {
    const values = rawReference[key];
    if (Array.isArray(values)) {
      referenceData[key] = values
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0);
    } else {
      referenceData[key] = clone(defaultState.referenceData[key]);
    }
  }

  const sessions = Array.isArray(raw?.sessions)
    ? raw.sessions
        .map((session) => normalizeSession(session))
        .filter((session) => Boolean(session))
    : [];

  return { referenceData, sessions };
}

function normalizeSession(session) {
  if (!session || typeof session !== 'object') return null;
  const result = {
    id: typeof session.id === 'string' && session.id.trim().length > 0 ? session.id : randomUUID(),
    date: typeof session.date === 'string' ? session.date.trim() : '',
    coach: typeof session.coach === 'string' ? session.coach.trim() : '',
    coachee: typeof session.coachee === 'string' ? session.coachee.trim() : '',
    sessionType: typeof session.sessionType === 'string' ? session.sessionType.trim() : '',
    focusArea: typeof session.focusArea === 'string' ? session.focusArea.trim() : '',
    status: typeof session.status === 'string' ? session.status.trim() : '',
    duration: parseDuration(session.duration),
    followUp: typeof session.followUp === 'string' ? session.followUp.trim() : '',
    highlights: typeof session.highlights === 'string' ? session.highlights.trim() : '',
    actions: typeof session.actions === 'string' ? session.actions.trim() : '',
    createdAt:
      typeof session.createdAt === 'string' && session.createdAt.trim().length > 0
        ? session.createdAt
        : new Date().toISOString(),
  };

  if (!result.date || !result.coach || !result.coachee) {
    return null;
  }

  return result;
}

function parseDuration(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value >= 0 ? value : null;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return null;
}

function isReferenceCategory(category) {
  return Object.prototype.hasOwnProperty.call(defaultState.referenceData, category);
}

function isValueInUse(state, category, value) {
  return state.sessions.some((session) => {
    switch (category) {
      case 'coaches':
        return session.coach === value;
      case 'coachees':
        return session.coachee === value;
      case 'sessionTypes':
        return session.sessionType === value;
      case 'focusAreas':
        return session.focusArea === value;
      case 'statuses':
        return session.status === value;
      default:
        return false;
    }
  });
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

function safeDecodePathname(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch (error) {
    return pathname;
  }
}

async function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      chunks.push(chunk);
      size += chunk.length;
      if (size > 1_000_000) {
        req.socket.destroy();
        reject(createHttpError(413, 'Request body too large.'));
      }
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });

    req.on('error', (error) => {
      reject(error);
    });
  });
}

async function parseJsonBody(req) {
  const body = await readRequestBody(req);
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch (error) {
    throw createHttpError(400, 'Request body must be valid JSON.');
  }
}

function sendJson(res, statusCode, payload, headers = {}) {
  if (res.writableEnded) return;
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, message, headers = {}) {
  if (res.writableEnded) return;
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    ...headers,
  });
  res.end(message);
}

async function handleApi(req, res, parsedUrl) {
  const segments = parsedUrl.pathname
    .replace(/^\/+/u, '')
    .replace(/\/+/gu, '/')
    .split('/');

  if (segments[0] !== 'api') {
    throw createHttpError(404, 'Not found.');
  }

  if (segments[1] === 'state' && req.method === 'GET') {
    const state = clone(await ensureState());
    sendJson(res, 200, state);
    return;
  }

  if (segments[1] === 'sessions' && req.method === 'POST') {
    await handleCreateSession(req, res);
    return;
  }

  if (segments[1] === 'reference' && segments.length >= 3) {
    const category = segments[2];
    if (!isReferenceCategory(category)) {
      throw createHttpError(404, 'Unknown reference category.');
    }

    if (req.method === 'POST') {
      await handleAddReference(req, res, category);
      return;
    }

    if (req.method === 'DELETE') {
      await handleRemoveReference(req, res, category, parsedUrl);
      return;
    }
  }

  throw createHttpError(404, 'Endpoint not found.');
}

async function handleCreateSession(req, res) {
  const state = await ensureState();
  const payload = await parseJsonBody(req);
  const requiredFields = ['date', 'coach', 'coachee', 'sessionType', 'focusArea', 'status'];

  for (const field of requiredFields) {
    const value = typeof payload[field] === 'string' ? payload[field].trim() : '';
    if (!value) {
      throw createHttpError(400, `Field \"${field}\" is required.`);
    }
    payload[field] = value;
  }

  const session = {
    id: randomUUID(),
    date: payload.date,
    coach: payload.coach,
    coachee: payload.coachee,
    sessionType: payload.sessionType,
    focusArea: payload.focusArea,
    status: payload.status,
    duration: parseDuration(payload.duration),
    followUp: typeof payload.followUp === 'string' ? payload.followUp.trim() : '',
    highlights: typeof payload.highlights === 'string' ? payload.highlights.trim() : '',
    actions: typeof payload.actions === 'string' ? payload.actions.trim() : '',
    createdAt: new Date().toISOString(),
  };

  state.sessions.unshift(session);
  await persistState();
  sendJson(res, 201, session);
}

async function handleAddReference(req, res, category) {
  const state = await ensureState();
  const payload = await parseJsonBody(req);
  const value = typeof payload.value === 'string' ? payload.value.trim() : '';

  if (!value) {
    throw createHttpError(400, 'Value is required.');
  }

  const list = state.referenceData[category] || (state.referenceData[category] = []);
  const exists = list.some((item) => item.toLowerCase() === value.toLowerCase());
  if (exists) {
    throw createHttpError(409, 'That entry already exists.');
  }

  list.push(value);
  await persistState();
  sendJson(res, 201, list);
}

async function handleRemoveReference(req, res, category, parsedUrl) {
  const state = await ensureState();
  const value = (parsedUrl.searchParams.get('value') || '').trim();

  if (!value) {
    throw createHttpError(400, 'Value query parameter is required.');
  }

  const list = state.referenceData[category] || [];
  const index = list.findIndex((item) => item === value);
  if (index === -1) {
    throw createHttpError(404, 'Entry not found.');
  }

  if (isValueInUse(state, category, value)) {
    throw createHttpError(409, 'Entry is used in sessions and cannot be removed.');
  }

  list.splice(index, 1);
  await persistState();
  sendJson(res, 200, list);
}

async function handleStatic(req, res, parsedUrl) {
  let pathname = safeDecodePathname(parsedUrl.pathname);
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  try {
    const stats = await fsp.stat(filePath);
    if (stats.isDirectory()) {
      return handleStatic(
        req,
        res,
        new URL(pathname.endsWith('/') ? pathname + 'index.html' : pathname + '/index.html', parsedUrl)
      );
    }

    const stream = fs.createReadStream(filePath);
    stream.on('error', (error) => {
      console.error('Static file stream error:', error);
      sendText(res, 500, 'Internal server error');
    });

    res.writeHead(200, {
      'Content-Type': getContentType(filePath),
      'Cache-Control': 'no-cache',
    });
    stream.pipe(res);
  } catch (error) {
    if (error.code === 'ENOENT') {
      if (!res.writableEnded) {
        sendText(res, 404, 'Not found');
      }
    } else {
      console.error('Failed to serve static asset:', error);
      sendText(res, 500, 'Internal server error');
    }
  }
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (parsedUrl.pathname.startsWith('/api/')) {
    handleApi(req, res, parsedUrl).catch((error) => {
      if (error && typeof error.statusCode === 'number') {
        sendJson(res, error.statusCode, { message: error.message });
      } else {
        console.error('Unexpected API error:', error);
        sendJson(res, 500, { message: 'Internal server error.' });
      }
    });
  } else {
    handleStatic(req, res, parsedUrl);
  }
});

server.on('clientError', (err, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(PORT, () => {
  console.log(`Coaches Log server running at http://localhost:${PORT}`);
});
