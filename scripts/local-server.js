const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..');
const keywordFile = path.join(repositoryRoot, 'category-keywords.json');
const hostname = '127.0.0.1';
const requestedPort = Number.parseInt(process.env.SPENDWISE_PORT || '8000', 10);
const port = Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort < 65536 ? requestedPort : 8000;
const maximumBodyBytes = 1024 * 1024;

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function validKeywords(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.length > 0 && entries.length <= 100 && entries.every(([category, keywords]) =>
    typeof category === 'string' && category.trim().length > 0 && category.length <= 100 &&
    Array.isArray(keywords) && keywords.length <= 1000 && keywords.every(keyword =>
      typeof keyword === 'string' && keyword.trim().length > 0 && keyword.length <= 250));
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(payload));
}

function applyLocalCors(request, response) {
  const origin = request.headers.origin;
  if (origin === 'null' || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin || '')) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
}

async function readSavedKeywords() {
  try {
    const contents = await fs.promises.readFile(keywordFile, 'utf8');
    const payload = JSON.parse(contents);
    return validKeywords(payload.keywords) ? payload.keywords : null;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeSavedKeywords(keywords) {
  const temporaryFile = `${keywordFile}.tmp`;
  const contents = `${JSON.stringify({ keywords }, null, 2)}\n`;
  await fs.promises.writeFile(temporaryFile, contents, { encoding: 'utf8', mode: 0o600 });
  await fs.promises.rename(temporaryFile, keywordFile);
}

async function handleKeywordApi(request, response) {
  if (request.method === 'GET') {
    const keywords = await readSavedKeywords();
    if (!keywords) {
      response.writeHead(204, { 'Cache-Control': 'no-store' });
      response.end();
      return;
    }
    sendJson(response, 200, { keywords });
    return;
  }

  if (request.method !== 'POST') {
    response.writeHead(405, { Allow: 'GET, POST' });
    response.end();
    return;
  }

  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBodyBytes) {
      sendJson(response, 413, { error: 'Keyword data is too large.' });
      return;
    }
    chunks.push(chunk);
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    sendJson(response, 400, { error: 'Keyword data must be valid JSON.' });
    return;
  }

  if (!validKeywords(payload.keywords)) {
    sendJson(response, 400, { error: 'Keyword data has an invalid structure.' });
    return;
  }

  await writeSavedKeywords(payload.keywords);
  sendJson(response, 200, { saved: true });
}

async function serveFile(request, response, pathname) {
  if (pathname === '/category-keywords.json') {
    response.writeHead(404);
    response.end();
    return;
  }

  const relativePath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const resolvedPath = path.resolve(repositoryRoot, relativePath);
  if (resolvedPath !== repositoryRoot && !resolvedPath.startsWith(`${repositoryRoot}${path.sep}`)) {
    response.writeHead(403);
    response.end();
    return;
  }

  try {
    const stats = await fs.promises.stat(resolvedPath);
    if (!stats.isFile()) throw Object.assign(new Error('Not a file'), { code: 'ENOENT' });
    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(resolvedPath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stats.size,
      'Cache-Control': 'no-store'
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    fs.createReadStream(resolvedPath).pipe(response);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500);
    response.end();
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || `${hostname}:${port}`}`);
    applyLocalCors(request, response);
    if (url.pathname === '/api/keywords') {
      if (request.method === 'OPTIONS') {
        response.writeHead(204, {
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '600'
        });
        response.end();
        return;
      }
      await handleKeywordApi(request, response);
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end();
      return;
    }
    await serveFile(request, response, url.pathname);
  } catch (error) {
    console.error(error);
    if (!response.headersSent) sendJson(response, 500, { error: 'The local server encountered an error.' });
    else response.end();
  }
});

server.listen(port, hostname, () => {
  console.log(`Spendwise is running at http://${hostname}:${port}`);
  console.log(`Keywords are saved locally to ${keywordFile}`);
});
