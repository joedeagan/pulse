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
                        "url": f"https://kalshi.com/markets/{event_ticker}",
                    })

                if len(result) >= 30:
                    break

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
                params={"closed": "false", "limit": 30},
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
    if any(w in t for w in ["bitcoin", "btc", "ethereum", "eth", "crypto", "sol", "doge"]):
        return "crypto"
    if any(w in t for w in ["nba", "mlb", "nfl", "nhl", "game", "win", "lakers", "yankees"]):
        return "sports"
    if any(w in t for w in ["trump", "election", "president", "senate", "congress", "biden"]):
        return "politics"
    if any(w in t for w in ["rain", "snow", "weather", "temperature"]):
        return "weather"
    return "other"


def find_arbitrage(kalshi_markets, poly_markets):
    opportunities = []
    keywords = ["bitcoin", "btc", "ethereum", "eth", "trump", "election", "fed"]

    for k in kalshi_markets:
        k_title = (k.get("question") or "").lower()
        for p in poly_markets:
            p_title = (p.get("question") or "").lower()
            for keyword in keywords:
                if keyword in k_title and keyword in p_title:
                    diff = abs(k["yes"] - p["yes"])
                    if diff >= 3:
                        opportunities.append({
                            "topic": keyword.upper(),
                            "kalshi": k,
                            "poly": p,
                            "diff": diff,
                            "direction": "Buy POLY" if k["yes"] > p["yes"] else "Buy KALSHI",
                        })

    opportunities.sort(key=lambda x: x["diff"], reverse=True)
    return opportunities[:10]


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8095))
    uvicorn.run(app, host="0.0.0.0", port=port)
