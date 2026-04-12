# CUSTOM DOMAIN: To set up a custom domain on Render:
# 1. Go to render.com → your service → Settings → Custom Domains
# 2. Add your domain (e.g., sygnal.joedeagan.com)
# 3. Add a CNAME record in your DNS pointing to your-service.onrender.com
# 4. Render handles SSL automatically

"""
Sygnal Backend Server
====================
This is your first backend. It does 3 things:

1. Fetches market data from Kalshi + Polymarket APIs
2. Combines them into one clean format
3. Serves it to your frontend via YOUR own API

WHY DO WE NEED THIS?
Browsers block direct API calls to other websites (called CORS).
Your frontend can't call Kalshi directly from GitHub Pages.
But YOUR server can call any API — no restrictions.
Then your frontend calls YOUR server instead.

Frontend → YOUR Server → Kalshi API
Frontend → YOUR Server → Polymarket API
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
import httpx
import os
import json
from datetime import datetime, timezone, timedelta

# SendGrid for email sending
# Load from .env file if exists
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(_env_path):
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and "=" in _line and not _line.startswith("#"):
                _k, _v = _line.split("=", 1)
                os.environ[_k.strip()] = _v.strip()

SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")
SENDGRID_FROM_EMAIL = os.environ.get("SENDGRID_FROM_EMAIL", "sygnal.joedeagan.com")

# Data directory: use /data volume on Fly.io, else local api/ directory
_api_dir = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = "/data" if os.path.isdir("/data") else _api_dir

# ─── Price History (for momentum scoring) ───
PRICE_HISTORY_FILE = os.path.join(DATA_DIR, "price_history.json")

def load_price_history():
    try:
        with open(PRICE_HISTORY_FILE, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}  # {ticker: [{yes, vol, ts}, ...]}

def save_price_history(data):
    with open(PRICE_HISTORY_FILE, "w") as f:
        json.dump(data, f)

def record_prices(markets):
    """Record current prices for all markets. Called each scan cycle."""
    history = load_price_history()
    now = datetime.now(timezone.utc).isoformat()
    for m in markets:
        ticker = m.get("ticker", "")
        if not ticker:
            continue
        if ticker not in history:
            history[ticker] = []
        history[ticker].append({
            "yes": m.get("yes", 50),
            "vol": m.get("volume", 0),
            "ts": now,
        })
        # Keep last 288 entries (24 hours at 5-min intervals)
        if len(history[ticker]) > 288:
            history[ticker] = history[ticker][-288:]
    save_price_history(history)

def get_momentum(ticker):
    """Get price momentum for a ticker. Returns (price_change_1h, price_change_6h, volume_spike)."""
    history = load_price_history()
    entries = history.get(ticker, [])
    if len(entries) < 2:
        return 0, 0, False

    current = entries[-1]
    # 1-hour ago (12 entries back at 5-min intervals)
    h1_idx = max(0, len(entries) - 12)
    h1 = entries[h1_idx]
    change_1h = current["yes"] - h1["yes"]

    # 6-hour ago (72 entries back)
    h6_idx = max(0, len(entries) - 72)
    h6 = entries[h6_idx]
    change_6h = current["yes"] - h6["yes"]

    # Volume spike: current vol > 3x average of last 24 entries
    recent_vols = [e.get("vol", 0) for e in entries[-24:]]
    avg_vol = sum(recent_vols) / len(recent_vols) if recent_vols else 0
    vol_spike = current.get("vol", 0) > avg_vol * 3 and avg_vol > 100

    return change_1h, change_6h, vol_spike

# WHAT IS FastAPI?
# It's a Python framework for building web APIs.
# You define "endpoints" (URLs) and what data they return.
# It's what Jarvis uses too.

app = FastAPI(title="Sygnal Markets API")

# WHAT IS CORS MIDDLEWARE?
# This tells the server "allow any website to call my API."
# Without this, your GitHub Pages frontend couldn't fetch from this server.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all websites
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the frontend files too (HTML, CSS, JS)
# The static_dir points to market-dashboard/ (one level up from api/)
static_dir = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))


@app.get("/")
async def index():
    from starlette.responses import HTMLResponse
    with open(os.path.join(static_dir, "index.html"), "r", encoding="utf-8") as f:
        html = f.read()
    return HTMLResponse(html, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})


@app.get("/style.css")
async def serve_css():
    return FileResponse(os.path.join(static_dir, "style.css"), media_type="text/css")


@app.get("/app.js")
async def serve_js():
    return FileResponse(os.path.join(static_dir, "app.js"), media_type="application/javascript")


@app.get("/manifest.json")
async def serve_manifest():
    return FileResponse(os.path.join(static_dir, "manifest.json"), media_type="application/manifest+json")


@app.get("/sw.js")
async def serve_sw():
    return FileResponse(os.path.join(static_dir, "sw.js"), media_type="application/javascript")


@app.get("/ekg-logo.svg")
async def serve_ekg_logo():
    return FileResponse(os.path.join(static_dir, "ekg-logo.svg"), media_type="image/svg+xml")


@app.get("/ekg-logo.png")
async def serve_ekg_logo_png():
    return FileResponse(os.path.join(static_dir, "ekg-logo.png"), media_type="image/png")


@app.get("/newsletter.png")
async def serve_newsletter_png():
    """Serve the pre-generated newsletter image."""
    path = os.path.join(static_dir, "newsletter.png")
    if os.path.exists(path):
        return FileResponse(path, media_type="image/png")
    return JSONResponse({"error": "Newsletter image not generated yet"}, status_code=404)


@app.get("/icon-192.png")
async def serve_icon_192():
    return FileResponse(os.path.join(static_dir, "icon-192.png"), media_type="image/png")


@app.get("/icon-512.png")
async def serve_icon_512():
    return FileResponse(os.path.join(static_dir, "icon-512.png"), media_type="image/png")


@app.get("/og-image.png")
async def serve_og_image():
    """Serve OG image — falls back to icon if no og-image.png exists."""
    og_path = os.path.join(static_dir, "og-image.png")
    if os.path.exists(og_path):
        return FileResponse(og_path, media_type="image/png")
    # Fallback: serve the app icon
    return FileResponse(os.path.join(static_dir, "icon-512.png"), media_type="image/png")


def _expires_before(market, max_dt):
    """Check if a market expires before the given datetime."""
    exp = market.get("expiration_time") or market.get("close_time", "")
    if not exp:
        return True  # No expiration = keep it
    try:
        exp_dt = datetime.fromisoformat(exp.replace("Z", "+00:00"))
        return exp_dt < max_dt
    except Exception:
        return True


# ─── KALSHI MARKETS ───
@app.get("/api/kalshi")
async def get_kalshi():
    """Fetch live markets from Kalshi via events (avoids parlay spam)."""
    try:
        async with httpx.AsyncClient() as client:
            # Fetch all open events with nested markets in one call
            all_events = []
            cursor = None
            for _ in range(3):  # Max 3 pages
                params = {"limit": 100, "status": "open", "with_nested_markets": "true"}
                if cursor:
                    params["cursor"] = cursor
                try:
                    resp = await client.get(
                        "https://api.elections.kalshi.com/trade-api/v2/events",
                        params=params,
                        timeout=20,
                    )
                    data = resp.json()
                    evts = data.get("events", [])
                    all_events.extend(evts)
                    cursor = data.get("cursor")
                    if not cursor or len(evts) < 100:
                        break
                except Exception:
                    break

            events = all_events

            result = []
            for ev in events:
                event_ticker = ev.get("event_ticker", "")
                series_ticker = ev.get("series_ticker", "")
                event_title = ev.get("title", "?")

                # Markets are nested in the event response
                markets = ev.get("markets", [])

                # Filter out parlays
                clean = [m for m in markets if not ("," in m.get("title", "") and ("yes " in m.get("title", "").lower() or "no " in m.get("title", "").lower()))]

                is_multi = len(clean) > 1

                # For multi-option events (Pope, energy source, etc),
                # pick only the top 2 by price
                if is_multi:
                    clean.sort(key=lambda m: float(m.get("yes_ask_dollars", "0") or "0"), reverse=True)
                    clean = clean[:2]

                # Filter out markets expiring more than 10 years from now
                max_exp = datetime.now(timezone.utc) + timedelta(days=3650)
                clean = [m for m in clean if _expires_before(m, max_exp)]

                for m in clean:
                    title = m.get("title", event_title)
                    sub = m.get("yes_sub_title", "")

                    # If market title has blanks (Kalshi strips names), use event title
                    if "  " in title or title.startswith("Will  "):
                        title = event_title

                    # For multi-option: make titles sound like real questions
                    if is_multi and sub and sub != title:
                        # Clean up the event title
                        short_event = event_title.replace("?", "").strip()
                        # If sub is a name/option, format as "Will [sub] [event]?"
                        if short_event.startswith("Who will"):
                            title = f"{short_event.replace('Who will', 'Will')} be {sub}?"
                        elif short_event.startswith("Where will"):
                            title = f"{short_event}: {sub}?"
                        elif short_event.startswith("What"):
                            title = f"{short_event}: {sub}?"
                        else:
                            title = f"{short_event}: {sub}"

                    # Parse dollar prices → cents
                    yes_price = 50
                    try:
                        yes_ask = m.get("yes_ask_dollars", "0")
                        if yes_ask and float(yes_ask) > 0:
                            yes_price = round(float(yes_ask) * 100)
                        else:
                            yes_price = m.get("yes_ask", 50)
                    except (ValueError, TypeError):
                        yes_price = m.get("yes_ask", 50)

                    vol = 0
                    try:
                        vol = float(m.get("volume_24h_fp", 0) or 0)
                        if vol == 0:
                            vol = m.get("volume_24h", m.get("volume", 0)) or 0
                    except (ValueError, TypeError):
                        pass

                    if yes_price == 0:
                        continue

                    # Get close time — tag but don't filter (let frontend handle)
                    close_time = m.get("close_time") or m.get("expiration_time") or ""
                    days_left = -1
                    if close_time:
                        try:
                            close_dt = datetime.fromisoformat(close_time.replace("Z", "+00:00"))
                            days_left = (close_dt - datetime.now(timezone.utc)).days
                        except Exception:
                            pass

                    result.append({
                        "question": title,
                        "ticker": m.get("ticker", ""),
                        "yes": yes_price,
                        "no": 100 - yes_price,
                        "volume": vol,
                        "source": "kalshi",
                        "category": categorize(title + " " + event_title),
                        "url": f"https://kalshi.com/markets/{series_ticker}/{event_ticker}",
                        "close_time": close_time,
                        "days_left": days_left,
                    })

                if len(result) >= 80:
                    break

            result.sort(key=lambda x: x["volume"], reverse=True)
            return {"markets": result[:80], "count": min(len(result), 80)}
    except Exception as e:
        return {"markets": [], "error": str(e)}


# ─── POLYMARKET MARKETS ───
@app.get("/api/polymarket")
async def get_polymarket():
    """Fetch live markets from Polymarket — diverse, no dead markets."""
    try:
        async with httpx.AsyncClient() as client:
            # Fetch by volume (popular) and by recency (fresh)
            resp1 = await client.get(
                "https://gamma-api.polymarket.com/markets",
                params={"closed": "false", "limit": 60, "order": "volume", "ascending": "false"},
                timeout=15,
            )
            resp2 = await client.get(
                "https://gamma-api.polymarket.com/markets",
                params={"closed": "false", "limit": 40, "order": "startDate", "ascending": "false"},
                timeout=15,
            )
            data = resp1.json() + resp2.json()

            seen_tickers = set()
            result = []
            for m in data:
                ticker = m.get("conditionId", "")
                if ticker in seen_tickers:
                    continue
                seen_tickers.add(ticker)

                yes_price = 50
                try:
                    outcomes = json.loads(m.get("outcomePrices", "[]"))
                    if outcomes:
                        yes_price = round(float(outcomes[0]) * 100)
                except Exception:
                    pass

                # Skip dead markets (0¢ or 100¢)
                if yes_price <= 2 or yes_price >= 98:
                    continue

                # Tag with days left — don't filter
                end_date = m.get("endDate") or ""
                poly_days_left = -1
                if end_date:
                    try:
                        end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                        poly_days_left = (end_dt - datetime.now(timezone.utc)).days
                    except Exception:
                        pass

                events = m.get("events", [])
                event_slug = events[0].get("slug", "") if events else m.get("slug", m.get("conditionId", ""))
                result.append({
                    "question": m.get("question", "?"),
                    "ticker": ticker,
                    "yes": yes_price,
                    "no": 100 - yes_price,
                    "volume": float(m.get("volume", 0)),
                    "source": "poly",
                    "category": categorize(m.get("question", "")),
                    "url": f"https://polymarket.com/event/{event_slug}",
                    "days_left": poly_days_left,
                })

            result.sort(key=lambda x: x["volume"], reverse=True)
            return {"markets": result[:80], "count": min(len(result), 80)}
    except Exception as e:
        return {"markets": [], "error": str(e)}


# ─── COMBINED — ALL MARKETS ───
@app.get("/api/markets")
async def get_all_markets():
    """Fetch from BOTH platforms and return combined data."""
    kalshi_data = await get_kalshi()
    poly_data = await get_polymarket()

    kalshi = kalshi_data.get("markets", [])
    poly = poly_data.get("markets", [])

    # Find arbitrage opportunities
    arbitrage = find_arbitrage(kalshi, poly)

    return {
        "kalshi": kalshi,
        "polymarket": poly,
        "arbitrage": arbitrage,
        "total": len(kalshi) + len(poly),
    }


# ─── YOUR KALSHI BOT DATA ───
@app.get("/api/bot")
async def get_bot():
    """Fetch your personal Kalshi bot data."""
    bot_url = "https://web-production-c8a5b.up.railway.app"
    try:
        async with httpx.AsyncClient() as client:
            portfolio = (await client.get(f"{bot_url}/api/portfolio", timeout=10)).json()
            status = (await client.get(f"{bot_url}/api/bot/status", timeout=10)).json()

            return {
                "balance": portfolio.get("balance", 0),
                "portfolio_value": portfolio.get("portfolio_value", 0),
                "positions": portfolio.get("positions", []),
                "running": status.get("running", False),
                "scans": status.get("scan_count", 0),
                "trades_today": status.get("trades_today", 0),
            }
    except Exception as e:
        return {"error": str(e)}


# ─── BOT CONFIG (GET + UPDATE) ───
BOT_URL = "https://web-production-c8a5b.up.railway.app"

@app.get("/api/bot/config")
async def get_bot_config():
    """Fetch current bot configuration."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{BOT_URL}/api/bot/config", timeout=10)
            return resp.json()
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/bot/config")
async def update_bot_config(request: Request):
    """Update bot configuration parameters."""
    try:
        body = await request.json()
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{BOT_URL}/api/bot/config", json=body, timeout=10)
            return resp.json()
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/bot/signals")
async def get_bot_signals():
    """Fetch latest bot signals."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{BOT_URL}/api/bot/signals", timeout=10)
            return resp.json()
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/bot/trades")
async def get_bot_trades(limit: int = 20):
    """Fetch recent bot trades."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{BOT_URL}/api/bot/trades?limit={limit}", timeout=10)
            return resp.json()
    except Exception as e:
        return {"error": str(e)}


# ─── HELPER FUNCTIONS ───

def categorize(title):
    t = (title or "").lower()
    if any(w in t for w in ["bitcoin", "btc", "ethereum", "eth", "crypto", "sol ", "doge", "coin", "token",
                             "solana", "ripple", "xrp", "dogecoin", "shiba"]):
        return "crypto"
    if any(w in t for w in ["nba", "mlb", "nfl", "nhl", "hockey", "baseball", "basketball", "football",
                             "soccer", "tennis", "golf", "ufc", "mma", "boxing", "f1", "nascar",
                             "formula 1", "formula one", "verstappen", "hamilton", "leclerc",
                             "world cup", "fifa", "champions league", "premier league", "serie a",
                             "la liga", "bundesliga", "ligue 1", "eredivisie",
                             "lakers", "yankees", "braves", "dodgers", "cubs", "mets",
                             "warriors", "celtics", "playoffs", "championship", "match",
                             "grand slam", "olympics", "medal", "stanley cup", "super bowl",
                             "hornets", "spurs", "suns", "raptors", "clippers", "nuggets",
                             "trail blazers", "thunder", "pacers", "magic", "hawks", "nets",
                             "avalanche", "rangers", "bruins", "panthers", "oilers",
                             "wimbledon", "us open", "french open", "australian open",
                             "retirement" if "season" in t else "NOMATCH"]):
        return "sports"
    if any(w in t for w in ["trump", "election", "president", "senate", "congress", "biden",
                             "governor", "democrat", "republican", "vote", "poll", "cabinet",
                             "minister", "parliament", "legislation", "bill pass",
                             "supreme court", "political", "party", "primary",
                             "tariff", "sanction", "executive order", "impeach",
                             "speaker of the house", "jeffries", "jim jordan",
                             "african leaders", "leave office", "climate goal"]):
        return "politics"
    if any(w in t for w in ["rain", "snow", "weather", "temperature", "hurricane", "tornado",
                             "flood", "drought", "heat wave", "storm", "celsius", "fahrenheit",
                             "wildfire", "earthquake"]):
        return "weather"
    # Catch war/geopolitics
    if any(w in t for w in ["war", "ukraine", "russia", "china", "nato", "military",
                             "cease", "invasion", "conflict", "missile", "nuclear",
                             "iran", "israel", "gaza", "taiwan"]):
        return "politics"
    # Entertainment / pop culture
    if any(w in t for w in ["gta", "album", "movie", "film", "cast", "released", "rihanna",
                             "carti", "drake", "kanye", "taylor swift", "beyonce",
                             "oscar", "grammy", "emmy", "netflix", "disney", "marvel",
                             "star wars", "james bond", "miami vice", "season",
                             "weinstein", "sentenced", "prison", "trial", "verdict",
                             "pope", "catholic", "vatican"]):
        return "entertainment"
    # Finance / economics
    if any(w in t for w in ["fed ", "rate cut", "rate hike", "inflation", "cpi", "gdp",
                             "recession", "unemployment", "s&p", "nasdaq", "dow",
                             "stock", "ipo", "interest rate", "treasury",
                             "ev market", "electric vehicle", "market share"]):
        return "finance"
    # Science / tech
    if any(w in t for w in ["moon", "mars", "spacex", "nasa", "robot", "humanoid",
                             "agi", "openai", "ai ", "fda", "cure", "diabetes",
                             "vaccine", "asteroid", "space"]):
        return "science"
    return "other"


def find_arbitrage(kalshi_markets, poly_markets):
    import re
    opportunities = []

    # Keywords with minimum length to avoid substring false positives
    # Use word boundary matching for short keywords
    keywords = [
        "bitcoin", "btc", "ethereum", "eth", "crypto",
        "trump", "election", "president", "biden",
        "interest rate", "inflation",
        "recession", "unemployment",
        "pope", "ukraine", "russia",
        "openai", "chatgpt",
        "tesla", "spacex",
        "world cup", "super bowl",
        "stanley cup", "nba finals",
        "gta vi", "gta 6",
    ]

    def has_keyword(title, kw):
        """Check if keyword appears as a whole word (not substring)."""
        if len(kw) <= 3:
            # Short keywords need word boundary check
            return bool(re.search(r'\b' + re.escape(kw) + r'\b', title))
        return kw in title

    seen = set()
    for k in kalshi_markets:
        k_title = (k.get("question") or "").lower()
        k_cat = k.get("category", "")
        for p in poly_markets:
            p_title = (p.get("question") or "").lower()
            p_cat = p.get("category", "")
            pair_key = (k.get("ticker", ""), p.get("ticker", ""))
            if pair_key in seen:
                continue

            # Must be in same category (or both uncategorized)
            if k_cat and p_cat and k_cat != p_cat:
                continue

            for keyword in keywords:
                if has_keyword(k_title, keyword) and has_keyword(p_title, keyword):
                    diff = abs(k["yes"] - p["yes"])
                    if diff >= 3:
                        seen.add(pair_key)
                        opportunities.append({
                            "topic": keyword.upper(),
                            "kalshi": k,
                            "poly": p,
                            "diff": diff,
                            "direction": "Buy POLY" if k["yes"] > p["yes"] else "Buy KALSHI",
                        })
                    break

    opportunities.sort(key=lambda x: x["diff"], reverse=True)
    return opportunities[:10]


# ─── NEWSLETTER / SUBSCRIBERS ───

SUBSCRIBERS_FILE = os.path.join(DATA_DIR, "subscribers.json")


def load_subscribers():
    try:
        with open(SUBSCRIBERS_FILE, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def save_subscribers(subs):
    with open(SUBSCRIBERS_FILE, "w") as f:
        json.dump(subs, f, indent=2)


@app.post("/api/subscribe")
async def subscribe(request: Request):
    """Add email to newsletter subscriber list."""
    body = await request.json()
    email = (body.get("email") or "").strip().lower()
    if not email or "@" not in email or "." not in email:
        return JSONResponse({"error": "Invalid email"}, status_code=400)

    subs = load_subscribers()
    existing = [s for s in subs if s["email"] == email]
    if existing:
        return {"status": "already_subscribed", "email": email}

    subs.append({
        "email": email,
        "subscribed_at": datetime.now(timezone.utc).isoformat(),
        "tier": "free",
    })
    save_subscribers(subs)
    return {"status": "subscribed", "email": email}


@app.get("/api/subscribers")
async def list_subscribers():
    """Admin: list all subscribers."""
    subs = load_subscribers()
    return {"subscribers": subs, "count": len(subs)}


@app.post("/api/unsubscribe")
async def unsubscribe(request: Request):
    """Remove email from subscriber list."""
    body = await request.json()
    email = (body.get("email") or "").strip().lower()
    subs = load_subscribers()
    subs = [s for s in subs if s["email"] != email]
    save_subscribers(subs)
    return {"status": "unsubscribed", "email": email}


@app.get("/api/newsletter/generate")
async def generate_newsletter():
    """Generate clean HTML newsletter — Morning Brew style, Gmail compatible."""
    markets_data = await get_all_markets()
    kalshi = markets_data.get("kalshi", [])
    poly = markets_data.get("polymarket", [])
    arbitrage = markets_data.get("arbitrage", [])
    all_markets = kalshi + poly

    all_markets.sort(key=lambda x: x.get("volume", 0), reverse=True)
    top_markets = all_markets[:5]
    movers = sorted(all_markets, key=lambda x: abs(x.get("yes", 50) - 50), reverse=True)[:5]

    SITE = "https://sygnalmarkets.com"
    date_str = datetime.now().strftime("%B %d, %Y")

    # Market rows
    market_rows = ""
    for m in top_markets:
        yes = m["yes"]
        no = 100 - yes
        yc = "#00875a" if yes >= 50 else "#cc2244"
        nc = "#cc2244" if yes >= 50 else "#00875a"
        vol = f"${m.get('volume', 0):,.0f}" if m.get("volume") else ""
        plat = "KALSHI" if m.get("source") == "kalshi" else "POLY"
        pc = "#0066cc" if plat == "KALSHI" else "#6b3fa0"
        sig = "BUY YES" if yes >= 70 else ("BUY NO" if yes <= 30 else "HOLD")
        sc = "#00875a" if yes >= 70 else ("#cc2244" if yes <= 30 else "#997a00")
        url = m.get("url", SITE)
        market_rows += f"""<tr>
<td style="padding:14px 0;border-bottom:1px solid #1a1a2e;">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td><span style="color:{pc};font-size:10px;font-weight:700;">{plat}</span>
<br><a href="{url}" style="color:#e0e0e0;text-decoration:none;font-size:14px;font-weight:600;line-height:20px;">{m['question'][:60]}</a>
<br><span style="color:#00d68f;font-size:15px;font-weight:700;">YES {yes}&#162;</span> &nbsp;<span style="color:#ff3b5c;font-size:15px;font-weight:700;">NO {no}&#162;</span> &nbsp;<span style="color:#555;font-size:11px;">{vol}</span></td>
</tr></table>
</td></tr>"""

    # Arbitrage rows
    arb_rows = ""
    if arbitrage:
        for a in arbitrage[:3]:
            arb_rows += f"""<tr><td style="padding:12px 0;border-bottom:1px solid #f0f0f0;">
<span style="font-size:14px;font-weight:600;color:#1a1a1a;">{a['topic']}</span><br>
<span style="color:#0066cc;">Kalshi {a['kalshi']['yes']}&#162;</span> vs <span style="color:#6b3fa0;">Poly {a['poly']['yes']}&#162;</span>
&nbsp;<span style="color:#997a00;font-weight:700;font-size:15px;">{a['diff']}&#162; spread</span>
</td></tr>"""
    else:
        arb_rows = '<tr><td style="padding:12px 0;color:#999;">No arbitrage this week.</td></tr>'

    # Movers rows
    mover_rows = ""
    for m in movers:
        yes = m["yes"]
        yc = "#00875a" if yes >= 70 else ("#cc2244" if yes <= 30 else "#999")
        sig = "BUY YES" if yes >= 70 else ("BUY NO" if yes <= 30 else "HOLD")
        sc = "#00875a" if yes >= 70 else ("#cc2244" if yes <= 30 else "#997a00")
        q = m["question"][:50] + ("..." if len(m["question"]) > 50 else "")
        mover_rows += f"""<tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
<span style="color:#333;font-size:14px;">{q}</span>
<span style="float:right;color:{yc};font-size:16px;font-weight:700;">{yes}&#162; <span style="color:{sc};font-size:10px;">{sig}</span></span>
</td></tr>"""

    # Bot stats
    bot_stats = ""
    try:
        import httpx as _hx
        async with _hx.AsyncClient() as _c:
            _br = await _c.get("https://web-production-c8a5b.up.railway.app/api/bot/status", timeout=5)
            _bd = _br.json()
            bot_equity = f"${_bd.get('equity_cents', 0) / 100:.2f}"
            bot_running = "Running" if _bd.get("running") else "Stopped"
            bot_stats = f'<tr><td style="padding:16px;background:#0a1628;border-radius:8px;margin-bottom:12px;"><table width="100%"><tr><td style="color:#0088ff;font-size:11px;font-weight:700;letter-spacing:2px;">BOT STATUS</td><td align="right" style="color:#00d68f;font-size:14px;font-weight:700;">{bot_running} &middot; {bot_equity}</td></tr></table></td></tr><tr><td style="height:12px;"></td></tr>'
    except Exception:
        pass

    # Scored markets as cards — matching website style
    scored_rows = ""
    scores = compute_sygnal_scores(kalshi, poly)
    top_scored = sorted(scores, key=lambda x: x["score"], reverse=True)[:3]
    for s in top_scored:
        sc = s["score"]
        sig = s["signal"]
        sc_color = "#00d68f" if sc >= 60 else ("#f0b000" if sc >= 40 else "#ff3b5c")
        sig_color = "#00d68f" if "YES" in sig else ("#ff3b5c" if "NO" in sig else "#888")
        sig_bg = "rgba(0,214,143,0.08)" if "YES" in sig else ("rgba(255,59,92,0.08)" if "NO" in sig else "rgba(136,136,136,0.08)")
        plat = "KALSHI" if s.get("source") == "kalshi" else "POLY"
        plat_color = "#0088ff" if plat == "KALSHI" else "#00d68f"
        plat_bg = "rgba(0,136,255,0.08)" if plat == "KALSHI" else "rgba(0,214,143,0.08)"
        q_text = s["question"][:65]
        if len(s["question"]) > 65:
            q_text += "..."
        scored_rows += f'''<tr><td style="padding:6px 0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border:1px solid #e0e0e0;border-radius:12px;" class="email-card">
<tr><td style="padding:20px;">
<!-- Platform + Signal row -->
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td><span style="font-size:9px;font-weight:700;color:{plat_color};letter-spacing:1px;background:{plat_bg};padding:3px 10px;border-radius:4px;">{plat}</span></td>
<td align="right"><span style="color:{sig_color};font-size:9px;font-weight:700;background:{sig_bg};padding:3px 10px;border-radius:4px;">{sig}</span></td>
</tr></table>
<!-- Question (fixed height for consistent cards) -->
<div style="color:#1a1a1a;font-size:14px;font-weight:600;line-height:1.5;margin:14px 0;min-height:42px;" class="email-text">{q_text}</div>
<!-- Prices -->
<div style="margin-bottom:14px;">
<span style="color:#00875a;font-size:16px;font-weight:700;">YES {s["yes"]}&#162;</span>
<span style="color:#ccc;font-size:11px;padding:0 6px;" class="email-dim">/</span>
<span style="color:#cc2244;font-size:16px;font-weight:700;">NO {s["no"]}&#162;</span>
</div>
<!-- Score badge -->
<table cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;"><div style="width:32px;height:32px;border-radius:50%;border:2px solid {sc_color};text-align:center;line-height:32px;color:{sc_color};font-size:13px;font-weight:800;">{sc}</div></td>
<td style="padding-left:8px;vertical-align:middle;"><span style="font-size:10px;color:#999;font-weight:600;letter-spacing:1px;">SYGNAL SCORE</span></td>
</tr></table>
</td></tr></table>
</td></tr>'''

    html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
:root {{ color-scheme: light dark; }}
@media (prefers-color-scheme: dark) {{
  .email-bg {{ background-color: #0a0a12 !important; }}
  .email-wrapper {{ background-color: #0e0e1a !important; border-color: #1a1a2e !important; }}
  .email-card {{ background-color: #12121f !important; border-color: rgba(255,255,255,0.06) !important; }}
  .email-text {{ color: #e0e0e0 !important; }}
  .email-dim {{ color: #666 !important; }}
  .email-header {{ color: #ffffff !important; }}
  .email-bot-bg {{ background-color: #0a1628 !important; border-color: #1a2a4a !important; }}
  .email-divider {{ background-color: #1a1a2e !important; }}
  .email-sub {{ color: #888 !important; }}
}}
</style>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" class="email-bg">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 12px;">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;">

<!-- Header -->
<tr><td align="center" style="padding:28px 0 20px;text-align:center;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="text-align:center;">
<div style="font-size:28px;font-weight:800;color:#0a0a12;letter-spacing:4px;text-align:center;" class="email-header">SYGNAL</div>
<div style="font-size:10px;color:#0088ff;font-weight:700;letter-spacing:4px;margin-top:4px;text-align:center;">WEEKLY MARKET DIGEST</div>
<div style="font-size:11px;color:#999;margin-top:6px;text-align:center;" class="email-sub">{date_str} &middot; {len(all_markets)} markets tracked</div>
</td></tr></table>
</td></tr>

<!-- Blue accent line -->
<tr><td style="padding:0;"><div style="height:3px;background:linear-gradient(90deg,#0088ff,#00d68f);border-radius:2px;">&nbsp;</div></td></tr>

<!-- Main content wrapper -->
<tr><td style="padding:24px 22px;background:#ffffff;border:1px solid #e8e8e8;border-top:none;border-radius:0 0 14px 14px;" class="email-wrapper">

<!-- Bot stats -->
<!--USER_BOT_PLACEHOLDER-->

<!-- Divider -->
<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:4px 0 16px;"><div style="height:1px;background:#e8e8e8;" class="email-divider"></div></td></tr></table>

<!-- Section header -->
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:0 0 12px;">
<span style="font-size:10px;font-weight:700;color:#0088ff;letter-spacing:2px;">TOP SYGNAL SCORES</span>
<span style="font-size:10px;color:#bbb;float:right;" class="email-sub">This week's best</span>
</td></tr>
{scored_rows}
</table>

<!-- CTA -->
<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:4px 0 0;"><div style="height:1px;background:#e8e8e8;" class="email-divider"></div></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:22px 0 6px;">
<table cellpadding="0" cellspacing="0"><tr><td bgcolor="#0088ff" style="padding:14px 48px;border-radius:10px;">
<a href="{SITE}" style="color:#fff;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:0.5px;">Open Dashboard &#8594;</a>
</td></tr></table>
</td></tr></table>

</td></tr>

<!-- Footer -->
<tr><td style="padding:20px 0;text-align:center;">
<div style="font-size:11px;color:#aaa;" class="email-sub">Sygnal Markets &middot; sygnalmarkets.com</div>
<a href="{SITE}/api/unsubscribe" style="font-size:10px;color:#0088ff;text-decoration:none;">Unsubscribe</a>
</td></tr>

</table>
</td></tr></table>
</body></html>"""

    # Pull admin bot data for preview
    all_bot = load_auto_bot_trades()
    admin_data = all_bot.get("joeydeagan2010@gmail.com", {})
    a_balance = admin_data.get("balance", 10000)
    a_pnl = admin_data.get("total_pnl", 0)
    a_open = len([t for t in admin_data.get("trades", []) if not t.get("resolved")])
    a_resolved = [t for t in admin_data.get("trades", []) if t.get("resolved")]
    a_wins = sum(1 for t in a_resolved if t.get("outcome") == "win")
    a_losses = sum(1 for t in a_resolved if t.get("outcome") == "loss")
    a_pnl_color = "#00d68f" if a_pnl >= 0 else "#ff3b5c"
    a_pnl_str = f"+${a_pnl:.2f}" if a_pnl >= 0 else f"-${abs(a_pnl):.2f}"

    user_bot_html = f'''<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef3ff;border:1px solid #d0d8e8;border-radius:12px;margin-bottom:8px;" class="email-bot-bg">
<tr><td style="padding:20px;">
<div style="font-size:10px;font-weight:700;color:#0088ff;letter-spacing:2px;margin-bottom:14px;">YOUR BOT</div>
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td width="25%" style="text-align:center;vertical-align:top;padding:0 6px;">
<div style="font-size:20px;font-weight:800;color:#1a1a1a;line-height:1;" class="email-text">${a_balance:,.0f}</div>
<div style="font-size:9px;color:#999;letter-spacing:1px;margin-top:6px;font-weight:600;">BALANCE</div>
</td>
<td width="25%" style="text-align:center;vertical-align:top;padding:0 6px;">
<div style="font-size:20px;font-weight:800;color:{a_pnl_color};line-height:1;">{a_pnl_str}</div>
<div style="font-size:9px;color:#999;letter-spacing:1px;margin-top:6px;font-weight:600;">P&amp;L</div>
</td>
<td width="25%" style="text-align:center;vertical-align:top;padding:0 6px;">
<div style="font-size:20px;font-weight:800;color:#1a1a1a;line-height:1;" class="email-text">{a_open}</div>
<div style="font-size:9px;color:#999;letter-spacing:1px;margin-top:6px;font-weight:600;">OPEN</div>
</td>
<td width="25%" style="text-align:center;vertical-align:top;padding:0 6px;">
<div style="font-size:20px;font-weight:800;color:#1a1a1a;line-height:1;" class="email-text">{a_wins}W/{a_losses}L</div>
<div style="font-size:9px;color:#999;letter-spacing:1px;margin-top:6px;font-weight:600;">RECORD</div>
</td>
</tr>
</table>
</td></tr></table>'''

    # For preview: inject admin bot data; for send: keep placeholder for per-user personalization
    preview_html = html.replace("<!--USER_BOT_PLACEHOLDER-->", user_bot_html)
    # Store raw template (with placeholder) as attribute for send_newsletter to use
    resp = HTMLResponse(content=preview_html)
    resp._raw_template = html  # template with placeholder intact
    return resp


@app.get("/api/newsletter/preview")
async def preview_newsletter():
    """Preview the newsletter (same as generate but returns metadata too)."""
    subs = load_subscribers()
    return {
        "subscriber_count": len(subs),
        "preview_url": "/api/newsletter/generate",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/newsletter/send")
async def send_newsletter():
    """Send the newsletter to all subscribers via SendGrid."""
    if not SENDGRID_API_KEY:
        return JSONResponse({"error": "SendGrid API key not configured. Set SENDGRID_API_KEY env var."}, status_code=500)

    subs = load_subscribers()
    if not subs:
        return {"error": "No subscribers", "sent": 0}

    # Generate the newsletter HTML
    newsletter_response = await generate_newsletter()
    # Use raw template (with placeholder) for per-user personalization
    html_template = getattr(newsletter_response, '_raw_template', None)
    if not html_template:
        html_template = newsletter_response.body.decode() if hasattr(newsletter_response, 'body') else str(newsletter_response)

    sent = 0
    errors = []

    all_bot_trades = load_auto_bot_trades()

    for sub in subs:
        try:
            email = sub.get("email", sub) if isinstance(sub, dict) else str(sub)
            # Personalize with user's bot data
            user_section = ""
            user_data = all_bot_trades.get(email.lower(), {})
            if user_data:
                balance = user_data.get("balance", 10000)
                total_pnl = user_data.get("total_pnl", 0)
                open_trades = [t for t in user_data.get("trades", []) if not t.get("resolved")]
                resolved = [t for t in user_data.get("trades", []) if t.get("resolved")]
                wins = sum(1 for t in resolved if t.get("outcome") == "win")
                losses = sum(1 for t in resolved if t.get("outcome") == "loss")
                pnl_color = "#00d68f" if total_pnl >= 0 else "#ff3b5c"
                pnl_str = f"+${total_pnl:.2f}" if total_pnl >= 0 else f"-${abs(total_pnl):.2f}"

                user_section = f'''<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef3ff;border:1px solid #d0d8e8;border-radius:12px;margin-bottom:8px;" class="email-bot-bg">
<tr><td style="padding:20px;">
<div style="font-size:10px;font-weight:700;color:#0088ff;letter-spacing:2px;margin-bottom:14px;">YOUR BOT</div>
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td width="25%" style="text-align:center;vertical-align:top;padding:0 6px;">
<div style="font-size:20px;font-weight:800;color:#1a1a1a;line-height:1;" class="email-text">${balance:,.0f}</div>
<div style="font-size:9px;color:#999;letter-spacing:1px;margin-top:6px;font-weight:600;">BALANCE</div>
</td>
<td width="25%" style="text-align:center;vertical-align:top;padding:0 6px;">
<div style="font-size:20px;font-weight:800;color:{pnl_color};line-height:1;">{pnl_str}</div>
<div style="font-size:9px;color:#999;letter-spacing:1px;margin-top:6px;font-weight:600;">P&amp;L</div>
</td>
<td width="25%" style="text-align:center;vertical-align:top;padding:0 6px;">
<div style="font-size:20px;font-weight:800;color:#1a1a1a;line-height:1;" class="email-text">{len(open_trades)}</div>
<div style="font-size:9px;color:#999;letter-spacing:1px;margin-top:6px;font-weight:600;">OPEN</div>
</td>
<td width="25%" style="text-align:center;vertical-align:top;padding:0 6px;">
<div style="font-size:20px;font-weight:800;color:#1a1a1a;line-height:1;" class="email-text">{wins}W/{losses}L</div>
<div style="font-size:9px;color:#999;letter-spacing:1px;margin-top:6px;font-weight:600;">RECORD</div>
</td>
</tr>
</table>
</td></tr></table>'''

            personalized_html = html_template.replace("<!--USER_BOT_PLACEHOLDER-->", user_section)

            # Use SendGrid v3 REST API directly (more reliable than SDK)
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.sendgrid.com/v3/mail/send",
                    headers={
                        "Authorization": f"Bearer {SENDGRID_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "personalizations": [{"to": [{"email": email}]}],
                        "from": {"email": SENDGRID_FROM_EMAIL, "name": "Sygnal Markets"},
                        "subject": f"Your Sygnal Weekly — {datetime.now().strftime('%B %d')}",
                        "content": [{"type": "text/html", "value": personalized_html}],
                    },
                )
                if resp.status_code >= 400:
                    raise Exception(f"SendGrid {resp.status_code}: {resp.text}")
            sent += 1
        except Exception as e:
            errors.append({"email": email if 'email' in dir() else str(sub), "error": str(e)})

    return {
        "status": "sent",
        "sent": sent,
        "total_subscribers": len(subs),
        "errors": errors,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ─── AFFILIATE CLICK TRACKING ───

CLICKS_FILE = os.path.join(DATA_DIR, "clicks.json")


@app.post("/api/clicks")
async def track_click(request: Request):
    body = await request.json()
    platform = body.get("platform", "unknown")
    try:
        with open(CLICKS_FILE, "r") as f:
            clicks = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        clicks = {}
    clicks[platform] = clicks.get(platform, 0) + 1
    clicks["total"] = clicks.get("total", 0) + 1
    with open(CLICKS_FILE, "w") as f:
        json.dump(clicks, f)
    return {"status": "tracked"}


@app.get("/api/clicks")
async def get_clicks():
    try:
        with open(CLICKS_FILE, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


# ─── SEO: ROBOTS.TXT + SITEMAP ───

@app.get("/robots.txt")
async def robots():
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(
        "User-agent: *\nAllow: /\nSitemap: https://sygnal-markets.fly.dev/sitemap.xml\n"
    )


@app.get("/sitemap.xml")
async def sitemap():
    from fastapi.responses import Response
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://sygnal-markets.fly.dev/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>
</urlset>"""
    return Response(content=xml, media_type="application/xml")


# ─── WEEKLY RECAP ───

@app.get("/api/recap")
async def get_recap():
    """Generate weekly market recap from current data."""
    markets_data = await get_all_markets()
    kalshi = markets_data.get("kalshi", [])
    poly = markets_data.get("polymarket", [])
    arb = markets_data.get("arbitrage", [])
    all_markets = kalshi + poly

    # Top by volume
    by_volume = sorted(all_markets, key=lambda x: x.get("volume", 0), reverse=True)[:5]

    # Most interesting (not dead markets)
    interesting = [m for m in all_markets if 5 <= m.get("yes", 50) <= 95]
    interesting.sort(key=lambda x: x.get("volume", 0), reverse=True)

    # Highest conviction
    movers = sorted(all_markets, key=lambda x: abs(x.get("yes", 50) - 50), reverse=True)[:5]

    # Category breakdown
    categories = {}
    for m in all_markets:
        cat = m.get("category", "other")
        categories[cat] = categories.get(cat, 0) + 1

    # Generate shareable text
    top3 = interesting[:3]
    share_text = f"Sygnal Weekly Recap\n\n"
    for m in top3:
        sig = "BUY YES" if m["yes"] >= 70 else ("BUY NO" if m["yes"] <= 30 else "WATCH")
        share_text += f"{m['question'][:50]}\nYES {m['yes']}c — {sig}\n\n"
    share_text += f"{len(all_markets)} markets tracked across Kalshi & Polymarket\nhttps://sygnal-markets.fly.dev"

    return {
        "date": datetime.now().strftime("%B %d, %Y"),
        "total_markets": len(all_markets),
        "kalshi_count": len(kalshi),
        "poly_count": len(poly),
        "arbitrage_count": len(arb),
        "top_by_volume": by_volume,
        "interesting": interesting[:8],
        "highest_conviction": movers,
        "categories": categories,
        "arbitrage": arb[:3],
        "share_text": share_text,
    }


# ─── Sygnal PRO ───

STRIPE_PRICE_ID = os.environ.get("STRIPE_PRICE_ID", "")
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
PRO_USERS_FILE = os.path.join(DATA_DIR, "pro_users.json")


def load_pro_users():
    try:
        with open(PRO_USERS_FILE, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


@app.post("/api/pro/checkout")
async def pro_checkout(request: Request):
    """Create a Stripe Checkout session for Sygnal Pro."""
    if not STRIPE_SECRET_KEY:
        return JSONResponse({"error": "Stripe not configured yet"}, status_code=500)

    try:
        import stripe
        stripe.api_key = STRIPE_SECRET_KEY

        body = await request.json()
        email = body.get("email", "")

        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": STRIPE_PRICE_ID, "quantity": 1}],
            customer_email=email if email else None,
            success_url="https://sygnalmarkets.com/?pro=success",
            cancel_url="https://sygnalmarkets.com/?pro=cancel",
            metadata={"product": "sygnal_pro"},
        )
        return {"url": session.url}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/api/pro/webhook")
async def pro_webhook(request: Request):
    """Handle Stripe webhook for subscription confirmation."""
    try:
        import stripe
        stripe.api_key = STRIPE_SECRET_KEY

        body = await request.body()
        event = json.loads(body)

        if event.get("type") == "checkout.session.completed":
            session = event["data"]["object"]
            email = session.get("customer_email", "")
            if email:
                pros = load_pro_users()
                if email not in pros:
                    pros.append(email)
                    with open(PRO_USERS_FILE, "w") as f:
                        json.dump(pros, f)
        return {"status": "ok"}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)


@app.post("/api/pro/grant")
async def grant_pro(request: Request):
    """Admin: manually grant Pro access to an email (for bypasses)."""
    body = await request.json()
    email = body.get("email", "").lower().strip()
    admin_key = body.get("admin_key", "")
    # Simple admin auth — only you can grant Pro
    if admin_key != "sygnal-admin-2026":
        return JSONResponse({"error": "unauthorized"}, status_code=403)
    if not email:
        return JSONResponse({"error": "email required"}, status_code=400)
    pros = load_pro_users()
    if email not in pros:
        pros.append(email)
        with open(PRO_USERS_FILE, "w") as f:
            json.dump(pros, f)
    return {"ok": True, "email": email, "pro": True}


# Admin emails that always have Pro (survives deploys)
ADMIN_PRO_EMAILS = ["joeydeagan2010@gmail.com", "briandeagan@gmail.com"]

@app.post("/api/pro/verify-checkout")
async def verify_checkout(request: Request):
    """Verify a completed Stripe checkout and grant Pro. Called client-side after redirect."""
    try:
        import stripe
        stripe.api_key = STRIPE_SECRET_KEY
        body = await request.json()
        email = body.get("email", "").lower().strip()
        if not email:
            return {"error": "email required"}

        # Check Stripe for recent completed checkouts for this email
        sessions = stripe.checkout.Session.list(
            customer_details={"email": email},
            limit=5,
        )
        for session in sessions.data:
            if session.status == "complete" and session.payment_status == "paid":
                # Grant Pro
                pros = load_pro_users()
                if email not in pros:
                    pros.append(email)
                    with open(PRO_USERS_FILE, "w") as f:
                        json.dump(pros, f)
                return {"pro": True, "verified": True}

        return {"pro": False, "verified": False}
    except Exception as e:
        return {"error": str(e)}


@app.get("/api/pro/check")
async def check_pro(email: str = ""):
    """Check if email is a pro user."""
    if not email:
        return {"pro": False}
    if email.lower() in ADMIN_PRO_EMAILS:
        return {"pro": True}
    pros = load_pro_users()
    return {"pro": email.lower() in [p.lower() for p in pros]}


# ─── SYGNAL SCORE API ───

import math

def _word_set(text):
    stop = {'will', 'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'are', 'was', 'were', 'been', 'being', 'before', 'after', 'between', 'about', 'than', 'there', 'their', 'what', 'when', 'where', 'which', 'who', 'how', 'not', 'but', 'does', 'did', 'any', 'its', 'his', 'her', 'our', 'more', 'most', 'also', 'into', 'over', 'such', 'only'}
    return set(w.lower() for w in (text or "").split() if len(w) > 2 and w.lower() not in stop)

def _extract_entities(text):
    """Extract proper nouns, numbers, and dates from text."""
    import re
    t = text or ""
    # Find capitalized words (names), numbers, years, percentages
    names = set(w.lower() for w in re.findall(r'[A-Z][a-z]{2,}', t))
    numbers = set(re.findall(r'\b\d+(?:\.\d+)?%?\b', t))
    return names, numbers

def _word_similarity(a, b):
    wa, wb = _word_set(a), _word_set(b)
    if not wa or not wb:
        return 0
    overlap = wa & wb
    # Require at least 3 matching meaningful words
    if len(overlap) < 3:
        return 0

    # Check entity overlap — names and numbers must also match
    names_a, nums_a = _extract_entities(a)
    names_b, nums_b = _extract_entities(b)

    # If both have names, at least one name must overlap
    if names_a and names_b:
        name_overlap = names_a & names_b
        if not name_overlap:
            return 0  # Different people/things — not the same market

    # If both have numbers/dates, at least one must overlap
    if nums_a and nums_b:
        num_overlap = nums_a & nums_b
        if not num_overlap:
            return 0  # Different quantities/dates — not the same market

    return len(overlap) / min(len(wa), len(wb))

_vegas_cache = {"data": [], "ts": 0}

async def get_vegas_odds():
    """Get Vegas odds with 10-min cache."""
    now = datetime.now(timezone.utc).timestamp()
    if _vegas_cache["data"] and now - _vegas_cache["ts"] < 600:
        return _vegas_cache["data"]
    try:
        async with httpx.AsyncClient() as client:
            odds = await fetch_sports_odds_summary(client)
            _vegas_cache["data"] = odds
            _vegas_cache["ts"] = now
            return odds
    except Exception:
        return _vegas_cache["data"]

def _match_vegas(question, vegas_odds):
    """Try to match a market question to Vegas odds by team names."""
    q_lower = question.lower()
    for game in vegas_odds:
        home = game["home"].lower()
        away = game["away"].lower()
        # Check if both team names (or parts) appear in the question
        home_parts = [w for w in home.split() if len(w) > 3]
        away_parts = [w for w in away.split() if len(w) > 3]
        home_match = any(p in q_lower for p in home_parts) if home_parts else False
        away_match = any(p in q_lower for p in away_parts) if away_parts else False
        # Need at least one team to match, plus sport-related keywords
        if home_match or away_match:
            # Figure out which team the question is about
            if "win" in q_lower:
                if home_match and not away_match:
                    return game, "home"
                elif away_match and not home_match:
                    return game, "away"
    return None, None

def compute_sygnal_scores(kalshi_markets, poly_markets, vegas_odds=None):
    """Port of the frontend Sygnal Score algorithm to Python."""
    all_markets = kalshi_markets + poly_markets

    # Build cross-platform price map
    cross_map = {}
    for k in kalshi_markets:
        best, best_sim = None, 0
        for p in poly_markets:
            s = _word_similarity(k.get("question", ""), p.get("question", ""))
            if s > best_sim and s >= 0.60:
                best_sim = s
                best = p
        if best:
            diff = abs((k.get("yes", 50)) - (best.get("yes", 50)))
            cross_map[k.get("ticker", "")] = {"match": best, "priceDiff": diff}
            cross_map[best.get("ticker", "")] = {"match": k, "priceDiff": diff}

    max_vol = max((m.get("volume", 0) for m in all_markets), default=1) or 1
    results = []

    for m in all_markets:
        yes = m.get("yes", 50)
        vol = m.get("volume", 0) or 0
        ticker = m.get("ticker", "")

        no = 100 - yes
        xp = cross_map.get(ticker)

        # 1. Edge Detection (0-35): Cross-platform + Vegas mispricing
        edge_score = 0
        edge_size = 0
        edge_direction = "NEUTRAL"
        vegas_edge = 0
        if xp:
            other_yes = xp["match"].get("yes", 50)
            edge_size = abs(yes - other_yes)
            if edge_size >= 3:
                edge_score = min(round(35 * (edge_size / 12)), 35)
            if yes < other_yes - 2: edge_direction = "YES"
            elif yes > other_yes + 2: edge_direction = "NO"

        # Vegas odds comparison for sports markets
        if vegas_odds:
            vegas_match, vegas_side = _match_vegas(m.get("question", ""), vegas_odds)
            if vegas_match:
                vegas_prob = vegas_match["home_prob"] if vegas_side == "home" else vegas_match["away_prob"]
                vegas_edge = abs(yes - vegas_prob)
                if vegas_edge >= 5:
                    # Vegas disagrees with market — potential edge
                    edge_score = min(35, edge_score + min(round(15 * (vegas_edge / 10)), 15))
                    if yes < vegas_prob - 3 and edge_direction == "NEUTRAL":
                        edge_direction = "YES"  # Market underprices YES vs Vegas
                    elif yes > vegas_prob + 3 and edge_direction == "NEUTRAL":
                        edge_direction = "NO"

        # 2. Value (0-25): Risk/reward BUT penalize extreme longshots
        yes_roi = (100 - yes) / yes if yes > 0 else 0
        no_roi = (100 - no) / no if no > 0 else 0
        best_roi = max(yes_roi, no_roi)
        if best_roi >= 4: value_score = 18  # High ROI but likely longshot
        elif best_roi >= 2.5: value_score = 22
        elif best_roi >= 1.5: value_score = 25  # Sweet spot: good odds + decent probability
        elif best_roi >= 1: value_score = 20
        elif best_roi >= 0.5: value_score = 12
        elif best_roi >= 0.2: value_score = 6
        else: value_score = 1
        # Penalize extreme odds — these are lottery tickets
        if yes <= 15 or yes >= 85: value_score = max(0, value_score - 10)
        if yes <= 5 or yes >= 95: value_score = 0

        # 3. Momentum (0-15): Real price movement from history
        change_1h, change_6h, vol_spike = get_momentum(ticker)
        momentum_score = 2  # Base
        abs_1h = abs(change_1h)
        abs_6h = abs(change_6h)
        if abs_1h >= 5: momentum_score += 5
        elif abs_1h >= 3: momentum_score += 3
        elif abs_1h >= 1: momentum_score += 1
        if abs_6h >= 8: momentum_score += 5
        elif abs_6h >= 4: momentum_score += 3
        elif abs_6h >= 2: momentum_score += 1
        if vol_spike: momentum_score += 3
        momentum_score = min(momentum_score, 15)

        # 4. Confidence (0-15): Volume-based price reliability
        if vol >= 500_000: conf_score = 15
        elif vol >= 100_000: conf_score = 13
        elif vol >= 50_000: conf_score = 11
        elif vol >= 10_000: conf_score = 9
        elif vol >= 5_000: conf_score = 7
        elif vol >= 1_000: conf_score = 5
        elif vol >= 100: conf_score = 3
        else: conf_score = 1

        # 5. Timing (0-9): Cross-platform + volume spike + momentum confirmation
        timing_score = 0
        if edge_size >= 3 and vol >= 10_000: timing_score += 5
        if vol_spike: timing_score += 3
        if vol >= 50_000: timing_score += 2
        if 15 <= yes <= 85: timing_score = max(timing_score, 3)

        total = max(1, min(edge_score + value_score + momentum_score + conf_score + timing_score, 99))

        # Directional signal — which side to bet
        signal = "HOLD"
        cross_vote = edge_direction
        value_vote = "YES" if yes <= 45 else ("NO" if yes >= 55 else "NEUTRAL")

        # Cross-platform edge alone is enough for LEAN
        if cross_vote == "YES": signal = "LEAN YES"
        elif cross_vote == "NO": signal = "LEAN NO"
        # Cross-platform + value agreement = BUY
        if cross_vote == "YES" and value_vote == "YES": signal = "BUY YES"
        elif cross_vote == "NO" and value_vote == "NO": signal = "BUY NO"
        # Value alone — LEAN if price suggests opportunity
        if signal == "HOLD" and 15 <= yes <= 45: signal = "LEAN YES"
        elif signal == "HOLD" and 55 <= yes <= 85: signal = "LEAN NO"
        # Decent score without cross-platform = LEAN based on direction
        if signal == "HOLD" and total >= 35:
            if yes <= 48: signal = "LEAN YES"
            elif yes >= 52: signal = "LEAN NO"
        # Never bet on extreme extremes
        if yes <= 5 or yes >= 95: signal = "HOLD"

        results.append({
            "ticker": ticker,
            "question": m.get("question", ""),
            "source": m.get("source", ""),
            "yes": yes,
            "no": no,
            "volume": vol,
            "score": total,
            "signal": signal,
            "cross_edge": edge_size,
            "edge_direction": edge_direction,
            "best_roi": round(best_roi, 2),
            "days_left": m.get("days_left", -1),
            "close_time": m.get("close_time", ""),
            "momentum_1h": change_1h,
            "momentum_6h": change_6h,
            "volume_spike": vol_spike,
            "vegas_edge": vegas_edge,
            "breakdown": {
                "edge": edge_score,
                "value": value_score,
                "momentum": momentum_score,
                "confidence": conf_score,
                "timing": timing_score,
            },
        })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results


_scores_cache = {"scores": [], "ts": 0}

@app.get("/api/scores")
async def get_scores(min_score: int = 0):
    """Get Sygnal Scores for all markets. Cached for 2 minutes."""
    now = datetime.now(timezone.utc).timestamp()
    if not _scores_cache["scores"] or now - _scores_cache["ts"] > 120:
        kalshi_data = await get_kalshi()
        poly_data = await get_polymarket()
        kalshi = kalshi_data.get("markets", [])
        poly = poly_data.get("markets", [])
        vegas = await get_vegas_odds()
        _scores_cache["scores"] = compute_sygnal_scores(kalshi, poly, vegas_odds=vegas)
        _scores_cache["ts"] = now
    scores = _scores_cache["scores"]
    if min_score > 0:
        scores = [s for s in scores if s["score"] >= min_score]
    return {"scores": scores, "count": len(scores)}


# ─── NEWS FEED ───

import xml.etree.ElementTree as ET

NEWS_CATEGORIES = {
    "politics": "US politics election policy when:2d",
    "economics": "economy jobs inflation GDP federal reserve when:2d",
    "crypto": "bitcoin ethereum crypto market when:2d",
    "sports": "NBA NFL MLB NHL sports odds when:2d",
    "markets": "prediction markets Kalshi Polymarket when:2d",
}

_news_cache = {"data": None, "ts": 0}
NEWS_CACHE_TTL = 900  # 15 minutes


async def fetch_news_category(client: httpx.AsyncClient, query: str, category: str):
    """Fetch news headlines from Google News RSS for a category."""
    try:
        url = f"https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"
        resp = await client.get(url, timeout=10)
        if resp.status_code != 200:
            return []
        root = ET.fromstring(resp.text)
        items = []
        cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
        for item in root.findall(".//item")[:8]:
            title = item.findtext("title", "")
            link = item.findtext("link", "")
            pub_date = item.findtext("pubDate", "")
            source = item.findtext("source", "")

            # Filter out old articles
            if pub_date:
                try:
                    from email.utils import parsedate_to_datetime
                    article_dt = parsedate_to_datetime(pub_date)
                    if article_dt < cutoff:
                        continue
                except Exception:
                    pass

            items.append({
                "title": title,
                "link": link,
                "source": source,
                "pub_date": pub_date,
                "category": category,
            })
        return items[:5]
    except Exception:
        return []


@app.get("/api/news")
async def get_news(category: str = ""):
    """Fetch news headlines relevant to active markets."""
    now = datetime.now(timezone.utc).timestamp()

    # Return cached if fresh
    if _news_cache["data"] and (now - _news_cache["ts"]) < NEWS_CACHE_TTL:
        cached = _news_cache["data"]
        if category:
            return {"articles": [a for a in cached if a["category"] == category]}
        return {"articles": cached}

    # Fetch current markets to build relevant search queries
    try:
        kalshi_data = await get_kalshi()
        kalshi_markets = kalshi_data.get("markets", [])
        # Extract top trending topics from market questions
        market_topics = set()
        for m in kalshi_markets[:30]:
            q = m.get("question", "").lower()
            if "bitcoin" in q or "btc" in q: market_topics.add("crypto")
            elif "ethereum" in q or "eth" in q: market_topics.add("crypto")
            elif "trump" in q or "election" in q or "president" in q or "congress" in q: market_topics.add("politics")
            elif "nba" in q or "nfl" in q or "mlb" in q or "nhl" in q or "masters" in q: market_topics.add("sports")
            elif "fed" in q or "inflation" in q or "gdp" in q or "jobs" in q or "rate" in q: market_topics.add("economics")
        # Always include markets category
        market_topics.add("markets")
        # If none matched, add defaults
        if len(market_topics) <= 1:
            market_topics.update(["politics", "crypto", "sports"])
    except Exception:
        market_topics = set(NEWS_CATEGORIES.keys())

    all_articles = []
    async with httpx.AsyncClient() as client:
        for cat in market_topics:
            query = NEWS_CATEGORIES.get(cat, cat + " when:2d")
            articles = await fetch_news_category(client, query, cat)
            all_articles.extend(articles)

    _news_cache["data"] = all_articles
    _news_cache["ts"] = now

    if category:
        return {"articles": [a for a in all_articles if a["category"] == category]}
    return {"articles": all_articles}


# ─── INTELLIGENCE API (Pro Feature) ───
# Real-world data overlays: polls, odds, weather, economic data

_intel_cache = {"data": None, "ts": 0}
INTEL_CACHE_TTL = 600  # 10 min


async def fetch_polling_data(client: httpx.AsyncClient):
    """Fetch RealClearPolitics-style polling averages from public sources."""
    polls = []
    try:
        # Use Google News to find recent polling data
        resp = await client.get(
            "https://news.google.com/rss/search?q=election+poll+average+2026&hl=en-US&gl=US&ceid=US:en",
            timeout=10,
        )
        if resp.status_code == 200:
            root = ET.fromstring(resp.text)
            for item in root.findall(".//item")[:5]:
                title = item.findtext("title", "")
                link = item.findtext("link", "")
                source = item.findtext("source", "")
                polls.append({"title": title, "source": source, "link": link, "type": "poll"})
    except Exception:
        pass

    # Hardcoded high-confidence political data points
    # These get updated when we see fresh data
    polls.extend([
        {"market_keyword": "trump", "data_point": "approval", "type": "static"},
        {"market_keyword": "election", "data_point": "polling_average", "type": "static"},
    ])
    return polls


async def fetch_sports_odds_summary(client: httpx.AsyncClient):
    """Fetch sports odds from free API for comparison."""
    odds = []
    try:
        # The Odds API — free tier
        odds_key = os.environ.get("ODDS_API_KEY", "")
        if not odds_key:
            return odds

        for sport in ["basketball_nba", "baseball_mlb", "icehockey_nhl"]:
            resp = await client.get(
                f"https://api.the-odds-api.com/v4/sports/{sport}/odds/",
                params={
                    "apiKey": odds_key,
                    "regions": "us",
                    "markets": "h2h",
                    "oddsFormat": "decimal",
                },
                timeout=10,
            )
            if resp.status_code != 200:
                continue

            games = resp.json()
            for game in games[:10]:
                home = game.get("home_team", "")
                away = game.get("away_team", "")
                # Average odds across bookmakers
                all_home_odds = []
                all_away_odds = []
                for bm in game.get("bookmakers", []):
                    for market in bm.get("markets", []):
                        if market.get("key") != "h2h":
                            continue
                        for outcome in market.get("outcomes", []):
                            if outcome.get("name") == home:
                                all_home_odds.append(outcome.get("price", 2.0))
                            elif outcome.get("name") == away:
                                all_away_odds.append(outcome.get("price", 2.0))

                if all_home_odds and all_away_odds:
                    avg_home = sum(all_home_odds) / len(all_home_odds)
                    avg_away = sum(all_away_odds) / len(all_away_odds)
                    # Convert decimal odds to implied probability
                    home_prob = round(1 / avg_home * 100)
                    away_prob = round(1 / avg_away * 100)
                    odds.append({
                        "home": home, "away": away, "sport": sport,
                        "home_prob": home_prob, "away_prob": away_prob,
                        "home_odds": round(avg_home, 2), "away_odds": round(avg_away, 2),
                        "bookmaker_count": len(all_home_odds),
                    })
    except Exception:
        pass
    return odds


@app.get("/api/intelligence")
async def get_intelligence():
    """Pro feature: real-world data overlays for smarter betting."""
    now = datetime.now(timezone.utc).timestamp()

    if _intel_cache["data"] and (now - _intel_cache["ts"]) < INTEL_CACHE_TTL:
        return _intel_cache["data"]

    async with httpx.AsyncClient() as client:
        polls = await fetch_polling_data(client)
        odds = await fetch_sports_odds_summary(client)

    result = {
        "polls": polls,
        "sports_odds": odds,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    _intel_cache["data"] = result
    _intel_cache["ts"] = now
    return result


# ─── BOT PAPER TRADES ───

BOT_PICKS_FILE = os.path.join(DATA_DIR, "bot_picks.json")


def load_bot_picks():
    try:
        with open(BOT_PICKS_FILE, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def save_bot_picks(picks):
    with open(BOT_PICKS_FILE, "w") as f:
        json.dump(picks[-100:], f)  # Keep last 100


@app.post("/api/bot/picks")
async def add_bot_pick(request: Request):
    """Bot posts its paper trade picks here."""
    body = await request.json()
    ticker = body.get("ticker", "")
    side = body.get("side", "")
    price = body.get("price", 0)
    score = body.get("score", 0)
    signal = body.get("signal", "")
    reason = body.get("reason", "")
    question = body.get("question", "")

    if not ticker or not side:
        return {"error": "ticker and side required"}

    pick = {
        "ticker": ticker,
        "question": question,
        "side": side,
        "price": price,
        "score": score,
        "signal": signal,
        "reason": reason,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "resolved": False,
        "outcome": None,
        "pnl": None,
    }

    picks = load_bot_picks()
    # Don't duplicate same ticker
    if any(p["ticker"] == ticker and not p["resolved"] for p in picks):
        return {"ok": True, "msg": "already tracked"}

    picks.append(pick)
    save_bot_picks(picks)
    return {"ok": True, "pick": pick}


@app.get("/api/bot/picks")
async def get_bot_picks(limit: int = 20):
    """Get bot's paper trade picks for display."""
    picks = load_bot_picks()
    # Most recent first
    picks.reverse()
    return {"picks": picks[:limit], "total": len(picks)}


@app.post("/api/bot/picks/resolve")
async def resolve_bot_pick(request: Request):
    """Resolve a bot pick with outcome."""
    body = await request.json()
    ticker = body.get("ticker", "")
    outcome = body.get("outcome", "")  # "win" or "loss"
    final_price = body.get("final_price", 0)

    picks = load_bot_picks()
    for p in picks:
        if p["ticker"] == ticker and not p["resolved"]:
            p["resolved"] = True
            p["outcome"] = outcome
            entry = p["price"]
            if p["side"] == "yes":
                p["pnl"] = (final_price - entry) if outcome == "win" else -entry
            else:
                p["pnl"] = ((100 - entry) - (100 - final_price)) if outcome == "win" else -(100 - entry)
            break

    save_bot_picks(picks)
    return {"ok": True}


# ─── COLLECTIVE LEARNING (Paper Trades Aggregation) ───

TRADES_AGG_FILE = os.path.join(DATA_DIR, "trades_aggregate.json")


def load_trades_agg():
    try:
        with open(TRADES_AGG_FILE, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"total": 0, "wins": 0, "by_score_range": {}, "by_category": {}}


def save_trades_agg(agg):
    with open(TRADES_AGG_FILE, "w") as f:
        json.dump(agg, f)


@app.post("/api/collective/trade")
async def record_collective_trade(request: Request):
    """Record a resolved paper trade for collective learning."""
    body = await request.json()
    ticker = body.get("ticker", "")
    side = body.get("side", "")
    score = body.get("score", 0)
    category = body.get("category", "other")
    outcome = body.get("outcome", "")  # "win" or "loss"
    signal = body.get("signal", "")

    if not outcome or outcome not in ("win", "loss"):
        return {"error": "outcome must be win or loss"}

    agg = load_trades_agg()
    agg["total"] += 1
    if outcome == "win":
        agg["wins"] += 1

    # Track by score range (0-19, 20-39, 40-59, 60-79, 80-99)
    score_range = f"{(score // 20) * 20}-{(score // 20) * 20 + 19}"
    if score_range not in agg["by_score_range"]:
        agg["by_score_range"][score_range] = {"total": 0, "wins": 0}
    agg["by_score_range"][score_range]["total"] += 1
    if outcome == "win":
        agg["by_score_range"][score_range]["wins"] += 1

    # Track by category
    if category not in agg["by_category"]:
        agg["by_category"][category] = {"total": 0, "wins": 0}
    agg["by_category"][category]["total"] += 1
    if outcome == "win":
        agg["by_category"][category]["wins"] += 1

    save_trades_agg(agg)
    return {"ok": True}


@app.get("/api/collective/stats")
async def get_collective_stats():
    """Get aggregate stats from all user paper trades — powers the score."""
    agg = load_trades_agg()
    win_rate = round(agg["wins"] / agg["total"] * 100) if agg["total"] > 0 else 0

    # Win rate by score range
    score_accuracy = {}
    for range_key, data in agg.get("by_score_range", {}).items():
        if data["total"] >= 3:
            score_accuracy[range_key] = {
                "win_rate": round(data["wins"] / data["total"] * 100),
                "trades": data["total"],
            }

    # Win rate by timeframe bucket
    timeframe_perf = {}
    for bucket, data in agg.get("by_timeframe", {}).items():
        if data["total"] >= 1:
            timeframe_perf[bucket] = {
                "win_rate": round(data["wins"] / data["total"] * 100) if data["total"] > 0 else 0,
                "trades": data["total"],
                "total_pnl": data.get("total_pnl", 0),
                "roi": round(data.get("total_pnl", 0) / max(data["total"], 1), 2),
            }

    return {
        "total_trades": agg["total"],
        "overall_win_rate": win_rate,
        "score_accuracy": score_accuracy,
        "by_category": agg.get("by_category", {}),
        "by_timeframe": timeframe_perf,
        "enough_data": agg["total"] >= 10,
    }


# ─── AUTO PAPER BOT (Per-User) ───

AUTO_BOT_FILE = os.path.join(DATA_DIR, "auto_bot_trades.json")


def load_auto_bot_trades():
    try:
        with open(AUTO_BOT_FILE, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}  # {user_email: [trades]}


def save_auto_bot_trades(data):
    with open(AUTO_BOT_FILE, "w") as f:
        json.dump(data, f)


@app.post("/api/autobot/register")
async def autobot_register(request: Request):
    """Register a user for auto-bot trading. Called on sign-in/sign-up."""
    body = await request.json()
    email = body.get("email", "").strip().lower()
    if not email or "@" not in email:
        return {"error": "valid email required"}

    all_trades = load_auto_bot_trades()
    if email in all_trades:
        return {"ok": True, "status": "already_registered", "balance": all_trades[email]["balance"]}

    all_trades[email] = {
        "balance": 10000,
        "trades": [],
        "total_pnl": 0,
        "created": datetime.now(timezone.utc).isoformat(),
        "settings": {"max_days": 30},
    }
    save_auto_bot_trades(all_trades)
    return {"ok": True, "status": "registered", "balance": 10000}


@app.post("/api/autobot/scan")
async def autobot_scan():
    """Run auto paper bot scan — places paper trades for all Pro users using Sygnal Scores."""
    try:
        # Get scored markets with Vegas odds for sports edge
        kalshi_data = await get_kalshi()
        poly_data = await get_polymarket()
        kalshi = kalshi_data.get("markets", [])
        poly = poly_data.get("markets", [])
        vegas = await get_vegas_odds()
        scores = compute_sygnal_scores(kalshi, poly, vegas_odds=vegas)

        # Include external picks from Railway Kalshi bot (baseball, etc.)
        ext_picks = load_bot_picks()
        ext_open = [p for p in ext_picks if not p.get("resolved") and p.get("ticker")]
        for ep in ext_open:
            # Add as high-priority BUY signal if not already in scores
            if not any(s["ticker"] == ep["ticker"] for s in scores):
                scores.append({
                    "ticker": ep["ticker"],
                    "question": ep.get("question", ""),
                    "source": "kalshi",
                    "yes": ep.get("price", 50) if ep.get("side") == "yes" else 100 - ep.get("price", 50),
                    "no": 100 - ep.get("price", 50) if ep.get("side") == "yes" else ep.get("price", 50),
                    "volume": 10000,
                    "score": max(ep.get("score", 60), 60),  # Treat external picks as high confidence
                    "signal": "BUY YES" if ep.get("side") == "yes" else "BUY NO",
                    "cross_edge": 10,
                    "edge_direction": "YES" if ep.get("side") == "yes" else "NO",
                    "best_roi": 1.0,
                    "days_left": 0,
                    "close_time": "",
                    "breakdown": {"edge": 20, "value": 15, "momentum": 10, "confidence": 10, "timing": 5},
                    "from_kalshi_bot": True,
                })

        # Only take actionable signals — prioritize BUY over LEAN
        buy_picks = []
        lean_picks = []
        for s in scores:
            if s["signal"] not in ("BUY YES", "BUY NO", "LEAN YES", "LEAN NO"):
                continue
            # BUY: score >= 30, LEAN: score >= 45 (need higher confidence)
            is_buy = "BUY" in s["signal"]
            if is_buy and s["score"] < 30:
                continue
            if not is_buy and s["score"] < 45:
                continue
            # Skip extreme longshots — Kelly sizing handles moderate ones
            s_yes = s.get("yes", 50)
            if s_yes <= 10 or s_yes >= 90:
                continue
            # Tag days_left but don't filter globally — per-user max_days handles it
            days_left = s.get("days_left", -1)
            # Hard cap: skip markets > 365 days out (absolute max)
            if days_left > 365 and days_left != -1:
                continue
            # Skip obviously long-term markets by keywords
            q_lower = s.get("question", "").lower()
            if any(w in q_lower for w in ["before 2030", "before 2029", "before 2028", "by 2030", "by 2029", "by 2028", "billionaire", "trillionaire"]):
                continue
            q = s.get("question", "")
            # Skip confusing sub-option markets
            if ": " in q and not q.startswith("Will") and not q.startswith("How"):
                parts = q.split(": ")
                if len(parts) == 2 and len(parts[1]) < 30:
                    s["question"] = parts[0] + ": " + parts[1]
            if is_buy:
                buy_picks.append(s)
            else:
                lean_picks.append(s)
        # Prioritize BUY signals, then fill remaining slots with LEAN
        buy_picks.sort(key=lambda s: s["score"], reverse=True)
        lean_picks.sort(key=lambda s: s["score"], reverse=True)
        top_picks = buy_picks[:5]
        if len(top_picks) < 5:
            top_picks += lean_picks[:5 - len(top_picks)]

        if not top_picks:
            return {"ok": True, "picks": 0, "msg": "No actionable signals"}

        # Only trade for users who signed in (registered via /api/autobot/register)
        pros = load_pro_users() + ADMIN_PRO_EMAILS
        pros = list(set(p.lower() for p in pros))
        all_trades = load_auto_bot_trades()
        all_emails = [e for e in all_trades.keys() if e and "@" in e]

        all_trades = load_auto_bot_trades()
        new_trades = 0

        for email in all_emails:
            if email not in all_trades:
                starting_balance = 10000  # Everyone gets $10K paper balance
                all_trades[email] = {"balance": starting_balance, "trades": [], "total_pnl": 0, "created": datetime.now(timezone.utc).isoformat()}

            user = all_trades[email]
            is_pro = email.lower() in [p.lower() for p in pros]

            # Pro users: $10K balance, weekly refill, 10 positions
            # Free users: $1K balance, no refill, 5 positions, 30-day trial
            if is_pro:
                # Weekly refill for Pro
                if user["balance"] < 5000:
                    created = user.get("created", "")
                    if created:
                        try:
                            days = (datetime.now(timezone.utc) - datetime.fromisoformat(created.replace("Z", "+00:00"))).days
                            if days > 0 and days % 7 == 0:
                                user["balance"] = 10000
                        except Exception:
                            pass

            if not is_pro:
                created = user.get("created", "")
                if created:
                    try:
                        created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                        days_active = (datetime.now(timezone.utc) - created_dt).days
                        if days_active > 30:
                            continue  # Trial expired
                    except Exception:
                        pass

            open_trades = [t for t in user["trades"] if not t.get("resolved")]
            max_positions = 15 if is_pro else 5
            user_settings = user.get("settings", {})

            if len(open_trades) >= max_positions:
                continue

            # Per-user settings
            user_max_days = user_settings.get("max_days", 30)
            if user_max_days == 0:
                user_max_days = 99999
            user_min_score = user_settings.get("min_score", 30) if is_pro else 30
            user_signal_filter = user_settings.get("signal_filter", "all") if is_pro else "all"
            user_categories = user_settings.get("categories", ["all"]) if is_pro else ["all"]
            risk_level = user_settings.get("risk_level", "moderate") if is_pro else "moderate"
            kelly_multiplier = {"conservative": 0.15, "moderate": 0.25, "aggressive": 0.40}.get(risk_level, 0.25)

            for pick in top_picks:
                # Skip markets beyond user's preferred timeframe
                pick_days = pick.get("days_left", -1)
                if pick_days > user_max_days or (pick_days < 0 and pick_days != -1):
                    continue
                # Skip below user's min score
                if pick["score"] < user_min_score:
                    continue
                # Signal filter (Pro): buy_only skips LEAN signals
                if user_signal_filter == "buy_only" and "LEAN" in pick["signal"]:
                    continue
                # Category filter (Pro)
                if "all" not in user_categories:
                    pick_cat = pick.get("category", "other")
                    if isinstance(pick_cat, str):
                        pick_cat = pick_cat.lower()
                    if pick_cat not in user_categories and pick.get("source", "") not in user_categories:
                        continue
                # Skip if already holding this ticker
                if any(t["ticker"] == pick["ticker"] and not t.get("resolved") for t in user["trades"]):
                    continue

                price = pick["yes"] if "YES" in pick["signal"] else pick["no"]
                if price <= 0 or price >= 100:
                    continue

                # --- Kelly Criterion Position Sizing ---
                market_prob = price / 100.0
                score = pick["score"]
                cross_edge = pick.get("cross_edge", 0)

                is_buy_signal = "BUY" in pick["signal"]
                if is_buy_signal:
                    edge_pct = 0.05 + (score - 30) * 0.003 + min(cross_edge, 15) * 0.005
                else:
                    edge_pct = 0.03 + (score - 50) * 0.002 + min(cross_edge, 15) * 0.003
                edge_pct = max(0.02, min(edge_pct, 0.25))

                our_prob = min(0.90, market_prob + edge_pct)

                payout_ratio = (1.0 / market_prob) - 1.0
                ev_per_dollar = our_prob * payout_ratio - (1 - our_prob)
                if ev_per_dollar < 0.03:
                    continue  # Skip bets with EV under 3 cents per dollar

                b = payout_ratio
                p = our_prob
                q = 1 - our_prob
                kelly_full = (b * p - q) / b if b > 0 else 0
                kelly_full = max(0, min(kelly_full, 0.25))

                # Risk level controls Kelly multiplier
                kelly_fraction = kelly_full * kelly_multiplier

                max_bet = 500 if is_pro else 100
                bet_amount = min(user["balance"] * kelly_fraction, max_bet)
                bet_amount = max(bet_amount, 5)
                if bet_amount > user["balance"] * 0.15:
                    bet_amount = user["balance"] * 0.15
                if bet_amount < 1 or user["balance"] < 10:
                    continue

                contracts = int(bet_amount / (price / 100))
                if contracts <= 0:
                    continue

                cost = contracts * price / 100
                user["balance"] -= cost

                trade = {
                    "ticker": pick["ticker"],
                    "question": pick["question"][:80],
                    "side": "yes" if "YES" in pick["signal"] else "no",
                    "price": price,
                    "contracts": contracts,
                    "cost": round(cost, 2),
                    "score": pick["score"],
                    "signal": pick["signal"],
                    "category": pick.get("source", "other"),
                    "days_left": pick.get("days_left", -1),
                    "ev_per_dollar": round(ev_per_dollar, 3),
                    "kelly_pct": round(kelly_fraction * 100, 1),
                    "our_prob": round(our_prob * 100, 1),
                    "edge": round(edge_pct * 100, 1),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "resolved": False,
                }
                user["trades"].append(trade)
                new_trades += 1

                # Keep last 50 trades per user
                if len(user["trades"]) > 50:
                    user["trades"] = user["trades"][-50:]

                if len(open_trades) + 1 >= 10:
                    break

        save_auto_bot_trades(all_trades)
        return {"ok": True, "picks": new_trades, "users": len(pros), "signals": len(top_picks)}

    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.post("/api/autobot/resolve")
async def autobot_resolve():
    """Check open auto-bot trades and resolve any that have moved significantly."""
    try:
        kalshi_data = await get_kalshi()
        poly_data = await get_polymarket()
        all_markets = kalshi_data.get("markets", []) + poly_data.get("markets", [])
        price_map = {m.get("ticker", ""): m for m in all_markets}

        all_trades = load_auto_bot_trades()
        agg = load_trades_agg()
        resolved_count = 0

        for email, user in all_trades.items():
            for trade in user["trades"]:
                if trade.get("resolved"):
                    continue

                market = price_map.get(trade["ticker"])
                if not market:
                    # Market gone — check if old enough to auto-resolve
                    ts = trade.get("timestamp", "")
                    if ts:
                        try:
                            trade_dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                            age_hours = (datetime.now(timezone.utc) - trade_dt).total_seconds() / 3600
                            if age_hours > 48:
                                # Auto-resolve as loss after 48h if market disappeared
                                trade["resolved"] = True
                                trade["outcome"] = "loss"
                                trade["pnl"] = -trade["cost"]
                                user["total_pnl"] = user.get("total_pnl", 0) + trade["pnl"]
                                resolved_count += 1
                        except Exception:
                            pass
                    continue

                current_price = market.get("yes", 50) if trade["side"] == "yes" else market.get("no", 50)
                entry_price = trade["price"]
                pnl_pct = (current_price - entry_price) / entry_price * 100 if entry_price > 0 else 0

                ts = trade.get("timestamp", "")
                age_hours = 0
                if ts:
                    try:
                        trade_dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                        age_hours = (datetime.now(timezone.utc) - trade_dt).total_seconds() / 3600
                    except Exception:
                        pass

                # Per-user take profit / stop loss (Pro), defaults for free
                u_settings = user.get("settings", {})
                take_profit_pct = u_settings.get("take_profit", 20)
                stop_loss_pct = u_settings.get("stop_loss", 30)

                should_resolve = (
                    current_price >= 95 or current_price <= 5 or  # Market resolved
                    pnl_pct >= take_profit_pct or                 # Hit take profit
                    pnl_pct <= -stop_loss_pct or                  # Hit stop loss
                    age_hours >= 168                              # 7 days max hold
                )

                if should_resolve:
                    trade["resolved"] = True
                    pnl = (current_price - entry_price) * trade["contracts"] / 100
                    trade["pnl"] = round(pnl, 2)
                    trade["outcome"] = "win" if pnl >= 0 else "loss"
                    trade["close_price"] = current_price
                    user["balance"] += trade["contracts"] * current_price / 100
                    user["total_pnl"] = user.get("total_pnl", 0) + pnl
                    resolved_count += 1

                    # Feed into collective learning
                    agg["total"] += 1
                    if trade["outcome"] == "win":
                        agg["wins"] += 1
                    score_range = f"{(trade['score'] // 20) * 20}-{(trade['score'] // 20) * 20 + 19}"
                    if score_range not in agg["by_score_range"]:
                        agg["by_score_range"][score_range] = {"total": 0, "wins": 0}
                    agg["by_score_range"][score_range]["total"] += 1
                    if trade["outcome"] == "win":
                        agg["by_score_range"][score_range]["wins"] += 1

                    # Track performance by timeframe bucket
                    trade_days = trade.get("days_left", -1)
                    if trade_days == -1:
                        bucket = "unknown"
                    elif trade_days <= 0.5:
                        bucket = "12h"
                    elif trade_days <= 1:
                        bucket = "24h"
                    elif trade_days <= 3:
                        bucket = "3d"
                    elif trade_days <= 7:
                        bucket = "1w"
                    elif trade_days <= 14:
                        bucket = "2w"
                    elif trade_days <= 30:
                        bucket = "1m"
                    elif trade_days <= 90:
                        bucket = "3m"
                    else:
                        bucket = "3m+"
                    trade["timeframe_bucket"] = bucket

                    if "by_timeframe" not in agg:
                        agg["by_timeframe"] = {}
                    if bucket not in agg["by_timeframe"]:
                        agg["by_timeframe"][bucket] = {"total": 0, "wins": 0, "total_pnl": 0}
                    agg["by_timeframe"][bucket]["total"] += 1
                    if trade["outcome"] == "win":
                        agg["by_timeframe"][bucket]["wins"] += 1
                    agg["by_timeframe"][bucket]["total_pnl"] = round(agg["by_timeframe"][bucket].get("total_pnl", 0) + pnl, 2)

        save_auto_bot_trades(all_trades)
        save_trades_agg(agg)
        return {"ok": True, "resolved": resolved_count}

    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.post("/api/autobot/sell")
async def sell_autobot_trade(request: Request):
    """Manually sell/close an auto-bot trade at current market price."""
    body = await request.json()
    email = body.get("email", "").lower()
    ticker = body.get("ticker", "")
    if not email or not ticker:
        return {"error": "email and ticker required"}

    all_trades = load_auto_bot_trades()
    user = all_trades.get(email)
    if not user:
        return {"error": "user not found"}

    # Find the open trade
    trade = None
    for t in user["trades"]:
        if t["ticker"] == ticker and not t.get("resolved"):
            trade = t
            break
    if not trade:
        return {"error": "trade not found or already resolved"}

    # Get current price from scores
    try:
        kalshi_data = await get_kalshi()
        poly_data = await get_polymarket()
        all_markets = kalshi_data.get("markets", []) + poly_data.get("markets", [])
        price_map = {m.get("ticker", ""): m for m in all_markets}
        market = price_map.get(ticker)
        if market:
            current_price = market.get("yes", 50) if trade["side"] == "yes" else market.get("no", 50)
        else:
            # Use entry price as fallback (sell at cost)
            current_price = trade["price"]
    except Exception:
        current_price = trade["price"]

    # Close the trade
    pnl = (current_price - trade["price"]) * trade["contracts"] / 100
    trade["resolved"] = True
    trade["pnl"] = round(pnl, 2)
    trade["outcome"] = "win" if pnl >= 0 else "loss"
    trade["close_price"] = current_price
    trade["sold_manually"] = True
    user["balance"] += trade["contracts"] * current_price / 100
    user["total_pnl"] = user.get("total_pnl", 0) + pnl

    save_auto_bot_trades(all_trades)
    return {
        "ok": True,
        "pnl": round(pnl, 2),
        "close_price": current_price,
        "new_balance": round(user["balance"], 2),
    }


@app.post("/api/autobot/reset")
async def reset_autobot(request: Request):
    """Reset a user's auto-bot balance (Pro gets $10K, free gets $1K)."""
    body = await request.json()
    email = body.get("email", "").lower()
    if not email:
        return {"error": "email required"}
    all_trades = load_auto_bot_trades()
    pros = load_pro_users() + ADMIN_PRO_EMAILS
    is_pro = email in [p.lower() for p in pros]
    balance = 10000 if is_pro else 1000
    all_trades[email] = {"balance": balance, "trades": [], "total_pnl": 0, "created": datetime.now(timezone.utc).isoformat()}
    save_auto_bot_trades(all_trades)
    return {"ok": True, "balance": balance, "is_pro": is_pro}


@app.get("/api/autobot/portfolio")
async def get_autobot_portfolio(email: str = ""):
    """Get a user's auto-bot portfolio."""
    if not email:
        return {"error": "email required"}
    all_trades = load_auto_bot_trades()
    user = all_trades.get(email.lower(), {"balance": 1000, "trades": [], "total_pnl": 0})
    open_trades = [t for t in user["trades"] if not t.get("resolved")]
    resolved_trades = [t for t in user["trades"] if t.get("resolved")]
    wins = sum(1 for t in resolved_trades if t.get("outcome") == "win")
    losses = sum(1 for t in resolved_trades if t.get("outcome") == "loss")
    return {
        "balance": round(user["balance"], 2),
        "total_pnl": round(user.get("total_pnl", 0), 2),
        "open_positions": len(open_trades),
        "open_trades": open_trades[-10:],
        "resolved_count": len(resolved_trades),
        "wins": wins,
        "losses": losses,
        "win_rate": round(wins / (wins + losses) * 100) if (wins + losses) > 0 else 0,
        "settings": user.get("settings", {}),
    }


@app.post("/api/autobot/settings")
async def set_autobot_settings(request: Request):
    """Update a user's auto-bot settings. Pro users get all options."""
    body = await request.json()
    email = body.get("email", "").lower()
    if not email:
        return {"error": "email required"}

    # Check Pro status
    pros = load_pro_users() + ADMIN_PRO_EMAILS
    is_pro = email in [p.lower() for p in pros]

    all_trades = load_auto_bot_trades()
    if email not in all_trades:
        all_trades[email] = {"balance": 10000, "trades": [], "total_pnl": 0, "created": datetime.now(timezone.utc).isoformat()}

    settings = all_trades[email].get("settings", {})

    # -- Timeframe (Free: 7 or 30 only, Pro: all) --
    if "max_days" in body:
        max_days = body["max_days"]
        max_days = float(max_days) if '.' in str(max_days) else int(max_days)
        free_options = (7, 30)
        pro_options = (0.5, 1, 3, 7, 14, 30, 60, 90, 0)
        valid = pro_options if is_pro else free_options
        if max_days not in valid:
            if not is_pro:
                return {"error": "Upgrade to Pro to unlock all timeframes", "pro_required": True}
            return {"error": f"max_days must be one of {valid}"}
        settings["max_days"] = max_days

    # -- Risk Level (Pro only): conservative / moderate / aggressive --
    if "risk_level" in body:
        if not is_pro:
            return {"error": "Upgrade to Pro to change risk level", "pro_required": True}
        rl = body["risk_level"]
        if rl not in ("conservative", "moderate", "aggressive"):
            return {"error": "risk_level must be conservative, moderate, or aggressive"}
        settings["risk_level"] = rl

    # -- Category Filter (Pro only): sports, politics, crypto, entertainment, all --
    if "categories" in body:
        if not is_pro:
            return {"error": "Upgrade to Pro to filter categories", "pro_required": True}
        cats = body["categories"]
        if not isinstance(cats, list):
            return {"error": "categories must be a list"}
        valid_cats = ["sports", "politics", "crypto", "entertainment", "world", "science", "all"]
        cats = [c for c in cats if c in valid_cats]
        settings["categories"] = cats

    # -- Minimum Score Threshold (Pro only): 30-70 --
    if "min_score" in body:
        if not is_pro:
            return {"error": "Upgrade to Pro to set score threshold", "pro_required": True}
        ms = int(body["min_score"])
        if ms < 20 or ms > 80:
            return {"error": "min_score must be between 20 and 80"}
        settings["min_score"] = ms

    # -- Signal Filter (Pro only): buy_only or all --
    if "signal_filter" in body:
        if not is_pro:
            return {"error": "Upgrade to Pro to filter signals", "pro_required": True}
        sf = body["signal_filter"]
        if sf not in ("buy_only", "all"):
            return {"error": "signal_filter must be buy_only or all"}
        settings["signal_filter"] = sf

    # -- Take Profit % (Pro only): 10-50 --
    if "take_profit" in body:
        if not is_pro:
            return {"error": "Upgrade to Pro to set take profit", "pro_required": True}
        tp = int(body["take_profit"])
        if tp < 5 or tp > 80:
            return {"error": "take_profit must be between 5 and 80"}
        settings["take_profit"] = tp

    # -- Stop Loss % (Pro only): 10-50 --
    if "stop_loss" in body:
        if not is_pro:
            return {"error": "Upgrade to Pro to set stop loss", "pro_required": True}
        sl = int(body["stop_loss"])
        if sl < 5 or sl > 80:
            return {"error": "stop_loss must be between 5 and 80"}
        settings["stop_loss"] = sl

    all_trades[email]["settings"] = settings
    save_auto_bot_trades(all_trades)
    return {"ok": True, "settings": settings, "is_pro": is_pro}


# ─── Sygnal AUTOPILOT (Smart Alerts Scanner) ───

ONESIGNAL_APP_ID = os.environ.get("ONESIGNAL_APP_ID", "")
ONESIGNAL_API_KEY = os.environ.get("ONESIGNAL_API_KEY", "")
ALERTS_FILE = os.path.join(DATA_DIR, "alerts_history.json")
SNAPSHOTS_FILE = os.path.join(DATA_DIR, "market_snapshots.json")


def load_snapshots():
    try:
        with open(SNAPSHOTS_FILE, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_snapshots(data):
    with open(SNAPSHOTS_FILE, "w") as f:
        json.dump(data, f)


def load_alerts_history():
    try:
        with open(ALERTS_FILE, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def save_alerts_history(alerts):
    # Keep last 200 alerts
    with open(ALERTS_FILE, "w") as f:
        json.dump(alerts[-200:], f)


async def send_push(title, message, url="https://sygnal-markets.fly.dev", segment="Pro Users"):
    """Send push notification via OneSignal."""
    if not ONESIGNAL_APP_ID or not ONESIGNAL_API_KEY:
        return False
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://onesignal.com/api/v1/notifications",
                headers={
                    "Authorization": f"Basic {ONESIGNAL_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "app_id": ONESIGNAL_APP_ID,
                    "included_segments": [segment],
                    "headings": {"en": title},
                    "contents": {"en": message},
                    "url": url,
                    "chrome_web_badge": "https://sygnal-markets.fly.dev/icon-192.png",
                },
                timeout=10,
            )
            return resp.status_code == 200
    except Exception:
        return False


@app.get("/api/autopilot/scan")
async def autopilot_scan():
    """Scan markets for trade opportunities. Returns alerts and optionally pushes to Pro users."""
    markets_data = await get_all_markets()
    kalshi = markets_data.get("kalshi", [])
    poly = markets_data.get("polymarket", [])
    arb = markets_data.get("arbitrage", [])
    all_markets = kalshi + poly

    # Record prices for momentum tracking
    record_prices(all_markets)

    prev_snapshots = load_snapshots()
    alerts = []
    now = datetime.now(timezone.utc).isoformat()

    for m in all_markets:
        ticker = m.get("ticker", "")
        yes = m.get("yes", 50)
        vol = m.get("volume", 0)
        question = m.get("question", "")
        source = m.get("source", "")
        url = m.get("url", "https://sygnal-markets.fly.dev")

        prev = prev_snapshots.get(ticker, {})
        prev_yes = prev.get("yes", yes)
        prev_vol = prev.get("volume", vol)

        price_change = yes - prev_yes

        # ── ALERT: Big price move (5¢+) ──
        if abs(price_change) >= 5 and prev_yes > 0:
            direction = "surged" if price_change > 0 else "dropped"
            alerts.append({
                "type": "price_move",
                "severity": "high" if abs(price_change) >= 10 else "medium",
                "title": f"Price {direction} {abs(price_change)}¢",
                "message": f"{question[:50]} — YES moved from {prev_yes}¢ to {yes}¢",
                "ticker": ticker,
                "source": source,
                "url": url,
                "price_change": price_change,
                "timestamp": now,
            })

        # ── ALERT: Momentum breakout (high vol + price move) ──
        if abs(price_change) >= 3 and vol > 100000:
            side = "YES" if price_change > 0 else "NO"
            alerts.append({
                "type": "momentum",
                "severity": "high",
                "title": f"Momentum: BUY {side}",
                "message": f"{question[:50]} — {side} at {yes}¢, high volume ${vol:,.0f}",
                "ticker": ticker,
                "source": source,
                "url": url,
                "timestamp": now,
            })

        # ── ALERT: Score spike (price near 25¢ or 75¢ = high confidence zone) ──
        if (20 <= yes <= 30 or 70 <= yes <= 80) and vol > 50000:
            side = "YES" if yes >= 70 else "NO"
            alerts.append({
                "type": "score_spike",
                "severity": "medium",
                "title": f"High confidence: BUY {side}",
                "message": f"{question[:50]} — {side} at {yes}¢ with strong volume",
                "ticker": ticker,
                "source": source,
                "url": url,
                "timestamp": now,
            })

    # ── ALERT: Arbitrage opportunities ──
    for a in arb:
        if a.get("diff", 0) >= 5:
            alerts.append({
                "type": "arbitrage",
                "severity": "high",
                "title": f"Arbitrage: {a['diff']}¢ spread",
                "message": f"{a['topic']} — Kalshi {a['kalshi']['yes']}¢ vs Poly {a['poly']['yes']}¢. {a['direction']}",
                "ticker": a.get("topic", ""),
                "url": "https://sygnal-markets.fly.dev",
                "timestamp": now,
            })

    # Deduplicate by ticker+type (don't spam same alert)
    seen = set()
    unique_alerts = []
    for a in alerts:
        key = f"{a['ticker']}:{a['type']}"
        if key not in seen:
            seen.add(key)
            unique_alerts.append(a)
    alerts = unique_alerts

    # Save current snapshots for next comparison
    new_snapshots = {}
    for m in all_markets:
        new_snapshots[m.get("ticker", "")] = {
            "yes": m.get("yes", 50),
            "volume": m.get("volume", 0),
            "question": m.get("question", ""),
        }
    save_snapshots(new_snapshots)

    # Save alerts to history
    history = load_alerts_history()
    history.extend(alerts)
    save_alerts_history(history)

    # Send top alert as push notification (only the highest severity one)
    push_sent = False
    high_alerts = [a for a in alerts if a["severity"] == "high"]
    if high_alerts:
        top = high_alerts[0]
        push_sent = await send_push(
            title=top["title"],
            message=top["message"],
            url=top.get("url", "https://sygnal-markets.fly.dev"),
        )

    return {
        "alerts": alerts,
        "alert_count": len(alerts),
        "push_sent": push_sent,
        "scanned_markets": len(all_markets),
        "timestamp": now,
    }


@app.get("/api/autopilot/alerts")
async def get_alerts(limit: int = 20):
    """Get recent alert history."""
    history = load_alerts_history()
    return {
        "alerts": history[-limit:][::-1],  # Most recent first
        "total": len(history),
    }


@app.get("/api/autopilot/config")
async def autopilot_config():
    """Get OneSignal config for frontend."""
    return {
        "onesignal_app_id": ONESIGNAL_APP_ID,
        "push_enabled": bool(ONESIGNAL_APP_ID),
    }


# ─── AUTOMATED AUTOPILOT SCANNER ───

import asyncio

async def autopilot_loop():
    """Run autopilot scan + auto-bot every 5 minutes in the background."""
    await asyncio.sleep(30)  # Wait for server to fully start
    while True:
        try:
            await autopilot_scan()
        except Exception as e:
            print(f"Autopilot scan error: {e}")
        # Run auto paper bot for Pro users
        try:
            result = await autobot_scan()
            print(f"Auto-bot: {result.get('picks', 0)} new picks for {result.get('users', 0)} users")
        except Exception as e:
            print(f"Auto-bot scan error: {e}")
        # Resolve old trades
        try:
            result = await autobot_resolve()
            if result.get("resolved", 0) > 0:
                print(f"Auto-bot: resolved {result['resolved']} trades")
        except Exception as e:
            print(f"Auto-bot resolve error: {e}")
        await asyncio.sleep(300)  # 5 minutes


@app.on_event("startup")
async def start_autopilot():
    """Start the autopilot scanner on server boot."""
    if os.environ.get("PORT"):  # Only in production
        asyncio.create_task(autopilot_loop())
        print("Autopilot scanner started (every 5 min)")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8095))
    uvicorn.run(app, host="0.0.0.0", port=port)
