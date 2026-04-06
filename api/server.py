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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import httpx
import os
from datetime import datetime, timezone, timedelta

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


@app.get("/icon-192.png")
async def serve_icon_192():
    return FileResponse(os.path.join(static_dir, "icon-192.png"), media_type="image/png")


@app.get("/icon-512.png")
async def serve_icon_512():
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

                slug = m.get("slug", m.get("conditionId", ""))
                result.append({
                    "question": m.get("question", "?"),
                    "ticker": m.get("conditionId", ""),
                    "yes": yes_price,
                    "no": 100 - yes_price,
                    "volume": float(m.get("volume", 0)),
                    "source": "poly",
                    "category": categorize(m.get("question", "")),
                    "url": f"https://polymarket.com/event/{slug}",
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


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8095))
    uvicorn.run(app, host="0.0.0.0", port=port)
