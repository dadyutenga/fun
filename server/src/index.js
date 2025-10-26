import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLIENT_DIR = path.join(__dirname, '..', '..', 'client');
const DEFAULT_GITHUB_USER = process.env.GITHUB_USERNAME || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const WEATHER_LAT = process.env.WEATHER_LATITUDE || '';
const WEATHER_LON = process.env.WEATHER_LONGITUDE || '';
const PORT = Number(process.env.PORT || 4000);

async function getDiskUsage() {
  try {
    const { stdout } = await execAsync('df -k --output=size,used / | tail -n 1');
    const [sizeKb, usedKb] = stdout.trim().split(/\s+/).map(Number);
    if (!Number.isFinite(sizeKb) || !Number.isFinite(usedKb)) {
      throw new Error('Invalid disk data');
    }
    const sizeBytes = sizeKb * 1024;
    const usedBytes = usedKb * 1024;
    return {
      totalBytes: sizeBytes,
      usedBytes: usedBytes,
      freeBytes: sizeBytes - usedBytes,
      usedPercentage: Number(((usedBytes / sizeBytes) * 100).toFixed(2))
    };
  } catch (error) {
    return {
      error: 'Unable to determine disk usage',
      details: error.message
    };
  }
}

function getMemoryStats() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    totalBytes: total,
    usedBytes: used,
    freeBytes: free,
    usedPercentage: Number(((used / total) * 100).toFixed(2))
  };
}

function getCpuStats() {
  const loads = os.loadavg();
  const cores = os.cpus().length;
  return {
    load1: Number(loads[0].toFixed(2)),
    load5: Number(loads[1].toFixed(2)),
    load15: Number(loads[2].toFixed(2)),
    cores
  };
}

async function getSystemStats() {
  const [disk] = await Promise.all([
    getDiskUsage()
  ]);
  return {
    cpu: getCpuStats(),
    memory: getMemoryStats(),
    disk,
    platform: os.platform(),
    release: os.release()
  };
}

async function getGithubRepos(username) {
  const user = username || DEFAULT_GITHUB_USER;
  if (!user) {
    return { error: 'Missing GitHub username' };
  }
  const url = new URL(`https://api.github.com/users/${user}/repos`);
  url.searchParams.set('sort', 'updated');
  url.searchParams.set('per_page', '5');
  const headers = {
    'User-Agent': 'Dev-Command-Center'
  };
  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const message = await response.text();
    return { error: `GitHub API error: ${response.status}`, details: message };
  }
  const data = await response.json();
  return data.map(repo => ({
    id: repo.id,
    name: repo.name,
    description: repo.description,
    url: repo.html_url,
    pushedAt: repo.pushed_at,
    stars: repo.stargazers_count,
    language: repo.language
  }));
}

async function getWeather() {
  if (!WEATHER_LAT || !WEATHER_LON) {
    return { error: 'Missing WEATHER_LATITUDE or WEATHER_LONGITUDE environment variables.' };
  }
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', WEATHER_LAT);
  url.searchParams.set('longitude', WEATHER_LON);
  url.searchParams.set('current_weather', 'true');
  url.searchParams.set('hourly', 'relativehumidity_2m,apparent_temperature');
  const response = await fetch(url);
  if (!response.ok) {
    const message = await response.text();
    return { error: `Weather API error: ${response.status}`, details: message };
  }
  const data = await response.json();
  const current = data.current_weather || {};
  return {
    temperature: current.temperature,
    windSpeed: current.windspeed,
    weatherCode: current.weathercode,
    time: current.time,
    timezone: data.timezone,
    apparentTemperature: data.hourly?.apparent_temperature?.[0] ?? null,
    humidity: data.hourly?.relativehumidity_2m?.[0] ?? null
  };
}

function getUptime() {
  return {
    systemSeconds: os.uptime(),
    processSeconds: process.uptime()
  };
}

function getMotivation() {
  const quotes = [
    'The bugs fear you. Show them why.',
    'Deploy dreams, not excuses.',
    'Stay determined — even Stack Overflow sleeps sometimes.',
    'Every commit is a spell. Cast wisely.',
    'Code today like the future depends on it.'
  ];
  const index = Math.floor(Date.now() / 60000) % quotes.length;
  return {
    quote: quotes[index],
    allQuotes: quotes
  };
}

async function buildDashboard(username) {
  const [system, github, weather] = await Promise.all([
    getSystemStats(),
    getGithubRepos(username),
    getWeather()
  ]);
  return {
    system,
    github,
    weather,
    uptime: getUptime(),
    motivation: getMotivation()
  };
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET'
  });
  res.end(body);
}

async function serveStatic(req, res, filePath) {
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.svg': 'image/svg+xml'
    }[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': data.length
    });
    res.end(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404);
      res.end('Not Found');
    } else {
      res.writeHead(500);
      res.end('Server Error');
    }
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET'
    });
    res.end();
    return;
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = requestUrl.pathname;

  if (pathname.startsWith('/api/')) {
    try {
      if (pathname === '/api/system') {
        const system = await getSystemStats();
        sendJson(res, 200, system);
        return;
      }
      if (pathname === '/api/github') {
        const username = requestUrl.searchParams.get('user') || undefined;
        const github = await getGithubRepos(username);
        sendJson(res, 200, github);
        return;
      }
      if (pathname === '/api/weather') {
        const weather = await getWeather();
        sendJson(res, 200, weather);
        return;
      }
      if (pathname === '/api/uptime') {
        sendJson(res, 200, getUptime());
        return;
      }
      if (pathname === '/api/motivation') {
        sendJson(res, 200, getMotivation());
        return;
      }
      if (pathname === '/api/dashboard') {
        const username = requestUrl.searchParams.get('user') || undefined;
        const dashboard = await buildDashboard(username);
        sendJson(res, 200, dashboard);
        return;
      }
      sendJson(res, 404, { error: 'Endpoint not found' });
    } catch (error) {
      sendJson(res, 500, { error: 'Server error', details: error.message });
    }
    return;
  }

  let safePath = pathname;
  if (safePath === '/' || safePath === '') {
    safePath = '/index.html';
  }
  const resolvedPath = path.normalize(path.join(CLIENT_DIR, safePath));
  if (!resolvedPath.startsWith(CLIENT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  await serveStatic(req, res, resolvedPath);
});

server.listen(PORT, () => {
  console.log(`Dev Command Center server listening on port ${PORT}`);
});

