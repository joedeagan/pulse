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
    const briefEl = document.getElementById('ai-brief');
    const botEl = document.getElementById('bot-panel');
    const portfolioEl = document.getElementById('portfolio-panel');
    const arbEl = document.getElementById('arbitrage');
    const corrEl = document.getElementById('correlations-panel');

    const marketsView = [heroEl, statsEl, filtersEl, marketsEl, briefEl];
    const botView = [botEl];
    const portfolioView = [portfolioEl];
    const arbView = [arbEl];
    const corrView = [corrEl];
    const allSections = [...marketsView, ...botView, ...portfolioView, ...arbView, ...corrView];

    // Hide everything
    allSections.forEach(el => { if (el) el.classList.add('view-hidden'); });

    // Show the selected view
    let visible = [];
    if (tab === 'markets') visible = marketsView;
    else if (tab === 'bot') visible = botView;
    else if (tab === 'portfolio') { visible = portfolioView; loadPortfolio(); }
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
    // Show skeleton loading on first load
    if (firstLoad) {
        grid.innerHTML = Array(6).fill(`
            <div class="market-card skeleton-card">
                <div class="skel skel-badge"></div>
                <div class="skel skel-title"></div>
                <div class="skel skel-title-sm"></div>
                <div class="skel skel-prices"></div>
                <div class="skel skel-chart"></div>
            </div>
        `).join('');
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

    // Save price snapshots for real sparklines
    const allMkts = [...kalshiMarkets, ...polyMarkets];
    savePriceSnapshot(allMkts);

    grid.innerHTML = '';
    allMarketCards = [];  // Reset for filtering
    firstLoad = false;

    // Sort: starred first, then by volume (highest first)
    const wl = getWatchlist();
    const sortByStarred = (arr) => {
        return [...arr].sort((a, b) => {
            const aStarred = wl.includes(a.ticker) ? 1 : 0;
            const bStarred = wl.includes(b.ticker) ? 1 : 0;
            if (bStarred !== aStarred) return bStarred - aStarred;
            return (b.volume || 0) - (a.volume || 0); // Then by volume
        });
    };

    // Calculate biggest movers
    const movers = findBiggestMovers(allMkts);

    // Show Biggest Movers section if any
    if (movers.length > 0) {
        const moverHeader = document.createElement('div');
        moverHeader.className = 'platform-header movers-header';
        moverHeader.innerHTML = '<h3>🔥 BIGGEST MOVERS</h3>';
        grid.appendChild(moverHeader);

        for (const m of movers.slice(0, 4)) {
            grid.appendChild(createMarketCard(m.market, m.market.source || 'kalshi', m.change));
        }
    }

    // Show Kalshi markets
    if (kalshiMarkets.length > 0) {
        const header = document.createElement('div');
        header.className = 'platform-header';
        header.innerHTML = '<h3>KALSHI</h3>';
        grid.appendChild(header);

        for (const m of sortByStarred(kalshiMarkets)) {
            const change = getMarketChange(m.ticker);
            grid.appendChild(createMarketCard(m, 'kalshi', change));
        }
    }

    // Show Polymarket markets
    if (polyMarkets.length > 0) {
        const header = document.createElement('div');
        header.className = 'platform-header';
        header.innerHTML = '<h3>POLYMARKET</h3>';
        grid.appendChild(header);

        for (const m of sortByStarred(polyMarkets)) {
            const change = getMarketChange(m.ticker);
            grid.appendChild(createMarketCard(m, 'poly', change));
        }
    }

    // Look for ARBITRAGE — same question on both platforms with different prices
    const arbitrage = findArbitrage(kalshiMarkets, polyMarkets);
    if (arbitrage.length > 0) {
        showArbitrage(arbitrage);
    }

    // Check for notification-worthy changes
    checkPriceAlerts(kalshiMarkets, polyMarkets);
    checkArbAlerts(arbitrage);

    // Generate AI market brief
    generateMarketBrief(kalshiMarkets, polyMarkets);

    // Update filter chip counts
    updateFilterCounts(allMkts);

    const total = kalshiMarkets.length + polyMarkets.length;
    document.getElementById('market-count').textContent = total;
    document.getElementById('arb-count').textContent = arbitrage.length || '0';
    document.getElementById('refresh-time').textContent = `Updated ${new Date().toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}`;

    // Apply volume filter
    filterMarkets();

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
function createMarketCard(market, platform, priceChange) {
    const card = document.createElement('div');
    card.className = 'market-card';

    // Color-code prices by confidence level
    const yesColor = market.yes >= 70 ? '#00d68f' : market.yes <= 30 ? '#ff3b5c' : '#8b8b99';
    const noColor = market.no >= 70 ? '#00d68f' : market.no <= 30 ? '#ff3b5c' : '#8b8b99';

    let title = shortenTitle(market.question);

    // Category badge
    const cat = market.category || categorize(market.question);
    const catColors = { crypto:'#ffb800', sports:'#00d68f', politics:'#0088ff', weather:'#64b5f6', entertainment:'#8b5cf6', finance:'#f0b000', science:'#00d68f', other:'#5a5a6e' };
    const catDot = `<span class="cat-dot" style="background:${catColors[cat] || '#5a5a6e'}" title="${cat}"></span>`;

    // Price change indicator
    let changeHtml = '';
    if (priceChange && priceChange !== 0) {
        const changeColor = priceChange > 0 ? '#00d68f' : '#ff3b5c';
        const arrow = priceChange > 0 ? '▲' : '▼';
        changeHtml = `<span class="price-change" style="color:${changeColor}">${arrow}${Math.abs(priceChange)}¢</span>`;
    }

    // Pulse Score — combines price confidence + volume strength + momentum
    const pulseScore = calcPulseScore(market, priceChange);
    const pulseColor = pulseScore >= 70 ? '#00d68f' : pulseScore >= 40 ? '#f0b000' : '#ff3b5c';
    const pulseLabel = pulseScore >= 70 ? 'STRONG' : pulseScore >= 40 ? 'MODERATE' : 'WEAK';

    const badge = platform === 'kalshi'
        ? '<span class="badge kalshi-badge">KALSHI</span>'
        : '<span class="badge poly-badge">POLY</span>';

    const starred = isStarred(market.ticker);
    const starChar = starred ? '\u2605' : '\u2606';
    const starClass = starred ? 'star-btn starred' : 'star-btn';
    const marketUrl = market.url || '#';

    card.innerHTML = `
        <div class="card-top-row">
            <div style="display:flex;align-items:center;gap:6px;">
                ${badge}
                ${catDot}
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
                <span class="pulse-score" style="color:${pulseColor}" title="Pulse Score: ${pulseLabel}">${pulseScore}</span>
                <button class="${starClass}" title="Add to watchlist">${starChar}</button>
            </div>
        </div>
        <h3>${title}</h3>
        <div class="prices">
            <span style="color:${yesColor};font-weight:600;">YES ${market.yes}\u00A2</span>
            ${changeHtml}
            <span style="color:#333;margin:0 4px;">\u00B7</span>
            <span style="color:${noColor};font-weight:600;">NO ${market.no}\u00A2</span>
        </div>
    `;

    // Sparkline — use real price history if available
    const sparkDiv = document.createElement('div');
    sparkDiv.className = 'sparkline';
    const sparkCanvas = document.createElement('canvas');
    sparkDiv.appendChild(sparkCanvas);
    card.appendChild(sparkDiv);

    const realHistory = getPriceHistory(market.ticker);
    let chartData;
    if (realHistory.length >= 3) {
        chartData = realHistory;
    } else {
        // Fallback to simulated data with current price as anchor
        const basePrice = market.yes;
        chartData = [];
        let p = basePrice - 5 + Math.random() * 10;
        for (let i = 0; i < 20; i++) {
            p += (Math.random() - 0.48) * 3;
            p = Math.max(5, Math.min(95, p));
            chartData.push(p);
        }
        chartData.push(basePrice);
    }
    setTimeout(() => drawSparkline(sparkCanvas, chartData), 100);

    // Card click → open detail page
    card.addEventListener('click', (e) => {
        if (e.target.closest('.star-btn')) return;
        openDetail(market, platform);
    });

    card.querySelector('.star-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleWatchlist(market.ticker, e.target);
    });

    allMarketCards.push({ card, market });
    return card;
}

// ── PULSE SCORE — confidence rating ──
function calcPulseScore(market, priceChange) {
    let score = 0;
    const yes = market.yes;

    // Price confidence — rewards markets with clear direction but NOT settled/dead ones
    // Best score: 70-90¢ or 10-30¢ range (strong lean, still tradeable)
    // Worst score: 0-3¢ or 97-100¢ (basically settled, no action)
    // Medium score: 40-60¢ range (uncertain, could go either way)
    if (yes <= 3 || yes >= 97) {
        score += 5; // Basically settled — low interest
    } else if (yes <= 10 || yes >= 90) {
        score += 30; // Very confident
    } else if (yes <= 20 || yes >= 80) {
        score += 35; // Strong lean, good trading range
    } else if (yes <= 30 || yes >= 70) {
        score += 25; // Moderate lean
    } else {
        score += 15; // Near 50/50 — uncertain
    }

    // Volume strength — logarithmic scale for better spread
    const vol = market.volume || 0;
    if (vol > 1000000) score += 25;
    else if (vol > 500000) score += 22;
    else if (vol > 100000) score += 18;
    else if (vol > 50000) score += 14;
    else if (vol > 10000) score += 10;
    else if (vol > 1000) score += 6;
    else if (vol > 100) score += 3;

    // Momentum (price change) — biggest differentiator
    const change = Math.abs(priceChange || 0);
    if (change > 10) score += 30;
    else if (change > 5) score += 22;
    else if (change > 3) score += 15;
    else if (change > 1) score += 8;
    else if (change > 0) score += 3;

    // Edge bonus
    if (market.edge && market.edge > 0.05) score += 8;

    return Math.min(Math.round(score), 99);
}

// ── SHARE MARKET ──
function shareMarket(market) {
    const text = `${market.question}\nYES ${market.yes}¢ · NO ${market.no}¢\n${market.url || 'via PULSE'}`;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.textContent = 'Copied to clipboard!';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        });
    }
}

// ── REAL PRICE HISTORY ──
function getPriceSnapshots() {
    try { return JSON.parse(localStorage.getItem('pulse-snapshots') || '{}'); }
    catch { return {}; }
}

function savePriceSnapshot(allMarkets) {
    const snapshots = getPriceSnapshots();
    const now = Date.now();
    for (const m of allMarkets) {
        if (!m.ticker) continue;
        if (!snapshots[m.ticker]) snapshots[m.ticker] = [];
        const arr = snapshots[m.ticker];
        // Only save if price changed or every 5 min
        const last = arr[arr.length - 1];
        if (!last || last.p !== m.yes || (now - last.t) > 300000) {
            arr.push({ t: now, p: m.yes });
        }
        // Keep last 50 snapshots per market
        if (arr.length > 50) arr.splice(0, arr.length - 50);
    }
    localStorage.setItem('pulse-snapshots', JSON.stringify(snapshots));
}

function getPriceHistory(ticker) {
    const snapshots = getPriceSnapshots();
    return (snapshots[ticker] || []).map(s => s.p);
}

function getMarketChange(ticker) {
    const snapshots = getPriceSnapshots();
    const arr = snapshots[ticker] || [];
    if (arr.length < 2) return 0;
    return arr[arr.length - 1].p - arr[0].p;
}

// ── BIGGEST MOVERS ──
function findBiggestMovers(allMarkets) {
    const movers = [];
    for (const m of allMarkets) {
        if (!m.ticker) continue;
        const change = getMarketChange(m.ticker);
        if (Math.abs(change) >= 2) {
            movers.push({ market: m, change });
        }
    }
    movers.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    return movers;
}

// ── FILTER CHIP COUNTS ──
function updateFilterCounts(allMarkets) {
    const counts = { all: allMarkets.length };
    for (const m of allMarkets) {
        const cat = m.category || categorize(m.question);
        counts[cat] = (counts[cat] || 0) + 1;
    }
    counts.watchlist = getWatchlist().length;

    document.querySelectorAll('.chip').forEach(chip => {
        const onclick = chip.getAttribute('onclick') || '';
        const match = onclick.match(/setFilter\('(\w+)'/);
        if (match) {
            const filter = match[1];
            const count = counts[filter] || 0;
            // Update chip text — keep label, add count
            const label = chip.textContent.replace(/\s*\(\d+\)$/, '');
            chip.textContent = count > 0 ? `${label} (${count})` : label;
        }
    });
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
let showLowVolume = false;
const MIN_VOLUME = 1000; // $1K minimum to be "high value"

function filterMarkets() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const wl = getWatchlist();
    let visibleCount = 0;
    for (const {card, market} of allMarketCards) {
        const text = (market.question || '').toLowerCase();
        const matchesSearch = !query || text.includes(query);
        let matchesFilter = true;
        if (currentFilter === 'watchlist') {
            matchesFilter = wl.includes(market.ticker);
        } else if (currentFilter !== 'all') {
            matchesFilter = (market.category || categorize(market.question)) === currentFilter;
        }
        // Volume filter — hide low volume unless toggled
        const vol = market.volume || 0;
        const isStarred = wl.includes(market.ticker);
        const passesVolume = showLowVolume || vol >= MIN_VOLUME || isStarred || currentFilter === 'watchlist';
        const show = matchesSearch && matchesFilter && passesVolume;
        card.style.display = show ? '' : 'none';
        if (show) visibleCount++;
    }
    // Update the "Show All" toggle count
    const toggleEl = document.getElementById('show-all-toggle');
    if (toggleEl) {
        const hiddenCount = allMarketCards.filter(c => (c.market.volume || 0) < MIN_VOLUME && !wl.includes(c.market.ticker)).length;
        toggleEl.textContent = showLowVolume ? 'Hide Low Volume' : `Show All (+${hiddenCount} low volume)`;
    }
}

function toggleLowVolume() {
    showLowVolume = !showLowVolume;
    filterMarkets();
}

function setFilter(filter, btn) {
    currentFilter = filter;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    filterMarkets();
}

// ── SORT MARKETS ──
let currentSort = 'default';
function sortMarkets(sort) {
    currentSort = sort;
    const grid = document.querySelector('.market-grid');
    if (!grid) return;

    // Separate platform headers from cards
    const headers = grid.querySelectorAll('.platform-header');
    const kalshiHeader = headers[0];
    const polyHeader = headers[1];

    // Split cards by platform
    const kalshiCards = allMarketCards.filter(c => c.market.source === 'kalshi');
    const polyCards = allMarketCards.filter(c => c.market.source === 'poly');

    const sortFn = getSortFn(sort);
    if (sortFn) {
        kalshiCards.sort(sortFn);
        polyCards.sort(sortFn);
    }

    // Rebuild grid
    grid.innerHTML = '';
    if (kalshiHeader) grid.appendChild(kalshiHeader);
    kalshiCards.forEach(c => grid.appendChild(c.card));
    if (polyHeader) grid.appendChild(polyHeader);
    polyCards.forEach(c => grid.appendChild(c.card));

    filterMarkets(); // Re-apply filters
}

function getSortFn(sort) {
    const prev = previousPrices;
    switch(sort) {
        case 'volume-desc': return (a, b) => (b.market.volume || 0) - (a.market.volume || 0);
        case 'volume-asc': return (a, b) => (a.market.volume || 0) - (b.market.volume || 0);
        case 'yes-desc': return (a, b) => b.market.yes - a.market.yes;
        case 'yes-asc': return (a, b) => a.market.yes - b.market.yes;
        case 'change-desc': return (a, b) => {
            const aChange = Math.abs(a.market.yes - (prev[a.market.ticker] || a.market.yes));
            const bChange = Math.abs(b.market.yes - (prev[b.market.ticker] || b.market.yes));
            return bChange - aChange;
        };
        default: return null;
    }
}

// Categorize a market by its title
function categorize(title) {
    const t = (title || '').toLowerCase();
    if (['bitcoin','btc','ethereum','eth','crypto','doge','token','solana','ripple','xrp'].some(w => t.includes(w))) return 'crypto';
    if (['nba','mlb','nfl','nhl','soccer','tennis','golf','ufc','boxing','f1','formula 1',
         'verstappen','hamilton','leclerc','world cup','fifa',
         'champions league','premier league','serie a','la liga','bundesliga',
         'playoffs','championship','stanley cup','super bowl',
         'lakers','yankees','braves','dodgers','warriors','celtics',
         'hornets','spurs','suns','raptors','clippers','nuggets','hawks','nets',
         'avalanche','rangers','bruins','panthers','oilers',
         'wimbledon','us open','french open','australian open',
         'olympics','medal','grand slam','hockey','baseball','basketball','football'].some(w => t.includes(w))) return 'sports';
    if (t.includes('retirement') && t.includes('season')) return 'sports';
    if (['trump','election','president','senate','congress','biden','governor',
         'democrat','republican','vote','parliament','supreme court',
         'tariff','sanction','executive order','impeach',
         'speaker of the house','jeffries','jim jordan',
         'african leaders','leave office','climate goal',
         'war','ukraine','russia','china','nato','military','invasion','conflict',
         'iran','israel','gaza','taiwan'].some(w => t.includes(w))) return 'politics';
    if (['rain','snow','weather','temperature','hurricane','tornado','storm','flood','drought',
         'wildfire','earthquake'].some(w => t.includes(w))) return 'weather';
    if (['gta','album','movie','film','cast','released','rihanna','carti','drake',
         'kanye','taylor swift','beyonce','oscar','grammy','emmy','netflix','disney',
         'marvel','star wars','james bond','miami vice','season',
         'weinstein','sentenced','prison','trial','verdict',
         'pope','catholic','vatican'].some(w => t.includes(w))) return 'entertainment';
    if (['fed ','rate cut','rate hike','inflation','cpi','gdp','recession',
         'unemployment','s&p','nasdaq','dow','stock','ipo','interest rate',
         'ev market','electric vehicle','market share'].some(w => t.includes(w))) return 'finance';
    if (['moon','mars','spacex','nasa','robot','humanoid','agi','openai','ai ',
         'fda','cure','diabetes','vaccine','asteroid','space'].some(w => t.includes(w))) return 'science';
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

        // Check for bot trade alerts
        checkBotAlerts(bot);

        // Total P&L (excluding Fed rate bet)
        const totalPnl = (bot.positions || []).filter(p => !p.ticker || !p.ticker.includes('KXFED')).reduce((sum, p) => sum + (p.upnl || p.pnl || 0), 0);
        const pnlEl = document.getElementById('bot-total-pnl');
        if (pnlEl) {
            const pnlText = totalPnl >= 0 ? '+$' + totalPnl.toFixed(2) : '-$' + Math.abs(totalPnl).toFixed(2);
            pnlEl.textContent = pnlText;
            pnlEl.className = 'bot-stat-value ' + (totalPnl >= 0 ? 'running' : 'stopped');
        }

        // Render positions (hide Fed rate bet — distorts stats)
        const posDiv = document.getElementById('bot-positions');
        const filteredPositions = (bot.positions || []).filter(p => !p.ticker || !p.ticker.includes('KXFED'));
        if (filteredPositions.length > 0) {
            posDiv.innerHTML = '<h3 style="font-size:13px;color:var(--text-dim);letter-spacing:2px;margin-bottom:8px;">OPEN POSITIONS</h3>' +
                filteredPositions.map(p => {
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

// ── MARKET DETAIL PAGE ──
let currentDetailMarket = null;

function openDetail(market, platform) {
    currentDetailMarket = market;
    const overlay = document.getElementById('market-detail');
    // Force all styles individually to avoid any cssText parsing issues
    overlay.style.display = 'flex';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.zIndex = '9999';
    overlay.style.background = 'rgba(0,0,0,0.7)';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '20px';
    console.log('DETAIL OPEN:', overlay.style.position, overlay.style.zIndex, overlay.style.display, getComputedStyle(overlay).position);

    // Badge
    const badgeHtml = platform === 'kalshi'
        ? '<span class="badge kalshi-badge">KALSHI</span>'
        : '<span class="badge poly-badge">POLYMARKET</span>';
    document.getElementById('detail-badge').innerHTML = badgeHtml;

    // Title
    document.getElementById('detail-title').textContent = market.question || 'Market';

    // Prices — big display
    const yesColor = market.yes >= 70 ? 'var(--green)' : market.yes <= 30 ? 'var(--red)' : 'var(--text)';
    const noColor = market.no >= 70 ? 'var(--green)' : market.no <= 30 ? 'var(--red)' : 'var(--text)';
    document.getElementById('detail-prices').innerHTML = `
        <div class="detail-price-row">
            <div class="detail-price yes" style="color:${yesColor}">
                <span class="detail-price-label">YES</span>
                <span class="detail-price-value">${market.yes}¢</span>
            </div>
            <div class="detail-price no" style="color:${noColor}">
                <span class="detail-price-label">NO</span>
                <span class="detail-price-value">${market.no}¢</span>
            </div>
        </div>
    `;

    // Stats
    const vol = market.volume ? '$' + Math.round(market.volume).toLocaleString() : '—';
    const cat = market.category || categorize(market.question);
    document.getElementById('detail-stats').innerHTML = `
        <div class="detail-stats-grid">
            <div><span class="detail-stat-label">Volume</span><span class="detail-stat-value">${vol}</span></div>
            <div><span class="detail-stat-label">Category</span><span class="detail-stat-value">${cat.charAt(0).toUpperCase() + cat.slice(1)}</span></div>
            <div><span class="detail-stat-label">Platform</span><span class="detail-stat-value">${platform === 'kalshi' ? 'Kalshi' : 'Polymarket'}</span></div>
            <div><span class="detail-stat-label">Ticker</span><span class="detail-stat-value">${market.ticker || '—'}</span></div>
        </div>
    `;

    // Actions
    const url = market.url || '#';
    const pulseScore = calcPulseScore(market, getMarketChange(market.ticker));
    const pulseColor = pulseScore >= 70 ? 'var(--green)' : pulseScore >= 40 ? 'var(--gold)' : 'var(--red)';
    const pulseLabel = pulseScore >= 70 ? 'STRONG' : pulseScore >= 40 ? 'MODERATE' : 'WEAK';
    document.getElementById('detail-actions').innerHTML = `
        <div class="detail-pulse-row">
            <div class="detail-pulse-score" style="border-color:${pulseColor};">
                <span class="detail-pulse-num" style="color:${pulseColor}">${pulseScore}</span>
                <span class="detail-pulse-label">PULSE</span>
            </div>
            <div class="detail-pulse-info">
                <span style="color:${pulseColor};font-weight:700;">${pulseLabel}</span> signal
                <span style="color:var(--text-dim);font-size:12px;display:block;">Based on price confidence, volume, and momentum</span>
            </div>
        </div>
        <div class="detail-btn-row">
            <a class="detail-btn detail-btn-yes" href="${url}" target="_blank">Buy YES on ${platform === 'kalshi' ? 'Kalshi' : 'Polymarket'}</a>
            <a class="detail-btn detail-btn-no" href="${url}" target="_blank">Buy NO on ${platform === 'kalshi' ? 'Kalshi' : 'Polymarket'}</a>
        </div>
        <div class="detail-btn-row">
            <button class="detail-btn" style="background:rgba(0,136,255,0.1);color:var(--accent);border-color:rgba(0,136,255,0.3);" onclick="analyzeMarket(currentDetailMarket)">⚡ AI Analysis</button>
            <button class="detail-btn" style="background:rgba(255,255,255,0.05);color:var(--text-mid);border-color:var(--border);" onclick="shareMarket(currentDetailMarket)">↗ Share</button>
        </div>
    `;

    // Paper trade section
    document.getElementById('detail-paper-trade').innerHTML = `
        <div class="paper-trade-section">
            <h4>Paper Trade</h4>
            <div class="paper-trade-row">
                <select id="paper-side">
                    <option value="yes">YES</option>
                    <option value="no">NO</option>
                </select>
                <input type="number" id="paper-amount" placeholder="Contracts" value="10" min="1" max="1000">
                <button class="detail-btn detail-btn-paper" onclick="placePaperTrade()">Place Paper Trade</button>
            </div>
            <p class="paper-cost" id="paper-cost-preview">Cost: 10 × ${market.yes}¢ = $${(10 * market.yes / 100).toFixed(2)}</p>
        </div>
    `;

    // Price alert section
    const alerts = getPriceAlerts();
    const existingAlert = alerts.find(a => a.ticker === market.ticker);
    document.getElementById('detail-alert-section').innerHTML = `
        <div class="paper-trade-section">
            <h4>Price Alert</h4>
            <div class="paper-trade-row">
                <span style="font-size:12px;color:var(--text-dim);">Alert when YES</span>
                <select id="alert-direction">
                    <option value="above" ${existingAlert?.direction === 'above' ? 'selected' : ''}>goes above</option>
                    <option value="below" ${existingAlert?.direction === 'below' ? 'selected' : ''}>drops below</option>
                </select>
                <input type="number" id="alert-threshold" placeholder="¢" value="${existingAlert?.threshold || ''}" min="1" max="99" style="width:70px;">
                <span style="font-size:12px;color:var(--text-dim);">¢</span>
                <button class="detail-btn detail-btn-paper" onclick="setPriceAlert()" style="flex:0;padding:10px 16px;">${existingAlert ? 'Update' : 'Set Alert'}</button>
                ${existingAlert ? '<button class="detail-btn" onclick="removePriceAlert()" style="flex:0;padding:10px 12px;background:rgba(255,59,92,0.1);color:var(--red);border-color:rgba(255,59,92,0.3);">✕</button>' : ''}
            </div>
            ${existingAlert ? `<p class="paper-cost">Active: Alert when YES ${existingAlert.direction} ${existingAlert.threshold}¢</p>` : ''}
        </div>
    `;

    // Update cost preview on input change
    setTimeout(() => {
        const amtInput = document.getElementById('paper-amount');
        const sideInput = document.getElementById('paper-side');
        const updateCost = () => {
            const amt = parseInt(amtInput.value) || 0;
            const side = sideInput.value;
            const price = side === 'yes' ? market.yes : market.no;
            document.getElementById('paper-cost-preview').textContent =
                `Cost: ${amt} × ${price}¢ = $${(amt * price / 100).toFixed(2)}`;
        };
        amtInput?.addEventListener('input', updateCost);
        sideInput?.addEventListener('change', updateCost);
    }, 50);

    // Draw bigger chart
    const canvas = document.getElementById('detail-chart');
    const basePrice = market.yes;
    const history = [];
    let p = basePrice - 8 + Math.random() * 16;
    for (let i = 0; i < 50; i++) {
        p += (Math.random() - 0.48) * 2.5;
        p = Math.max(2, Math.min(98, p));
        history.push(p);
    }
    history.push(basePrice);
    setTimeout(() => drawDetailChart(canvas, history), 50);
}

function drawDetailChart(canvas, data) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const min = Math.min(...data) * 0.95;
    const max = Math.max(...data) * 1.05;
    const range = max - min || 1;
    const trending = data[data.length - 1] >= data[0];
    const color = trending ? '0, 214, 143' : '255, 59, 92';

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
        const y = (h / 5) * i + 20;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Fill
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < data.length; i++) {
        const x = (i / (data.length - 1)) * w;
        const y = h - 20 - ((data[i] - min) / range) * (h - 40);
        ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `rgba(${color}, 0.2)`);
    grad.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
        const x = (i / (data.length - 1)) * w;
        const y = h - 20 - ((data[i] - min) / range) * (h - 40);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(${color}, 0.9)`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dot at end
    const lastX = w;
    const lastY = h - 20 - ((data[data.length - 1] - min) / range) * (h - 40);
    ctx.beginPath();
    ctx.arc(lastX - 2, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${color})`;
    ctx.fill();
}

function closeDetail() {
    document.getElementById('market-detail').style.cssText = 'display:none;';
    currentDetailMarket = null;
}

// Close on overlay click
document.getElementById('market-detail')?.addEventListener('click', (e) => {
    if (e.target.id === 'market-detail') closeDetail();
});


// ── PAPER PORTFOLIO ──
function getPaperPortfolio() {
    try { return JSON.parse(localStorage.getItem('pulse-portfolio') || '{"balance":1000,"trades":[]}'); }
    catch { return { balance: 1000, trades: [] }; }
}

function savePaperPortfolio(portfolio) {
    localStorage.setItem('pulse-portfolio', JSON.stringify(portfolio));
}

function placePaperTrade() {
    if (!currentDetailMarket) return;
    const side = document.getElementById('paper-side').value;
    const amount = parseInt(document.getElementById('paper-amount').value) || 0;
    if (amount <= 0) return;

    const price = side === 'yes' ? currentDetailMarket.yes : currentDetailMarket.no;
    const cost = (amount * price) / 100;

    const portfolio = getPaperPortfolio();
    if (cost > portfolio.balance) {
        alert(`Not enough balance! Need $${cost.toFixed(2)}, have $${portfolio.balance.toFixed(2)}`);
        return;
    }

    portfolio.balance -= cost;
    portfolio.trades.push({
        ticker: currentDetailMarket.ticker,
        question: currentDetailMarket.question,
        side: side,
        contracts: amount,
        entryPrice: price,
        cost: cost,
        timestamp: Date.now(),
        platform: currentDetailMarket.source || 'unknown',
        settled: false,
    });

    savePaperPortfolio(portfolio);
    closeDetail();

    // Show confirmation
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = `Paper trade placed: ${amount} ${side.toUpperCase()} @ ${price}¢ ($${cost.toFixed(2)})`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function loadPortfolio() {
    const portfolio = getPaperPortfolio();
    const trades = portfolio.trades || [];

    document.getElementById('paper-balance').textContent = '$' + portfolio.balance.toFixed(2);

    const invested = trades.filter(t => !t.settled).reduce((s, t) => s + t.cost, 0);
    document.getElementById('paper-invested').textContent = '$' + invested.toFixed(2);
    document.getElementById('paper-trades').textContent = trades.length;

    // Calculate P&L using current prices
    let totalPnl = 0;
    const posDiv = document.getElementById('paper-positions');

    if (trades.length === 0) {
        posDiv.innerHTML = '<p style="color:var(--text-dim);font-size:13px;">No paper trades yet. Click any market card to place one.</p>';
        document.getElementById('paper-pnl').textContent = '$0.00';
        return;
    }

    const activeTrades = trades.filter(t => !t.settled);
    const settledTrades = trades.filter(t => t.settled);

    let html = '<h3 style="font-size:13px;color:var(--text-dim);letter-spacing:2px;margin-bottom:8px;">ACTIVE POSITIONS</h3>';

    if (activeTrades.length === 0) {
        html += '<p style="color:var(--text-dim);font-size:13px;">No active positions</p>';
    }

    for (const t of activeTrades) {
        // Try to find current price
        const currentMarket = allMarketCards.find(c => c.market.ticker === t.ticker);
        const currentPrice = currentMarket ? (t.side === 'yes' ? currentMarket.market.yes : currentMarket.market.no) : t.entryPrice;
        const pnl = ((currentPrice - t.entryPrice) * t.contracts) / 100;
        totalPnl += pnl;

        const pnlStr = pnl >= 0 ? '+$' + pnl.toFixed(2) : '-$' + Math.abs(pnl).toFixed(2);
        const pnlClass = pnl >= 0 ? 'positive' : 'negative';
        const title = shortenTitle(t.question);

        html += `<div class="bot-position">
            <div>
                <div class="bot-position-title">${title}</div>
                <div class="bot-position-side">${t.side.toUpperCase()} · ${t.contracts} contracts @ ${t.entryPrice}¢</div>
            </div>
            <div class="bot-position-pnl ${pnlClass}">${pnlStr}</div>
        </div>`;
    }

    posDiv.innerHTML = html;

    const pnlEl = document.getElementById('paper-pnl');
    pnlEl.textContent = totalPnl >= 0 ? '+$' + totalPnl.toFixed(2) : '-$' + Math.abs(totalPnl).toFixed(2);
    pnlEl.className = 'bot-stat-value ' + (totalPnl >= 0 ? 'running' : 'stopped');
}


// ── AI MARKET BRIEF ──
function generateMarketBrief(kalshiMarkets, polyMarkets) {
    const briefEl = document.getElementById('ai-brief-content');
    if (!briefEl) return;

    const allMarkets = [...kalshiMarkets, ...polyMarkets];
    if (allMarkets.length === 0) { briefEl.innerHTML = ''; return; }

    // Find interesting markets
    const highConf = allMarkets.filter(m => m.yes >= 80 || m.yes <= 20).slice(0, 3);
    const coinFlips = allMarkets.filter(m => m.yes >= 45 && m.yes <= 55).slice(0, 3);
    const highVol = [...allMarkets].sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 3);

    let html = `<div class="brief-card">
        <h3 class="brief-title">Market Brief</h3>
        <div class="brief-time">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>`;

    // Summary stats
    const avgYes = Math.round(allMarkets.reduce((s, m) => s + m.yes, 0) / allMarkets.length);
    html += `<div class="brief-stat-row">
        <span>${allMarkets.length} markets tracked</span>
        <span>Avg YES: ${avgYes}¢</span>
    </div>`;

    // High confidence
    if (highConf.length > 0) {
        html += '<div class="brief-section"><h4>Near Certain</h4>';
        for (const m of highConf) {
            const dir = m.yes >= 80 ? 'YES' : 'NO';
            const conf = m.yes >= 80 ? m.yes : m.no;
            html += `<div class="brief-item"><span class="brief-item-title">${shortenTitle(m.question)}</span><span class="brief-item-value" style="color:var(--green);">${dir} ${conf}¢</span></div>`;
        }
        html += '</div>';
    }

    // Coin flips
    if (coinFlips.length > 0) {
        html += '<div class="brief-section"><h4>Coin Flips</h4>';
        for (const m of coinFlips) {
            html += `<div class="brief-item"><span class="brief-item-title">${shortenTitle(m.question)}</span><span class="brief-item-value" style="color:var(--accent);">YES ${m.yes}¢</span></div>`;
        }
        html += '</div>';
    }

    // Highest volume
    if (highVol.length > 0) {
        html += '<div class="brief-section"><h4>Most Active</h4>';
        for (const m of highVol) {
            const vol = m.volume ? '$' + Math.round(m.volume).toLocaleString() : '—';
            html += `<div class="brief-item"><span class="brief-item-title">${shortenTitle(m.question)}</span><span class="brief-item-value">${vol}</span></div>`;
        }
        html += '</div>';
    }

    html += '</div>';
    briefEl.innerHTML = html;
}


// ── NOTIFICATIONS ──
let notificationsEnabled = localStorage.getItem('pulse-notifications') === 'true';
let previousPrices = {};
try { previousPrices = JSON.parse(localStorage.getItem('pulse-prices') || '{}'); } catch {}
let previousBotTrades = null;

function updateNotifLabel() {
    const label = document.getElementById('notif-label');
    if (label) label.textContent = 'Alerts: ' + (notificationsEnabled ? 'ON' : 'OFF');
}

async function toggleNotifications() {
    if (!notificationsEnabled) {
        // Request permission
        if (!('Notification' in window)) {
            alert('Your browser doesn\'t support notifications');
            return;
        }
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
            notificationsEnabled = true;
            localStorage.setItem('pulse-notifications', 'true');
            sendNotification('PULSE Alerts Enabled', 'You\'ll be notified when watchlisted markets move 5%+ or your bot trades.');
        } else {
            alert('Notifications blocked — enable them in browser settings');
            return;
        }
    } else {
        notificationsEnabled = false;
        localStorage.setItem('pulse-notifications', 'false');
    }
    updateNotifLabel();
}

function sendNotification(title, body, tag) {
    if (!notificationsEnabled || Notification.permission !== 'granted') return;
    try {
        new Notification(title, {
            body: body,
            icon: 'https://pulse-api-joed.onrender.com/favicon.ico',
            badge: 'https://pulse-api-joed.onrender.com/favicon.ico',
            tag: tag || undefined,  // prevents duplicate notifs with same tag
            silent: false,
        });
    } catch (e) { console.warn('Notification failed:', e); }
}

function checkPriceAlerts(kalshiMarkets, polyMarkets) {
    if (!notificationsEnabled) return;
    const watchlist = getWatchlist();
    if (watchlist.length === 0) return;

    const allMarkets = [...kalshiMarkets, ...polyMarkets];
    const newPrices = {};

    for (const m of allMarkets) {
        if (!m.ticker) continue;
        newPrices[m.ticker] = m.yes;

        // Only alert on watchlisted markets
        if (!watchlist.includes(m.ticker)) continue;

        const oldPrice = previousPrices[m.ticker];
        if (oldPrice === undefined) continue;  // First time seeing this market

        const diff = Math.abs(m.yes - oldPrice);
        if (diff >= 5) {
            const direction = m.yes > oldPrice ? '📈' : '📉';
            const title = shortenTitle(m.question);
            sendNotification(
                `${direction} ${title}`,
                `Moved ${diff}¢ → now YES ${m.yes}¢ (was ${oldPrice}¢)`,
                'price-' + m.ticker
            );
        }
    }

    // Save current prices
    previousPrices = newPrices;
    localStorage.setItem('pulse-prices', JSON.stringify(newPrices));
}

function checkBotAlerts(bot) {
    if (!notificationsEnabled || !bot) return;

    const trades = bot.trades_today || 0;
    if (previousBotTrades !== null && trades > previousBotTrades) {
        const newCount = trades - previousBotTrades;
        sendNotification(
            `🤖 Bot Made ${newCount} New Trade${newCount > 1 ? 's' : ''}`,
            `Total today: ${trades} | Balance: $${(bot.balance || 0).toFixed(2)}`,
            'bot-trade'
        );
    }
    previousBotTrades = trades;
}

function checkArbAlerts(opportunities) {
    if (!notificationsEnabled || opportunities.length === 0) return;

    const bestArb = opportunities[0];
    if (bestArb.diff >= 5) {
        sendNotification(
            `💰 Arbitrage: ${bestArb.diff}¢ Spread`,
            `${bestArb.topic} — ${bestArb.direction}`,
            'arb-' + bestArb.topic
        );
    }
}

// Init label on load
updateNotifLabel();


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

// ── PRICE ALERT THRESHOLDS (Feature 4) ──
function getPriceAlerts() {
    try { return JSON.parse(localStorage.getItem('pulse-price-alerts') || '[]'); }
    catch { return []; }
}

function savePriceAlerts(alerts) {
    localStorage.setItem('pulse-price-alerts', JSON.stringify(alerts));
}

function setPriceAlert() {
    if (!currentDetailMarket) return;
    const direction = document.getElementById('alert-direction').value;
    const threshold = parseInt(document.getElementById('alert-threshold').value);
    if (!threshold || threshold < 1 || threshold > 99) { alert('Enter a threshold between 1-99¢'); return; }

    let alerts = getPriceAlerts();
    alerts = alerts.filter(a => a.ticker !== currentDetailMarket.ticker);
    alerts.push({
        ticker: currentDetailMarket.ticker,
        question: currentDetailMarket.question,
        direction: direction,
        threshold: threshold,
    });
    savePriceAlerts(alerts);

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = `Alert set: ${shortenTitle(currentDetailMarket.question)} YES ${direction} ${threshold}¢`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
    closeDetail();
}

function removePriceAlert() {
    if (!currentDetailMarket) return;
    let alerts = getPriceAlerts();
    alerts = alerts.filter(a => a.ticker !== currentDetailMarket.ticker);
    savePriceAlerts(alerts);

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = 'Price alert removed';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
    closeDetail();
}

function checkCustomAlerts(allMarkets) {
    if (!notificationsEnabled) return;
    const alerts = getPriceAlerts();
    const triggered = [];

    for (const alert of alerts) {
        const market = allMarkets.find(m => m.ticker === alert.ticker);
        if (!market) continue;

        const hit = (alert.direction === 'above' && market.yes >= alert.threshold) ||
                    (alert.direction === 'below' && market.yes <= alert.threshold);

        if (hit) {
            sendNotification(
                `🔔 ${shortenTitle(alert.question)}`,
                `YES is now ${market.yes}¢ (alert: ${alert.direction} ${alert.threshold}¢)`,
                'custom-alert-' + alert.ticker
            );
            triggered.push(alert.ticker);
        }
    }

    // Remove triggered alerts so they don't fire again
    if (triggered.length > 0) {
        savePriceAlerts(alerts.filter(a => !triggered.includes(a.ticker)));
    }
}


// ── PORTFOLIO P&L CHART (Feature 5) ──
function getPortfolioHistory() {
    try { return JSON.parse(localStorage.getItem('pulse-portfolio-history') || '[]'); }
    catch { return []; }
}

function recordPortfolioSnapshot() {
    const portfolio = getPaperPortfolio();
    const trades = portfolio.trades || [];
    const invested = trades.filter(t => !t.settled).reduce((s, t) => s + t.cost, 0);

    // Estimate current portfolio value
    let currentValue = portfolio.balance;
    for (const t of trades.filter(tr => !tr.settled)) {
        const currentMarket = allMarketCards.find(c => c.market.ticker === t.ticker);
        const currentPrice = currentMarket ? (t.side === 'yes' ? currentMarket.market.yes : currentMarket.market.no) : t.entryPrice;
        currentValue += (currentPrice * t.contracts) / 100;
    }

    const history = getPortfolioHistory();
    history.push({
        timestamp: Date.now(),
        value: currentValue,
        balance: portfolio.balance,
        invested: invested,
    });

    // Keep last 100 snapshots
    if (history.length > 100) history.splice(0, history.length - 100);
    localStorage.setItem('pulse-portfolio-history', JSON.stringify(history));
}

function drawPortfolioChart() {
    const canvas = document.getElementById('portfolio-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const history = getPortfolioHistory();
    if (history.length < 2) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.font = '13px Sora, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Portfolio chart will appear after a few refreshes', w/2, h/2);
        return;
    }

    const values = history.map(h => h.value);
    const min = Math.min(...values) * 0.98;
    const max = Math.max(...values) * 1.02;
    const range = max - min || 1;
    const trending = values[values.length - 1] >= values[0];
    const color = trending ? '0, 214, 143' : '255, 59, 92';

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
        const y = (h / 4) * i + 10;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        // Label
        const val = max - (i / 4) * range;
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = '10px Sora, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('$' + val.toFixed(0), 4, y - 2);
    }

    // Fill
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < values.length; i++) {
        const x = (i / (values.length - 1)) * w;
        const y = h - 10 - ((values[i] - min) / range) * (h - 20);
        ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `rgba(${color}, 0.15)`);
    grad.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    for (let i = 0; i < values.length; i++) {
        const x = (i / (values.length - 1)) * w;
        const y = h - 10 - ((values[i] - min) / range) * (h - 20);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(${color}, 0.9)`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // End dot
    const lastY = h - 10 - ((values[values.length - 1] - min) / range) * (h - 20);
    ctx.beginPath();
    ctx.arc(w - 2, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${color})`;
    ctx.fill();

    // Current value label
    ctx.fillStyle = `rgb(${color})`;
    ctx.font = 'bold 14px Sora, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('$' + values[values.length - 1].toFixed(2), w - 10, lastY - 10);
}


// ── MARKET CORRELATIONS (Feature 7) ──
function buildCorrelations(kalshiMarkets, polyMarkets) {
    const allMarkets = [...kalshiMarkets, ...polyMarkets];
    const categories = {};

    // Group markets by category
    for (const m of allMarkets) {
        const cat = m.category || categorize(m.question);
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(m);
    }

    const catNames = Object.keys(categories).filter(c => categories[c].length >= 2);

    // Calculate average price per category
    const catAvgs = {};
    for (const c of catNames) {
        const markets = categories[c];
        catAvgs[c] = {
            avgYes: Math.round(markets.reduce((s, m) => s + m.yes, 0) / markets.length),
            count: markets.length,
            avgVol: Math.round(markets.reduce((s, m) => s + (m.volume || 0), 0) / markets.length),
            topMarket: markets.sort((a, b) => (b.volume || 0) - (a.volume || 0))[0],
        };
    }

    // Render correlation grid
    const grid = document.getElementById('correlation-grid');
    if (!grid) return;

    let html = '<div class="corr-cards">';

    for (const cat of catNames) {
        const data = catAvgs[cat];
        const color = cat === 'crypto' ? 'var(--gold)' :
                      cat === 'sports' ? 'var(--green)' :
                      cat === 'politics' ? 'var(--accent)' :
                      cat === 'weather' ? '#64b5f6' : 'var(--purple)';

        // Find related categories (share keywords)
        const related = catNames.filter(c => c !== cat);

        html += `
            <div class="corr-card">
                <div class="corr-card-header">
                    <span class="corr-cat-dot" style="background:${color}"></span>
                    <h3>${cat.charAt(0).toUpperCase() + cat.slice(1)}</h3>
                    <span class="corr-count">${data.count} markets</span>
                </div>
                <div class="corr-stats">
                    <div><span class="corr-label">Avg YES</span><span class="corr-value">${data.avgYes}¢</span></div>
                    <div><span class="corr-label">Avg Volume</span><span class="corr-value">$${data.avgVol.toLocaleString()}</span></div>
                </div>
                <div class="corr-top-market">
                    <span class="corr-label">Top Market</span>
                    <span class="corr-market-name">${shortenTitle(data.topMarket.question)}</span>
                    <span style="color:${data.topMarket.yes >= 50 ? 'var(--green)' : 'var(--red)'}; font-weight:600;">YES ${data.topMarket.yes}¢</span>
                </div>
                ${related.length > 0 ? `
                <div class="corr-related">
                    <span class="corr-label">Related</span>
                    <div class="corr-tags">${related.map(r => `<span class="corr-tag">${r}</span>`).join('')}</div>
                </div>` : ''}
            </div>
        `;
    }

    // Cross-platform comparison
    const kalshiAvg = kalshiMarkets.length > 0 ? Math.round(kalshiMarkets.reduce((s, m) => s + m.yes, 0) / kalshiMarkets.length) : 0;
    const polyAvg = polyMarkets.length > 0 ? Math.round(polyMarkets.reduce((s, m) => s + m.yes, 0) / polyMarkets.length) : 0;
    const platformDiff = Math.abs(kalshiAvg - polyAvg);

    html += `
        <div class="corr-card corr-card-platform">
            <div class="corr-card-header">
                <span class="corr-cat-dot" style="background:var(--gold)"></span>
                <h3>Platform Comparison</h3>
            </div>
            <div class="corr-platform-row">
                <div class="corr-platform">
                    <span class="badge kalshi-badge">KALSHI</span>
                    <span class="corr-platform-avg">${kalshiAvg}¢ avg</span>
                    <span class="corr-platform-count">${kalshiMarkets.length} markets</span>
                </div>
                <div class="corr-platform-vs">vs</div>
                <div class="corr-platform">
                    <span class="badge poly-badge">POLY</span>
                    <span class="corr-platform-avg">${polyAvg}¢ avg</span>
                    <span class="corr-platform-count">${polyMarkets.length} markets</span>
                </div>
            </div>
            <div class="corr-insight">
                ${platformDiff > 5 ? `<span style="color:var(--gold);">⚡ ${platformDiff}¢ average spread — potential systematic mispricing</span>` :
                `<span style="color:var(--green);">✓ Platforms within ${platformDiff}¢ — markets in agreement</span>`}
            </div>
        </div>
    `;

    html += '</div>';
    grid.innerHTML = html;
}


// ── IMPROVED ARBITRAGE (Feature 8) ──
function showArbitrageImproved(opportunities) {
    const section = document.getElementById('arbitrage');
    if (!section) return;

    let html = '<h2>Arbitrage Opportunities</h2>';

    if (opportunities.length === 0) {
        html += '<p style="color:var(--text-dim);font-size:14px;">No arbitrage opportunities detected right now. Markets are tightly priced.</p>';
        section.innerHTML = html;
        return;
    }

    html += '<div class="market-grid">';
    for (const opp of opportunities.slice(0, 8)) {
        const profit = opp.diff;
        const investPerSide = 10; // $10 per side
        const estProfit = ((profit / 100) * investPerSide).toFixed(2);
        const roi = ((profit / Math.max(opp.kalshi.yes, opp.poly.yes)) * 100).toFixed(1);

        html += `
            <div class="market-card arb-card">
                <div class="card-top-row">
                    <span class="badge arb-badge">ARBITRAGE</span>
                    <span style="color:var(--gold);font-size:13px;font-weight:700;">${profit}¢ spread</span>
                </div>
                <h3>${opp.topic}</h3>
                <div class="arb-comparison">
                    <div class="arb-side">
                        <span class="badge kalshi-badge">KALSHI</span>
                        <div class="arb-price">YES ${opp.kalshi.yes}¢</div>
                        <div class="arb-question">${shortenTitle(opp.kalshi.question)}</div>
                    </div>
                    <div class="arb-vs">⇄</div>
                    <div class="arb-side">
                        <span class="badge poly-badge">POLY</span>
                        <div class="arb-price">YES ${opp.poly.yes}¢</div>
                        <div class="arb-question">${shortenTitle(opp.poly.question)}</div>
                    </div>
                </div>
                <div class="arb-profit-row">
                    <div><span class="arb-profit-label">Est. Profit ($10/side)</span><span class="arb-profit-value" style="color:var(--green);">+$${estProfit}</span></div>
                    <div><span class="arb-profit-label">ROI</span><span class="arb-profit-value" style="color:var(--gold);">${roi}%</span></div>
                </div>
                <div style="margin-top:8px;color:var(--accent);font-weight:600;font-size:13px;">
                    ${opp.direction}
                </div>
                <button class="detail-btn detail-btn-paper" style="margin-top:10px;width:100%;" onclick="paperTradeArb('${opp.kalshi.ticker}','${opp.poly.ticker}',${opp.kalshi.yes},${opp.poly.yes},'${opp.topic}')">Paper Trade This Spread</button>
            </div>
        `;
    }
    html += '</div>';
    section.innerHTML = html;
}

function paperTradeArb(kalshiTicker, polyTicker, kalshiYes, polyYes, topic) {
    const portfolio = getPaperPortfolio();
    // Buy cheap YES, sell expensive YES (simulated as buying NO on expensive side)
    const cheapSide = kalshiYes < polyYes ? 'kalshi' : 'poly';
    const cheapPrice = Math.min(kalshiYes, polyYes);
    const expensivePrice = Math.max(kalshiYes, polyYes);
    const contracts = 10;
    const cost = (contracts * cheapPrice / 100) + (contracts * (100 - expensivePrice) / 100);

    if (cost > portfolio.balance) {
        alert(`Not enough balance! Need $${cost.toFixed(2)}, have $${portfolio.balance.toFixed(2)}`);
        return;
    }

    portfolio.balance -= cost;
    portfolio.trades.push({
        ticker: cheapSide === 'kalshi' ? kalshiTicker : polyTicker,
        question: `ARB: ${topic} (${cheapSide === 'kalshi' ? 'KALSHI' : 'POLY'} YES)`,
        side: 'yes',
        contracts: contracts,
        entryPrice: cheapPrice,
        cost: cost,
        timestamp: Date.now(),
        platform: cheapSide,
        settled: false,
        isArb: true,
    });

    savePaperPortfolio(portfolio);

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = `Arbitrage paper trade: ${topic} spread for $${cost.toFixed(2)}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}


// ── UPDATE loadMarkets to include new features ──
// Hook custom alerts into the existing checkPriceAlerts flow
const _origCheckPriceAlerts = checkPriceAlerts;
checkPriceAlerts = function(kalshiMarkets, polyMarkets) {
    _origCheckPriceAlerts(kalshiMarkets, polyMarkets);
    checkCustomAlerts([...kalshiMarkets, ...polyMarkets]);
};

// Hook correlations + improved arbitrage into loadMarkets
const _origShowArbitrage = showArbitrage;
showArbitrage = function(opportunities) {
    showArbitrageImproved(opportunities);
};

// Store market data for correlations
let lastKalshiMarkets = [];
let lastPolyMarkets = [];
const _origLoadMarkets = loadMarkets;
loadMarkets = async function() {
    await _origLoadMarkets();
    // Record portfolio snapshot on each refresh
    recordPortfolioSnapshot();
};

// Hook into switchTab for correlations
const _origSwitchTab = switchTab;
switchTab = function(tab, btn) {
    const corrEl = document.getElementById('correlations-panel');
    // First run original
    _origSwitchTab(tab, btn);
    // Handle correlations
    if (corrEl) corrEl.classList.add('view-hidden');
    if (tab === 'correlations') {
        if (corrEl) corrEl.classList.remove('view-hidden');
        // Build correlations with whatever markets we have
        const kalshi = allMarketCards.filter(c => c.market.source === 'kalshi').map(c => c.market);
        const poly = allMarketCards.filter(c => c.market.source === 'poly').map(c => c.market);
        buildCorrelations(kalshi, poly);
    }
};

// Hook loadPortfolio to also draw the chart
const _origLoadPortfolio = loadPortfolio;
loadPortfolio = function() {
    _origLoadPortfolio();
    drawPortfolioChart();
};


// ── PULSE SCORE EXPLAINER ──
if (localStorage.getItem('pulse-explainer-dismissed') === 'true') {
    const expl = document.getElementById('pulse-explainer');
    if (expl) expl.style.display = 'none';
}

// ── KEYBOARD SHORTCUTS ──
document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

    const tabs = ['markets', 'bot', 'portfolio', 'arbitrage', 'correlations'];
    const links = document.querySelectorAll('.nav-links a');

    if (e.key >= '1' && e.key <= '5') {
        const idx = parseInt(e.key) - 1;
        if (tabs[idx] && links[idx]) {
            switchTab(tabs[idx], links[idx]);
        }
    }
    if (e.key === 'Escape') {
        closeDetail();
        closeAI();
    }
    if (e.key === '/' && !e.ctrlKey) {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
    }
});


// ── SERVICE WORKER (PWA) ──
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW registered:', reg.scope))
        .catch(err => console.warn('SW failed:', err));
}
