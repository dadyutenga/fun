# Dev Command Center

A self-hosted dashboard that celebrates your builder energy. It shows live system resource stats, your latest GitHub repos, weather for your VPS location, uptime, and a rotating motivational boost.

## Features

- **System monitor** – CPU load averages, memory usage, and disk utilization with animated bars.
- **GitHub integration** – fetches the five most recently updated repositories for a configured user.
- **Weather + uptime** – pulls current weather from Open-Meteo and displays both host and process uptime.
- **Motivation corner** – rotating quotes with an anime-inspired loading bar for fun flair.

## Getting started

1. **Set environment variables** (optional but recommended):

   ```bash
   export GITHUB_USERNAME="your-github-handle"
   # Optional, only needed if you hit GitHub rate limits
   # export GITHUB_TOKEN="ghp_example"

   # Coordinates for your VPS location (used by the weather widget)
   export WEATHER_LATITUDE="40.7128"
   export WEATHER_LONGITUDE="-74.0060"
   ```

2. **Start the server**:

   ```bash
   npm run start
   ```

3. **Open the dashboard** by visiting [http://localhost:4000](http://localhost:4000).

The server exposes a handful of JSON endpoints under `/api/*` if you want to integrate the data elsewhere.

## Project structure

```
client/          Static assets served to the browser
  ├─ index.html  Dashboard layout
  ├─ main.js     Fetches data and updates the UI
  └─ styles.css  Neon control center vibes
server/
  └─ src/index.js  Minimal Node.js server + API routes
```

## Notes

- The server relies on the host OS `df` command to gather disk usage data. On unsupported systems, the panel will display an error instead of usage stats.
- Weather data is fetched from [Open-Meteo](https://open-meteo.com/); no API key is required.
- If you run into GitHub rate limiting, provide a personal access token through `GITHUB_TOKEN`.
