# Project Summary for Agent Understanding

## Overview

This repository is a static website backed by a JSON data store, with a small Flask helper app for local data loading and saving. It appears to support a baseball or softball league called "Ligue Brasserie du Boulevard" and provides pages for calendar, rankings, statistics, lineups, playoffs, rules, and sponsors.

The project is organized into:

- Root static site assets and main client application
- `application/` helper applications and drafts tools
- `data/` league data and season records
- `img/` static images, team logos, headshots, and winner assets

## Root folder

Key files:

- `index.html` - main site shell. Contains the page layout, navigation sidebar, and content placeholder. Uses `script.js` as a module to populate pages dynamically.
- `script.js` - main client-side application logic. Loads JSON data, initializes global state, and renders different pages (`calendar`, `ranking`, `stats`, `lineup`, `playoffs`, `player`, `rules`, `sponsors`) based on URL parameters.
  - Uses data from `data/` and assets from `img/`
  - Handles page structure, team filtering, game selection, stats calculations, schedule and playoff rendering, and dynamic content insertion.
- `style.css` - shared styles for the static site. Defines layout, cards, tables, sponsor sections, winner layout, navigation sidebar, logos, and responsive appearance.
- `site.webmanifest`, favicon files, and `CNAME` - static site metadata and domain settings for deployment.

## `application/` folder

This folder contains auxiliary apps and tools, including a draft manager and a Flask backend for data loading/saving.

Files:

- `draft.html` - draft management page for the current season. Likely allows saving, loading, and exporting draft state for player/team drafts.
- `draft.js` - client-side draft app logic. Implements:
  - localStorage draft state save/load/clear
  - drag-and-drop or selection of draft players and teams
  - tie-breaker handling and draft order computation
  - backup export/import for draft state
  - UI rendering for draft summary and team selection
- `GameApp.html` - frontend page for the Flask helper app, probably for manual JSON save/load when running locally.
- `gameApp.js` - client-side app logic for the Flask helper. Manages roster lineups, player assignment, per-inning stats, substitutes, base state, and lineup display.
  - Uses a local Flask service at `http://127.0.0.1:5000` to load `players.json`, `players_<year>.json`, and `season_<year>.json`
  - Provides lineup creation UI with per-inning actions and statistics tracking
- `GameApp.py` - small Flask web server exposing `/load` and `/save` endpoints.
  - Serves JSON from `../data`
  - Creates directories automatically when saving files
  - Enables client scripts to fetch season files and player data via HTTP
- `styles.css` - CSS for the `application/` app pages.
- `README.md` - instructions for creating the Python virtual environment and launching the Flask app.

## `data/` folder

This is the main content database for the site. It contains:

- global JSON files:
  - `players.json` - player master list used across seasons
  - `seasons.json` - season metadata and maybe season selection data
  - `default_game.json` - default game template or fallback
  - `default_out.json` - likely default result/outcome template
  - `columns.json` - configuration for table columns or stats display
  - `rules.json` - league rules content
  - `sponsors.json` - sponsors data for the site
- season-specific subfolders by year: `2020/`, `2021/`, `2022/`, `2023/`, `2024/`, `2025/`, `2026/`
  - Each year contains `players_<year>.json`, `season_<year>.json`, and often `stats_season_<year>.json`, `stats_playoff_<year>.json`
  - For recent years, there are nested venue folders such as `bar_le_cocotier/`, `buffet_frédéric/`, `centrale_auto_SM/`, `la_bouchée_d'or/` with JSON game schedule/results files by date/time
- `draft_2026_backup_2026-04-05.json` - draft backup state file

Data folder purpose:

- source of truth for the website
- contains league schedule, standings, player rosters, statistics, and venue-specific game data
- enables the app to render dynamic league content without a database backend

## `img/` folder

Contains static image assets used by both the public site and the application tools.

Subfolders:

- `headshots/` - player headshots and placeholders
- `logo/` - league and sponsor logos used throughout the site
- `winners/` - winner and season winner photos for historical seasons

Other root images:

- `field.png`, `bracket-connector.png`, and standard favicons for the web app

## Project purpose and behavior

The repository appears to be a league website and management tool:

- A static frontend site presenting league calendar, team rankings, player statistics, playoff brackets, and sponsor information
- A draft management tool and/or lineup manager under `application/`
- A lightweight Flask helper service for local JSON data operations during development
- Data-driven architecture where all content is read from JSON and rendered client-side

## Notes for an agent

- `index.html` is the entrypoint; the app is not server-rendered.
- `script.js` is the main logic hub and should be read first to understand page generation and data flows.
- `data/` stores the content model: players, seasons, schedules, stats, rules, and sponsors.
- `application/` contains two separate utilities:
  - `draft.js` for drafting players/teams locally
  - `gameApp.js` + `GameApp.py` for lineup/stats editing via a local Flask service
- There is no package manager config; the app is built as static HTML/CSS/JS plus a simple Python helper.
