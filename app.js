// ============================================
// PULSE — app.js
// Lesson 3: Cross-platform comparison
// ============================================

// WHAT WE'RE BUILDING:
// Pull data from BOTH Kalshi (via our bot) AND Polymarket
// Show them side by side so you can spot arbitrage (price differences)

// API base — uses same origin when served from backend, or Render URL from GitHub Pages
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? '' : (window.location.origin.includes('github.io') ? 'https://pulse-api-joed.onrender.com' : '');

// ── TAB NAVIGATION ──
function switchTab(tab, btn) {
    // Update active nav link
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    if (btn) btn.classList.add('active');

    // Define which elements belong to each view
    const heroEl = document.querySelector('.hero');
    const statsEl = document.querySelector('.stats-bar');
    const filtersEl = document.getElementById('filters');
    const marketsEl = document.getElementById('markets');
    const botEl = document.getElementById('bot-panel');
    const arbEl = document.getElementById('arbitrage');

    const marketsView = [heroEl, statsEl, filtersEl, marketsEl];
    const botView = [botEl];
    const arbView = [arbEl];
    const allSections = [...marketsView, ...botView, ...arbView];

    // Hide everything
    allSections.forEach(el => { if (el) el.classList.add('view-hidden'); });

    // Show the selected view
    let visible = [];
    if (tab === 'markets') visible = marketsView;
    else if (tab === 'bot') visible = botView;
    else if (tab === 'arbitrage') visible = arbView;

    visible.forEach(el => { if (el) el.classList.remove('view-hidden'); });
}

// ── WATCHLIST ──
function getWatchlist() {
    try {
        return JSON.parse(localStorage.getItem('pulse-watchlist') || '[]');
    } catch { return []; }
}

function toggleWatchlist(ticker, btn) {
    let wl = getWatchlist();
    if (wl.includes(ticker)) {
        wl = wl.filter(t => t !== ticker);
        btn.classList.remove('starred');
        btn.textContent = '\u2606';
    } else {
        wl.push(ticker);
        btn.classList.add('starred');
        btn.textContent = '\u2605';
    }
    localStorage.setItem('pulse-watchlist', JSON.stringify(wl));
}

function isStarred(ticker) {
    return getWatchlist().includes(ticker);
}

let firstLoad = true;
async function loadMarkets() {
    const grid = document.querySelector('.market-grid');
    // Only show "Loading..." on first load — don't flash it on refresh
    if (firstLoad) {
        grid.innerHTML = '<div class="market-card"><h3>Loading...</h3></div>';
    }

    // Try our backend server first (has no CORS issues)
    // Falls back to direct API calls if server isn't running
    let kalshiMarkets = [];
    let polyMarkets = [];

    try {
        const resp = await fetch(API_BASE + '/api/markets');
        if (resp.ok) {
            const data = await resp.json();
            kalshiMarkets = data.kalshi || [];
            polyMarkets = data.polymarket || [];
        } else {
            throw new Error('Server not available');
        }
    } catch(e) {
        // Fallback to direct API calls
        try { kalshiMarkets = await fetchKalshi(); } catch(e2) {}
        try { polyMarkets = await fetchPolymarket(); } catch(e2) {}
    }

    // If both APIs failed (CORS on GitHub Pages), show sample data
    if (kalshiMarkets.length === 0 && polyMarkets.length === 0) {
        kalshiMarkets = [
            { question: "Bitcoin above $70,000 on April 10?", ticker: "KXBTCD", yes: 62, no: 38, volume: 45200, source: 'kalshi', edge: 0.06, side: 'yes' },
            { question: "Lakers win tonight?", ticker: "KXNBA", yes: 45, no: 55, volume: 12800, source: 'kalshi', edge: 0.04, side: 'no' },
            { question: "Rain in NYC tomorrow?", ticker: "KXRAIN", yes: 73, no: 27, volume: 8400, source: 'kalshi', edge: 0.02, side: 'yes' },
            { question: "Yankees win today?", ticker: "KXMLB", yes: 58, no: 42, volume: 15600, source: 'kalshi', edge: 0.05, side: 'yes' },
            { question: "Ethereum above $4,000 this week?", ticker: "KXETH", yes: 35, no: 65, volume: 28900, source: 'kalshi', edge: 0.07, side: 'no' },
            { question: "Fed rate cut in June?", ticker: "KXFED", yes: 32, no: 68, volume: 134000, source: 'kalshi', edge: 0.03, side: 'no' },
        ];
        polyMarkets = [
            { question: "Will Bitcoin hit $100K in 2026?", ticker: "POLY-BTC", yes: 41, no: 59, volume: 892000, source: 'poly' },
            { question: "Trump wins 2028 election?", ticker: "POLY-POTUS", yes: 33, no: 67, volume: 2340000, source: 'poly' },
            { question: "Ethereum above $5,000 by July?", ticker: "POLY-ETH", yes: 22, no: 78, volume: 456000, source: 'poly' },
            { question: "US recession in 2026?", ticker: "POLY-ECON", yes: 28, no: 72, volume: 1200000, source: 'poly' },
            { question: "Next iPhone has AI chip?", ticker: "POLY-TECH", yes: 85, no: 15, volume: 340000, source: 'poly' },
        ];
    }

    grid.innerHTML = '';
    allMarketCards = [];  // Reset for filtering
    firstLoad = false;

    // Sort starred markets to top within each platform
    const wl = getWatchlist();
    const sortByStarred = (arr) => {
        return [...arr].sort((a, b) => {
            const aStarred = wl.includes(a.ticker) ? 1 : 0;
            const bStarred = wl.includes(b.ticker) ? 1 : 0;
            return bStarred - aStarred;
        });
    };

    // Show Kalshi markets
    if (kalshiMarkets.length > 0) {
        const header = document.createElement('div');
        header.className = 'platform-header';
        header.innerHTML = '<h3>KALSHI</h3>';
        grid.appendChild(header);

        for (const m of sortByStarred(kalshiMarkets)) {
            grid.appendChild(createMarketCard(m, 'kalshi'));
        }
    }

    // Show Polymarket markets
    if (polyMarkets.length > 0) {
        const header = document.createElement('div');
        header.className = 'platform-header';
        header.innerHTML = '<h3>POLYMARKET</h3>';
        grid.appendChild(header);

        for (const m of sortByStarred(polyMarkets)) {
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

    // Trigger scroll-based card animations
    if (typeof observeCards === 'function') observeCards();
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


// ── SHORTEN LONG TITLES ──
function shortenTitle(t) {
    if (!t) return '?';
    // Remove leading filler (but keep the subject after "Will")
    t = t.replace(/^Will the /i, '').replace(/^Will /i, '');
    t = t.replace(/^What will /i, '');
    t = t.replace(/^How many /i, '');
    t = t.replace(/^Which /i, '');
    // Sports
    t = t.replace(/win the (\d{4}) NHL Stanley Cup\??/i, '— Stanley Cup $1');
    t = t.replace(/win the (\d{4}) NBA Championship\??/i, '— NBA Champs $1');
    t = t.replace(/win the (\d{4}) World Series\??/i, '— World Series $1');
    t = t.replace(/win the (\d{4}) Super Bowl\??/i, '— Super Bowl $1');
    t = t.replace(/win (?:the )?(\d{4}) (\w+)/i, '— $2 $1');
    t = t.replace(/win against /i, 'beat ');
    t = t.replace(/win over /i, 'beat ');
    // Sentencing
    t = t.replace(/be sentenced to /i, 'Sentenced to ');
    t = t.replace(/between (\d+) and (\d+) years in prison/i, '$1-$2 yrs prison');
    t = t.replace(/more than (\d+) years in prison/i, '$1+ yrs prison');
    t = t.replace(/less than (\d+) years in prison/i, '<$1 yrs prison');
    t = t.replace(/no prison time/i, 'no prison');
    // Finance / crypto
    t = t.replace(/close (above|below|at or above|at or below) /i, '$1 ');
    t = t.replace(/be (above|below|at or above|at or below) /i, '$1 ');
    t = t.replace(/price of /i, '');
    t = t.replace(/the price /i, '');
    t = t.replace(/on or before /i, 'by ');
    t = t.replace(/at the end of /i, 'end of ');
    t = t.replace(/by the end of /i, 'by end of ');
    t = t.replace(/Federal Reserve/i, 'Fed');
    t = t.replace(/interest rate/i, 'rate');
    // Dates — shorten month names
    t = t.replace(/January/i, 'Jan').replace(/February/i, 'Feb').replace(/March/i, 'Mar');
    t = t.replace(/April/i, 'Apr').replace(/August/i, 'Aug').replace(/September/i, 'Sep');
    t = t.replace(/October/i, 'Oct').replace(/November/i, 'Nov').replace(/December/i, 'Dec');
    // General
    t = t.replace(/released before /i, 'by ');
    t = t.replace(/before GTA VI\??/i, 'before GTA VI');
    t = t.replace(/United States/i, 'US');
    t = t.replace(/over pre-industrial levels /i, '');
    t = t.replace(/the largest source of global primary energy consumption/i, 'top energy source');
    t = t.replace(/a human land on Mars before California starts high-speed rail/i, 'Mars landing before CA high-speed rail');
    t = t.replace(/a supervolcano erupt before /i, 'supervolcano before ');
    t = t.replace(/humans colonize Mars before /i, 'Mars colony by ');
    t = t.replace(/Next Pope be/i, 'Next Pope');
    t = t.replace(/G7 leader will leave next/i, 'G7 leader out next');
    t = t.replace(/become President of the US before /i, 'US President by ');
    t = t.replace(/be President of the US before /i, 'US President by ');
    t = t.replace(/country will be the next to send humans to the Moon/i, 'next country on the Moon');
    t = t.replace(/When will any company achieve AGI: /i, 'AGI by ');
    t = t.replace(/be cast(?:ed)? in (?:the )?next /i, 'Cast in ');
    t = t.replace(/Before Jan 1, /i, 'Before ');
    t = t.replace(/\?$/, '');
    // Title Case — capitalize first letter of each word (skip small words)
    const small = new Set(['a','an','the','and','but','or','for','nor','on','at','to','by','in','of','vs','is']);
    t = t.replace(/\b\w+/g, (word, i) => {
        if (i === 0 || !small.has(word.toLowerCase())) {
            return word.charAt(0).toUpperCase() + word.slice(1);
        }
        return word;
    });
    // Cap length
    if (t.length > 60) t = t.substring(0, 57) + '...';
    return t;
}

// ── CREATE A MARKET CARD ──
// This function builds the HTML for one market card
function createMarketCard(market, platform) {
    const card = document.createElement('div');
    card.className = 'market-card';

    // Color-code prices by confidence level
    const yesColor = market.yes >= 70 ? '#00d68f' : market.yes <= 30 ? '#ff3b5c' : '#8b8b99';
    const noColor = market.no >= 70 ? '#00d68f' : market.no <= 30 ? '#ff3b5c' : '#8b8b99';

    // Clean up the title — make it short and punchy
    let title = shortenTitle(market.question);

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

    const starred = isStarred(market.ticker);
    const starChar = starred ? '\u2605' : '\u2606';
    const starClass = starred ? 'star-btn starred' : 'star-btn';
    const marketUrl = market.url || '#';

    card.innerHTML = `
        <div class="card-top-row">
            ${badge}
            <div style="display:flex;align-items:center;gap:6px;">
                <button class="${starClass}" title="Add to watchlist">${starChar}</button>
                <button class="ai-btn" title="AI Analysis">\u26A1</button>
            </div>
        </div>
        <h3>${title}</h3>
        <div class="prices">
            <span style="color:${yesColor};font-weight:600;">YES ${market.yes}\u00A2</span>
            <span style="color:#333;margin:0 8px;">\u00B7</span>
            <span style="color:${noColor};font-weight:600;">NO ${market.no}\u00A2</span>
        </div>
        <div class="buy-btns">
            <a class="buy-btn buy-yes" href="${marketUrl}" target="_blank" onclick="event.stopPropagation();">Buy YES</a>
            <a class="buy-btn buy-no" href="${marketUrl}" target="_blank" onclick="event.stopPropagation();">Buy NO</a>
        </div>
        ${extraInfo}
    `;

    // Add sparkline chart with fake price history
    // (Real price history requires a paid API — we simulate it for now)
    const sparkDiv = document.createElement('div');
    sparkDiv.className = 'sparkline';
    const sparkCanvas = document.createElement('canvas');
    sparkDiv.appendChild(sparkCanvas);
    card.appendChild(sparkDiv);

    // Generate simulated price data based on current price
    const basePrice = market.yes;
    const fakeHistory = [];
    let price = basePrice - 5 + Math.random() * 10;
    for (let i = 0; i < 20; i++) {
        price += (Math.random() - 0.48) * 3;
        price = Math.max(5, Math.min(95, price));
        fakeHistory.push(price);
    }
    fakeHistory.push(basePrice);  // End at current price

    // Draw after card is in the DOM
    setTimeout(() => drawSparkline(sparkCanvas, fakeHistory), 100);

    // Card click → open on platform
    card.addEventListener('click', (e) => {
        // Don't navigate if they clicked a button or link
        if (e.target.closest('.ai-btn') || e.target.closest('.star-btn') || e.target.closest('.buy-btn')) return;
        if (market.url) window.open(market.url, '_blank');
    });

    // AI button → analysis popup
    card.querySelector('.ai-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        analyzeMarket(market);
    });

    // Star button → toggle watchlist
    card.querySelector('.star-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleWatchlist(market.ticker, e.target);
    });

    // Store for filtering
    allMarketCards.push({ card, market });

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


// ── SEARCH & FILTER ──
let allMarketCards = [];  // Store all cards for filtering
let currentFilter = 'all';

function filterMarkets() {
    const query = document.getElementById('search-input').value.toLowerCase();
    for (const {card, market} of allMarketCards) {
        const text = (market.question || '').toLowerCase();
        const matchesSearch = !query || text.includes(query);
        const matchesFilter = currentFilter === 'all' || (market.category || categorize(market.question)) === currentFilter;
        card.style.display = (matchesSearch && matchesFilter) ? '' : 'none';
    }
}

function setFilter(filter, btn) {
    currentFilter = filter;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    filterMarkets();
}

// Categorize a market by its title
function categorize(title) {
    const t = (title || '').toLowerCase();
    if (['bitcoin','btc','ethereum','eth','crypto','doge','token'].some(w => t.includes(w))) return 'crypto';
    if (['nba','mlb','nfl','nhl','soccer','tennis','golf','ufc','boxing','f1',
         'world cup','champions league','premier league','playoffs','championship',
         'lakers','yankees','braves','dodgers','warriors','celtics',
         'olympics','medal','grand slam','hockey','baseball','basketball','football'].some(w => t.includes(w))) return 'sports';
    if (['trump','election','president','senate','congress','biden','governor',
         'democrat','republican','vote','parliament','supreme court',
         'war','ukraine','russia','china','nato','military','invasion','conflict'].some(w => t.includes(w))) return 'politics';
    if (['rain','snow','weather','temperature','hurricane','tornado','storm','flood','drought'].some(w => t.includes(w))) return 'weather';
    return 'other';
}


// ── SPARKLINE CHART ──
// Draws a tiny price history chart inside each card
function drawSparkline(canvas, data) {
    if (!canvas || !data || data.length < 2) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = 60;
    ctx.scale(2, 2);  // Retina

    const min = Math.min(...data) * 0.95;
    const max = Math.max(...data) * 1.05;
    const range = max - min || 1;
    const trending = data[data.length - 1] >= data[0];
    const color = trending ? '0, 214, 143' : '255, 59, 92';

    // Fill
    ctx.beginPath();
    ctx.moveTo(0, 30);
    for (let i = 0; i < data.length; i++) {
        const x = (i / (data.length - 1)) * (w / 2);
        const y = 30 - ((data[i] - min) / range) * 28;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(w / 2, 30);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, 30);
    grad.addColorStop(0, `rgba(${color}, 0.15)`);
    grad.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
        const x = (i / (data.length - 1)) * (w / 2);
        const y = 30 - ((data[i] - min) / range) * 28;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(${color}, 0.8)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
}


// ── THEME TOGGLE ──
// ── SETTINGS DROPDOWN ──
function toggleSettings() {
    const menu = document.getElementById('settings-menu');
    menu.classList.toggle('open');
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.settings-dropdown')) {
        const menu = document.getElementById('settings-menu');
        if (menu) menu.classList.remove('open');
    }
});

function toggleTheme() {
    document.body.classList.toggle('light');
    const isLight = document.body.classList.contains('light');
    const icon = document.getElementById('theme-icon');
    const label = document.getElementById('theme-label');
    if (icon) icon.innerHTML = isLight ? '&#9789;' : '&#9728;';
    if (label) label.textContent = isLight ? 'Dark Mode' : 'Light Mode';
    localStorage.setItem('pulse-theme', isLight ? 'light' : 'dark');
}

let autoRefreshEnabled = true;
let refreshInterval1, refreshInterval2;

function toggleAutoRefresh() {
    autoRefreshEnabled = !autoRefreshEnabled;
    const label = document.getElementById('autorefresh-label');
    if (label) label.textContent = 'Auto-Refresh: ' + (autoRefreshEnabled ? 'ON' : 'OFF');
    if (!autoRefreshEnabled) {
        clearInterval(refreshInterval1);
        clearInterval(refreshInterval2);
    } else {
        refreshInterval1 = setInterval(loadMarkets, 120000);
        refreshInterval2 = setInterval(loadBot, 120000);
    }
}

function clearWatchlist() {
    localStorage.removeItem('pulse-watchlist');
    loadMarkets();
    const menu = document.getElementById('settings-menu');
    if (menu) menu.classList.remove('open');
}

// Load saved theme
if (localStorage.getItem('pulse-theme') === 'light') {
    document.body.classList.add('light');
    const icon = document.getElementById('theme-icon');
    const label = document.getElementById('theme-label');
    if (icon) icon.innerHTML = '&#9789;';
    if (label) label.textContent = 'Dark Mode';
}


// ── NAV MINI ORB — matches badass hero orb ──
(function() {
    const c = document.getElementById('nav-orb');
    if (!c) return;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    c.width = 32 * dpr;
    c.height = 32 * dpr;
    ctx.scale(dpr, dpr);
    let t = 0;

    function draw() {
        t += 0.02;
        ctx.clearRect(0, 0, 32, 32);
        const cx = 16, cy = 16;

        // Outer hexagon
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + t * 0.3;
            ctx[i === 0 ? 'moveTo' : 'lineTo'](cx + Math.cos(a) * 14, cy + Math.sin(a) * 14);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(0, 136, 255, 0.2)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Segmented ring (rotating)
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * 0.5);
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const bright = Math.sin(t * 2 + i) * 0.3 + 0.5;
            ctx.beginPath();
            ctx.arc(0, 0, 12, a + 0.1, a + 0.6);
            ctx.strokeStyle = `rgba(0, 180, 255, ${bright})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        ctx.restore();

        // Inner ring (counter-rotate)
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-t * 0.8);
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(0, 0, 8, a + 0.15, a + 0.7);
            ctx.strokeStyle = i % 2 === 0 ? 'rgba(0, 214, 143, 0.3)' : 'rgba(0, 136, 255, 0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.restore();

        // Orbiting dot
        const dotA = t * 1.5;
        const dx = cx + Math.cos(dotA) * 10;
        const dy = cy + Math.sin(dotA) * 10;
        ctx.beginPath();
        ctx.arc(dx, dy, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 214, 143, 0.8)';
        ctx.fill();

        // Core glow
        const p = Math.sin(t * 2) * 0.2 + 0.8;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 5 * p);
        g.addColorStop(0, `rgba(255, 255, 255, ${0.9 * p})`);
        g.addColorStop(0.4, `rgba(0, 180, 255, ${0.5 * p})`);
        g.addColorStop(1, 'rgba(0, 100, 200, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, 5 * p, 0, Math.PI * 2);
        ctx.fill();

        // Center dot
        ctx.beginPath();
        ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 + Math.sin(t * 3) * 0.2})`;
        ctx.fill();

        requestAnimationFrame(draw);
    }
    draw();
})();

// ── ANIMATED LOGO ORB — v5 BADASS EDITION ──
(function() {
    const canvas = document.getElementById('logo-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const S = 200; // canvas logical size
    canvas.width = S * dpr;
    canvas.height = S * dpr;
    ctx.scale(dpr, dpr);
    let t = 0;

    // Hexagon helper
    function hexPath(cx, cy, r, rot) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + rot;
            const method = i === 0 ? 'moveTo' : 'lineTo';
            ctx[method](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        ctx.closePath();
    }

    // Data stream particles
    const streams = [];
    for (let i = 0; i < 20; i++) {
        streams.push({
            angle: Math.random() * Math.PI * 2,
            r: 30 + Math.random() * 60,
            speed: 0.3 + Math.random() * 0.7,
            size: 0.5 + Math.random() * 1.5,
            brightness: 0.3 + Math.random() * 0.7,
        });
    }

    function drawLogo() {
        t += 0.012;
        ctx.clearRect(0, 0, S, S);
        const cx = S / 2, cy = S / 2;

        // === DEEP BACKGROUND GLOW ===
        const bgGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 98);
        bgGlow.addColorStop(0, 'rgba(0, 136, 255, 0.08)');
        bgGlow.addColorStop(0.5, 'rgba(0, 80, 180, 0.03)');
        bgGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = bgGlow;
        ctx.beginPath();
        ctx.arc(cx, cy, 98, 0, Math.PI * 2);
        ctx.fill();

        // === OUTER HEXAGON (slow rotate) ===
        ctx.save();
        hexPath(cx, cy, 90, t * 0.2);
        ctx.strokeStyle = `rgba(0, 136, 255, ${0.08 + Math.sin(t) * 0.04})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();

        // === SECOND HEXAGON (counter-rotate, slightly smaller) ===
        ctx.save();
        hexPath(cx, cy, 82, -t * 0.15 + Math.PI / 6);
        ctx.strokeStyle = 'rgba(0, 214, 143, 0.06)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();

        // === SCANNING SWEEP (radar-style) ===
        ctx.save();
        ctx.translate(cx, cy);
        const sweepAngle = t * 1.5;
        const sweep = ctx.createConicGradient(sweepAngle, 0, 0);
        sweep.addColorStop(0, 'rgba(0, 136, 255, 0.12)');
        sweep.addColorStop(0.15, 'rgba(0, 136, 255, 0)');
        sweep.addColorStop(1, 'rgba(0, 136, 255, 0)');
        ctx.fillStyle = sweep;
        ctx.beginPath();
        ctx.arc(0, 0, 75, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // === SEGMENTED OUTER RING (24 segments, rotating) ===
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * 0.3);
        for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            const gap = 0.04;
            const arcLen = (Math.PI * 2 / 24) - gap * 2;
            const bright = (Math.sin(t * 2 + i * 0.5) * 0.5 + 0.5);
            ctx.beginPath();
            ctx.arc(0, 0, 75, a + gap, a + arcLen + gap);
            ctx.strokeStyle = `rgba(0, 136, 255, ${0.08 + bright * 0.25})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        ctx.restore();

        // === MIDDLE RING — thick, pulsing ===
        const midPulse = Math.sin(t * 1.5) * 0.1 + 0.9;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-t * 0.5);
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            const gap = 0.06;
            const arcLen = (Math.PI * 2 / 16) - gap * 2;
            ctx.beginPath();
            ctx.arc(0, 0, 58 * midPulse, a + gap, a + arcLen + gap);
            ctx.strokeStyle = i % 4 === 0
                ? `rgba(0, 214, 143, 0.35)`
                : `rgba(0, 136, 255, 0.12)`;
            ctx.lineWidth = i % 4 === 0 ? 2.5 : 1;
            ctx.stroke();
        }
        ctx.restore();

        // === INNER HEXAGON (fast rotate) ===
        ctx.save();
        hexPath(cx, cy, 42, t * 0.8);
        ctx.strokeStyle = 'rgba(0, 136, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        // === TICK MARKS (48 of them, subtle) ===
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * 0.2);
        for (let i = 0; i < 48; i++) {
            const a = (i / 48) * Math.PI * 2;
            const isMajor = i % 6 === 0;
            const len = isMajor ? 10 : 4;
            const r1 = 65;
            const r2 = r1 + len;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
            ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
            ctx.strokeStyle = isMajor
                ? 'rgba(0, 214, 143, 0.3)'
                : 'rgba(0, 136, 255, 0.08)';
            ctx.lineWidth = isMajor ? 1.5 : 0.5;
            ctx.stroke();
        }
        ctx.restore();

        // === DATA STREAM PARTICLES ===
        for (const s of streams) {
            s.angle += 0.005 * s.speed;
            const wobble = Math.sin(t * 3 + s.angle * 5) * 3;
            const x = cx + Math.cos(s.angle) * (s.r + wobble);
            const y = cy + Math.sin(s.angle) * (s.r + wobble);
            const flicker = Math.sin(t * 5 + s.angle * 10) * 0.3 + 0.7;
            ctx.beginPath();
            ctx.arc(x, y, s.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 180, 255, ${s.brightness * flicker * 0.6})`;
            ctx.fill();
        }

        // === ORBITING SATELLITES (3 big ones with trails) ===
        const satColors = [
            { r: '0, 180, 255', glow: 'rgba(0, 180, 255, 0.3)' },
            { r: '0, 214, 143', glow: 'rgba(0, 214, 143, 0.3)' },
            { r: '139, 92, 246', glow: 'rgba(139, 92, 246, 0.3)' },
        ];
        for (let i = 0; i < 3; i++) {
            const speed = 0.8 + i * 0.3;
            const radius = 48 + i * 18;
            const a = t * speed + (i * Math.PI * 2 / 3);
            const x = cx + Math.cos(a) * radius;
            const y = cy + Math.sin(a) * radius;

            // Trail
            for (let tr = 1; tr <= 6; tr++) {
                const ta = a - tr * 0.08;
                const tx = cx + Math.cos(ta) * radius;
                const ty = cy + Math.sin(ta) * radius;
                ctx.beginPath();
                ctx.arc(tx, ty, 2 - tr * 0.25, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${satColors[i].r}, ${0.3 - tr * 0.04})`;
                ctx.fill();
            }

            // Satellite dot
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${satColors[i].r}, 0.9)`;
            ctx.shadowColor = satColors[i].glow;
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // === ENERGY PULSE RINGS (expanding outward) ===
        const pulsePhase = (t * 0.8) % (Math.PI * 2);
        const pulseR = 20 + (pulsePhase / (Math.PI * 2)) * 70;
        const pulseAlpha = 1 - (pulsePhase / (Math.PI * 2));
        if (pulseAlpha > 0.05) {
            ctx.beginPath();
            ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 136, 255, ${pulseAlpha * 0.15})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        // Second pulse offset
        const pulse2Phase = ((t * 0.8) + Math.PI) % (Math.PI * 2);
        const pulse2R = 20 + (pulse2Phase / (Math.PI * 2)) * 70;
        const pulse2Alpha = 1 - (pulse2Phase / (Math.PI * 2));
        if (pulse2Alpha > 0.05) {
            ctx.beginPath();
            ctx.arc(cx, cy, pulse2R, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 214, 143, ${pulse2Alpha * 0.1})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }

        // === CORE — intense glowing center ===
        const corePulse = Math.sin(t * 2) * 0.2 + 0.8;

        // Core outer halo
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30 * corePulse);
        halo.addColorStop(0, `rgba(0, 200, 255, ${0.3 * corePulse})`);
        halo.addColorStop(0.5, `rgba(0, 100, 255, ${0.1 * corePulse})`);
        halo.addColorStop(1, 'rgba(0, 50, 150, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, cy, 30 * corePulse, 0, Math.PI * 2);
        ctx.fill();

        // Core bright sphere
        const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14 * corePulse);
        coreGrad.addColorStop(0, `rgba(255, 255, 255, ${0.95 * corePulse})`);
        coreGrad.addColorStop(0.3, `rgba(100, 220, 255, ${0.7 * corePulse})`);
        coreGrad.addColorStop(0.7, `rgba(0, 136, 255, ${0.4 * corePulse})`);
        coreGrad.addColorStop(1, 'rgba(0, 80, 200, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, 14 * corePulse, 0, Math.PI * 2);
        ctx.fill();

        // Core white-hot center
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 + Math.sin(t * 4) * 0.2})`;
        ctx.shadowColor = 'rgba(0, 200, 255, 0.8)';
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.shadowBlur = 0;

        // === CROSSHAIR LINES (subtle targeting) ===
        const crossAlpha = 0.06 + Math.sin(t * 1.5) * 0.03;
        ctx.strokeStyle = `rgba(0, 136, 255, ${crossAlpha})`;
        ctx.lineWidth = 0.5;
        // Horizontal
        ctx.beginPath();
        ctx.moveTo(cx - 95, cy);
        ctx.lineTo(cx - 25, cy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 25, cy);
        ctx.lineTo(cx + 95, cy);
        ctx.stroke();
        // Vertical
        ctx.beginPath();
        ctx.moveTo(cx, cy - 95);
        ctx.lineTo(cx, cy - 25);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy + 25);
        ctx.lineTo(cx, cy + 95);
        ctx.stroke();

        requestAnimationFrame(drawLogo);
    }
    drawLogo();
})();

// ── PARTICLE BACKGROUND ──
(function() {
    const canvas = document.getElementById('particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, particles = [];

    function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Create particles
    for (let i = 0; i < 60; i++) {
        particles.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            size: Math.random() * 1.5 + 0.5,
            alpha: Math.random() * 0.3 + 0.05,
        });
    }

    function draw() {
        ctx.clearRect(0, 0, w, h);

        for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0) p.x = w;
            if (p.x > w) p.x = 0;
            if (p.y < 0) p.y = h;
            if (p.y > h) p.y = 0;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 136, 255, ${p.alpha})`;
            ctx.fill();
        }

        // Draw lines between nearby particles
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 150) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(0, 136, 255, ${0.06 * (1 - dist / 150)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }

        requestAnimationFrame(draw);
    }
    draw();
})();


// ── SCROLL REVEAL ──
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.classList.add('visible');
            revealObserver.unobserve(e.target);
        }
    });
}, { threshold: 0.15 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ── CARD SCROLL REVEAL (staggered) ──
const cardObserver = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
        if (e.isIntersecting) {
            // Stagger delay based on position in the current batch
            const delay = (i % 3) * 80; // 0ms, 80ms, 160ms per row
            setTimeout(() => e.target.classList.add('card-visible'), delay);
            cardObserver.unobserve(e.target);
        }
    });
}, { threshold: 0.1 });

function observeCards() {
    document.querySelectorAll('.market-card:not(.card-visible)').forEach(el => {
        cardObserver.observe(el);
    });
}


// ── BOT PANEL ──
// MLB team codes to names
const TEAMS = {
    ATL:'Braves',NYY:'Yankees',LAD:'Dodgers',HOU:'Astros',BOS:'Red Sox',CHC:'Cubs',
    NYM:'Mets',PHI:'Phillies',SD:'Padres',SF:'Giants',STL:'Cardinals',WSH:'Nationals',
    MIA:'Marlins',CIN:'Reds',MIL:'Brewers',PIT:'Pirates',COL:'Rockies',ARI:'D-backs',
    LAA:'Angels',SEA:'Mariners',TEX:'Rangers',OAK:'Athletics',MIN:'Twins',CLE:'Guardians',
    DET:'Tigers',KC:'Royals',CWS:'White Sox',TB:'Rays',TOR:'Blue Jays',BAL:'Orioles',
    // NBA
    LAL:'Lakers',GSW:'Warriors',BKN:'Nets',MEM:'Grizzlies',DAL:'Mavs',DEN:'Nuggets',
    PHX:'Suns',SAC:'Kings',POR:'Trail Blazers',OKC:'Thunder',IND:'Pacers',ORL:'Magic',
    CHA:'Hornets',WAS:'Wizards',SAS:'Spurs',UTA:'Jazz',NOP:'Pelicans',
};

function decodeTicker(ticker) {
    // KXMLBGAME-26APR081607ATLLAA-ATL → "Braves vs Angels"
    // KXNBAGAME-26APR05... → NBA game
    if (!ticker) return '?';
    const parts = ticker.split('-');
    if (parts.length < 2) return ticker;

    const type = parts[0]; // KXMLBGAME, KXNBAGAME, etc
    const sport = type.includes('MLB') ? 'MLB' : type.includes('NBA') ? 'NBA' : type.includes('NHL') ? 'NHL' : '';

    // Last part is usually the team this contract is for
    const lastPart = parts[parts.length - 1];

    // Try to extract two team codes from the middle section
    const mid = parts[1] || '';
    // Pattern: 26APR081607ATLLAA — date then team codes
    const teamMatch = mid.match(/\d+[A-Z]{3}\d+(\w+)/);

    if (teamMatch) {
        const teamStr = teamMatch[1];
        // Try to find known 2-3 letter team codes
        for (const [code, name] of Object.entries(TEAMS)) {
            if (lastPart === code) {
                return `${sport} ${name}`;
            }
        }
    }

    // Fallback: use last part as team
    if (TEAMS[lastPart]) return `${sport} ${TEAMS[lastPart]}`;
    if (sport) return `${sport} Game`;

    // Non-sport tickers
    if (type.includes('FED')) return 'Fed Rate Decision';
    if (type.includes('CPI')) return 'CPI Report';
    if (type.includes('GDP')) return 'GDP Report';
    if (type.includes('POPE')) return 'Next Pope';
    if (type.includes('INX') || type.includes('SPX')) return 'S&P 500';
    if (type.includes('BTC')) return 'Bitcoin';
    return ticker.substring(0, 25) + '...';
}

async function loadBot() {
    try {
        const resp = await fetch(API_BASE + '/api/bot');
        if (!resp.ok) throw new Error('Bot unavailable');
        const bot = await resp.json();
        if (bot.error) throw new Error(bot.error);

        document.getElementById('bot-balance').textContent = '$' + (bot.balance || 0).toFixed(2);
        document.getElementById('bot-portfolio').textContent = '$' + (bot.portfolio_value || 0).toFixed(2);

        const statusEl = document.getElementById('bot-status');
        statusEl.textContent = bot.running ? 'Running' : 'Stopped';
        statusEl.className = 'bot-stat-value ' + (bot.running ? 'running' : 'stopped');

        document.getElementById('bot-trades').textContent = bot.trades_today || 0;

        // Total P&L
        const totalPnl = (bot.positions || []).reduce((sum, p) => sum + (p.upnl || p.pnl || 0), 0);
        const pnlEl = document.getElementById('bot-total-pnl');
        if (pnlEl) {
            const pnlText = totalPnl >= 0 ? '+$' + totalPnl.toFixed(2) : '-$' + Math.abs(totalPnl).toFixed(2);
            pnlEl.textContent = pnlText;
            pnlEl.className = 'bot-stat-value ' + (totalPnl >= 0 ? 'running' : 'stopped');
        }

        // Render positions
        const posDiv = document.getElementById('bot-positions');
        if (bot.positions && bot.positions.length > 0) {
            posDiv.innerHTML = '<h3 style="font-size:13px;color:var(--text-dim);letter-spacing:2px;margin-bottom:8px;">OPEN POSITIONS</h3>' +
                bot.positions.map(p => {
                    const pnl = p.upnl || p.pnl || 0;
                    const pnlClass = pnl >= 0 ? 'positive' : 'negative';
                    const pnlStr = pnl >= 0 ? '+$' + pnl.toFixed(2) : '-$' + Math.abs(pnl).toFixed(2);
                    const posTitle = p.title && !p.title.includes('KX') ? p.title : decodeTicker(p.ticker);
                    const contracts = p.contracts || p.count || 1;
                    return `<div class="bot-position">
                        <div>
                            <div class="bot-position-title">${posTitle}</div>
                            <div class="bot-position-side">${(p.side || '').toUpperCase()} · ${contracts} contract${contracts > 1 ? 's' : ''}</div>
                        </div>
                        <div class="bot-position-pnl ${pnlClass}">${pnlStr}</div>
                    </div>`;
                }).join('');
        } else {
            posDiv.innerHTML = '<p style="color:var(--text-dim);font-size:13px;">No open positions</p>';
        }
    } catch(e) {
        // Bot offline — show error message instead of hiding
        document.getElementById('bot-balance').textContent = '—';
        document.getElementById('bot-status').textContent = 'Offline';
        document.getElementById('bot-status').className = 'bot-stat-value stopped';
    }
}

// ── AUTO REFRESH with countdown ──
let refreshCountdown = 120;
refreshInterval1 = setInterval(loadMarkets, 120000);
refreshInterval2 = setInterval(loadBot, 120000);
setInterval(() => {
    refreshCountdown--;
    if (refreshCountdown <= 0) refreshCountdown = 120;
    const el = document.getElementById('refresh-countdown');
    if (el) el.textContent = `Next refresh: ${refreshCountdown}s`;
}, 1000);
loadMarkets();
loadBot();
