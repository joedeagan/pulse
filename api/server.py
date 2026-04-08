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
    return FileResponse(os.path.join(static_dir, "index.html"))


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
            # Fetch events — the clean parent questions
            resp = await client.get(
                "https://api.elections.kalshi.com/trade-api/v2/events",
                params={"limit": 100, "status": "open"},
                timeout=15,
            )
            events = resp.json().get("events", [])

            result = []
            for ev in events:
                event_ticker = ev.get("event_ticker", "")
                series_ticker = ev.get("series_ticker", "")
                event_title = ev.get("title", "?")

                # Get markets for this event
                mresp = await client.get(
                    "https://api.elections.kalshi.com/trade-api/v2/markets",
                    params={"event_ticker": event_ticker, "limit": 10},
                    timeout=10,
                )
                markets = mresp.json().get("markets", [])

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

                    # For multi-option: combine event name + option
                    if is_multi and sub and sub != title:
                        # Shorten event title for combo
                        short_event = event_title.replace("Who will the next ", "Next ").replace("Who will be the next new ", "Next ").replace("Who will be the next ", "Next ").replace("Which ", "").replace("?", "").strip()
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

                    result.append({
                        "question": title,
                        "ticker": m.get("ticker", ""),
                        "yes": yes_price,
                        "no": 100 - yes_price,
                        "volume": vol,
                        "source": "kalshi",
                        "category": categorize(title + " " + event_title),
                        "url": f"https://kalshi.com/markets/{series_ticker}/{event_ticker}",
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

SUBSCRIBERS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "subscribers.json")


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

    SITE = "https://sygnal-api-joed.onrender.com"
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
<td style="padding:16px 0;border-bottom:1px solid #f0f0f0;">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td><span style="color:{pc};font-size:10px;font-weight:700;">{plat}</span> <span style="color:{sc};font-size:10px;font-weight:700;">{sig}</span>
<br><a href="{url}" style="color:#1a1a1a;text-decoration:none;font-size:15px;font-weight:600;line-height:22px;">{m['question']}</a>
<br><span style="color:{yc};font-size:18px;font-weight:700;">YES {yes}&#162;</span> &nbsp;<span style="color:{nc};font-size:18px;font-weight:700;">NO {no}&#162;</span> &nbsp;<span style="color:#999;font-size:12px;">{vol}</span></td>
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

    html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px;">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;">

<!-- Logo + Title -->
<tr><td style="padding:0 0 20px;text-align:center;">
<span style="font-size:28px;font-weight:800;color:#0066cc;letter-spacing:2px;">Sygnal</span>
<br><span style="font-size:13px;color:#888;">{date_str} &middot; {len(all_markets)} markets tracked</span>
</td></tr>

<!-- Blue divider -->
<tr><td style="padding:0;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:3px;background:#0066cc;font-size:0;">&nbsp;</td></tr></table></td></tr>

<!-- Main card -->
<tr><td bgcolor="#ffffff" style="padding:24px;">

<!-- Top Markets -->
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:0 0 12px;"><span style="font-size:12px;font-weight:700;color:#0066cc;letter-spacing:2px;">TOP MARKETS</span></td></tr>
{market_rows}
</table>

<!-- Spacer -->
<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:20px 0 0;"></td></tr></table>

<!-- Arbitrage -->
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:0 0 12px;"><span style="font-size:12px;font-weight:700;color:#997a00;letter-spacing:2px;">ARBITRAGE</span></td></tr>
{arb_rows}
</table>

<!-- Spacer -->
<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:20px 0 0;"></td></tr></table>

<!-- Highest Conviction -->
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:0 0 12px;"><span style="font-size:12px;font-weight:700;color:#00875a;letter-spacing:2px;">HIGHEST CONVICTION</span></td></tr>
{mover_rows}
</table>

<!-- CTA -->
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 0 8px;">
<table cellpadding="0" cellspacing="0"><tr><td bgcolor="#0066cc" style="padding:12px 32px;">
<a href="{SITE}" style="color:#fff;text-decoration:none;font-size:14px;font-weight:700;">Open Sygnal &#8594;</a>
</td></tr></table>
</td></tr></table>

</td></tr>

<!-- Footer -->
<tr><td style="padding:20px 0;text-align:center;">
<span style="font-size:11px;color:#888;">You subscribed to Sygnal Market Digest.</span><br>
<a href="{SITE}" style="font-size:11px;color:#0066cc;">Unsubscribe</a>
</td></tr>

</table>
</td></tr></table>
</body></html>"""

    return HTMLResponse(content=html)


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
    html_content = newsletter_response.body.decode() if hasattr(newsletter_response, 'body') else str(newsletter_response)

    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail, To

    sg = SendGridAPIClient(SENDGRID_API_KEY)
    sent = 0
    errors = []

    for sub in subs:
        try:
            message = Mail(
                from_email=(SENDGRID_FROM_EMAIL, "Sygnal Markets"),
                to_emails=sub["email"],
                subject=f"Sygnal Weekly Market Digest — {datetime.now().strftime('%B %d, %Y')}",
                html_content=html_content,
            )
            sg.send(message)
            sent += 1
        except Exception as e:
            errors.append({"email": sub["email"], "error": str(e)})

    return {
        "status": "sent",
        "sent": sent,
        "total_subscribers": len(subs),
        "errors": errors,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ─── AFFILIATE CLICK TRACKING ───

CLICKS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "clicks.json")


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
        "User-agent: *\nAllow: /\nSitemap: https://sygnal-api-joed.onrender.com/sitemap.xml\n"
    )


@app.get("/sitemap.xml")
async def sitemap():
    from fastapi.responses import Response
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://sygnal-api-joed.onrender.com/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>
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
    share_text += f"{len(all_markets)} markets tracked across Kalshi & Polymarket\nhttps://sygnal-api-joed.onrender.com"

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
PRO_USERS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pro_users.json")


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
            success_url="https://sygnal-api-joed.onrender.com/?pro=success",
            cancel_url="https://sygnal-api-joed.onrender.com/?pro=cancel",
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


@app.get("/api/pro/check")
async def check_pro(email: str = ""):
    """Check if email is a pro user."""
    if not email:
        return {"pro": False}
    pros = load_pro_users()
    return {"pro": email.lower() in [p.lower() for p in pros]}


# ─── Sygnal AUTOPILOT (Smart Alerts Scanner) ───

ONESIGNAL_APP_ID = os.environ.get("ONESIGNAL_APP_ID", "")
ONESIGNAL_API_KEY = os.environ.get("ONESIGNAL_API_KEY", "")
ALERTS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "alerts_history.json")
SNAPSHOTS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "market_snapshots.json")


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


async def send_push(title, message, url="https://sygnal-api-joed.onrender.com", segment="Pro Users"):
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
                    "chrome_web_badge": "https://sygnal-api-joed.onrender.com/icon-192.png",
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

    prev_snapshots = load_snapshots()
    alerts = []
    now = datetime.now(timezone.utc).isoformat()

    for m in all_markets:
        ticker = m.get("ticker", "")
        yes = m.get("yes", 50)
        vol = m.get("volume", 0)
        question = m.get("question", "")
        source = m.get("source", "")
        url = m.get("url", "https://sygnal-api-joed.onrender.com")

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
                "url": "https://sygnal-api-joed.onrender.com",
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
            url=top.get("url", "https://sygnal-api-joed.onrender.com"),
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
    """Run autopilot scan every 5 minutes in the background."""
    await asyncio.sleep(30)  # Wait for server to fully start
    while True:
        try:
            await autopilot_scan()
        except Exception as e:
            print(f"Autopilot scan error: {e}")
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
