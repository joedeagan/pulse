# CUSTOM DOMAIN: To set up a custom domain on Render:
# 1. Go to render.com → your service → Settings → Custom Domains
# 2. Add your domain (e.g., pulse.joedeagan.com)
# 3. Add a CNAME record in your DNS pointing to your-service.onrender.com
# 4. Render handles SSL automatically

"""
PULSE Backend Server
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
SENDGRID_FROM_EMAIL = os.environ.get("SENDGRID_FROM_EMAIL", "pulse@joedeagan.com")

# WHAT IS FastAPI?
# It's a Python framework for building web APIs.
# You define "endpoints" (URLs) and what data they return.
# It's what Jarvis uses too.

app = FastAPI(title="PULSE API")

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
                params={"limit": 40, "status": "open"},
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

                if len(result) >= 30:
                    break

            # Keep all Kalshi markets (most have low volume but are still active)
            result.sort(key=lambda x: x["volume"], reverse=True)
            return {"markets": result[:30], "count": min(len(result), 30)}
    except Exception as e:
        return {"markets": [], "error": str(e)}


# ─── POLYMARKET MARKETS ───
@app.get("/api/polymarket")
async def get_polymarket():
    """Fetch live markets from Polymarket."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://gamma-api.polymarket.com/markets",
                params={"closed": "false", "limit": 100},
                timeout=15,
            )
            data = resp.json()

            result = []
            for m in data:
                yes_price = 50
                try:
                    import json
                    outcomes = json.loads(m.get("outcomePrices", "[]"))
                    if outcomes:
                        yes_price = round(float(outcomes[0]) * 100)
                except Exception:
                    pass

                # Use event slug for URL (market slug doesn't work on polymarket.com)
                events = m.get("events", [])
                event_slug = events[0].get("slug", "") if events else m.get("slug", m.get("conditionId", ""))
                result.append({
                    "question": m.get("question", "?"),
                    "ticker": m.get("conditionId", ""),
                    "yes": yes_price,
                    "no": 100 - yes_price,
                    "volume": float(m.get("volume", 0)),
                    "source": "poly",
                    "category": categorize(m.get("question", "")),
                    "url": f"https://polymarket.com/event/{event_slug}",
                })

            result.sort(key=lambda x: x["volume"], reverse=True)
            return {"markets": result, "count": len(result)}
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
    """Generate newsletter HTML from current market data."""
    markets_data = await get_all_markets()
    kalshi = markets_data.get("kalshi", [])
    poly = markets_data.get("polymarket", [])
    arbitrage = markets_data.get("arbitrage", [])
    all_markets = kalshi + poly

    # Sort by volume for top markets
    all_markets.sort(key=lambda x: x.get("volume", 0), reverse=True)
    top_markets = all_markets[:5]

    # Find biggest movers (most extreme prices = most conviction)
    movers = sorted(all_markets, key=lambda x: abs(x.get("yes", 50) - 50), reverse=True)[:5]

    # Generate newsletter PNG image first
    _generate_newsletter_png(kalshi, poly, all_markets, arbitrage, top_markets, movers)

    SITE = "https://pulse-api-joed.onrender.com"
    # Use Render URL for production, localhost for dev
    is_prod = os.environ.get("PORT")
    IMG_URL = f"{SITE}/newsletter.png" if is_prod else "http://localhost:8095/newsletter.png"

    html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background-color:#0a0a14;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:16px 0;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;">

<tr><td align="center"><a href="{SITE}"><img src="{IMG_URL}" alt="PULSE Weekly Market Digest" width="600" style="display:block;max-width:100%;height:auto;"></a></td></tr>

<tr><td bgcolor="#0a0a14" align="center" style="padding:20px 24px;">
<table cellpadding="0" cellspacing="0"><tr><td bgcolor="#0088ff" align="center" style="padding:14px 40px;">
<a href="{SITE}" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;font-family:system-ui,sans-serif;">Open PULSE Dashboard &#8594;</a>
</td></tr></table>
</td></tr>

<tr><td bgcolor="#003366" align="center" style="padding:20px 24px;">
<p style="font-family:system-ui,sans-serif;font-size:10px;letter-spacing:4px;color:#ffffff;font-weight:700;margin:0 0 4px;text-align:center;">PULSE</p>
<p style="font-family:system-ui,sans-serif;font-size:11px;color:#88bbdd;margin:0;text-align:center;">Trading. Logically.</p>
<p style="font-family:system-ui,sans-serif;font-size:10px;color:#6699bb;margin:10px 0 0;text-align:center;">You subscribed to PULSE Market Digest.<br><a href="{SITE}" style="color:#ffffff;">Unsubscribe</a></p>
</td></tr>

</table>
</td></tr></table>
</body></html>"""

    return HTMLResponse(content=html)


def _generate_newsletter_png(kalshi, poly, all_markets, arbitrage, top_markets, movers):
    """Generate the newsletter body as a pixel-perfect PNG."""
    from PIL import Image, ImageDraw, ImageFont
    import math

    W = 600
    BG = (10, 10, 20)
    CARD_BG = (18, 18, 30)
    BLUE = (0, 136, 255)
    DARK_BLUE = (0, 51, 102)
    GREEN = (0, 180, 100)
    RED = (200, 40, 60)
    AMBER = (200, 150, 0)
    WHITE = (255, 255, 255)
    DIM = (120, 120, 140)
    TEXT_COLOR = (220, 220, 230)

    import platform
    def _load_font(names, size):
        """Try multiple font paths for cross-platform support."""
        dirs = ["C:/Windows/Fonts/", "/usr/share/fonts/truetype/dejavu/", "/usr/share/fonts/", ""]
        for d in dirs:
            for n in names:
                try:
                    return ImageFont.truetype(d + n, size)
                except (OSError, IOError):
                    continue
        return ImageFont.load_default()

    title_font = _load_font(["Montserrat-Regular.ttf", "DejaVuSans.ttf", "arial.ttf"], 22)
    heading_font = _load_font(["segoeuib.ttf", "DejaVuSans-Bold.ttf", "arialbd.ttf"], 11)
    body_font = _load_font(["segoeui.ttf", "DejaVuSans.ttf", "arial.ttf"], 14)
    body_bold = _load_font(["segoeuib.ttf", "DejaVuSans-Bold.ttf", "arialbd.ttf"], 14)
    small_font = _load_font(["segoeui.ttf", "DejaVuSans.ttf", "arial.ttf"], 11)
    big_num = _load_font(["segoeuib.ttf", "DejaVuSans-Bold.ttf", "arialbd.ttf"], 26)
    price_font = _load_font(["segoeuib.ttf", "DejaVuSans-Bold.ttf", "arialbd.ttf"], 20)
    badge_font = _load_font(["segoeuib.ttf", "DejaVuSans-Bold.ttf", "arialbd.ttf"], 10)

    # Calculate height
    H = 100 + 60 + 30 + len(top_markets) * 80 + 30 + max(len(arbitrage[:3]), 1) * 50 + 30 + len(movers) * 45 + 20

    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    y = 0

    # Header
    draw.rectangle([0, y, W, y + 100], fill=DARK_BLUE)
    ekg_pts = []
    for x in range(40, 75): ekg_pts.append((x, y + 50))
    for x in range(75, 90):
        t = (x - 75) / 15
        if t < 0.3: ey = y + 50 - t / 0.3 * 25
        elif t < 0.6: ey = y + 25 + (t - 0.3) / 0.3 * 45
        else: ey = y + 70 - (t - 0.6) / 0.4 * 30
        ekg_pts.append((x, int(ey)))
    for x in range(90, 110):
        ey = y + 50 - 8 * math.sin((x - 90) / 20 * math.pi)
        ekg_pts.append((x, int(ey)))
    for x in range(110, 140): ekg_pts.append((x, y + 50))
    for i in range(len(ekg_pts) - 1):
        draw.line([ekg_pts[i], ekg_pts[i + 1]], fill=(0, 200, 255), width=2)

    draw.text((150, y + 30), "PULSE", fill=WHITE, font=title_font)
    draw.text((150, y + 58), "Weekly Market Digest", fill=(136, 187, 221), font=body_font)
    date_str = datetime.now().strftime("%B %d, %Y")
    draw.text((150, y + 78), f"{date_str} \u00b7 {len(all_markets)} markets", fill=DIM, font=small_font)
    y += 100

    # Stats bar
    draw.rectangle([0, y, W, y + 60], fill=(0, 34, 68))
    thirds = W // 3
    for i, (num, label) in enumerate([(len(kalshi), "KALSHI"), (len(poly), "POLYMARKET"), (len(arbitrage), "ARBITRAGE")]):
        cx = i * thirds + thirds // 2
        tw = draw.textlength(str(num), font=big_num)
        draw.text((cx - tw / 2, y + 8), str(num), fill=WHITE, font=big_num)
        tw2 = draw.textlength(label, font=badge_font)
        draw.text((cx - tw2 / 2, y + 40), label, fill=(136, 187, 221), font=badge_font)
        if i < 2:
            draw.line([(i + 1) * thirds, y + 10, (i + 1) * thirds, y + 50], fill=(51, 85, 119), width=1)
    y += 60

    # Top Markets
    draw.text((24, y + 10), "TOP MARKETS BY VOLUME", fill=BLUE, font=heading_font)
    y += 30
    for m in top_markets:
        draw.rectangle([16, y + 4, W - 16, y + 76], fill=CARD_BG)
        plat = "KALSHI" if m.get("source") == "kalshi" else "POLY"
        pc = BLUE if plat == "KALSHI" else (119, 68, 204)
        draw.text((28, y + 10), plat, fill=pc, font=badge_font)
        yes = m["yes"]
        sig = "BUY YES" if yes >= 70 else ("BUY NO" if yes <= 30 else "HOLD")
        sc = GREEN if yes >= 70 else (RED if yes <= 30 else AMBER)
        draw.text((28 + draw.textlength(plat, font=badge_font) + 12, y + 10), sig, fill=sc, font=badge_font)
        q = m["question"][:60] + ("..." if len(m["question"]) > 60 else "")
        draw.text((28, y + 26), q, fill=TEXT_COLOR, font=body_font)
        no = 100 - yes
        draw.text((28, y + 48), f"YES {yes}\u00a2", fill=GREEN if yes >= 50 else RED, font=price_font)
        draw.text((160, y + 48), f"NO {no}\u00a2", fill=RED if yes >= 50 else GREEN, font=price_font)
        vol = f"Vol ${m.get('volume', 0):,.0f}" if m.get("volume") else ""
        if vol:
            vw = draw.textlength(vol, font=small_font)
            draw.text((W - 28 - vw, y + 54), vol, fill=DIM, font=small_font)
        y += 80

    # Arbitrage
    draw.text((24, y + 10), "CROSS-PLATFORM ARBITRAGE", fill=AMBER, font=heading_font)
    y += 30
    if arbitrage:
        for a in arbitrage[:3]:
            draw.rectangle([16, y + 4, W - 16, y + 46], fill=CARD_BG)
            draw.text((28, y + 10), a["topic"], fill=TEXT_COLOR, font=body_bold)
            draw.text((28, y + 28), f"Kalshi {a['kalshi']['yes']}\u00a2  vs  Poly {a['poly']['yes']}\u00a2", fill=DIM, font=small_font)
            spread = f"{a['diff']}\u00a2 spread"
            sw = draw.textlength(spread, font=body_bold)
            draw.text((W - 28 - sw, y + 16), spread, fill=AMBER, font=body_bold)
            y += 50
    else:
        draw.rectangle([16, y + 4, W - 16, y + 46], fill=CARD_BG)
        draw.text((28, y + 16), "No arbitrage this week.", fill=DIM, font=small_font)
        y += 50

    # Highest conviction
    draw.text((24, y + 10), "HIGHEST CONVICTION", fill=GREEN, font=heading_font)
    y += 30
    for m in movers:
        draw.line([(24, y + 44), (W - 24, y + 44)], fill=(30, 30, 50), width=1)
        q = m["question"][:45] + ("..." if len(m["question"]) > 45 else "")
        draw.text((28, y + 8), q, fill=TEXT_COLOR, font=body_font)
        yes = m["yes"]
        yc = GREEN if yes >= 70 else (RED if yes <= 30 else DIM)
        pt = f"{yes}\u00a2"
        pw = draw.textlength(pt, font=price_font)
        draw.text((W - 28 - pw, y + 6), pt, fill=yc, font=price_font)
        sig = "BUY YES" if yes >= 70 else ("BUY NO" if yes <= 30 else "HOLD")
        sc = GREEN if yes >= 70 else (RED if yes <= 30 else AMBER)
        sw = draw.textlength(sig, font=badge_font)
        draw.text((W - 28 - sw, y + 30), sig, fill=sc, font=badge_font)
        y += 45

    img = img.crop((0, 0, W, y + 10))
    img.save(os.path.join(static_dir, "newsletter.png"), quality=95)


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
                from_email=(SENDGRID_FROM_EMAIL, "PULSE Markets"),
                to_emails=sub["email"],
                subject=f"PULSE Weekly Market Digest — {datetime.now().strftime('%B %d, %Y')}",
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


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8095))
    uvicorn.run(app, host="0.0.0.0", port=port)
