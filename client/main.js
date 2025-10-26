const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes)) return 'N/A';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
};

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds)) return 'Unknown';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
};

const animeLoading = () => {
  const progress = document.getElementById('loading-progress');
  if (!progress) return;
  const reset = () => {
    progress.style.animation = 'none';
    void progress.offsetWidth; // trigger reflow to restart animation
    progress.style.animation = '';
  };
  setInterval(reset, 5000);
};

const applyBarValue = (selector, percentage) => {
  const bar = document.querySelector(`.bar[data-stat="${selector}"]`);
  if (!bar) return;
  const percent = Math.max(0, Math.min(percentage / 100, 1));
  bar.style.setProperty('--percent', percent.toString());
  bar.setAttribute('data-percent', percent.toString());
};

const renderSystemStats = (system) => {
  if (!system) return;
  const cpuStats = document.getElementById('cpu-stats');
  const memoryStats = document.getElementById('memory-stats');
  const diskStats = document.getElementById('disk-stats');
  const meta = document.getElementById('system-meta');

  if (cpuStats && system.cpu) {
    cpuStats.textContent = `${system.cpu.load1} / ${system.cpu.load5} / ${system.cpu.load15} (cores: ${system.cpu.cores})`;
    const loadPercent = Math.min(100, (system.cpu.load1 / system.cpu.cores) * 100);
    applyBarValue('cpu', loadPercent);
  }

  if (memoryStats && system.memory) {
    memoryStats.textContent = `${formatBytes(system.memory.usedBytes)} used of ${formatBytes(system.memory.totalBytes)}`;
    applyBarValue('memory', system.memory.usedPercentage);
  }

  if (diskStats && system.disk && !system.disk.error) {
    diskStats.textContent = `${formatBytes(system.disk.usedBytes)} used of ${formatBytes(system.disk.totalBytes)} (${system.disk.usedPercentage}% used)`;
    applyBarValue('disk', system.disk.usedPercentage);
  } else if (diskStats && system.disk && system.disk.error) {
    diskStats.textContent = system.disk.error;
  }

  if (meta) {
    meta.textContent = `${system.platform} ${system.release}`;
  }
};

const renderRepos = (repos) => {
  const list = document.getElementById('repo-list');
  if (!list) return;
  list.innerHTML = '';

  if (!Array.isArray(repos) || repos.length === 0) {
    list.innerHTML = '<li class="placeholder">No repositories found. Check your GitHub username.</li>';
    return;
  }

  repos.forEach((repo) => {
    const li = document.createElement('li');
    li.className = 'repo';

    const title = document.createElement('a');
    title.href = repo.url;
    title.target = '_blank';
    title.rel = 'noopener noreferrer';
    title.textContent = repo.name;

    const description = document.createElement('p');
    description.className = 'muted';
    description.textContent = repo.description || 'No description provided.';

    const meta = document.createElement('div');
    meta.className = 'repo-meta';
    meta.innerHTML = `
      <span>⭐ ${repo.stars}</span>
      <span>${repo.language || 'N/A'}</span>
      <span>Updated ${new Date(repo.pushedAt).toLocaleString()}</span>
    `;

    li.appendChild(title);
    li.appendChild(description);
    li.appendChild(meta);
    list.appendChild(li);
  });
};

const renderWeather = (weather) => {
  const weatherNode = document.getElementById('weather');
  if (!weatherNode) return;

  if (!weather || weather.error) {
    weatherNode.innerHTML = `<span class="muted">${weather?.error || 'Weather unavailable. Configure coordinates.'}</span>`;
    return;
  }

  const items = [
    `<strong>${weather.temperature}°C</strong> current temperature`,
    weather.apparentTemperature != null ? `Feels like ${weather.apparentTemperature}°C` : null,
    weather.humidity != null ? `Humidity ${weather.humidity}%` : null,
    `Wind ${weather.windSpeed} km/h`
  ].filter(Boolean);

  weatherNode.innerHTML = items.map((item) => `<div>${item}</div>`).join('');
};

const renderUptime = (uptime) => {
  const systemNode = document.getElementById('system-uptime');
  const processNode = document.getElementById('process-uptime');
  if (!uptime || !systemNode || !processNode) return;
  systemNode.textContent = `System: ${formatDuration(uptime.systemSeconds)}`;
  processNode.textContent = `Dashboard: ${formatDuration(uptime.processSeconds)}`;
};

const renderQuote = (motivation) => {
  const quoteNode = document.getElementById('quote');
  if (!quoteNode) return;
  if (!motivation) {
    quoteNode.textContent = 'Keep calm and commit often.';
    return;
  }
  quoteNode.textContent = motivation.quote;
};

const renderUptimeHeader = (uptime) => {
  const uptimeNode = document.getElementById('uptime');
  if (!uptimeNode || !uptime) return;
  uptimeNode.textContent = `Uptime: ${formatDuration(uptime.systemSeconds)}`;
};

const fetchDashboard = async () => {
  try {
    const response = await fetch('/api/dashboard');
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    const data = await response.json();
    renderSystemStats(data.system);
    renderRepos(data.github);
    renderWeather(data.weather);
    renderUptime(data.uptime);
    renderUptimeHeader(data.uptime);
    renderQuote(data.motivation);
  } catch (error) {
    console.error('Failed to fetch dashboard data', error);
  }
};

animeLoading();
fetchDashboard();
setInterval(fetchDashboard, 60_000);
