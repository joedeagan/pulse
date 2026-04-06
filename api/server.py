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
static_dir = os.path.join(os.path.dirname(__file__), "..")
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/")
async def index():
    return FileResponse(os.path.join(static_dir, "index.html"))


# ─── KALSHI MARKETS ───
@app.get("/api/kalshi")
async def get_kalshi():
    """Fetch live markets from Kalshi."""
    try:
        async with httpx.AsyncClient() as client:
            # Get markets from Kalshi's public API
            resp = await client.get(
                "https://api.elections.kalshi.com/trade-api/v2/markets",
                params={"limit": 30, "status": "open"},
                timeout=15,
            )
            data = resp.json()
            markets = data.get("markets", [])

            # Clean up the data into a simple format
            result = []
            for m in markets:
                result.append({
                    "question": m.get("title", m.get("ticker", "?")),
                    "ticker": m.get("ticker", ""),
                    "yes": m.get("yes_ask", 50),
                    "no": 100 - m.get("yes_ask", 50),
                    "volume": m.get("volume_24h", m.get("volume", 0)),
                    "source": "kalshi",
                    "category": categorize(m.get("title", "")),
                })

            return {"markets": result, "count": len(result)}
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

                result.append({
                    "question": m.get("question", "?"),
                    "ticker": m.get("conditionId", ""),
                    "yes": yes_price,
                    "no": 100 - yes_price,
                    "volume": float(m.get("volume", 0)),
                    "source": "poly",
                    "category": categorize(m.get("question", "")),
                })

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
    uvicorn.run(app, host="0.0.0.0", port=8080)
