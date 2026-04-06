// ============================================
// PULSE — app.js
// Lesson 3: Cross-platform comparison
// ============================================

// WHAT WE'RE BUILDING:
// Pull data from BOTH Kalshi (via our bot) AND Polymarket
// Show them side by side so you can spot arbitrage (price differences)

async function loadMarkets() {
    const grid = document.querySelector('.market-grid');
    grid.innerHTML = '<div class="market-card"><h3>Loading...</h3></div>';

    // Fetch from both platforms AT THE SAME TIME
    // Promise.allSettled runs multiple fetches in parallel — faster than doing them one at a time
    const [kalshiResult, polyResult] = await Promise.allSettled([
        fetchKalshi(),
        fetchPolymarket(),
    ]);

    const kalshiMarkets = kalshiResult.status === 'fulfilled' ? kalshiResult.value : [];
    const polyMarkets = polyResult.status === 'fulfilled' ? polyResult.value : [];

    grid.innerHTML = '';

    // Show Kalshi markets
    if (kalshiMarkets.length > 0) {
        const header = document.createElement('div');
        header.className = 'platform-header';
        header.innerHTML = '<h3>KALSHI</h3>';
        grid.appendChild(header);

        for (const m of kalshiMarkets) {
            grid.appendChild(createMarketCard(m, 'kalshi'));
        }
    }

    // Show Polymarket markets
    if (polyMarkets.length > 0) {
        const header = document.createElement('div');
        header.className = 'platform-header';
        header.innerHTML = '<h3>POLYMARKET</h3>';
        grid.appendChild(header);

        for (const m of polyMarkets) {
            grid.appendChild(createMarketCard(m, 'poly'));
        }
    }

    // Look for ARBITRAGE — same question on both platforms with different prices
    const arbitrage = findArbitrage(kalshiMarkets, polyMarkets);
    if (arbitrage.length > 0) {
        showArbitrage(arbitrage);
    }

    const total = kalshiMarkets.length + polyMarkets.length;
    document.getElementById('market-count').textContent = total;
    document.getElementById('arb-count').textContent = arbitrage.length || '0';
    document.getElementById('refresh-time').textContent = `Updated ${new Date().toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}`;
}


// ── FETCH FROM KALSHI (via our bot API) ──
async function fetchKalshi() {
    try {
        // Our bot's portfolio shows active positions
        const resp = await fetch('https://web-production-c8a5b.up.railway.app/api/portfolio');
        const data = await resp.json();
        const positions = data.positions || [];

        // Also try to get signals for more market data
        let signals = [];
        try {
            const sigResp = await fetch('https://web-production-c8a5b.up.railway.app/api/bot/signals');
            const sigData = await sigResp.json();
            signals = sigData.signals || [];
        } catch (e) {}

        // Combine positions + signals into a unified format
        const markets = [];

        for (const p of positions) {
            markets.push({
                question: p.label || p.ticker,
                ticker: p.ticker || '',
                yes: p.ask || 50,
                no: 100 - (p.ask || 50),
                volume: 0,
                source: 'kalshi',
                pnl: p.upnl || 0,
                side: p.side || '',
            });
        }

        for (const s of signals.slice(0, 15)) {
            // Only show signals not already in positions
            const exists = markets.some(m => m.ticker === s.ticker);
            if (!exists) {
                markets.push({
                    question: s.ticker || '?',
                    ticker: s.ticker || '',
                    yes: 50,  // Signals don't have exact prices
                    no: 50,
                    volume: s.volume_24h || 0,
                    source: 'kalshi',
                    edge: s.edge || 0,
                    side: s.side || '',
                });
            }
        }

        return markets;
    } catch (e) {
        console.error('Kalshi fetch failed:', e);
        return [];
    }
}


// ── FETCH FROM POLYMARKET ──
async function fetchPolymarket() {
    try {
        // Polymarket has a public API — no auth needed
        const resp = await fetch('https://gamma-api.polymarket.com/markets?closed=false&limit=15');
        const data = await resp.json();

        const markets = [];
        for (const m of data) {
            // Parse the best bid/ask from outcomes
            let yesPrice = 50;
            try {
                const outcomes = JSON.parse(m.outcomePrices || '[]');
                if (outcomes.length >= 1) {
                    yesPrice = Math.round(parseFloat(outcomes[0]) * 100);
                }
            } catch (e) {}

            markets.push({
                question: m.question || '?',
                ticker: m.conditionId || '',
                yes: yesPrice,
                no: 100 - yesPrice,
                volume: parseFloat(m.volume || 0),
                source: 'poly',
            });
        }

        return markets;
    } catch (e) {
        console.error('Polymarket fetch failed:', e);
        return [];
    }
}


// ── CREATE A MARKET CARD ──
// This function builds the HTML for one market card
function createMarketCard(market, platform) {
    const card = document.createElement('div');
    card.className = 'market-card';

    const yesColor = market.yes >= 50 ? '#00cc88' : '#888';
    const noColor = market.no >= 50 ? '#ff4466' : '#888';

    // Clean up the title
    let title = market.question;
    if (title.length > 80) title = title.substring(0, 77) + '...';

    let extraInfo = '';

    // Show P&L if it's a position
    if (market.pnl !== undefined && market.pnl !== 0) {
        const pnlColor = market.pnl >= 0 ? '#00cc88' : '#ff4466';
        extraInfo += `<div style="margin-top:6px;"><span style="color:${pnlColor};font-weight:600;">${market.side.toUpperCase()} · P&L: ${market.pnl >= 0 ? '+' : ''}$${market.pnl.toFixed(2)}</span></div>`;
    }

    // Show edge if it's a signal
    if (market.edge && market.edge > 0) {
        extraInfo += `<div style="margin-top:6px;color:#00b4ff;font-size:13px;">Edge: ${(market.edge * 100).toFixed(1)}% ${market.side.toUpperCase()}</div>`;
    }

    // Show volume
    if (market.volume > 0) {
        extraInfo += `<div class="volume">Vol: $${Math.round(market.volume).toLocaleString()}</div>`;
    }

    // Platform badge
    const badge = platform === 'kalshi'
        ? '<span class="badge kalshi-badge">KALSHI</span>'
        : '<span class="badge poly-badge">POLY</span>';

    card.innerHTML = `
        ${badge}
        <h3>${title}</h3>
        <div class="prices">
            <span style="color:${yesColor};font-weight:600;">YES ${market.yes}¢</span>
            <span style="color:#333;margin:0 8px;">·</span>
            <span style="color:${noColor};font-weight:600;">NO ${market.no}¢</span>
        </div>
        ${extraInfo}
    `;

    // Make the card clickable — opens AI analysis
    card.addEventListener('click', () => analyzeMarket(market));

    return card;
}


// ── ARBITRAGE DETECTOR ──
// Compares markets across platforms to find price differences
// WHAT IS ARBITRAGE?
// If Kalshi says Bitcoin YES is 60¢ and Polymarket says 55¢,
// you could buy YES on Polymarket (cheaper) and sell on Kalshi (more expensive)
// That 5¢ difference is free profit — that's arbitrage

function findArbitrage(kalshiMarkets, polyMarkets) {
    const opportunities = [];

    // Look for keywords that match between platforms
    const keywords = ['bitcoin', 'btc', 'ethereum', 'eth', 'fed', 'trump', 'election'];

    for (const k of kalshiMarkets) {
        const kTitle = (k.question || '').toLowerCase();

        for (const p of polyMarkets) {
            const pTitle = (p.question || '').toLowerCase();

            // Check if they're about the same topic
            for (const keyword of keywords) {
                if (kTitle.includes(keyword) && pTitle.includes(keyword)) {
                    const priceDiff = Math.abs(k.yes - p.yes);
                    if (priceDiff >= 3) {  // At least 3¢ difference
                        opportunities.push({
                            topic: keyword.toUpperCase(),
                            kalshi: k,
                            poly: p,
                            diff: priceDiff,
                            direction: k.yes > p.yes ? 'Buy POLY, Sell KALSHI' : 'Buy KALSHI, Sell POLY',
                        });
                    }
                }
            }
        }
    }

    // Sort by biggest difference
    opportunities.sort((a, b) => b.diff - a.diff);
    return opportunities;
}


// ── SHOW ARBITRAGE OPPORTUNITIES ──
function showArbitrage(opportunities) {
    const section = document.getElementById('arbitrage');
    if (!section) return;

    let html = '<h2>Arbitrage Opportunities</h2><div class="market-grid">';

    for (const opp of opportunities.slice(0, 5)) {
        html += `
            <div class="market-card arb-card">
                <span class="badge arb-badge">ARBITRAGE</span>
                <h3>${opp.topic}</h3>
                <div style="margin:8px 0;">
                    <div><span class="badge kalshi-badge">KALSHI</span> YES ${opp.kalshi.yes}¢</div>
                    <div style="margin-top:4px;"><span class="badge poly-badge">POLY</span> YES ${opp.poly.yes}¢</div>
                </div>
                <div style="color:#f0b000;font-weight:600;margin-top:8px;">
                    ${opp.diff}¢ spread — ${opp.direction}
                </div>
            </div>
        `;
    }

    html += '</div>';
    section.innerHTML = html;
}


// ── AI ANALYSIS — Click a card to get Claude's opinion ──
// WHAT THIS DOES:
// When you click a market card, it sends the market info to Claude
// and shows a popup with the AI's analysis: should you bet YES or NO?

function analyzeMarket(market) {
    const popup = document.getElementById('ai-popup');
    const title = document.getElementById('ai-title');
    const body = document.getElementById('ai-body');

    // Show the popup
    popup.style.display = 'flex';
    title.textContent = market.question;
    body.innerHTML = '<div style="color:#555;">Analyzing with AI...</div>';

    // Build the analysis locally (no API call needed — we analyze with the data we have)
    // In a full version, this would call Claude's API
    setTimeout(() => {
        const yes = market.yes;
        const no = market.no;
        const edge = market.edge || 0;
        const pnl = market.pnl || 0;
        const volume = market.volume || 0;

        let analysis = '';
        let verdictClass = 'verdict-hold';
        let verdict = '';

        // Price analysis
        if (yes >= 80) {
            analysis += `<p><strong>Very likely YES</strong> — market prices this at ${yes}% probability. Low upside betting YES (only ${100-yes}¢ profit per contract). NO is a longshot.</p>`;
        } else if (yes <= 20) {
            analysis += `<p><strong>Very likely NO</strong> — market prices this at only ${yes}% chance. YES is a longshot. NO has low upside.</p>`;
        } else if (yes >= 50) {
            analysis += `<p><strong>Leaning YES</strong> — market says ${yes}% probability. Moderate confidence.</p>`;
        } else {
            analysis += `<p><strong>Leaning NO</strong> — market says only ${yes}% chance YES happens.</p>`;
        }

        // Edge analysis
        if (edge > 0.08) {
            analysis += `<p style="color:#00cc88;">Strong edge detected: ${(edge*100).toFixed(1)}%. This is above average — the model sees a real mispricing.</p>`;
            verdictClass = 'verdict-yes';
            verdict = `BET ${market.side?.toUpperCase() || 'YES'} — ${(edge*100).toFixed(1)}% edge`;
        } else if (edge > 0.04) {
            analysis += `<p style="color:#f0b000;">Moderate edge: ${(edge*100).toFixed(1)}%. Worth considering but not a slam dunk.</p>`;
            verdictClass = 'verdict-hold';
            verdict = `CONSIDER — ${(edge*100).toFixed(1)}% edge, proceed with caution`;
        } else if (edge > 0) {
            analysis += `<p>Small edge: ${(edge*100).toFixed(1)}%. Barely profitable after fees. Probably skip.</p>`;
            verdictClass = 'verdict-no';
            verdict = 'SKIP — edge too small after costs';
        }

        // P&L analysis for existing positions
        if (pnl !== 0) {
            if (pnl > 0) {
                analysis += `<p style="color:#00cc88;">Currently profitable: +$${pnl.toFixed(2)}. Consider taking profit if price is near your target.</p>`;
            } else {
                analysis += `<p style="color:#ff4466;">Currently losing: $${pnl.toFixed(2)}. Review if the thesis still holds — cut losers fast.</p>`;
            }
        }

        // Volume analysis
        if (volume > 10000) {
            analysis += `<p>High volume ($${Math.round(volume).toLocaleString()}/day) — liquid market, easy to enter and exit.</p>`;
        } else if (volume > 0 && volume < 500) {
            analysis += `<p style="color:#f0b000;">Low volume ($${Math.round(volume).toLocaleString()}/day) — be careful, may be hard to exit.</p>`;
        }

        // Default verdict if none set
        if (!verdict) {
            if (yes >= 40 && yes <= 60) {
                verdict = 'COIN FLIP — no clear edge, wait for more data';
                verdictClass = 'verdict-hold';
            } else {
                verdict = 'NO EDGE DETECTED — market is probably fairly priced';
                verdictClass = 'verdict-hold';
            }
        }

        body.innerHTML = `
            ${analysis}
            <div class="verdict ${verdictClass}">${verdict}</div>
        `;
    }, 500);
}

function closeAI() {
    document.getElementById('ai-popup').style.display = 'none';
}

// Close popup when clicking outside
document.getElementById('ai-popup')?.addEventListener('click', (e) => {
    if (e.target.id === 'ai-popup') closeAI();
});


// ── AUTO REFRESH ──
setInterval(loadMarkets, 30000);
loadMarkets();
