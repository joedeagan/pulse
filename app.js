// ============================================
// SYGNAL — app.js
// Lesson 3: Cross-platform comparison
// ============================================

// WHAT WE'RE BUILDING:
// Pull data from BOTH Kalshi (via our bot) AND Polymarket
// Show them side by side so you can spot arbitrage (price differences)

// API base — uses same origin when served from backend, or Render URL from GitHub Pages
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? '' : (window.location.origin.includes('github.io') ? 'https://sygnalmarkets.com' : '');

// ── AFFILIATE LINKS ──
const AFFILIATE = {
    kalshi: { base: 'https://kalshi.com/markets/', param: '?referral=9b5a413c-b37a-47a3-bbb3-f96c9286719f' },
    poly:   { base: 'https://polymarket.com/event/', param: '?utm_source=sygnal&utm_medium=referral' },
};
function getAffiliateUrl(market) {
    if (market.source === 'kalshi') {
        // Always use Kalshi referral link for Kalshi markets
        const base = market.url && market.url !== '#' ? market.url : AFFILIATE.kalshi.base + (market.ticker || '');
        const sep = base.includes('?') ? '&' : '?';
        return base + sep + 'referral=9b5a413c-b37a-47a3-bbb3-f96c9286719f';
    }
    if (market.url && market.url !== '#') return market.url;
    return AFFILIATE.poly.base + (market.ticker || '') + AFFILIATE.poly.param;
}
function trackAffiliateClick(platform) {
    const clicks = JSON.parse(localStorage.getItem('sygnal-affiliate-clicks') || '{}');
    clicks[platform] = (clicks[platform] || 0) + 1;
    clicks.total = (clicks.total || 0) + 1;
    localStorage.setItem('sygnal-affiliate-clicks', JSON.stringify(clicks));
    fetch((API_BASE || '') + '/api/clicks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform }) }).catch(() => {});
}

// ── LOCALSTORAGE MIGRATION (pulse- → sygnal-) ──
// Migrate existing users' data so nothing is lost
(function migratePulseKeys() {
    const keyMap = [
        'seen-landing', 'affiliate-clicks', 'watchlist', 'market-cache',
        'snapshots', 'track-record', 'theme', 'portfolio', 'notifications',
        'prices', 'prev-scores', 'price-alerts', 'portfolio-history',
        'leagues', 'pro', 'last-visit', 'explainer-dismissed'
    ];
    for (const k of keyMap) {
        const old = localStorage.getItem('pulse-' + k);
        if (old !== null && localStorage.getItem('sygnal-' + k) === null) {
            localStorage.setItem('sygnal-' + k, old);
            localStorage.removeItem('pulse-' + k);
        }
    }
})();

// ── NAV MORE DROPDOWN ──
function toggleNavMore(e) {
    e.stopPropagation();
    const menu = document.getElementById('nav-more-menu');
    menu.classList.toggle('open');
    // Close on outside click
    if (menu.classList.contains('open')) {
        setTimeout(() => document.addEventListener('click', closeNavMore, { once: true }), 10);
    }
}
function closeNavMore() {
    document.getElementById('nav-more-menu')?.classList.remove('open');
}
function switchTabFromMore(tab, btn) {
    closeNavMore();
    // Highlight the More button when a sub-item is active
    document.querySelectorAll('.nav-links > a').forEach(a => a.classList.remove('active'));
    document.querySelector('.nav-more-btn')?.classList.add('active');
    document.querySelectorAll('.nav-more-menu a').forEach(a => a.classList.remove('active'));
    if (btn) btn.classList.add('active');
    switchTab(tab, null);
}

// ── MOBILE MORE DROPDOWN ──
function toggleMobileMore(e) {
    e.preventDefault();
    e.stopPropagation();
    const menu = document.getElementById('mobile-more-menu');
    menu.classList.toggle('open');
    if (menu.classList.contains('open')) {
        setTimeout(() => document.addEventListener('click', closeMobileMore, { once: true }), 10);
    }
}
function closeMobileMore() {
    document.getElementById('mobile-more-menu')?.classList.remove('open');
}
function switchTabMobile(tab) {
    closeMobileMore();
    // Update mobile nav active
    document.querySelectorAll('.mobile-nav-item').forEach(a => a.classList.remove('active'));
    document.querySelector('.mobile-more-wrap .mobile-nav-item')?.classList.add('active');
    switchTab(tab, null);
}

// ── TAB NAVIGATION ──
function switchTab(tab, btn) {
    // Update active nav link
    document.querySelectorAll('.nav-links > a').forEach(a => a.classList.remove('active'));
    if (btn) btn.classList.add('active');
    // If switching to a main tab, deactivate More
    const mainTabs = ['markets', 'trending', 'bot', 'portfolio'];
    if (mainTabs.includes(tab)) {
        document.querySelector('.nav-more-btn')?.classList.remove('active');
        document.querySelectorAll('.nav-more-menu a').forEach(a => a.classList.remove('active'));
    }

    // Update mobile nav active states
    document.querySelectorAll('.mobile-nav-item').forEach(a => a.classList.remove('active'));
    const mobileItems = document.querySelectorAll('.mobile-nav-item');
    mobileItems.forEach(item => {
        const onclick = item.getAttribute('onclick') || '';
        if (onclick.includes(`'${tab}'`)) item.classList.add('active');
    });

    // Define which elements belong to each view
    const heroEl = document.querySelector('.hero');
    const statsEl = document.querySelector('.stats-bar');
    const filtersEl = document.getElementById('filters');
    const marketsEl = document.getElementById('markets');
    const briefEl = document.getElementById('ai-brief');
    const explainerEl = document.getElementById('sygnal-explainer');
    const signupEl = document.getElementById('email-signup');
    const botEl = document.getElementById('bot-panel');
    const portfolioEl = document.getElementById('portfolio-panel');
    const arbEl = document.getElementById('arbitrage');
    const corrEl = document.getElementById('correlations-panel');
    const trendingEl = document.getElementById('trending-panel');
    const leaguesEl = document.getElementById('leagues-panel');

    const compareEl = document.getElementById('compare-panel');
    const alertsEl = document.getElementById('alerts-panel');
    const newsFeedEl = document.getElementById('news-feed');

    const marketsView = [heroEl, statsEl, filtersEl, marketsEl, briefEl, explainerEl, signupEl, newsFeedEl];
    const botView = [botEl];
    const portfolioView = [portfolioEl];
    const arbView = [arbEl];
    const corrView = [corrEl];
    const trendingView = [trendingEl];
    const leaguesView = [leaguesEl];
    const compareView = [compareEl];
    const alertsView = [alertsEl];
    const allSections = [...marketsView, ...botView, ...portfolioView, ...arbView, ...corrView, ...trendingView, ...leaguesView, ...compareView, ...alertsView];

    // Hide everything
    allSections.forEach(el => { if (el) el.classList.add('view-hidden'); });

    // Show the selected view
    let visible = [];
    if (tab === 'markets') visible = marketsView;
    else if (tab === 'bot') visible = botView;
    else if (tab === 'portfolio') { visible = portfolioView; loadPortfolio(); }
    else if (tab === 'arbitrage') visible = arbView;
    else if (tab === 'trending') { visible = trendingView; buildTrendingPanel(); }
    else if (tab === 'correlations') { visible = corrView; }
    else if (tab === 'leagues') { visible = leaguesView; buildLeaguePanel(); }
    else if (tab === 'compare') { visible = compareView; buildComparePanel(); }
    else if (tab === 'alerts') { visible = alertsView; renderAlertRules(); }

    visible.forEach(el => { if (el) el.classList.remove('view-hidden'); });
}

// ── WATCHLIST ──
function getWatchlist() {
    try {
        return JSON.parse(localStorage.getItem('sygnal-watchlist') || '[]');
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
    localStorage.setItem('sygnal-watchlist', JSON.stringify(wl));
}

function isStarred(ticker) {
    return getWatchlist().includes(ticker);
}

let firstLoad = true;
async function loadMarkets() {
    const grid = document.querySelector('.market-grid');

    // Show cached data instantly while fetching fresh data
    const cached = getCachedMarkets();
    if (firstLoad && cached) {
        renderMarkets(cached.kalshi, cached.polymarket);
        // Show "updating..." indicator
        const refreshEl = document.getElementById('refresh-time');
        if (refreshEl) refreshEl.textContent = 'Updating...';
    } else if (firstLoad) {
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

    // Fetch fresh data from server
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

    // If API failed, keep showing cached data (already rendered above)
    if (kalshiMarkets.length === 0 && polyMarkets.length === 0 && cached) {
        const refreshEl = document.getElementById('refresh-time');
        if (refreshEl) refreshEl.textContent = 'Using cached data';
        return;
    }

    // If no data at all, show sample data
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

    // Cache the fresh data for next visit
    cacheMarkets(kalshiMarkets, polyMarkets);

    // Render fresh data
    renderMarkets(kalshiMarkets, polyMarkets);
}

function getCachedMarkets() {
    try {
        const raw = localStorage.getItem('sygnal-market-cache');
        if (!raw) return null;
        const data = JSON.parse(raw);
        // Cache is valid for 30 minutes
        if (Date.now() - data.ts > 30 * 60 * 1000) return null;
        return data;
    } catch { return null; }
}

function cacheMarkets(kalshi, polymarket) {
    try {
        localStorage.setItem('sygnal-market-cache', JSON.stringify({ kalshi, polymarket, ts: Date.now() }));
    } catch {}
}

function renderMarkets(kalshiMarkets, polyMarkets) {
    const grid = document.querySelector('.market-grid');

    // Save price snapshots for real sparklines
    const allMkts = [...kalshiMarkets, ...polyMarkets];
    savePriceSnapshot(allMkts);

    // Compute Sygnal Scores for ALL markets at once (percentile-based)
    computeAllSygnalScores(allMkts);

    // Check for Sygnal Score spikes
    checkSygnalScoreSpikes(allMkts);

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

    // Merge all markets into one unified list
    _marketGroups = {};
    const allCards = [];

    // Add Kalshi markets
    for (const m of kalshiMarkets) {
        m.source = 'kalshi';
        const change = getMarketChange(m.ticker);
        allCards.push({ market: m, platform: 'kalshi', change, score: calcSygnalScore(m, change) });
    }

    // Add Polymarket markets (flatten groups — show top market from each group)
    const grouped = groupSimilarMarkets(sortByStarred(polyMarkets));
    for (const item of grouped) {
        if (item.isGroup) {
            _marketGroups[item.groupTitle] = item;
            // Use the highest-volume market from the group as the representative card
            const topMarket = item.markets.sort((a, b) => (b.volume || 0) - (a.volume || 0))[0];
            topMarket.source = 'poly';
            topMarket._groupTitle = item.groupTitle;
            topMarket._groupCount = item.markets.length;
            const change = getMarketChange(topMarket.ticker);
            allCards.push({ market: topMarket, platform: 'poly', change, score: calcSygnalScore(topMarket, change) });
        } else {
            item.source = 'poly';
            const change = getMarketChange(item.ticker);
            allCards.push({ market: item, platform: 'poly', change, score: calcSygnalScore(item, change) });
        }
    }

    // Sort: starred first, then by sygnal score (highest first)
    allCards.sort((a, b) => {
        const aStarred = wl.includes(a.market.ticker) ? 1 : 0;
        const bStarred = wl.includes(b.market.ticker) ? 1 : 0;
        if (bStarred !== aStarred) return bStarred - aStarred;
        return b.score - a.score;
    });

    // Render all cards uniformly
    for (const { market, platform, change } of allCards) {
        grid.appendChild(createMarketCard(market, platform, change));
    }

    // Look for ARBITRAGE — same question on both platforms with different prices
    const arbitrage = findArbitrage(kalshiMarkets, polyMarkets);
    if (arbitrage.length > 0) {
        showArbitrage(arbitrage);
    }

    // Check for notification-worthy changes
    checkPriceAlerts(kalshiMarkets, polyMarkets);
    checkArbAlerts(arbitrage);

    // Generate AI market brief + weekly recap
    generateMarketBrief(kalshiMarkets, polyMarkets);
    loadWeeklyRecap();

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

    // Show email signup after markets load
    const signup = document.getElementById('email-signup');
    if (signup) signup.style.display = '';
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
                url: (m.events && m.events[0]?.slug) ? `https://polymarket.com/event/${m.events[0].slug}` : (m.slug ? `https://polymarket.com/event/${m.slug}` : ''),
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

// ── SYGNAL RING SVG HELPER ──
function makeSygnalRing(score, size) {
    size = size || 28;
    const color = score >= 70 ? '#00d68f' : score >= 40 ? '#f0b000' : '#ff3b5c';
    return `<svg class="sygnal-ring" width="${size}" height="${size}" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="3"/>
        <circle cx="18" cy="18" r="15" fill="none" stroke="${color}" stroke-width="3"
            stroke-dasharray="${score * 0.94} 100" stroke-dashoffset="0"
            stroke-linecap="round" transform="rotate(-90 18 18)" style="transition:stroke-dasharray 0.5s"/>
        <text x="18" y="20" text-anchor="middle" fill="${color}" font-size="11" font-weight="700" font-family="var(--font)">${score}</text>
    </svg>`;
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

    // Sygnal Score — combines price confidence + volume strength + momentum
    const sygnalScore = calcSygnalScore(market, priceChange);
    const sygnalColor = sygnalScore >= 67 ? '#00d68f' : sygnalScore >= 34 ? '#f0b000' : '#ff3b5c';
    const sygnalLabel = sygnalScore >= 67 ? 'TRADE' : sygnalScore >= 34 ? 'WATCH' : 'SKIP';

    const badge = platform === 'kalshi'
        ? '<span class="badge kalshi-badge">KALSHI</span>'
        : '<span class="badge poly-badge">POLY</span>';

    // Group badge if this represents a grouped market
    const groupCount = market._groupCount;
    const groupBadge = groupCount ? `<span class="badge group-count-badge">${groupCount} markets</span>` : '';

    const starred = isStarred(market.ticker);
    const starChar = starred ? '\u2605' : '\u2606';
    const starClass = starred ? 'star-btn starred' : 'star-btn';
    const marketUrl = market.url || '#';

    card.innerHTML = `
        <div class="card-top-row">
            <div style="display:flex;gap:6px;align-items:center;">${badge}${groupBadge}</div>
            <button class="${starClass}" title="Add to watchlist">${starChar}</button>
        </div>
        <h3>${title}</h3>
        <div class="prices">
            <span style="color:${yesColor};font-weight:600;">YES ${market.yes}\u00A2</span>
            <span style="color:${noColor};font-weight:600;">NO ${market.no}\u00A2</span>
            ${changeHtml}
        </div>
    `;

    // Sparkline — use real price history if available
    const sparkDiv = document.createElement('div');
    sparkDiv.className = 'sparkline';
    const sparkCanvas = document.createElement('canvas');
    sparkDiv.appendChild(sparkCanvas);
    card.appendChild(sparkDiv);

    // Sygnal Score footer + signal badge
    const sygnalFooter = document.createElement('div');
    sygnalFooter.className = 'card-sygnal-footer';
    const sig = getSygnalSignal(market.ticker);
    let sigColor, sigBg;
    if (sig.signal.includes('YES')) { sigColor = '#00d68f'; sigBg = 'rgba(0,214,143,0.12)'; }
    else if (sig.signal.includes('NO')) { sigColor = '#ff3b5c'; sigBg = 'rgba(255,59,92,0.12)'; }
    else { sigColor = '#f0b000'; sigBg = 'rgba(240,176,0,0.10)'; }
    const signalHtml = `<span class="card-signal" style="color:${sigColor};background:${sigBg};">${sig.signal}</span>`;
    sygnalFooter.innerHTML = `${signalHtml}<span class="card-sygnal-label">SYGNAL</span><span class="card-sygnal-score" style="color:${sygnalColor};">${sygnalScore}</span>`;
    card.appendChild(sygnalFooter);

    // Affiliate trade button
    const tradeBtn = document.createElement('a');
    tradeBtn.className = 'card-trade-btn';
    tradeBtn.href = getAffiliateUrl(market);
    tradeBtn.target = '_blank';
    tradeBtn.rel = 'noopener';
    tradeBtn.textContent = `Trade on ${platform === 'kalshi' ? 'Kalshi' : 'Polymarket'} →`;
    tradeBtn.addEventListener('click', (e) => { e.stopPropagation(); trackAffiliateClick(platform); });
    card.appendChild(tradeBtn);

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

// ── SYGNAL SCORE — confidence rating ──
// ── SYGNAL SCORE ENGINE ──
// ── SYGNAL SCORE — 5-Factor Cross-Platform Intelligence ──
// Only SYGNAL can do this: we see BOTH platforms simultaneously
let _sygnalScoreCache = {};
let _sygnalSignalCache = {};
let _crossPlatformMap = {};

function buildCrossPlatformMap(allMarkets) {
    _crossPlatformMap = {};
    const stop = new Set(['the','a','an','in','on','at','to','for','of','is','will','be','by','and','or','this','that','it','as','with','from']);
    const kw = t => (t||'').toLowerCase().replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(w => w.length > 2 && !stop.has(w));
    const sim = (a, b) => {
        const aw = new Set(kw(a)), bw = new Set(kw(b));
        if (!aw.size || !bw.size) return 0;
        let m = 0; for (const w of aw) if (bw.has(w)) m++;
        return m / Math.min(aw.size, bw.size);
    };
    const kalshi = allMarkets.filter(m => m.source === 'kalshi');
    const poly = allMarkets.filter(m => m.source === 'poly');
    for (const k of kalshi) {
        let best = null, bestS = 0;
        for (const p of poly) {
            const s = sim(k.question, p.question);
            if (s > bestS && s >= 0.4) { bestS = s; best = p; }
        }
        if (best) {
            const d = Math.abs(k.yes - best.yes);
            _crossPlatformMap[k.ticker] = { match: best, priceDiff: d };
            _crossPlatformMap[best.ticker] = { match: k, priceDiff: d };
        }
    }
}

function computeAllSygnalScores(allMarkets) {
    _sygnalScoreCache = {};
    _sygnalSignalCache = {};
    if (!allMarkets || allMarkets.length === 0) return;

    buildCrossPlatformMap(allMarkets);
    const maxVol = Math.max(...allMarkets.map(m => m.volume || 0), 1);

    for (const m of allMarkets) {
        const yes = m.yes || 50;
        const vol = m.volume || 0;
        const change = getMarketChange(m.ticker) || 0;
        const absChange = Math.abs(change);

        // 1. PRICE POSITION (0-20): Bell curve at 25¢/75¢
        let priceScore = 0;
        if (yes > 3 && yes < 97) {
            const dist = Math.abs(yes - 50);
            priceScore = Math.round(20 * Math.exp(-Math.pow(dist - 25, 2) / 450));
        }

        // 2. VOLUME (0-20): Log-scaled relative to all markets
        let volScore = 0;
        if (vol > 0) volScore = Math.round(20 * Math.min(Math.log10(vol) / Math.log10(maxVol), 1));

        // 3. MOMENTUM (0-20): Price velocity
        const momentumScore = Math.round(20 * Math.min(absChange / 8, 1));

        // 4. CROSS-PLATFORM EDGE (0-20): Price gap between platforms — SYGNAL exclusive
        let crossScore = 0;
        const xp = _crossPlatformMap[m.ticker];
        if (xp) crossScore = Math.round(20 * Math.min(xp.priceDiff / 10, 1));

        // 5. LIQUIDITY (0-19): Can you trade at this price?
        let liqScore = 0;
        if (vol >= 1000000) liqScore = 19;
        else if (vol >= 500000) liqScore = 16;
        else if (vol >= 100000) liqScore = 13;
        else if (vol >= 50000) liqScore = 10;
        else if (vol >= 10000) liqScore = 7;
        else if (vol >= 1000) liqScore = 4;
        else if (vol > 0) liqScore = 1;

        const total = Math.max(1, Math.min(priceScore + volScore + momentumScore + crossScore + liqScore, 99));
        _sygnalScoreCache[m.ticker] = total;

        // ── DIRECTIONAL SIGNAL ──
        let signal = 'HOLD';
        const priceLean = yes >= 52 ? 'YES' : yes <= 48 ? 'NO' : 'NEUTRAL';
        const momLean = change >= 2 ? 'YES' : change <= -2 ? 'NO' : 'NEUTRAL';
        let crossLean = 'NEUTRAL';
        if (xp) {
            const other = xp.match.yes || 50;
            if (yes < other - 2) crossLean = 'YES';
            else if (yes > other + 2) crossLean = 'NO';
        }
        const leans = [priceLean, momLean, crossLean];
        const yC = leans.filter(l => l === 'YES').length;
        const nC = leans.filter(l => l === 'NO').length;

        if (yC >= 2) signal = 'BUY YES';
        else if (nC >= 2) signal = 'BUY NO';
        else if (yC === 1 && nC === 0) signal = 'LEAN YES';
        else if (nC === 1 && yC === 0) signal = 'LEAN NO';
        if (yes <= 5 || yes >= 95) signal = 'HOLD';

        _sygnalSignalCache[m.ticker] = { signal, confidence: Math.max(yC, nC), crossEdge: xp ? xp.priceDiff : 0 };
    }
}

function calcSygnalScore(market, priceChange) {
    if (_sygnalScoreCache[market.ticker] !== undefined) return _sygnalScoreCache[market.ticker];
    const yes = market.yes || 50, vol = market.volume || 0, change = Math.abs(priceChange || 0);
    let ps = 0;
    if (yes > 3 && yes < 97) { const d = Math.abs(yes-50); ps = Math.round(20*Math.exp(-Math.pow(d-25,2)/450)); }
    const vs = vol > 0 ? Math.round(20*Math.min(Math.log10(vol)/7,1)) : 0;
    const ms = Math.round(20*Math.min(change/8,1));
    let ls = 0;
    if (vol >= 1e6) ls = 19; else if (vol >= 5e5) ls = 16; else if (vol >= 1e5) ls = 13;
    else if (vol >= 5e4) ls = 10; else if (vol >= 1e4) ls = 7; else if (vol >= 1e3) ls = 4; else if (vol > 0) ls = 1;
    return Math.max(1, Math.min(ps+vs+ms+ls, 99));
}

function getSygnalSignal(ticker) {
    return _sygnalSignalCache[ticker] || { signal: 'HOLD', confidence: 0, crossEdge: 0 };
}

// ── SHARE MARKET ──
function shareMarket(market) {
    showSharePopup(market);
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

// ── REAL PRICE HISTORY ──
function getPriceSnapshots() {
    try { return JSON.parse(localStorage.getItem('sygnal-snapshots') || '{}'); }
    catch { return {}; }
}

function savePriceSnapshot(allMarkets) {
    const snapshots = getPriceSnapshots();
    const now = Date.now();
    for (const m of allMarkets) {
        if (!m.ticker) continue;
        if (!snapshots[m.ticker]) snapshots[m.ticker] = [];
        const arr = snapshots[m.ticker];
        const score = _sygnalScoreCache[m.ticker] || 0;
        const sig = _sygnalSignalCache[m.ticker]?.signal || 'HOLD';
        const last = arr[arr.length - 1];
        if (!last || last.p !== m.yes || (now - last.t) > 300000) {
            arr.push({ t: now, p: m.yes, s: score, sig });
        }
        if (arr.length > 50) arr.splice(0, arr.length - 50);
    }
    localStorage.setItem('sygnal-snapshots', JSON.stringify(snapshots));

    // Track signal accuracy
    trackSignalAccuracy(allMarkets);
}

// ── SIGNAL ACCURACY TRACKING ──
function trackSignalAccuracy(allMarkets) {
    let record = getTrackRecord();
    const now = Date.now();
    // Check old signals — did they pan out?
    for (let i = record.pending.length - 1; i >= 0; i--) {
        const entry = record.pending[i];
        const market = allMarkets.find(m => m.ticker === entry.ticker);
        if (!market) continue;
        const elapsed = now - entry.time;
        // Check after 1 hour minimum
        if (elapsed < 3600000) continue;
        const priceNow = market.yes;
        const priceThen = entry.price;
        const change = priceNow - priceThen;
        let correct = false;
        if (entry.signal === 'BUY YES' || entry.signal === 'LEAN YES') {
            correct = change > 0; // Price went up = YES was right
        } else if (entry.signal === 'BUY NO' || entry.signal === 'LEAN NO') {
            correct = change < 0; // Price went down = NO was right
        } else {
            // HOLD — remove without counting
            record.pending.splice(i, 1);
            continue;
        }
        record.results.push({ ...entry, priceAfter: priceNow, correct, resolvedAt: now });
        record.pending.splice(i, 1);
        // Keep last 200 results
        if (record.results.length > 200) record.results.shift();
    }
    // Add new pending signals (only BUY/LEAN, once per ticker per day)
    for (const m of allMarkets) {
        if (!m.ticker) continue;
        const sig = _sygnalSignalCache[m.ticker];
        if (!sig || sig.signal === 'HOLD') continue;
        const alreadyPending = record.pending.some(p => p.ticker === m.ticker && (now - p.time) < 86400000);
        if (alreadyPending) continue;
        record.pending.push({ ticker: m.ticker, signal: sig.signal, price: m.yes, time: now, question: (m.question || '').substring(0, 60) });
        // Cap pending at 50
        if (record.pending.length > 50) record.pending.shift();
    }
    localStorage.setItem('sygnal-track-record', JSON.stringify(record));
}

function getTrackRecord() {
    try {
        const raw = localStorage.getItem('sygnal-track-record');
        if (raw) return JSON.parse(raw);
    } catch {}
    return { pending: [], results: [] };
}

function getAccuracyStats() {
    const record = getTrackRecord();
    const results = record.results;
    if (results.length === 0) return { total: 0, correct: 0, pct: 0, pending: record.pending.length };
    const correct = results.filter(r => r.correct).length;
    return { total: results.length, correct, pct: Math.round((correct / results.length) * 100), pending: record.pending.length };
}

function getSygnalScoreHistory(ticker) {
    const snapshots = getPriceSnapshots();
    return (snapshots[ticker] || []).map(s => ({ t: s.t, score: s.s || 0, price: s.p, signal: s.sig || '' }));
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
    const seen = new Set();

    // Extract key words from a title (remove common filler words)
    const stopWords = new Set(['the','a','an','in','on','at','to','for','of','is','will','be','by','and','or','this','that','it','as','with','from']);
    function getKeywords(title) {
        return (title || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    }

    // Score how similar two titles are (0-1)
    function similarity(a, b) {
        const aWords = new Set(getKeywords(a));
        const bWords = new Set(getKeywords(b));
        if (aWords.size === 0 || bWords.size === 0) return 0;
        let matches = 0;
        for (const w of aWords) if (bWords.has(w)) matches++;
        return matches / Math.min(aWords.size, bWords.size);
    }

    for (const k of kalshiMarkets) {
        for (const p of polyMarkets) {
            const sim = similarity(k.question, p.question);
            if (sim < 0.4) continue; // Need at least 40% word overlap

            const priceDiff = Math.abs(k.yes - p.yes);
            if (priceDiff < 2) continue; // Need at least 2¢ difference

            const key = [k.ticker, p.ticker].sort().join('|');
            if (seen.has(key)) continue;
            seen.add(key);

            const cheaper = k.yes < p.yes ? 'KALSHI' : 'POLY';
            opportunities.push({
                kalshi: k,
                poly: p,
                diff: priceDiff,
                similarity: sim,
                direction: `Buy YES on ${cheaper} (cheaper)`,
            });
        }
    }

    opportunities.sort((a, b) => b.diff - a.diff);
    return opportunities;
}


// ── SHOW ARBITRAGE OPPORTUNITIES ──
function showArbitrage(opportunities) {
    const section = document.getElementById('arbitrage');
    if (!section) return;

    let html = '<h2>Arbitrage Opportunities</h2>';
    if (opportunities.length === 0) {
        html += '<p style="color:var(--text-dim);font-size:14px;">No arbitrage opportunities found right now. Cross-platform price differences are checked every refresh.</p>';
        section.innerHTML = html;
        return;
    }
    html += `<p style="color:var(--text-dim);font-size:14px;margin-bottom:16px;">${opportunities.length} price difference${opportunities.length > 1 ? 's' : ''} found across Kalshi &amp; Polymarket</p>`;
    html += '<div class="market-grid">';

    for (const opp of opportunities.slice(0, 8)) {
        const kName = opp.kalshi.question?.substring(0, 60) || 'Kalshi Market';
        const pName = opp.poly.question?.substring(0, 60) || 'Poly Market';
        html += `
            <div class="market-card arb-card" style="border-color:rgba(240,176,0,0.3);">
                <span class="badge" style="background:rgba(240,176,0,0.15);color:#f0b000;border:1px solid rgba(240,176,0,0.3);">${opp.diff}¢ SPREAD</span>
                <h3 style="font-size:14px;margin:8px 0;">${kName}</h3>
                <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin:8px 0;">
                    <div style="text-align:center;flex:1;">
                        <span class="badge kalshi-badge" style="font-size:10px;">KALSHI</span>
                        <div style="font-size:20px;font-weight:700;margin-top:4px;">YES ${opp.kalshi.yes}¢</div>
                    </div>
                    <span style="color:var(--text-dim);font-size:12px;">vs</span>
                    <div style="text-align:center;flex:1;">
                        <span class="badge poly-badge" style="font-size:10px;">POLY</span>
                        <div style="font-size:20px;font-weight:700;margin-top:4px;">YES ${opp.poly.yes}¢</div>
                    </div>
                </div>
                <div style="color:#f0b000;font-weight:600;font-size:13px;margin-top:auto;padding-top:8px;border-top:1px solid var(--border);">
                    ${opp.direction}
                </div>
            </div>
        `;
    }

    html += '</div>';
    section.innerHTML = html;
    section.querySelectorAll('.market-card').forEach(c => c.classList.add('card-visible'));
}


// ── AI ANALYSIS — Click a card to get Claude's opinion ──
// WHAT THIS DOES:
// When you click a market card, it sends the market info to Claude
// and shows a popup with the AI's analysis: should you bet YES or NO?

function analyzeMarket(market) {
    if (!isPro()) { showProUpsell('AI Market Analysis'); return; }
    const popup = document.getElementById('ai-popup');
    const title = document.getElementById('ai-title');
    const body = document.getElementById('ai-body');

    popup.style.display = 'flex';
    title.textContent = market.question;
    body.innerHTML = '<div style="color:var(--text-dim);">Analyzing...</div>';

    setTimeout(() => {
        const yes = market.yes;
        const no = market.no;
        const volume = market.volume || 0;
        const change = getMarketChange(market.ticker) || 0;
        const score = calcSygnalScore(market, change);
        const volFmt = volume >= 1e6 ? '$' + (volume / 1e6).toFixed(1) + 'M' : volume >= 1e3 ? '$' + (volume / 1e3).toFixed(0) + 'K' : '$' + volume;

        let sections = [];
        let verdict = '';
        let verdictClass = '';
        let side = '';

        // 1. WHICH SIDE? — The core question
        if (yes >= 75) {
            side = 'YES';
            sections.push(`<div class="ai-section"><strong style="color:#00d68f;">Market strongly favors YES (${yes}%)</strong><br>The crowd is very confident this happens. Buying YES only profits ${100-yes}¢ per contract. Buying NO is a longshot but pays ${no}¢ if you're right.</div>`);
        } else if (yes <= 25) {
            side = 'NO';
            sections.push(`<div class="ai-section"><strong style="color:#ff3b5c;">Market strongly favors NO (${no}%)</strong><br>The crowd thinks this probably won't happen. Buying NO only profits ${100-no}¢ per contract. Buying YES is a longshot but pays ${yes > 0 ? (100-yes) + '¢' : 'big'} if you're right.</div>`);
        } else if (yes >= 55) {
            side = 'YES';
            sections.push(`<div class="ai-section"><strong style="color:#00d68f;">Slight lean toward YES (${yes}%)</strong><br>Market thinks this is more likely than not, but it's close. There's decent upside on both sides.</div>`);
        } else if (yes <= 45) {
            side = 'NO';
            sections.push(`<div class="ai-section"><strong style="color:#ff3b5c;">Slight lean toward NO (${no}%)</strong><br>Market thinks this probably won't happen, but it's not certain. Both sides have room to profit.</div>`);
        } else {
            side = 'EITHER';
            sections.push(`<div class="ai-section"><strong style="color:#f0b000;">True coin flip (${yes}% / ${no}%)</strong><br>Market has no strong opinion. This is where big profits come from — if you have an edge on either side, this is a great entry point.</div>`);
        }

        // 2. MOMENTUM — Is price moving?
        if (Math.abs(change) >= 3) {
            const dir = change > 0 ? 'YES' : 'NO';
            const color = change > 0 ? '#00d68f' : '#ff3b5c';
            sections.push(`<div class="ai-section"><strong style="color:${color};">Price moving toward ${dir}</strong> (${change > 0 ? '+' : ''}${change}¢ recently)<br>Money is flowing ${dir}. This trend could continue or reverse — momentum matters.</div>`);
        } else if (Math.abs(change) > 0) {
            sections.push(`<div class="ai-section"><strong>Minor price movement</strong> (${change > 0 ? '+' : ''}${change}¢)<br>Small shift, nothing dramatic yet.</div>`);
        }

        // 3. VOLUME — Can you actually trade it?
        if (volume >= 100000) {
            sections.push(`<div class="ai-section"><strong>High volume</strong> (${volFmt})<br>Very liquid — easy to buy and sell. Price is well-tested by many traders.</div>`);
        } else if (volume >= 5000) {
            sections.push(`<div class="ai-section"><strong>Moderate volume</strong> (${volFmt})<br>Enough liquidity to trade. Price is reasonably reliable.</div>`);
        } else if (volume > 0) {
            sections.push(`<div class="ai-section"><strong style="color:#f0b000;">Low volume</strong> (${volFmt})<br>Thin market — price may not be reliable. Could be hard to exit your position.</div>`);
        }

        // 4. VERDICT
        if (score >= 67 && Math.abs(change) >= 2) {
            verdictClass = 'verdict-yes';
            verdict = side === 'EITHER'
                ? `GOOD ENTRY — Active market, pick your side`
                : `BUY ${side} — Strong market activity, momentum is there`;
        } else if (score >= 34) {
            verdictClass = 'verdict-hold';
            verdict = `WATCHLIST — Decent market but wait for a clearer signal`;
        } else {
            verdictClass = 'verdict-no';
            verdict = `PASS — Low activity, not worth trading right now`;
        }

        body.innerHTML = `
            ${sections.join('')}
            <div class="verdict ${verdictClass}">${verdict}</div>
        `;
    }, 300);
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
// ── CUSTOM SORT DROPDOWN ──
function toggleSortDropdown() {
    const dropdown = document.getElementById('sort-dropdown');
    const menu = document.getElementById('sort-menu');
    menu.classList.toggle('open');
    dropdown.classList.toggle('open');
}

function selectSort(el) {
    const value = el.dataset.value;
    const label = el.textContent;
    document.getElementById('sort-label').textContent = value === 'default' ? 'Sort: Default' : 'Sort: ' + label;
    document.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('sort-menu').classList.remove('open');
    document.getElementById('sort-dropdown').classList.remove('open');
    sortMarkets(value);
}

// Close sort dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select')) {
        const menu = document.getElementById('sort-menu');
        const dropdown = document.getElementById('sort-dropdown');
        if (menu) menu.classList.remove('open');
        if (dropdown) dropdown.classList.remove('open');
    }
});

function sortMarkets(sort) {
    currentSort = sort;
    const grid = document.querySelector('.market-grid');
    if (!grid) return;

    const sortFn = getSortFn(sort);
    if (sortFn) {
        allMarketCards.sort(sortFn);
    }

    // Rebuild grid — all cards in one unified list
    grid.innerHTML = '';
    allMarketCards.forEach(c => grid.appendChild(c.card));

    filterMarkets(); // Re-apply filters
    if (typeof observeCards === 'function') observeCards();
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
        case 'sygnal-desc': return (a, b) => (calcSygnalScore(b.market, 0)) - (calcSygnalScore(a.market, 0));
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
    localStorage.setItem('sygnal-theme', isLight ? 'light' : 'dark');
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
    localStorage.removeItem('sygnal-watchlist');
    loadMarkets();
    const menu = document.getElementById('settings-menu');
    if (menu) menu.classList.remove('open');
}

// Load saved theme
if (localStorage.getItem('sygnal-theme') === 'light') {
    document.body.classList.add('light');
    const icon = document.getElementById('theme-icon');
    const label = document.getElementById('theme-label');
    if (icon) icon.innerHTML = '&#9789;';
    if (label) label.textContent = 'Dark Mode';
}


// ── NAV SYGNAL LOGO — broadcast signal wave animation ──
(function() {
    const c = document.getElementById('nav-orb');
    if (!c) return;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    c.width = 32 * dpr;
    c.height = 32 * dpr;
    ctx.scale(dpr, dpr);
    let t = 0;
    let _navOrbRAF;

    function draw() {
        t += 0.015;
        ctx.clearRect(0, 0, 32, 32);
        const cx = 16, cy = 16;
        const light = document.body.classList.contains('light');
        const blue = light ? '0, 90, 180' : '0, 136, 255';
        const cyan = light ? '0, 160, 200' : '0, 200, 255';

        // Broadcast arcs (3 concentric, animating outward)
        for (let i = 0; i < 3; i++) {
            const phase = (t * 0.5 + i * 0.33) % 1;
            const r = 4 + phase * 11;
            const alpha = (1 - phase) * 0.5;
            ctx.beginPath();
            ctx.arc(cx, cy, r, -Math.PI * 0.4, Math.PI * 0.4);
            ctx.strokeStyle = `rgba(${blue}, ${alpha})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // Mirror arcs on left side
        for (let i = 0; i < 3; i++) {
            const phase = (t * 0.5 + i * 0.33) % 1;
            const r = 4 + phase * 11;
            const alpha = (1 - phase) * 0.5;
            ctx.beginPath();
            ctx.arc(cx, cy, r, Math.PI * 0.6, Math.PI * 1.4);
            ctx.strokeStyle = `rgba(${blue}, ${alpha})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // Center dot (pulsing)
        const p = Math.sin(t * 3) * 0.2 + 0.8;
        ctx.beginPath();
        ctx.arc(cx, cy, 3 * p, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cyan}, ${0.8 * p})`;
        ctx.fill();

        // Inner glow ring
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${blue}, 0.15)`;
        ctx.lineWidth = 1;
        ctx.stroke();

        _navOrbRAF = requestAnimationFrame(draw);
    }
    draw();

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { cancelAnimationFrame(_navOrbRAF); }
        else { draw(); }
    });
})();

// Hero orb removed — sygnal animation lives in nav now
let _heroOrbRAF = null;
let _heroOrbRunning = false;

function initHeroOrb() {
    return; // No longer used

(function() {
    const canvas = document.getElementById('logo-canvas');
    if (!canvas) return;
    if (window.innerWidth < 768) {
        canvas.style.display = 'none';
        _heroOrbRunning = false;
        return;
    }
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const S = 200;
    canvas.width = S * dpr;
    canvas.height = S * dpr;
    ctx.scale(dpr, dpr);
    let t = 0;

    // Theme-aware colors
    function isLight() { return document.body.classList.contains('light'); }

    // Sygnal wave rings expanding from center
    const rings = [0, 0.33, 0.66].map(offset => ({ phase: offset }));

    // EKG heartbeat shape
    function ekgY(x) {
        // x from 0 to 1, returns y offset (-1 to 1)
        if (x < 0.1) return 0;
        if (x < 0.15) return (x - 0.1) * 6;         // small rise
        if (x < 0.2) return 0.3 - (x - 0.15) * 10;  // dip down
        if (x < 0.25) return -0.2;                     // baseline dip
        if (x < 0.32) return -0.2 + (x - 0.25) * 18; // sharp spike up
        if (x < 0.38) return 1.06 - (x - 0.32) * 22; // sharp spike down
        if (x < 0.42) return -0.26 + (x - 0.38) * 6; // recovery
        if (x < 0.5) return -0.02;                     // flat
        if (x < 0.55) return (x - 0.5) * 4;           // T-wave up
        if (x < 0.65) return 0.2 - (x - 0.55) * 2;   // T-wave down
        return 0;
    }

    // Market data dots orbiting
    const dots = [];
    for (let i = 0; i < 12; i++) {
        dots.push({
            angle: (i / 12) * Math.PI * 2,
            radius: 68 + (i % 3) * 8,
            speed: 0.15 + Math.random() * 0.1,
            size: 1.5 + Math.random() * 1.5,
            hue: i % 3, // 0=blue, 1=green, 2=purple
        });
    }

    function drawLogo() {
        t += 0.015;
        ctx.clearRect(0, 0, S, S);
        const cx = S / 2, cy = S / 2;
        const light = isLight();

        // Color palette based on theme
        const blue = light ? '0, 90, 180' : '0, 136, 255';
        const green = light ? '0, 160, 110' : '0, 214, 143';
        const purple = light ? '100, 60, 200' : '139, 92, 246';
        const lineAlpha = light ? 0.6 : 0.4;
        const subtleAlpha = light ? 0.15 : 0.08;

        // === OUTER CIRCLE (thin) ===
        ctx.beginPath();
        ctx.arc(cx, cy, 92, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${blue}, ${subtleAlpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // === SYGNAL RINGS expanding outward ===
        for (const ring of rings) {
            const phase = (t * 0.5 + ring.phase) % 1;
            const r = 10 + phase * 85;
            const alpha = (1 - phase) * (light ? 0.2 : 0.12);
            if (alpha > 0.01) {
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(${blue}, ${alpha})`;
                ctx.lineWidth = 1.5 * (1 - phase);
                ctx.stroke();
            }
        }

        // === SEGMENTED RING (slow rotate, 16 segments) ===
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * 0.2);
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            const gap = 0.06;
            const arcLen = (Math.PI * 2 / 16) - gap * 2;
            const wave = Math.sin(t * 2 + i * 0.8) * 0.5 + 0.5;
            const color = i % 4 === 0 ? green : blue;
            ctx.beginPath();
            ctx.arc(0, 0, 82, a + gap, a + arcLen + gap);
            ctx.strokeStyle = `rgba(${color}, ${(subtleAlpha + wave * 0.15)})`;
            ctx.lineWidth = i % 4 === 0 ? 2.5 : 1.5;
            ctx.stroke();
        }
        ctx.restore();

        // === EKG HEARTBEAT LINE ===
        const ekgWidth = 140;
        const ekgLeft = cx - ekgWidth / 2;
        const ekgAmplitude = 28;
        const scrollSpeed = 0.4;
        const offset = (t * scrollSpeed) % 1;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, 70, 0, Math.PI * 2);
        ctx.clip();

        ctx.beginPath();
        for (let px = 0; px <= ekgWidth; px++) {
            const x = ekgLeft + px;
            const normX = ((px / ekgWidth) + offset) % 1;
            const yVal = ekgY(normX);
            const y = cy - yVal * ekgAmplitude;
            if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        // Glow
        ctx.strokeStyle = `rgba(${green}, ${lineAlpha * 0.3})`;
        ctx.lineWidth = 6;
        ctx.stroke();
        // Main line
        ctx.strokeStyle = `rgba(${green}, ${lineAlpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        // === DATA DOTS orbiting ===
        const dotColors = [blue, green, purple];
        for (const d of dots) {
            d.angle += 0.003 * d.speed;
            const wobble = Math.sin(t * 2 + d.angle * 3) * 2;
            const x = cx + Math.cos(d.angle) * (d.radius + wobble);
            const y = cy + Math.sin(d.angle) * (d.radius + wobble);
            const flicker = Math.sin(t * 3 + d.angle * 7) * 0.3 + 0.7;
            ctx.beginPath();
            ctx.arc(x, y, d.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${dotColors[d.hue]}, ${flicker * (light ? 0.5 : 0.4)})`;
            ctx.fill();
        }

        // === CENTER GLOW ===
        const coreWave = Math.sin(t * 2) * 0.15 + 0.85;
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, 25 * coreWave);
        halo.addColorStop(0, `rgba(${green}, ${(light ? 0.25 : 0.2) * coreWave})`);
        halo.addColorStop(0.5, `rgba(${blue}, ${0.08 * coreWave})`);
        halo.addColorStop(1, `rgba(${blue}, 0)`);
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, cy, 25 * coreWave, 0, Math.PI * 2);
        ctx.fill();

        // Center bright dot
        const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 8);
        coreGrad.addColorStop(0, `rgba(255, 255, 255, ${(light ? 0.9 : 0.85) * coreWave})`);
        coreGrad.addColorStop(0.4, `rgba(${green}, ${0.5 * coreWave})`);
        coreGrad.addColorStop(1, `rgba(${green}, 0)`);
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fill();

        _heroOrbRAF = requestAnimationFrame(drawLogo);
    }
    drawLogo();

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { cancelAnimationFrame(_heroOrbRAF); }
        else if (_heroOrbRunning) { drawLogo(); }
    });
})();
} // end initHeroOrb

// Lazy-load hero orb: only start when hero section scrolls into view
(function() {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    const heroObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            initHeroOrb();
            heroObserver.disconnect();
        }
    }, { threshold: 0.1 });
    heroObserver.observe(hero);
})();

// ── PARTICLE BACKGROUND ──
// Performance: fewer particles on mobile, pause when tab hidden
(function() {
    const canvas = document.getElementById('particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, particles = [];
    let _particleRAF;
    const isMobile = window.innerWidth < 768;
    const particleCount = isMobile ? 20 : 60;
    const lineThreshold = isMobile ? 100 : 150;

    function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * (w || 1000),
            y: Math.random() * (h || 800),
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

        // Skip line drawing on mobile (O(n²) is expensive)
        if (!isMobile) {
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < lineThreshold) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(0, 136, 255, ${0.06 * (1 - dist / lineThreshold)})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }
        }

        _particleRAF = requestAnimationFrame(draw);
    }
    draw();

    // Pause when tab hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { cancelAnimationFrame(_particleRAF); }
        else { draw(); }
    });
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
let _firstObserveBatch = true;
const cardObserver = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
        if (e.isIntersecting) {
            // First batch appears instantly, subsequent batches get subtle stagger
            if (_firstObserveBatch) {
                e.target.classList.add('card-visible');
            } else {
                setTimeout(() => e.target.classList.add('card-visible'), (i % 3) * 40);
            }
            cardObserver.unobserve(e.target);
        }
    });
    _firstObserveBatch = false;
}, { threshold: 0.05 });

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

// ── BOT CONTROLS ──
let _botPaused = false;
let _botOrigMaxPos = 12;

async function loadBotConfig() {
    try {
        const resp = await fetch(API_BASE + '/api/bot/config');
        if (!resp.ok) return;
        const cfg = await resp.json();
        if (cfg.error) return;

        // Populate sliders with current values
        const setSlider = (id, val, fmt) => {
            const el = document.getElementById(id);
            const valEl = document.getElementById(id + '-val');
            if (el && val !== undefined) { el.value = val; if (valEl) valEl.textContent = fmt(val); }
        };
        setSlider('bot-max-bet', cfg.max_bet_dollars, v => '$' + parseFloat(v).toFixed(2));
        setSlider('bot-max-pos', cfg.max_positions, v => v);
        setSlider('bot-min-edge', cfg.min_edge, v => (v * 100).toFixed(0) + '%');
        setSlider('bot-loss-limit', cfg.daily_loss_limit_cents, v => '$' + (v / 100).toFixed(2));
        setSlider('bot-max-contracts', cfg.max_contracts_per, v => v);

        _botOrigMaxPos = cfg.max_positions || 12;
        _botPaused = cfg.max_positions === 0;
        updatePauseBtn();
    } catch(e) { console.log('Bot config unavailable'); }
}

function updatePauseBtn() {
    const btn = document.getElementById('bot-pause-btn');
    if (!btn) return;
    if (_botPaused) {
        btn.textContent = 'PAUSED — Resume';
        btn.className = 'bot-toggle-btn paused';
    } else {
        btn.textContent = 'RUNNING — Pause';
        btn.className = 'bot-toggle-btn running';
    }
}

async function toggleBotPause() {
    const btn = document.getElementById('bot-pause-btn');
    btn.textContent = 'Updating...';
    try {
        if (_botPaused) {
            // Resume: restore original max positions
            await fetch(API_BASE + '/api/bot/config', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ max_positions: _botOrigMaxPos || 12 })
            });
            _botPaused = false;
        } else {
            // Pause: set max_positions to 0 (won't open new trades)
            _botOrigMaxPos = parseInt(document.getElementById('bot-max-pos').value) || 12;
            await fetch(API_BASE + '/api/bot/config', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ max_positions: 0 })
            });
            _botPaused = true;
        }
        updatePauseBtn();
        showBotStatus(_botPaused ? 'Bot paused — no new trades' : 'Bot resumed — trading active', !_botPaused);
    } catch(e) {
        showBotStatus('Failed to update bot', false);
        updatePauseBtn();
    }
}

async function saveBotConfig() {
    const btn = document.getElementById('bot-save-btn');
    btn.textContent = 'Saving...';
    const config = {
        max_bet_dollars: parseFloat(document.getElementById('bot-max-bet').value),
        max_positions: parseInt(document.getElementById('bot-max-pos').value),
        min_edge: parseFloat(document.getElementById('bot-min-edge').value),
        daily_loss_limit_cents: parseInt(document.getElementById('bot-loss-limit').value),
        max_contracts_per: parseInt(document.getElementById('bot-max-contracts').value),
    };
    // If bot is paused, don't override max_positions
    if (_botPaused) {
        _botOrigMaxPos = config.max_positions;
        delete config.max_positions;
    }
    try {
        const resp = await fetch(API_BASE + '/api/bot/config', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        const result = await resp.json();
        if (result.error) throw new Error(result.error);
        showBotStatus('Config saved successfully', true);
    } catch(e) {
        showBotStatus('Failed: ' + e.message, false);
    }
    btn.textContent = 'Save Changes';
}

function showBotStatus(msg, success) {
    const el = document.getElementById('bot-config-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'bot-config-status ' + (success ? 'success' : 'error');
    setTimeout(() => { el.textContent = ''; el.className = 'bot-config-status'; }, 4000);
}

async function loadBotSignals() {
    try {
        const resp = await fetch(API_BASE + '/api/bot/signals');
        if (!resp.ok) return;
        const data = await resp.json();
        const signals = data.signals || data || [];
        const section = document.getElementById('bot-signals-section');
        if (!section || signals.length === 0) return;
        section.innerHTML = '<h3 style="font-size:13px;color:var(--text-dim);letter-spacing:2px;margin:16px 0 8px;">LATEST SIGNALS</h3>' +
            signals.slice(0, 10).map(s => {
                const acted = !s.skip_reason;
                const color = acted ? 'var(--green)' : 'var(--text-dim)';
                const badge = acted ? 'ACTED' : (s.skip_reason || 'SKIPPED');
                return `<div class="bot-signal-row">
                    <span class="bot-signal-ticker">${decodeTicker(s.ticker || s.market || '?')}</span>
                    <span style="color:${color};font-size:11px;font-weight:700;">${(s.side || '').toUpperCase()}</span>
                    <span style="font-size:11px;color:var(--text-dim);">Edge: ${((s.edge || 0) * 100).toFixed(1)}%</span>
                    <span class="bot-signal-badge ${acted ? 'acted' : 'skipped'}">${badge}</span>
                </div>`;
            }).join('');
    } catch(e) {}
}

// Load bot config on page load
setTimeout(() => { loadBotConfig(); loadBotSignals(); }, 2000);
// Refresh signals every 5 min
setInterval(loadBotSignals, 300000);

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
    document.body.style.overflow = 'hidden'; // Lock body scroll on mobile
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
    const url = getAffiliateUrl(market);
    const sygnalScore = calcSygnalScore(market, getMarketChange(market.ticker));
    const sygnalColor = sygnalScore >= 67 ? 'var(--green)' : sygnalScore >= 34 ? 'var(--gold)' : 'var(--red)';
    const sygnalLabel = sygnalScore >= 67 ? 'TRADE' : sygnalScore >= 34 ? 'WATCH' : 'SKIP';
    const sig = getSygnalSignal(market.ticker);
    const sigColor = sig.signal.includes('YES') ? 'var(--green)' : sig.signal.includes('NO') ? 'var(--red)' : 'var(--gold)';
    const sigBg = sig.signal.includes('YES') ? 'rgba(0,214,143,0.12)' : sig.signal.includes('NO') ? 'rgba(255,59,92,0.12)' : 'rgba(240,176,0,0.10)';

    // Cross-platform edge info
    const xp = _crossPlatformMap[market.ticker];
    let crossHtml = '';
    if (xp) {
        const otherPlatform = xp.match.source === 'kalshi' ? 'Kalshi' : 'Polymarket';
        crossHtml = `<div class="detail-cross-edge">
            <span class="detail-edge-label">Cross-Platform Edge</span>
            <span class="detail-edge-value">${xp.priceDiff}¢ gap vs ${otherPlatform} (YES ${xp.match.yes}¢)</span>
        </div>`;
    }

    // Score breakdown
    const yes = market.yes || 50;
    let ps = 0;
    if (yes > 3 && yes < 97) { const d = Math.abs(yes-50); ps = Math.round(20*Math.exp(-Math.pow(d-25,2)/450)); }
    const volRaw = market.volume || 0;
    const maxVol = 10000000;
    const vs = volRaw > 0 ? Math.round(20*Math.min(Math.log10(volRaw)/7,1)) : 0;
    const absChange = Math.abs(getMarketChange(market.ticker) || 0);
    const ms = Math.round(20*Math.min(absChange/8,1));
    const cs = xp ? Math.round(20*Math.min(xp.priceDiff/10,1)) : 0;
    let ls = 0;
    if (volRaw >= 1e6) ls = 19; else if (volRaw >= 5e5) ls = 16; else if (volRaw >= 1e5) ls = 13;
    else if (volRaw >= 5e4) ls = 10; else if (volRaw >= 1e4) ls = 7; else if (volRaw >= 1e3) ls = 4; else if (volRaw > 0) ls = 1;

    document.getElementById('detail-actions').innerHTML = `
        <div class="detail-sygnal-row">
            <div class="detail-sygnal-score" style="border-color:${sygnalColor};">
                <span class="detail-sygnal-num" style="color:${sygnalColor}">${sygnalScore}</span>
                <span class="detail-sygnal-label">SYGNAL</span>
            </div>
            <div class="detail-sygnal-info">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                    <span style="color:${sygnalColor};font-weight:700;">${sygnalLabel}</span>
                    <span style="color:${sigColor};background:${sigBg};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">${sig.signal}</span>
                </div>
                <span style="color:var(--text-dim);font-size:12px;display:block;">5-factor score: Price ${ps} + Vol ${vs} + Momentum ${ms} + Edge ${cs} + Liq ${ls}</span>
            </div>
        </div>
        ${crossHtml}
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

    // Draw bigger chart — use real history if available
    const canvas = document.getElementById('detail-chart');
    const realHistory = getPriceHistory(market.ticker);
    let detailChartData;
    if (realHistory.length >= 5) {
        detailChartData = realHistory;
    } else {
        const basePrice = market.yes;
        detailChartData = [];
        let p = basePrice - 8 + Math.random() * 16;
        for (let i = 0; i < 50; i++) {
            p += (Math.random() - 0.48) * 2.5;
            p = Math.max(2, Math.min(98, p));
            detailChartData.push(p);
        }
        detailChartData.push(basePrice);
    }
    setTimeout(() => drawDetailChart(canvas, detailChartData), 50);

    // Sygnal Score history
    const scoreHistory = getSygnalScoreHistory(market.ticker);
    const histEl = document.getElementById('detail-sygnal-history');
    if (scoreHistory.length >= 3) {
        const scores = scoreHistory.map(h => h.score).filter(s => s > 0);
        if (scores.length >= 3) {
            const minS = Math.min(...scores);
            const maxS = Math.max(...scores);
            const trend = scores[scores.length - 1] - scores[0];
            const trendIcon = trend > 3 ? '📈' : trend < -3 ? '📉' : '➡️';
            const trendColor = trend > 3 ? 'var(--green)' : trend < -3 ? 'var(--red)' : 'var(--text-dim)';
            histEl.innerHTML = `
                <div class="sygnal-history-section">
                    <h4>Sygnal Score History</h4>
                    <canvas id="sygnal-history-chart" width="600" height="100"></canvas>
                    <div class="sygnal-history-stats">
                        <span>Low: <b style="color:var(--red)">${minS}</b></span>
                        <span>High: <b style="color:var(--green)">${maxS}</b></span>
                        <span>Trend: <b style="color:${trendColor}">${trendIcon} ${trend > 0 ? '+' : ''}${trend}</b></span>
                        <span>Snapshots: ${scores.length}</span>
                    </div>
                </div>
            `;
            setTimeout(() => drawSygnalHistoryChart(document.getElementById('sygnal-history-chart'), scores), 100);
        } else {
            histEl.innerHTML = '';
        }
    } else {
        histEl.innerHTML = '';
    }
}

function _drawDetailChartBase(canvas, data) {
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

    // Y-axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '11px Sora, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
        const val = min + (i / 4) * range;
        const y = h - 20 - (i / 4) * (h - 40);
        ctx.fillText(Math.round(val) + '\u00A2', 35, y + 4);
    }

    // Current price label
    ctx.fillStyle = `rgb(${color})`;
    ctx.font = 'bold 13px Sora, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(Math.round(data[data.length-1]) + '\u00A2', lastX + 6, lastY + 4);

    return { min, max, range, color };
}

function drawSygnalHistoryChart(canvas, scores) {
    if (!canvas || scores.length < 2) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width = canvas.offsetWidth * dpr;
    const h = canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const cw = canvas.offsetWidth, ch = canvas.offsetHeight;
    ctx.clearRect(0, 0, cw, ch);

    const min = Math.max(0, Math.min(...scores) - 5);
    const max = Math.min(99, Math.max(...scores) + 5);
    const range = max - min || 1;
    const pad = 4;

    // Zone backgrounds (SKIP / WATCH / TRADE)
    const zones = [
        { from: 0, to: 33, color: 'rgba(255,59,92,0.04)' },
        { from: 34, to: 66, color: 'rgba(240,176,0,0.04)' },
        { from: 67, to: 99, color: 'rgba(0,214,143,0.04)' },
    ];
    for (const z of zones) {
        const y1 = ch - pad - ((Math.min(z.to, max) - min) / range) * (ch - pad * 2);
        const y2 = ch - pad - ((Math.max(z.from, min) - min) / range) * (ch - pad * 2);
        if (y2 > y1) {
            ctx.fillStyle = z.color;
            ctx.fillRect(0, y1, cw, y2 - y1);
        }
    }

    // Zone threshold lines at 33 and 67
    for (const thresh of [33, 67]) {
        if (thresh >= min && thresh <= max) {
            const y = ch - pad - ((thresh - min) / range) * (ch - pad * 2);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(cw, y);
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    // Score line
    ctx.beginPath();
    for (let i = 0; i < scores.length; i++) {
        const x = (i / (scores.length - 1)) * cw;
        const y = ch - pad - ((scores[i] - min) / range) * (ch - pad * 2);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    // Color based on current zone
    const current = scores[scores.length - 1];
    const lineColor = current >= 67 ? '0,214,143' : current >= 34 ? '240,176,0' : '255,59,92';
    ctx.strokeStyle = `rgba(${lineColor}, 0.8)`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Fill under
    ctx.lineTo(cw, ch);
    ctx.lineTo(0, ch);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, `rgba(${lineColor}, 0.15)`);
    grad.addColorStop(1, `rgba(${lineColor}, 0)`);
    ctx.fillStyle = grad;
    ctx.fill();

    // Current score dot
    const lastX = cw;
    const lastY = ch - pad - ((current - min) / range) * (ch - pad * 2);
    ctx.beginPath();
    ctx.arc(lastX - 3, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${lineColor}, 0.9)`;
    ctx.fill();
}

function drawDetailChart(canvas, data) {
    const chartInfo = _drawDetailChartBase(canvas, data);
    if (!chartInfo) return;

    // Store data for hover
    canvas._chartData = data;
    canvas._chartInfo = chartInfo;

    // Set up hover (only once)
    if (!canvas._hoverBound) {
        canvas._hoverBound = true;

        canvas.onmousemove = function(e) {
            const d = canvas._chartData;
            const info = canvas._chartInfo;
            if (!d || !info) return;

            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const ratio = mouseX / rect.width;
            const idx = Math.round(ratio * (d.length - 1));
            if (idx < 0 || idx >= d.length) return;

            // Redraw base
            _drawDetailChartBase(canvas, d);

            const ctx = canvas.getContext('2d');
            const w = canvas.width;
            const h = canvas.height;
            const x = (idx / (d.length - 1)) * w;
            const y = h - 20 - ((d[idx] - info.min) / info.range) * (h - 40);

            // Crosshair
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
            ctx.setLineDash([]);

            // Dot
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fillStyle = d[idx] >= d[0] ? 'rgb(0, 214, 143)' : 'rgb(255, 59, 92)';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Tooltip
            ctx.fillStyle = 'rgba(13,13,21,0.9)';
            const tooltipW = 60;
            const tooltipH = 28;
            const tx = Math.min(x - tooltipW/2, w - tooltipW - 4);
            const ty = y - tooltipH - 10;
            ctx.beginPath();
            ctx.roundRect(Math.max(4, tx), Math.max(4, ty), tooltipW, tooltipH, 6);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 13px Sora, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(Math.round(d[idx]) + '\u00A2', Math.max(4, tx) + tooltipW/2, Math.max(4, ty) + 19);
        };

        canvas.onmouseleave = function() {
            if (canvas._chartData) {
                _drawDetailChartBase(canvas, canvas._chartData);
            }
        };
    }
}

function closeDetail() {
    document.getElementById('market-detail').style.cssText = 'display:none;';
    document.body.style.overflow = ''; // Unlock body scroll
    currentDetailMarket = null;
}

// Close on overlay click
document.getElementById('market-detail')?.addEventListener('click', (e) => {
    if (e.target.id === 'market-detail') closeDetail();
});


// ── PAPER PORTFOLIO ──
function getPaperPortfolio() {
    try { return JSON.parse(localStorage.getItem('sygnal-portfolio') || '{"balance":1000,"trades":[]}'); }
    catch { return { balance: 1000, trades: [] }; }
}

function savePaperPortfolio(portfolio) {
    localStorage.setItem('sygnal-portfolio', JSON.stringify(portfolio));
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
let notificationsEnabled = localStorage.getItem('sygnal-notifications') === 'true';
let previousPrices = {};
try { previousPrices = JSON.parse(localStorage.getItem('sygnal-prices') || '{}'); } catch {}
let previousBotTrades = null;

function updateNotifLabel() {
    const label = document.getElementById('notif-label');
    if (label) label.textContent = 'Alerts: ' + (notificationsEnabled ? 'ON' : 'OFF');
}

async function toggleNotifications() {
    if (!isPro()) { showProUpsell('Push Notifications'); return; }
    if (!notificationsEnabled) {
        // Request permission
        if (!('Notification' in window)) {
            alert('Your browser doesn\'t support notifications');
            return;
        }
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
            notificationsEnabled = true;
            localStorage.setItem('sygnal-notifications', 'true');
            sendNotification('Sygnal Alerts Enabled', 'You\'ll be notified when watchlisted markets move 5%+ or your bot trades.');
        } else {
            alert('Notifications blocked — enable them in browser settings');
            return;
        }
    } else {
        notificationsEnabled = false;
        localStorage.setItem('sygnal-notifications', 'false');
    }
    updateNotifLabel();
}

function sendNotification(title, body, tag) {
    if (!notificationsEnabled || Notification.permission !== 'granted') return;
    try {
        new Notification(title, {
            body: body,
            icon: 'https://sygnalmarkets.com/favicon.ico',
            badge: 'https://sygnalmarkets.com/favicon.ico',
            tag: tag || undefined,  // prevents duplicate notifs with same tag
            silent: false,
        });
    } catch (e) { console.warn('Notification failed:', e); }
}

function showPriceToast(title, price, direction) {
    const toast = document.createElement('div');
    toast.className = 'toast price-toast';
    toast.innerHTML = `<span class="toast-icon">${direction === 'up' ? '\uD83D\uDCC8' : '\uD83D\uDCC9'}</span> <strong>${title}</strong> \u2192 YES ${price}\u00A2`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function checkPriceAlerts(kalshiMarkets, polyMarkets) {
    const watchlist = getWatchlist();
    const allMarkets = [...kalshiMarkets, ...polyMarkets];
    const newPrices = {};

    for (const m of allMarkets) {
        if (!m.ticker) continue;
        newPrices[m.ticker] = m.yes;

        // Only alert on watchlisted markets
        if (!watchlist.includes(m.ticker)) continue;

        const oldPrice = previousPrices[m.ticker];
        if (oldPrice === undefined) continue;  // First time seeing this market

        // Check 10-cent boundary crossings
        const oldBucket = Math.floor(oldPrice / 10);
        const newBucket = Math.floor(m.yes / 10);
        if (oldBucket !== newBucket) {
            const direction = m.yes > oldPrice ? 'up' : 'down';
            const title = shortenTitle(m.question);
            showPriceToast(title, m.yes, direction);
        }

        const diff = Math.abs(m.yes - oldPrice);
        if (diff >= 5 && notificationsEnabled) {
            const dirIcon = m.yes > oldPrice ? '\uD83D\uDCC8' : '\uD83D\uDCC9';
            const title = shortenTitle(m.question);
            sendNotification(
                `${dirIcon} ${title}`,
                `Moved ${diff}\u00A2 \u2192 now YES ${m.yes}\u00A2 (was ${oldPrice}\u00A2)`,
                'price-' + m.ticker
            );
        }
    }

    // Save current prices
    previousPrices = newPrices;
    localStorage.setItem('sygnal-prices', JSON.stringify(newPrices));
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


// ── GROUP SIMILAR MARKETS (Kill Sports Spam) ──
let _marketGroups = {};

function groupSimilarMarkets(markets) {
    // Known groupable patterns — match the suffix after a variable subject
    const patterns = [
        { regex: /win the (\d{4} FIFA World Cup)/i, label: m => m[1] },
        { regex: /win the (\d{4} NBA (?:Finals|Championship))/i, label: m => m[1] },
        { regex: /win the (\d{4} (?:NHL )?Stanley Cup)/i, label: m => m[1] },
        { regex: /win the (\d{4} World Series)/i, label: m => m[1] },
        { regex: /win the (\d{4} Super Bowl)/i, label: m => m[1] },
        { regex: /sentenced to (.+(?:prison|years))/i, label: () => 'Weinstein Sentencing' },
        { regex: /(\w+ (?:—|–|-) .+(?:World Cup|NBA|Stanley|Finals|Championship))/i, label: m => m[1] },
    ];

    const groups = {};

    for (const m of markets) {
        const title = m.question || '';
        let matched = false;
        for (const pat of patterns) {
            const match = title.match(pat.regex);
            if (match) {
                const label = pat.label(match);
                if (!groups[label]) groups[label] = [];
                groups[label].push(m);
                matched = true;
                break;
            }
        }
        // Also try dash-based grouping as fallback
        if (!matched) {
            const dashMatch = title.match(/\s*[\u2014\u2013-]\s*(.+)$/);
            if (dashMatch) {
                const suffix = dashMatch[1].trim();
                if (!groups[suffix]) groups[suffix] = [];
                groups[suffix].push(m);
            }
        }
    }

    const result = [];
    const groupedTickers = new Set();

    for (const [suffix, gMarkets] of Object.entries(groups)) {
        if (gMarkets.length >= 5) {
            gMarkets.sort((a, b) => (b.volume || 0) - (a.volume || 0));
            result.push({ groupTitle: suffix, markets: gMarkets, isGroup: true });
            gMarkets.forEach(m => groupedTickers.add(m.ticker));
        }
    }

    // Ungrouped markets maintain original order
    for (const m of markets) {
        if (!groupedTickers.has(m.ticker)) {
            result.push(m);
        }
    }

    return result;
}

function createGroupCard(group) {
    const card = document.createElement('div');
    card.className = 'market-card group-card';
    const topMarkets = group.markets.slice(0, 2);
    const remaining = group.markets.length - 2;
    const avgScore = Math.round(group.markets.reduce((s,m) => s + calcSygnalScore(m, 0), 0) / group.markets.length);
    const scoreColor = avgScore >= 70 ? '#00d68f' : avgScore >= 40 ? '#f0b000' : '#ff3b5c';

    card.innerHTML = `
        <div class="card-top-row">
            <span class="badge group-badge">GROUP</span>
            <span style="font-size:12px;color:var(--text-dim);">${group.markets.length} markets</span>
        </div>
        <h3>${group.groupTitle}</h3>
        <div class="group-preview">
            ${topMarkets.map(m => `<div class="group-item"><span>${shortenTitle(m.question)}</span><span style="color:${m.yes >= 50 ? '#00d68f' : '#ff3b5c'}">YES ${m.yes}\u00A2</span></div>`).join('')}
        </div>
        <button class="group-toggle" onclick="expandGroup(this, '${group.groupTitle.replace(/'/g, "\\'")}')">${remaining} more markets \u2192</button>
        <div class="card-sygnal-footer">
            <span class="card-sygnal-label">SYGNAL</span>
            <span class="card-sygnal-score" style="color:${scoreColor};">${avgScore}</span>
        </div>
    `;
    return card;
}

function expandGroup(btn, groupTitle) {
    const group = _marketGroups[groupTitle];
    if (!group) return;
    const card = btn.closest('.group-card');
    const isExpanded = card.classList.contains('group-expanded');

    if (isExpanded) {
        card.classList.remove('group-expanded');
        const expandedCards = card.parentElement.querySelectorAll(`.group-child[data-group="${groupTitle}"]`);
        expandedCards.forEach(c => c.remove());
        btn.textContent = `${group.markets.length - 2} more markets \u2192`;
    } else {
        card.classList.add('group-expanded');
        const remaining = group.markets.slice(2);
        remaining.forEach(m => {
            const mCard = createMarketCard(m, m.source || 'poly', getMarketChange(m.ticker));
            mCard.classList.add('group-child');
            mCard.dataset.group = groupTitle;
            card.after(mCard);
        });
        btn.textContent = 'Show less \u2190';
        if (typeof observeCards === 'function') observeCards();
    }
}

// ── SYGNAL SCORE SPIKE ALERTS ──
let _prevSygnalScores = {};
try { _prevSygnalScores = JSON.parse(localStorage.getItem('sygnal-prev-scores') || '{}'); } catch {}

function checkSygnalScoreSpikes(allMarkets) {
    if (!notificationsEnabled) return;
    const newScores = {};
    for (const m of allMarkets) {
        if (!m.ticker) continue;
        const score = calcSygnalScore(m, 0);
        newScores[m.ticker] = score;

        const prev = _prevSygnalScores[m.ticker];
        if (prev !== undefined) {
            const change = score - prev;
            if (change >= 15) {
                sendNotification(
                    `\uD83D\uDCCA Sygnal Score Spike: ${shortenTitle(m.question)}`,
                    `Score jumped from ${prev} \u2192 ${score} (+${change})`,
                    'sygnal-spike-' + m.ticker
                );
            }
        }
    }
    _prevSygnalScores = newScores;
    localStorage.setItem('sygnal-prev-scores', JSON.stringify(newScores));
}

// ── TRENDING PANEL ──
function buildTrendingPanel() {
    const grid = document.getElementById('trending-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const allMarkets = allMarketCards.map(c => c.market);

    // ── Section 1: Biggest Price Movers ──
    const movers = findBiggestMovers(allMarkets);
    if (movers.length > 0) {
        const header1 = document.createElement('div');
        header1.className = 'trending-section-header';
        header1.innerHTML = '<span class="trending-section-icon">🔥</span> Biggest Movers';
        grid.appendChild(header1);
        for (const t of movers.slice(0, 6)) {
            grid.appendChild(makeTrendingCard(t.market, t.change, 'price'));
        }
    }

    // ── Section 2: Sygnal Score Risers ──
    const prevScores = {};
    try { Object.assign(prevScores, JSON.parse(localStorage.getItem('sygnal-prev-scores') || '{}')); } catch {}
    const risers = [];
    for (const {market} of allMarketCards) {
        const currentScore = calcSygnalScore(market, 0);
        const prevScore = prevScores[market.ticker];
        if (prevScore !== undefined) {
            const change = currentScore - prevScore;
            if (change > 0) risers.push({ market, currentScore, change });
        }
    }
    risers.sort((a, b) => b.change - a.change);
    if (risers.length > 0) {
        const header2 = document.createElement('div');
        header2.className = 'trending-section-header';
        header2.innerHTML = '<span class="trending-section-icon">📈</span> Sygnal Score Rising';
        grid.appendChild(header2);
        for (const t of risers.slice(0, 6)) {
            grid.appendChild(makeTrendingCard(t.market, t.change, 'sygnal'));
        }
    }

    // ── Section 3: Top Sygnal Scores (always available) ──
    const topSygnal = allMarketCards
        .map(c => ({ market: c.market, score: calcSygnalScore(c.market, 0) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);
    const header3 = document.createElement('div');
    header3.className = 'trending-section-header';
    header3.innerHTML = '<span class="trending-section-icon">⚡</span> Highest Confidence';
    grid.appendChild(header3);
    for (const t of topSygnal) {
        grid.appendChild(makeTrendingCard(t.market, t.score, 'top'));
    }

    // ── Section 4: Highest Volume ──
    const topVol = [...allMarkets]
        .filter(m => m.volume > 0)
        .sort((a, b) => (b.volume || 0) - (a.volume || 0))
        .slice(0, 6);
    if (topVol.length > 0) {
        const header4 = document.createElement('div');
        header4.className = 'trending-section-header';
        header4.innerHTML = '<span class="trending-section-icon">💰</span> Most Traded';
        grid.appendChild(header4);
        for (const m of topVol) {
            grid.appendChild(makeTrendingCard(m, m.volume, 'volume'));
        }
    }

    if (grid.children.length === 0) {
        grid.innerHTML = '<div class="market-card card-visible"><h3 style="color:var(--text-dim);">No trending data yet — scores update every refresh cycle</h3></div>';
    }

    // Make trending cards visible (they start with opacity:0 from .market-card CSS)
    grid.querySelectorAll('.market-card').forEach(c => c.classList.add('card-visible'));
}

function makeTrendingCard(m, value, type) {
    const card = document.createElement('div');
    card.className = 'market-card trending-card';
    const sygnalScore = calcSygnalScore(m, 0);
    const sygnalColor = sygnalScore >= 67 ? '#00d68f' : sygnalScore >= 34 ? '#f0b000' : '#ff3b5c';

    let tagHtml = '';
    if (type === 'price') {
        const sign = value >= 0 ? '+' : '';
        const color = value >= 0 ? '#00d68f' : '#ff3b5c';
        tagHtml = `<span class="trending-change" style="color:${color};">${sign}${value}¢</span>`;
    } else if (type === 'sygnal') {
        tagHtml = `<span class="trending-change" style="color:#00d68f;">+${value} sygnal</span>`;
    } else if (type === 'top') {
        tagHtml = `<span class="trending-change" style="color:${sygnalColor};">Score: ${value}</span>`;
    } else if (type === 'volume') {
        const fmt = value >= 1e6 ? (value / 1e6).toFixed(1) + 'M' : value >= 1e3 ? (value / 1e3).toFixed(0) + 'K' : value.toFixed(0);
        tagHtml = `<span class="trending-change" style="color:#8b5cf6;">$${fmt}</span>`;
    }

    card.innerHTML = `
        <div class="card-top-row">
            <span class="badge ${m.source === 'kalshi' ? 'kalshi-badge' : 'poly-badge'}">${m.source === 'kalshi' ? 'KALSHI' : 'POLY'}</span>
            <div style="display:flex;align-items:center;gap:8px;">
                ${tagHtml}
            </div>
        </div>
        <h3>${shortenTitle(m.question)}</h3>
        <div class="prices">
            <span style="color:${m.yes >= 50 ? '#00d68f' : '#ff3b5c'};font-weight:600;">YES ${m.yes}¢</span>
            <span style="color:#333;margin:0 4px;">·</span>
            <span style="color:${m.no >= 50 ? '#00d68f' : '#ff3b5c'};font-weight:600;">NO ${m.no}¢</span>
        </div>
        <div class="card-sygnal-footer">
            <span class="card-sygnal-label">SYGNAL</span>
            <span class="card-sygnal-score" style="color:${sygnalColor};">${sygnalScore}</span>
        </div>
    `;

    card.addEventListener('click', () => openDetail(m, m.source || 'poly'));
    return card;
}

// ── AUTO REFRESH with countdown ──
const refreshMs = isPro() ? 30000 : 120000;
let refreshCountdown = isPro() ? 30 : 120;
refreshInterval1 = setInterval(loadMarkets, refreshMs);
refreshInterval2 = setInterval(loadBot, refreshMs);
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
    try { return JSON.parse(localStorage.getItem('sygnal-price-alerts') || '[]'); }
    catch { return []; }
}

function savePriceAlerts(alerts) {
    localStorage.setItem('sygnal-price-alerts', JSON.stringify(alerts));
}

function setPriceAlert() {
    if (!currentDetailMarket) return;
    if (!isPro()) { showProUpsell('Custom Price Alerts'); return; }
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
    try { return JSON.parse(localStorage.getItem('sygnal-portfolio-history') || '[]'); }
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
    localStorage.setItem('sygnal-portfolio-history', JSON.stringify(history));
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


// ── SHARE POPUP (Feature 2) ──
function generatePickCard(market) {
    const scale = 3; // 3x for sharp retina
    const W = 600;

    // Pre-calculate height based on content
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.font = '700 20px system-ui';
    const words = (market.question || '').split(' ');
    let lines = 1, testLine = '';
    for (const w of words) {
        const test = testLine ? testLine + ' ' + w : w;
        if (tempCtx.measureText(test).width > W - 60) { lines++; testLine = w; }
        else testLine = test;
    }
    const H = 140 + lines * 28 + 80; // header + question lines + prices/signal/footer

    const canvas = document.createElement('canvas');
    canvas.width = W * scale; canvas.height = H * scale;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    // Background
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0a0a14'); grad.addColorStop(1, '#12121f');
    ctx.fillStyle = grad; roundRect(ctx, 0, 0, W, H, 20, true);

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    roundRect(ctx, 0.5, 0.5, W - 1, H - 1, 20, false, true);

    // Top accent line
    const accentGrad = ctx.createLinearGradient(24, 0, W - 24, 0);
    accentGrad.addColorStop(0, 'transparent'); accentGrad.addColorStop(0.3, '#0088ff'); accentGrad.addColorStop(0.7, '#0088ff'); accentGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = accentGrad; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(24, 1); ctx.lineTo(W - 24, 1); ctx.stroke();

    // "SYGNAL" header
    ctx.fillStyle = '#0088ff'; ctx.font = '800 12px system-ui';
    ctx.fillText('S Y G N A L', 28, 36);

    // Platform badge
    const plat = market.source === 'kalshi' ? 'KALSHI' : 'POLYMARKET';
    const platColor = market.source === 'kalshi' ? '#0088ff' : '#8b5cf6';
    ctx.font = '700 10px system-ui';
    const platTextW = ctx.measureText(plat).width;
    ctx.fillStyle = platColor + '20'; roundRect(ctx, W - 28 - platTextW - 16, 22, platTextW + 16, 22, 6, true);
    ctx.strokeStyle = platColor + '30'; ctx.lineWidth = 1; roundRect(ctx, W - 28 - platTextW - 16, 22, platTextW + 16, 22, 6, false, true);
    ctx.fillStyle = platColor; ctx.fillText(plat, W - 28 - platTextW - 8, 37);

    // Market question (word wrap)
    ctx.fillStyle = '#eaeaef'; ctx.font = '700 20px system-ui';
    let line = '', y = 74;
    for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > W - 60) { ctx.fillText(line, 28, y); y += 28; line = w; }
        else line = test;
    }
    if (line) ctx.fillText(line, 28, y);

    // Prices
    const priceY = y + 44;
    ctx.font = '800 34px system-ui';
    ctx.fillStyle = market.yes >= 50 ? '#00d68f' : '#8b8b99';
    ctx.fillText(`YES ${market.yes}¢`, 28, priceY);
    const noX = ctx.measureText(`YES ${market.yes}¢`).width + 40;
    ctx.fillStyle = market.no >= 50 ? '#ff3b5c' : '#8b8b99';
    ctx.fillText(`NO ${market.no}¢`, noX, priceY);

    // Sygnal Score circle
    const ps = calcSygnalScore(market, getMarketChange(market.ticker));
    const psColor = ps >= 67 ? '#00d68f' : ps >= 34 ? '#f0b000' : '#ff3b5c';
    const scoreX = W - 60, scoreY2 = priceY - 10;
    ctx.beginPath(); ctx.arc(scoreX, scoreY2, 34, 0, Math.PI * 2);
    ctx.strokeStyle = psColor; ctx.lineWidth = 3; ctx.stroke();
    // Score arc fill (partial ring based on score)
    ctx.beginPath(); ctx.arc(scoreX, scoreY2, 34, -Math.PI/2, -Math.PI/2 + (ps/99) * Math.PI * 2);
    ctx.strokeStyle = psColor + '40'; ctx.lineWidth = 6; ctx.stroke();
    ctx.fillStyle = psColor; ctx.font = '800 26px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(ps, scoreX, scoreY2 + 9);
    ctx.fillStyle = '#55556a'; ctx.font = '700 8px system-ui';
    ctx.fillText('SYGNAL', scoreX, scoreY2 + 24);
    ctx.textAlign = 'left';

    // Signal badge
    const sig = getSygnalSignal(market.ticker);
    const sigY = priceY + 20;
    let sigCol = '#f0b000';
    if (sig.signal.includes('YES')) sigCol = '#00d68f';
    else if (sig.signal.includes('NO')) sigCol = '#ff3b5c';
    ctx.font = '700 14px system-ui';
    const sigTextW = ctx.measureText(sig.signal).width;
    ctx.fillStyle = sigCol + '15'; roundRect(ctx, 28, sigY, sigTextW + 24, 28, 8, true);
    ctx.strokeStyle = sigCol + '30'; ctx.lineWidth = 1; roundRect(ctx, 28, sigY, sigTextW + 24, 28, 8, false, true);
    ctx.fillStyle = sigCol;
    ctx.fillText(sig.signal, 40, sigY + 20);

    // Divider
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(28, H - 38); ctx.lineTo(W - 28, H - 38); ctx.stroke();

    // Footer
    ctx.fillStyle = '#44445a'; ctx.font = '500 11px system-ui';
    ctx.fillText('sygnalmarkets.com', 28, H - 14);
    ctx.textAlign = 'right';
    ctx.fillText(new Date().toLocaleDateString(), W - 28, H - 14);
    ctx.textAlign = 'left';

    return canvas;
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

function showSharePopup(market) {
    const canvas = generatePickCard(market);
    const ps = calcSygnalScore(market, 0);
    const sig = getSygnalSignal(market.ticker);
    const text = `${market.question}\n\nYES ${market.yes}¢ · NO ${market.no}¢\nSygnal Score: ${ps}/99 — ${sig.signal}\n\nsygnalmarkets.com`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;

    const popup = document.createElement('div');
    popup.className = 'share-popup';
    popup.innerHTML = `
        <div class="share-popup-content share-card-popup">
            <h4>Share Your Pick</h4>
            <div class="share-card-preview"></div>
            <div class="share-btn-row">
                <button class="share-action-btn" id="share-download">⬇ Download</button>
                <button class="share-action-btn" id="share-copy">📋 Copy Image</button>
                <a class="share-action-btn" href="${twitterUrl}" target="_blank">𝕏 Share on X</a>
            </div>
            <button onclick="this.closest('.share-popup').remove()" class="share-cancel">Cancel</button>
        </div>
    `;
    document.body.appendChild(popup);
    popup.querySelector('.share-card-preview').appendChild(canvas);

    popup.querySelector('#share-download').addEventListener('click', () => {
        canvas.toBlob(blob => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'sygnal-pick.png';
            a.click(); URL.revokeObjectURL(a.href);
            showToast('Image downloaded!');
        });
    });
    popup.querySelector('#share-copy').addEventListener('click', () => {
        canvas.toBlob(blob => {
            navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(() => {
                showToast('Image copied to clipboard!');
            }).catch(() => showToast('Copy failed — try download instead'));
        });
    });
}

// ── EMBED WIDGET (Feature 9) ──
function showEmbedCode(market) {
    const ps = calcSygnalScore(market, 0);
    const psColor = ps >= 70 ? '#00d68f' : ps >= 40 ? '#f0b000' : '#ff3b5c';
    const code = `<div style="background:#0d0d15;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:16px;font-family:system-ui;max-width:320px;color:#e8e8ed;">
  <div style="font-size:9px;letter-spacing:1.5px;color:#5a5a6e;margin-bottom:8px;">SYGNAL MARKET</div>
  <div style="font-size:14px;font-weight:500;margin-bottom:12px;">${market.question}</div>
  <div style="display:flex;gap:12px;margin-bottom:8px;">
    <span style="color:${market.yes >= 50 ? '#00d68f' : '#ff3b5c'};font-weight:600;">YES ${market.yes}\u00A2</span>
    <span style="color:${market.no >= 50 ? '#00d68f' : '#ff3b5c'};font-weight:600;">NO ${market.no}\u00A2</span>
  </div>
  <div style="display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;">
    <span style="font-size:11px;color:#5a5a6e;letter-spacing:2px;font-weight:700;">SYGNAL</span>
    <span style="font-size:18px;font-weight:800;color:${psColor};">${ps}</span>
  </div>
  <a href="${market.url || 'https://sygnalmarkets.com'}" target="_blank" style="font-size:11px;color:#0088ff;text-decoration:none;display:block;margin-top:8px;">View on Sygnal \u2192</a>
</div>`;

    const popup = document.createElement('div');
    popup.className = 'share-popup';
    popup.innerHTML = `
        <div class="share-popup-content">
            <h4>Embed This Market</h4>
            <textarea class="embed-textarea" readonly onclick="this.select()">${code.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
            <button onclick="navigator.clipboard.writeText(this.closest('.share-popup-content').querySelector('textarea').textContent).then(()=>{this.textContent='Copied!';setTimeout(()=>this.closest('.share-popup').remove(),1000)})">Copy Embed Code</button>
            <button onclick="this.closest('.share-popup').remove()" class="share-cancel">Cancel</button>
        </div>
    `;
    document.body.appendChild(popup);
}

// ── MARKET INSIGHTS (Feature 3) ──
function getMarketInsights(market) {
    const ps = calcSygnalScore(market, 0);
    const cat = market.category || categorize(market.question);
    const vol = market.volume || 0;
    const change = getMarketChange(market.ticker);

    const insights = [];

    if (ps >= 70) insights.push({ icon: '\uD83D\uDD25', text: `High confidence signal \u2014 Sygnal Score ${ps}/99` });
    else if (ps <= 30) insights.push({ icon: '\u26A0\uFE0F', text: 'Low confidence \u2014 thin volume or uncertain outcome' });

    if (Math.abs(change) >= 5) insights.push({ icon: change > 0 ? '\uD83D\uDCC8' : '\uD83D\uDCC9', text: `Price moved ${Math.abs(change)}\u00A2 recently \u2014 ${change > 0 ? 'bullish' : 'bearish'} momentum` });

    if (vol > 1000000) insights.push({ icon: '\uD83D\uDCB0', text: `$${(vol/1e6).toFixed(1)}M traded \u2014 institutional-level volume` });
    else if (vol > 100000) insights.push({ icon: '\uD83D\uDCCA', text: `$${(vol/1e3).toFixed(0)}K traded \u2014 healthy liquidity` });
    else if (vol < 1000) insights.push({ icon: '\uD83D\uDEA8', text: 'Very low volume \u2014 price may be unreliable' });

    if (market.yes >= 90) insights.push({ icon: '\u2705', text: 'Market sees this as near-certain YES' });
    else if (market.yes <= 10) insights.push({ icon: '\u274C', text: 'Market sees this as near-certain NO' });
    else if (market.yes >= 45 && market.yes <= 55) insights.push({ icon: '\uD83C\uDFB2', text: 'True coin flip \u2014 maximum uncertainty' });

    if (cat === 'crypto') insights.push({ icon: '\u20BF', text: 'Crypto markets are highly volatile \u2014 prices can swing 10\u00A2+ in hours' });
    if (cat === 'politics') insights.push({ icon: '\uD83C\uDFDB\uFE0F', text: 'Political markets often price in polling data and insider sentiment' });
    if (cat === 'sports') insights.push({ icon: '\u26BD', text: 'Sports markets adjust quickly as game time approaches' });

    return insights.slice(0, 4);
}

// ── EMAIL SIGNUP (Feature 8) ──
async function submitSignup() {
    const email = document.getElementById('signup-email').value.trim();
    const statusEl = document.getElementById('signup-status');
    if (!email || !email.includes('@')) {
        statusEl.textContent = 'Please enter a valid email';
        return;
    }
    statusEl.textContent = 'Subscribing...';
    try {
        // Subscribe via Beehiiv
        const resp = await fetch('https://api.beehiiv.com/v2/publications/pub_sygnalmarkets/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, utm_source: 'sygnal-dashboard' }),
        });
        if (resp.ok || resp.status === 409) {
            statusEl.textContent = '✓ Subscribed! Check your email to confirm.';
            statusEl.style.color = '#00d68f';
        } else {
            // Fallback: open Beehiiv subscribe page
            window.open(`https://sygnalmarkets.beehiiv.com/subscribe?email=${encodeURIComponent(email)}`, '_blank');
            statusEl.textContent = '✓ Redirecting to confirm subscription...';
            statusEl.style.color = '#00d68f';
        }
        document.getElementById('signup-email').value = '';
    } catch {
        // Fallback: open Beehiiv subscribe page directly
        window.open(`https://sygnalmarkets.beehiiv.com/subscribe?email=${encodeURIComponent(email)}`, '_blank');
        statusEl.textContent = '✓ Redirecting to confirm subscription...';
        statusEl.style.color = '#00d68f';
        document.getElementById('signup-email').value = '';
    }
}

// ── ACCURACY TRACKER (Feature 10) ──
function calculateAccuracy() {
    const stats = getAccuracyStats();
    if (stats.total >= 5) return stats.pct;
    // Fallback to snapshot-based accuracy
    const history = getPriceSnapshots();
    let correct = 0, total = 0;
    for (const {market} of allMarketCards) {
        const ps = calcSygnalScore(market, 0);
        const h = history[market.ticker] || [];
        if (h.length < 3) continue;
        const priceDir = h[h.length-1].p > h[0].p ? 'up' : 'down';
        if ((ps >= 60 && priceDir === 'up') || (ps < 40 && priceDir === 'down')) correct++;
        total++;
    }
    return total > 5 ? Math.round((correct / total) * 100) : null;
}

// ── DAILY RECAP BANNER ──
// Shows what changed since the user's last visit
function showRecapBanner() {
    const banner = document.getElementById('recap-banner');
    if (!banner) return;

    const lastVisit = localStorage.getItem('sygnal-last-visit');
    const now = Date.now();
    localStorage.setItem('sygnal-last-visit', now);

    // Only show if user has been away 1+ hours
    if (!lastVisit || (now - parseInt(lastVisit)) < 3600000) return;

    const hoursSince = Math.round((now - parseInt(lastVisit)) / 3600000);
    const timeAgo = hoursSince >= 24 ? Math.round(hoursSince / 24) + 'd' : hoursSince + 'h';

    // Count price movers since last visit
    const snapshots = getPriceSnapshots();
    let bigMovers = 0;
    let biggestMove = { ticker: '', change: 0, question: '' };
    for (const {market} of allMarketCards) {
        const arr = snapshots[market.ticker] || [];
        if (arr.length < 2) continue;
        const change = Math.abs(arr[arr.length - 1].p - arr[0].p);
        if (change >= 5) {
            bigMovers++;
            if (change > Math.abs(biggestMove.change)) {
                biggestMove = { ticker: market.ticker, change: arr[arr.length - 1].p - arr[0].p, question: market.question };
            }
        }
    }

    // Count arbitrage opportunities
    const arbCount = document.querySelectorAll('.arb-card').length;

    // Build recap
    const parts = [];
    parts.push(`<span class="recap-time">Since ${timeAgo} ago</span>`);
    if (bigMovers > 0) {
        parts.push(`<span class="recap-stat">🔥 ${bigMovers} market${bigMovers > 1 ? 's' : ''} moved 5¢+</span>`);
    }
    if (biggestMove.question) {
        const dir = biggestMove.change > 0 ? '📈' : '📉';
        const name = shortenTitle(biggestMove.question);
        parts.push(`<span class="recap-stat">${dir} ${name}: ${biggestMove.change > 0 ? '+' : ''}${biggestMove.change}¢</span>`);
    }
    if (arbCount > 0) {
        parts.push(`<span class="recap-stat">💰 ${arbCount} arbitrage opportunit${arbCount > 1 ? 'ies' : 'y'}</span>`);
    }

    if (bigMovers === 0 && arbCount === 0) return; // Nothing interesting to show

    banner.innerHTML = `
        <div class="recap-content">
            ${parts.join('<span class="recap-sep">·</span>')}
        </div>
        <button class="recap-close" onclick="this.closest('.recap-banner').style.display='none'">✕</button>
    `;
    banner.style.display = 'flex';
}

// Hook recap into loadMarkets
const _origLoadMarkets2 = loadMarkets;
loadMarkets = async function() {
    await _origLoadMarkets2();
    if (firstLoad === false) {
        // Show recap on first successful load
        showRecapBanner();
    }
    // Update accuracy stat
    const acc = calculateAccuracy();
    const accEl = document.getElementById('accuracy-stat');
    if (accEl && acc !== null) {
        accEl.textContent = acc + '%';
        const stats = getAccuracyStats();
        if (stats.total > 0) {
            accEl.title = `${stats.correct}/${stats.total} signals correct (${stats.pending} pending)`;
        }
    }
};

// ── SYGNAL SCORE EXPLAINER ──
if (localStorage.getItem('sygnal-explainer-dismissed') === 'true') {
    const expl = document.getElementById('sygnal-explainer');
    if (expl) expl.style.display = 'none';
}

// ── KEYBOARD SHORTCUTS ──
document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

    const tabs = ['markets', 'trending', 'bot', 'portfolio', 'arbitrage', 'correlations'];
    const links = document.querySelectorAll('.nav-links a');

    if (e.key >= '1' && e.key <= '6') {
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


// ── SYGNAL AI CHAT WIDGET ──
function toggleSygnalChat() {
    const chat = document.getElementById('sygnal-chat');
    const btn = document.getElementById('sygnal-chat-btn');
    if (chat.style.display === 'none') {
        chat.style.display = 'flex';
        btn.style.display = 'none';
        document.getElementById('chat-input').focus();
    } else {
        chat.style.display = 'none';
        btn.style.display = 'flex';
    }
}

function sendChatMsg() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';

    const msgs = document.getElementById('chat-messages');
    msgs.innerHTML += `<div class="chat-msg user">${escapeHtml(msg)}</div>`;
    msgs.innerHTML += `<div class="chat-msg bot" id="chat-thinking">Thinking...</div>`;
    msgs.scrollTop = msgs.scrollHeight;

    setTimeout(() => {
        const response = processChatQuery(msg);
        const thinking = document.getElementById('chat-thinking');
        if (thinking) thinking.outerHTML = `<div class="chat-msg bot">${response}</div>`;
        msgs.scrollTop = msgs.scrollHeight;
    }, 300);
}

function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function processChatQuery(query) {
    const q = query.toLowerCase();

    // Best trades / what to trade
    if (q.includes('best trade') || q.includes('what should i') || q.includes('top market') || q.includes('what to trade')) {
        const topCards = allMarketCards
            .map(c => ({ m: c.market, score: calcSygnalScore(c.market, 0), sig: getSygnalSignal(c.market.ticker) }))
            .filter(c => c.sig.signal !== 'HOLD')
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
        if (topCards.length === 0) return "No strong signals right now. All markets are showing HOLD. Check back after the next refresh.";
        let html = "Here are the top opportunities right now:<br><br>";
        for (const c of topCards) {
            const sigColor = c.sig.signal.includes('YES') ? '#00d68f' : '#ff3b5c';
            const sigBg = c.sig.signal.includes('YES') ? 'rgba(0,214,143,0.15)' : 'rgba(255,59,92,0.15)';
            html += `<b>${c.m.question}</b><br>`;
            html += `YES ${c.m.yes}¢ · Sygnal ${c.score} · <span class="chat-signal" style="color:${sigColor};background:${sigBg};">${c.sig.signal}</span><br><br>`;
        }
        return html;
    }

    // Bot status
    if (q.includes('bot') || q.includes('kalshi') || q.includes('trading bot')) {
        return fetchBotStatusForChat();
    }

    // Arbitrage
    if (q.includes('arbitrage') || q.includes('arb') || q.includes('price difference')) {
        const xpCount = Object.keys(_crossPlatformMap).length / 2;
        if (xpCount === 0) return "No cross-platform price differences detected right now. The arbitrage scanner checks every refresh.";
        return `Found <b>${Math.round(xpCount)}</b> cross-platform matches. Switch to the <b>Arbitrage</b> tab to see price differences between Kalshi and Polymarket.`;
    }

    // Sygnal score explanation
    if (q.includes('sygnal score') || q.includes('how does scoring') || q.includes('what is sygnal')) {
        return "The Sygnal Score (0-99) rates how tradeable a market is using 5 factors:<br><br>" +
            "<b>Price Position (0-20)</b> — best at 25¢/75¢<br>" +
            "<b>Volume (0-20)</b> — more trading = reliable<br>" +
            "<b>Momentum (0-20)</b> — price moving fast<br>" +
            "<b>Cross-Platform Edge (0-20)</b> — Kalshi vs Polymarket gap<br>" +
            "<b>Liquidity (0-19)</b> — can you trade easily<br><br>" +
            "Each card also shows a <b>BUY YES / BUY NO / LEAN / HOLD</b> signal.";
    }

    // Search for specific market
    if (q.includes('bitcoin') || q.includes('btc') || q.includes('crypto') || q.includes('ethereum') || q.includes('eth')) {
        return searchMarketChat(q, 'crypto');
    }
    if (q.includes('trump') || q.includes('election') || q.includes('president') || q.includes('politics')) {
        return searchMarketChat(q, 'politics');
    }
    if (q.includes('weather') || q.includes('rain') || q.includes('temperature')) {
        return searchMarketChat(q, 'weather');
    }

    // Accuracy / track record
    if (q.includes('accuracy') || q.includes('track record') || q.includes('win rate') || q.includes('how good')) {
        const stats = getAccuracyStats();
        if (stats.total === 0) return "Still building the track record. Signals are being tracked — accuracy will show after enough trades resolve (usually 1+ hours).";
        return `Signal track record: <b>${stats.pct}%</b> accuracy (${stats.correct}/${stats.total} correct). Currently <b>${stats.pending}</b> signals pending resolution.`;
    }

    // Market count / overview
    if (q.includes('how many') || q.includes('market count') || q.includes('overview')) {
        const total = allMarketCards.length;
        const signals = allMarketCards.filter(c => getSygnalSignal(c.market.ticker).signal !== 'HOLD').length;
        return `Tracking <b>${total}</b> live markets across Kalshi & Polymarket. <b>${signals}</b> have active BUY/LEAN signals right now.`;
    }

    // Generic search
    const found = allMarketCards.find(c => c.market.question.toLowerCase().includes(q.split(' ').slice(0, 3).join(' ')));
    if (found) {
        const m = found.market;
        const score = calcSygnalScore(m, 0);
        const sig = getSygnalSignal(m.ticker);
        const sigColor = sig.signal.includes('YES') ? '#00d68f' : sig.signal.includes('NO') ? '#ff3b5c' : '#f0b000';
        const sigBg = sig.signal.includes('YES') ? 'rgba(0,214,143,0.15)' : sig.signal.includes('NO') ? 'rgba(255,59,92,0.15)' : 'rgba(240,176,0,0.12)';
        return `<b>${m.question}</b><br>YES ${m.yes}¢ · NO ${m.no}¢<br>` +
            `Sygnal Score: <b>${score}</b> · <span class="chat-signal" style="color:${sigColor};background:${sigBg};">${sig.signal}</span><br>` +
            `Volume: $${(m.volume || 0).toLocaleString()}`;
    }

    return "I can help with:<br>• <b>\"best trades\"</b> — top signals right now<br>• <b>\"how is the bot doing\"</b> — Kalshi bot status<br>• <b>\"Bitcoin\"</b> or any topic — find markets<br>• <b>\"sygnal score\"</b> — how scoring works<br>• <b>\"accuracy\"</b> — signal track record";
}

function searchMarketChat(query, category) {
    const matches = allMarketCards
        .filter(c => {
            const cat = (c.market.category || categorize(c.market.question)).toLowerCase();
            return cat.includes(category);
        })
        .map(c => ({ m: c.market, score: calcSygnalScore(c.market, 0), sig: getSygnalSignal(c.market.ticker) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

    if (matches.length === 0) return `No ${category} markets found right now.`;
    let html = `Found ${matches.length} ${category} market${matches.length > 1 ? 's' : ''}:<br><br>`;
    for (const c of matches) {
        const sigColor = c.sig.signal.includes('YES') ? '#00d68f' : c.sig.signal.includes('NO') ? '#ff3b5c' : '#f0b000';
        const sigBg = c.sig.signal.includes('YES') ? 'rgba(0,214,143,0.15)' : c.sig.signal.includes('NO') ? 'rgba(255,59,92,0.15)' : 'rgba(240,176,0,0.12)';
        html += `<b>${c.m.question}</b><br>YES ${c.m.yes}¢ · Sygnal ${c.score} · <span class="chat-signal" style="color:${sigColor};background:${sigBg};">${c.sig.signal}</span><br><br>`;
    }
    return html;
}

let _botStatusCache = null;
let _botStatusTime = 0;
function fetchBotStatusForChat() {
    // Use cached if recent
    if (_botStatusCache && Date.now() - _botStatusTime < 60000) {
        return formatBotStatus(_botStatusCache);
    }
    // Fetch async and update
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);
    fetch('https://web-production-c8a5b.up.railway.app/api/bot/status', { signal: controller.signal })
        .then(r => r.json())
        .then(data => {
            _botStatusCache = data;
            _botStatusTime = Date.now();
            const thinking = document.querySelector('#chat-messages .chat-msg.bot:last-child');
            if (thinking && thinking.textContent === 'Checking bot status...') {
                thinking.innerHTML = formatBotStatus(data);
            }
        })
        .catch(() => {
            const thinking = document.querySelector('#chat-messages .chat-msg.bot:last-child');
            if (thinking && thinking.textContent === 'Checking bot status...') {
                thinking.innerHTML = "Bot is currently offline. Try again in a minute.";
            }
        });
    return 'Checking bot status...';
}

function formatBotStatus(data) {
    if (data.error) return "Bot is currently offline. Try again in a minute.";
    const balance = data.balance_cents != null ? (data.balance_cents / 100).toFixed(2) : '—';
    const equity = data.equity_cents != null ? (data.equity_cents / 100).toFixed(2) : '—';
    const status = data.running ? '<span style="color:#00d68f;">Running</span>' : '<span style="color:#ff3b5c;">Stopped</span>';
    const scans = data.scan_count || 0;
    const trades = data.trades_today || 0;
    const signals = data.signals_today || 0;
    return `<b>Kalshi Bot Status</b><br>` +
        `Status: ${status} · ${scans} scans today<br>` +
        `Balance: <b>$${balance}</b> · Equity: <b>$${equity}</b><br>` +
        `Trades today: <b>${trades}</b> · Signals evaluated: <b>${signals}</b><br>` +
        `Next scan: ${data.next_scan_at ? new Date(data.next_scan_at).toLocaleTimeString() : '—'}`;
}

// ── LIVE BOT FEED ──
let _lastFeedTradeId = null;
async function loadBotFeed() {
    try {
        const ac = new AbortController();
        setTimeout(() => ac.abort(), 5000);
        const resp = await fetch('https://web-production-c8a5b.up.railway.app/api/bot/trades?limit=8', { signal: ac.signal });
        if (!resp.ok) return;
        const data = await resp.json();
        if (!data.trades || data.trades.length === 0) return;

        // Show the feed panel
        document.getElementById('bot-feed').style.display = '';

        const container = document.getElementById('feed-trades');
        container.innerHTML = data.trades.map(t => {
            const title = t.ticker ? decodeTicker(t.ticker) : 'Unknown';
            const side = (t.side || 'yes').toLowerCase();
            const price = t.price_cents || 0;
            const time = t.ts ? new Date(t.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            const pnl = t.realized_pnl !== null ? (t.realized_pnl >= 0 ? `+$${t.realized_pnl.toFixed(2)}` : `-$${Math.abs(t.realized_pnl).toFixed(2)}`) : '';
            const pnlColor = t.realized_pnl > 0 ? '#00d68f' : t.realized_pnl < 0 ? '#ff3b5c' : '';
            return `<div class="feed-trade">
                <span class="feed-trade-side ${side}">${side.toUpperCase()}</span>
                <span class="feed-trade-title">${escapeHtml(title)}</span>
                <span class="feed-trade-price">${price}¢${pnl ? ` <span style="color:${pnlColor}">${pnl}</span>` : ''}</span>
                <span class="feed-trade-time">${time}</span>
            </div>`;
        }).join('');

        // Check for new trade and show notification
        if (_lastFeedTradeId && data.trades[0].order_id !== _lastFeedTradeId) {
            const t = data.trades[0];
            showToast(`Bot traded: ${(t.side || '').toUpperCase()} at ${t.price_cents}¢`);
        }
        _lastFeedTradeId = data.trades[0].order_id;
    } catch {}
}

// Load bot feed on page load and refresh every 2 minutes
loadBotFeed();
setInterval(loadBotFeed, 120000);

// ── SYGNAL LEAGUES ──
function getISOWeek(d) {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getLeagueData() {
    try { return JSON.parse(localStorage.getItem('sygnal-leagues') || '{}'); }
    catch { return {}; }
}
function saveLeagueData(data) {
    localStorage.setItem('sygnal-leagues', JSON.stringify(data));
}

function initLeagueWeek() {
    const league = getLeagueData();
    const thisWeek = getISOWeek(new Date());
    if (!league.weeks) league.weeks = {};
    if (!league.username) league.username = 'You';

    if (league.currentWeek !== thisWeek) {
        // Close out old week
        if (league.currentWeek && league.weeks[league.currentWeek]) {
            const old = league.weeks[league.currentWeek];
            const portfolio = getPaperPortfolio();
            const currentVal = portfolio.balance + (portfolio.trades || []).filter(t => !t.settled).reduce((s, t) => s + t.cost, 0);
            old.finalReturn = old.startBalance > 0 ? ((currentVal - old.startBalance) / old.startBalance * 100) : 0;
            old.endBalance = currentVal;
        }
        // Start new week
        const portfolio = getPaperPortfolio();
        const startBal = portfolio.balance + (portfolio.trades || []).filter(t => !t.settled).reduce((s, t) => s + t.cost, 0);
        league.weeks[thisWeek] = {
            startBalance: startBal,
            startTimestamp: Date.now(),
            picks: [],
            snapshots: [],
            finalReturn: null
        };
        league.currentWeek = thisWeek;
    }
    saveLeagueData(league);
}

function recordLeagueSnapshot() {
    const league = getLeagueData();
    if (!league.currentWeek || !league.weeks[league.currentWeek]) return;
    const week = league.weeks[league.currentWeek];
    const portfolio = getPaperPortfolio();
    const currentVal = portfolio.balance + (portfolio.trades || []).filter(t => !t.settled).reduce((s, t) => s + t.cost, 0);
    week.snapshots.push({ t: Date.now(), v: currentVal });
    if (week.snapshots.length > 200) week.snapshots = week.snapshots.slice(-200);
    saveLeagueData(league);
}

function getLeagueReturn(weekData) {
    if (!weekData || !weekData.startBalance) return 0;
    if (weekData.finalReturn != null) return weekData.finalReturn;
    const portfolio = getPaperPortfolio();
    const currentVal = portfolio.balance + (portfolio.trades || []).filter(t => !t.settled).reduce((s, t) => s + t.cost, 0);
    return ((currentVal - weekData.startBalance) / weekData.startBalance * 100);
}

function generateBotCompetitors(weekKey) {
    // Deterministic pseudo-random from week key
    let seed = 0;
    for (let i = 0; i < weekKey.length; i++) seed = ((seed << 5) - seed) + weekKey.charCodeAt(i);
    const rand = (min, max) => { seed = (seed * 16807 + 0) % 2147483647; return min + (seed % 1000) / 1000 * (max - min); };

    return [
        { name: 'SignalTrader_42', ret: rand(-8, 18), badge: '#0088ff' },
        { name: 'SygnalWhale', ret: rand(-5, 25), badge: '#8b5cf6' },
        { name: 'MarketBot_AI', ret: rand(-12, 15), badge: '#00d68f' },
        { name: 'NightOwlBets', ret: rand(-10, 12), badge: '#f0b000' },
        { name: 'ArbHunter', ret: rand(-6, 20), badge: '#ff3b5c' },
    ];
}

function buildLeaguePanel() {
    const thisWeek = getISOWeek(new Date());
    initLeagueWeek();
    const league = getLeagueData();

    const weekData = league.weeks[thisWeek];
    const myReturn = getLeagueReturn(weekData);
    const portfolio = getPaperPortfolio();
    const currentVal = portfolio.balance + (portfolio.trades || []).filter(t => !t.settled).reduce((s, t) => s + t.cost, 0);
    const picks = weekData ? weekData.picks || [] : [];

    // Week label
    document.getElementById('league-week-label').textContent = thisWeek;

    // Stats row
    document.getElementById('league-stats-row').innerHTML = `
        <div class="league-stat">
            <div class="league-stat-value">$${currentVal.toFixed(0)}</div>
            <div class="league-stat-label">PORTFOLIO</div>
        </div>
        <div class="league-stat">
            <div class="league-stat-value ${myReturn >= 0 ? 'positive' : 'negative'}">${myReturn >= 0 ? '+' : ''}${myReturn.toFixed(1)}%</div>
            <div class="league-stat-label">WEEKLY RETURN</div>
        </div>
        <div class="league-stat">
            <div class="league-stat-value">${picks.length}</div>
            <div class="league-stat-label">PICKS</div>
        </div>
        <div class="league-stat">
            <div class="league-stat-value" id="league-rank">—</div>
            <div class="league-stat-label">RANK</div>
        </div>
    `;

    // Build leaderboard
    const bots = generateBotCompetitors(thisWeek);
    const entries = [
        { name: league.username || 'You', ret: myReturn, badge: '#0088ff', isYou: true },
        ...bots.map(b => ({ ...b, isYou: false }))
    ].sort((a, b) => b.ret - a.ret);

    const myRank = entries.findIndex(e => e.isYou) + 1;
    const rankEl = document.getElementById('league-rank');
    if (rankEl) rankEl.textContent = `#${myRank}`;

    const medals = ['🥇', '🥈', '🥉'];
    document.getElementById('league-leaderboard').innerHTML = entries.map((e, i) => `
        <div class="league-row ${e.isYou ? 'you' : ''}">
            <span class="league-rank-num">${medals[i] || (i + 1)}</span>
            <span class="league-avatar" style="background:${e.badge};">${e.name.charAt(0).toUpperCase()}</span>
            <span class="league-name">${escapeHtml(e.name)}${e.isYou ? ' <span style="font-size:10px;color:var(--accent);">(you)</span>' : ''}</span>
            <span class="league-return ${e.ret >= 0 ? 'positive' : 'negative'}">${e.ret >= 0 ? '+' : ''}${e.ret.toFixed(1)}%</span>
        </div>
    `).join('');

    // Picks this week
    if (picks.length === 0) {
        document.getElementById('league-picks').innerHTML = '<p style="color:var(--text-dim);font-size:13px;">No picks yet this week. Open any market and place a paper trade to compete!</p>';
    } else {
        document.getElementById('league-picks').innerHTML = picks.map(p => `
            <div class="league-pick">
                <span class="feed-trade-side ${(p.side || 'yes').toLowerCase()}">${(p.side || 'YES').toUpperCase()}</span>
                <span style="flex:1;font-size:13px;">${escapeHtml(shortenTitle(p.question))}</span>
                <span style="font-size:11px;color:var(--text-dim);">${new Date(p.timestamp).toLocaleDateString()}</span>
            </div>
        `).join('');
    }

    // Past weeks
    const pastWeeks = Object.keys(league.weeks || {}).filter(w => w !== thisWeek).sort().reverse().slice(0, 8);
    if (pastWeeks.length === 0) {
        document.getElementById('league-history').innerHTML = '<p style="color:var(--text-dim);font-size:13px;">No past weeks yet. Your history will appear after the first week ends.</p>';
    } else {
        document.getElementById('league-history').innerHTML = pastWeeks.map(w => {
            const wd = league.weeks[w];
            const ret = wd.finalReturn != null ? wd.finalReturn : 0;
            const picks = (wd.picks || []).length;
            return `<div class="league-history-row">
                <span class="league-history-week">${w}</span>
                <span style="font-size:12px;color:var(--text-dim);">${picks} picks</span>
                <span class="league-return ${ret >= 0 ? 'positive' : 'negative'}">${ret >= 0 ? '+' : ''}${ret.toFixed(1)}%</span>
            </div>`;
        }).join('');
    }
}

// Hook leagues into paper trading
const _origPlacePaperTradeLeague = placePaperTrade;
placePaperTrade = function() {
    _origPlacePaperTradeLeague();
    const league = getLeagueData();
    if (!league.currentWeek || !league.weeks[league.currentWeek]) return;
    const week = league.weeks[league.currentWeek];
    if (typeof currentDetailMarket !== 'undefined' && currentDetailMarket) {
        week.picks.push({
            ticker: currentDetailMarket.ticker,
            question: currentDetailMarket.question,
            side: document.getElementById('paper-side')?.value || 'yes',
            timestamp: Date.now(),
        });
        saveLeagueData(league);
    }
};

// Hook league tracking into market refresh cycle
const _origRecordPortfolioSnapshot = recordPortfolioSnapshot;
recordPortfolioSnapshot = function() {
    _origRecordPortfolioSnapshot();
    initLeagueWeek();
    recordLeagueSnapshot();
};

// ── WEEKLY RECAP ──
async function loadWeeklyRecap() {
    try {
        const resp = await fetch((API_BASE || '') + '/api/recap');
        if (!resp.ok) return;
        const recap = await resp.json();

        const container = document.getElementById('ai-brief');
        if (!container) return;

        const interesting = recap.interesting || [];
        let marketsHtml = interesting.slice(0, 4).map(m => {
            const sig = m.yes >= 70 ? 'BUY YES' : (m.yes <= 30 ? 'BUY NO' : 'WATCH');
            const sigColor = m.yes >= 70 ? '#00d68f' : (m.yes <= 30 ? '#ff3b5c' : '#f0b000');
            const vol = m.volume ? '$' + Math.round(m.volume).toLocaleString() : '';
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
                <span style="font-size:13px;color:var(--text);flex:1;">${shortenTitle(m.question)}</span>
                <span style="font-size:14px;font-weight:700;color:${sigColor};margin-left:8px;">${m.yes}¢ <span style="font-size:10px;">${sig}</span></span>
            </div>`;
        }).join('');

        const cats = recap.categories || {};
        const catHtml = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 4)
            .map(([c, n]) => `<span style="font-size:11px;color:var(--text-dim);margin-right:10px;">${c}: ${n}</span>`).join('');

        container.innerHTML = `
            <div class="brief-card">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <h3 style="margin:0;font-size:15px;">Weekly Recap — ${recap.date}</h3>
                    <button onclick="shareRecap()" style="background:rgba(0,136,255,0.1);color:var(--accent);border:1px solid rgba(0,136,255,0.2);border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;">Share</button>
                </div>
                <div style="display:flex;gap:16px;margin-bottom:14px;flex-wrap:wrap;">
                    <span style="font-size:12px;color:var(--accent);font-weight:700;">${recap.total_markets} markets</span>
                    <span style="font-size:12px;color:var(--text-dim);">${recap.kalshi_count} Kalshi</span>
                    <span style="font-size:12px;color:var(--text-dim);">${recap.poly_count} Polymarket</span>
                    <span style="font-size:12px;color:#f0b000;">${recap.arbitrage_count} arb opps</span>
                </div>
                <div style="margin-bottom:10px;">${marketsHtml}</div>
                <div style="margin-top:8px;">${catHtml}</div>
            </div>`;

        // Store recap text for sharing
        window._recapShareText = recap.share_text;
    } catch {}
}

function shareRecap() {
    const text = window._recapShareText || 'Check out Sygnal Markets — cross-platform prediction market analytics\nhttps://sygnalmarkets.com';
    if (navigator.share) {
        navigator.share({ title: 'Sygnal Weekly Recap', text }).catch(() => {});
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => showToast('Recap copied!'));
    }
}

// ── SYGNAL PRO ──
function isPro() {
    return localStorage.getItem('sygnal-pro') === 'true';
}

function exportSignalHistory() {
    if (!isPro()) { showProUpsell('Signal History Export'); return; }
    const snapshots = JSON.parse(localStorage.getItem('sygnal-snapshots') || '{}');
    let csv = 'Ticker,Timestamp,Price,Score,Signal\n';
    for (const [ticker, entries] of Object.entries(snapshots)) {
        for (const e of entries) {
            csv += `${ticker},${new Date(e.t).toISOString()},${e.p},${e.s || ''},${e.sig || ''}\n`;
        }
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sygnal-signals-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Signal history exported!');
}

function showProUpsell(feature) {
    const existing = document.querySelector('.pro-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'pro-modal';
    modal.innerHTML = `
        <div class="pro-modal-content">
            <div style="font-size:10px;letter-spacing:3px;color:var(--accent);font-weight:700;margin-bottom:8px;">SYGNAL PRO</div>
            <h3 style="margin:0 0 8px;font-size:18px;color:var(--text);">${feature || 'Unlock Premium Features'}</h3>
            <p style="color:var(--text-dim);font-size:13px;margin:0 0 16px;line-height:1.5;">Get access to AI Analysis, Signal History Export, Custom Push Alerts, and Priority Data Refresh.</p>
            <div style="font-size:24px;font-weight:800;color:var(--text);margin-bottom:16px;">$9.99<span style="font-size:13px;color:var(--text-dim);font-weight:400;">/month</span></div>
            <button class="pro-btn" onclick="startProCheckout()">Upgrade to Pro</button>
            <button onclick="this.closest('.pro-modal').remove()" style="background:none;border:none;color:var(--text-dim);font-size:12px;cursor:pointer;margin-top:10px;">Maybe later</button>
        </div>
    `;
    document.body.appendChild(modal);
}

async function startProCheckout() {
    try {
        const resp = await fetch((API_BASE || '') + '/api/pro/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        const data = await resp.json();
        if (data.url) {
            window.open(data.url, '_blank');
        } else {
            showToast(data.error || 'Stripe not configured yet — coming soon!');
        }
    } catch {
        showToast('Pro subscriptions coming soon!');
    }
    const modal = document.querySelector('.pro-modal');
    if (modal) modal.remove();
}

// Check for pro=success in URL
if (window.location.search.includes('pro=success')) {
    localStorage.setItem('sygnal-pro', 'true');
    showToast('Welcome to Sygnal Pro!');
    history.replaceState({}, '', '/');
}

// ── SYGNAL AUTOPILOT ──
async function loadAutopilotAlerts() {
    try {
        const resp = await fetch((API_BASE || '') + '/api/autopilot/alerts?limit=10');
        if (!resp.ok) return;
        const data = await resp.json();
        window._autopilotAlerts = data.alerts || [];
    } catch {}
}

function showAutopilotPanel() {
    const alerts = window._autopilotAlerts || [];
    const existing = document.querySelector('.autopilot-panel');
    if (existing) { existing.remove(); return; }

    const severityColors = { high: '#ff3b5c', medium: '#f0b000', low: '#5a5a6e' };
    const typeIcons = { price_move: '📈', momentum: '⚡', score_spike: '🎯', arbitrage: '💰' };

    const alertsHtml = alerts.length === 0
        ? '<p style="color:var(--text-dim);font-size:13px;text-align:center;padding:20px;">No alerts yet. Autopilot scans every 5 minutes.</p>'
        : alerts.map(a => `
            <div class="autopilot-alert" style="border-left:3px solid ${severityColors[a.severity] || '#5a5a6e'};">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:13px;font-weight:600;color:var(--text);">${typeIcons[a.type] || '📊'} ${a.title}</span>
                    <span style="font-size:10px;color:var(--text-dim);">${new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p style="margin:4px 0 0;font-size:12px;color:var(--text-mid);line-height:1.4;">${a.message}</p>
            </div>
        `).join('');

    const panel = document.createElement('div');
    panel.className = 'autopilot-panel';
    panel.innerHTML = `
        <div class="autopilot-header">
            <div>
                <span style="font-size:10px;letter-spacing:2px;color:var(--accent);font-weight:700;">SYGNAL AUTOPILOT</span>
                ${isPro() ? '<span style="font-size:9px;color:#00d68f;margin-left:8px;font-weight:700;">PRO</span>' : '<span style="font-size:9px;color:#f0b000;margin-left:8px;font-weight:700;">FREE (delayed)</span>'}
            </div>
            <button onclick="this.closest('.autopilot-panel').remove()" style="background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer;">×</button>
        </div>
        <div class="autopilot-alerts">${alertsHtml}</div>
        ${!isPro() ? '<div style="padding:12px;text-align:center;border-top:1px solid var(--border);"><button onclick="showProUpsell(\'Real-time Autopilot Alerts\')" style="background:var(--accent);color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:12px;font-weight:700;cursor:pointer;">Upgrade for Real-time Alerts</button></div>' : ''}
        <div style="padding:8px 12px;text-align:center;border-top:1px solid var(--border);">
            <button onclick="triggerAutopilotScan()" style="background:rgba(0,136,255,0.1);color:var(--accent);border:1px solid rgba(0,136,255,0.2);border-radius:6px;padding:6px 14px;font-size:11px;cursor:pointer;">Scan Now</button>
        </div>
    `;
    document.body.appendChild(panel);
}

async function triggerAutopilotScan() {
    showToast('Scanning markets...');
    try {
        const resp = await fetch((API_BASE || '') + '/api/autopilot/scan');
        const data = await resp.json();
        showToast(`Found ${data.alert_count} alerts across ${data.scanned_markets} markets`);
        await loadAutopilotAlerts();
        // Refresh the panel
        const panel = document.querySelector('.autopilot-panel');
        if (panel) { panel.remove(); showAutopilotPanel(); }
    } catch {
        showToast('Scan failed — try again');
    }
}

// Load alerts on page load
loadAutopilotAlerts();

// ══════════════════════════════════════════════
// FEATURE 1: PERFORMANCE DASHBOARD
// ══════════════════════════════════════════════
let _botTradesCache = [];
let _tradeHistoryOffset = 0;

async function loadBotPerformance() {
    try {
        const resp = await fetch(API_BASE + '/api/bot/trades?limit=100');
        if (!resp.ok) return;
        const data = await resp.json();
        _botTradesCache = data.trades || data || [];
        renderPerfStats();
        drawEquityChart();
        renderTradeHistory(_botTradesCache);
    } catch(e) { console.log('Bot perf unavailable'); }
}

function renderPerfStats() {
    const trades = _botTradesCache;
    if (!trades.length) return;
    const wins = trades.filter(t => (t.realized_pnl || t.pnl || 0) > 0).length;
    const losses = trades.filter(t => (t.realized_pnl || t.pnl || 0) < 0).length;
    const totalPnl = trades.reduce((s, t) => s + (t.realized_pnl || t.pnl || 0), 0);
    const winRate = trades.length > 0 ? ((wins / trades.length) * 100).toFixed(0) : 0;
    const avgWin = wins > 0 ? (trades.filter(t => (t.realized_pnl || t.pnl || 0) > 0).reduce((s, t) => s + (t.realized_pnl || t.pnl || 0), 0) / wins).toFixed(2) : '0.00';
    const avgLoss = losses > 0 ? (trades.filter(t => (t.realized_pnl || t.pnl || 0) < 0).reduce((s, t) => s + Math.abs(t.realized_pnl || t.pnl || 0), 0) / losses).toFixed(2) : '0.00';

    const el = document.getElementById('perf-stats-row');
    if (!el) return;
    el.innerHTML = `
        <div class="perf-stat"><span class="perf-stat-val ${totalPnl >= 0 ? 'positive' : 'negative'}">${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}</span><span class="perf-stat-label">Total P&L</span></div>
        <div class="perf-stat"><span class="perf-stat-val">${winRate}%</span><span class="perf-stat-label">Win Rate</span></div>
        <div class="perf-stat"><span class="perf-stat-val">${trades.length}</span><span class="perf-stat-label">Total Trades</span></div>
        <div class="perf-stat"><span class="perf-stat-val positive">$${avgWin}</span><span class="perf-stat-label">Avg Win</span></div>
        <div class="perf-stat"><span class="perf-stat-val negative">$${avgLoss}</span><span class="perf-stat-label">Avg Loss</span></div>
        <div class="perf-stat"><span class="perf-stat-val">${wins}W / ${losses}L</span><span class="perf-stat-label">Record</span></div>
    `;
}

function drawEquityChart() {
    const canvas = document.getElementById('equity-chart');
    if (!canvas || !_botTradesCache.length) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Build cumulative P&L curve
    const trades = [..._botTradesCache].reverse();
    let cumPnl = 0;
    const points = [0];
    for (const t of trades) {
        cumPnl += (t.realized_pnl || t.pnl || 0);
        points.push(cumPnl);
    }

    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const pad = 20;

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
        const y = pad + (i / 4) * (h - pad * 2);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Zero line
    const zeroY = h - pad - ((0 - min) / range) * (h - pad * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(0, zeroY); ctx.lineTo(w, zeroY); ctx.stroke();
    ctx.setLineDash([]);

    // Equity curve
    const trending = points[points.length - 1] >= 0;
    const color = trending ? '0, 214, 143' : '255, 59, 92';
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
        const x = (i / (points.length - 1)) * w;
        const y = h - pad - ((points[i] - min) / range) * (h - pad * 2);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(${color}, 0.9)`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Fill
    const lastX = w, lastY = h - pad - ((points[points.length - 1] - min) / range) * (h - pad * 2);
    ctx.lineTo(lastX, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `rgba(${color}, 0.15)`);
    grad.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = grad;
    ctx.fill();
}

// ══════════════════════════════════════════════
// FEATURE 2: NEWS FEED
// ══════════════════════════════════════════════
function buildNewsFeed() {
    const container = document.getElementById('news-feed-content');
    if (!container || !allMarketCards.length) return;

    // Generate contextual news items from market data
    const newsItems = [];
    const movers = allMarketCards.filter(c => Math.abs(getMarketChange(c.market.ticker)) >= 3).slice(0, 5);
    for (const c of movers) {
        const ch = getMarketChange(c.market.ticker);
        const dir = ch > 0 ? 'surges' : 'drops';
        newsItems.push({
            title: `${shortenTitle(c.market.question, 60)} ${dir} ${Math.abs(ch).toFixed(0)}¢`,
            tag: categorize(c.market.question || c.market.title || ''),
            time: 'Live',
            color: ch > 0 ? 'var(--green)' : 'var(--red)',
            ticker: c.market.ticker
        });
    }

    // High score markets
    const highScore = allMarketCards.filter(c => calcSygnalScore(c.market, 0) >= 80).slice(0, 3);
    for (const c of highScore) {
        newsItems.push({
            title: `${shortenTitle(c.market.question, 60)} hits Sygnal Score ${calcSygnalScore(c.market, 0)}`,
            tag: 'signal',
            time: 'Now',
            color: 'var(--green)',
            ticker: c.market.ticker
        });
    }

    // Arbitrage opportunities
    const arbs = findArbitrage ? findArbitrage(lastKalshiMarkets || [], lastPolyMarkets || []) : [];
    for (const arb of arbs.slice(0, 3)) {
        newsItems.push({
            title: `Arbitrage: ${shortenTitle(arb.question || arb.title || '?', 50)} — ${arb.spread || arb.diff || '?'}¢ spread`,
            tag: 'arbitrage',
            time: 'Live',
            color: 'var(--accent)'
        });
    }

    if (!newsItems.length) {
        container.innerHTML = '<p style="color:var(--text-dim);font-size:13px;">No notable market activity right now.</p>';
        return;
    }

    container.innerHTML = newsItems.map(n => `
        <div class="news-item" ${n.ticker ? `onclick="openDetail(allMarketCards.find(c=>c.market.ticker==='${n.ticker}')?.market)" style="cursor:pointer;"` : ''}>
            <span class="news-tag" style="color:${n.color}">${n.tag.toUpperCase()}</span>
            <span class="news-title">${n.title}</span>
            <span class="news-time">${n.time}</span>
        </div>
    `).join('');
}

// ══════════════════════════════════════════════
// FEATURE 3: WATCHLIST TARGET PRICE NOTIFICATIONS
// ══════════════════════════════════════════════
function checkWatchlistAlerts() {
    if (!notificationsEnabled) return;
    const wl = getWatchlist();
    const targets = JSON.parse(localStorage.getItem('sygnal-watchlist-targets') || '{}');

    for (const ticker of wl) {
        const card = allMarketCards.find(c => c.market.ticker === ticker);
        if (!card) continue;
        const target = targets[ticker];
        if (!target) continue;

        const price = card.market.yes;
        if (target.direction === 'above' && price >= target.value) {
            sendNotification(`${shortenTitle(card.market.question, 40)} hit ${price}¢`, `Target: above ${target.value}¢`, 'sygnal-wl-' + ticker);
            delete targets[ticker];
        } else if (target.direction === 'below' && price <= target.value) {
            sendNotification(`${shortenTitle(card.market.question, 40)} dropped to ${price}¢`, `Target: below ${target.value}¢`, 'sygnal-wl-' + ticker);
            delete targets[ticker];
        }
    }
    localStorage.setItem('sygnal-watchlist-targets', JSON.stringify(targets));
}

// ══════════════════════════════════════════════
// FEATURE 4: BOT TRADE HISTORY
// ══════════════════════════════════════════════
let _tradeHistFilter = 'all';

function renderTradeHistory(trades) {
    const el = document.getElementById('trade-history-table');
    if (!el) return;

    let filtered = trades;
    if (_tradeHistFilter === 'wins') filtered = trades.filter(t => (t.realized_pnl || t.pnl || 0) > 0);
    if (_tradeHistFilter === 'losses') filtered = trades.filter(t => (t.realized_pnl || t.pnl || 0) < 0);

    if (!filtered.length) {
        el.innerHTML = '<p style="color:var(--text-dim);font-size:13px;padding:12px;">No trades found.</p>';
        return;
    }

    el.innerHTML = filtered.slice(0, 20 + _tradeHistoryOffset).map(t => {
        const pnl = t.realized_pnl || t.pnl || 0;
        const pnlClass = pnl > 0 ? 'positive' : pnl < 0 ? 'negative' : '';
        const pnlStr = pnl >= 0 ? '+$' + pnl.toFixed(2) : '-$' + Math.abs(pnl).toFixed(2);
        const side = (t.side || '').toUpperCase();
        const title = t.title || decodeTicker(t.ticker || '?');
        const price = t.price ? (t.price * 100).toFixed(0) + '¢' : t.avg_price ? t.avg_price.toFixed(0) + '¢' : '—';
        const time = t.created_at || t.timestamp || '';
        const timeStr = time ? new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        return `<div class="trade-hist-row">
            <span class="trade-hist-side ${side.toLowerCase()}">${side}</span>
            <span class="trade-hist-title">${shortenTitle(title, 40)}</span>
            <span class="trade-hist-price">${price}</span>
            <span class="trade-hist-pnl ${pnlClass}">${pnlStr}</span>
            <span class="trade-hist-time">${timeStr}</span>
        </div>`;
    }).join('');
}

function filterTradeHistory(filter, btn) {
    _tradeHistFilter = filter;
    _tradeHistoryOffset = 0;
    document.querySelectorAll('.trade-hist-filters .chip').forEach(c => c.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderTradeHistory(_botTradesCache);
}

function loadMoreTrades() {
    _tradeHistoryOffset += 20;
    renderTradeHistory(_botTradesCache);
}

// ══════════════════════════════════════════════
// FEATURE 5: MULTI-TIMEFRAME CHARTS
// ══════════════════════════════════════════════
function getMultiTimeframeData(ticker) {
    const snapshots = JSON.parse(localStorage.getItem('sygnal-snapshots') || '{}');
    const allPrices = [];
    for (const [ts, markets] of Object.entries(snapshots)) {
        const m = (markets || []).find(x => x.ticker === ticker);
        if (m) allPrices.push({ ts: parseInt(ts), price: m.yes || m.price || 0 });
    }
    allPrices.sort((a, b) => a.ts - b.ts);

    const now = Date.now();
    return {
        '1h': allPrices.filter(p => now - p.ts < 3600000).map(p => p.price),
        '24h': allPrices.filter(p => now - p.ts < 86400000).map(p => p.price),
        '7d': allPrices.map(p => p.price),
    };
}

// ══════════════════════════════════════════════
// FEATURE 6: IMPROVED SOCIAL SHARING
// ══════════════════════════════════════════════
function getShareTrackRecord() {
    const record = getTrackRecord();
    const stats = getAccuracyStats();
    const totalPicks = record.length;
    const correctPicks = record.filter(r => r.correct).length;
    return {
        total: totalPicks,
        correct: correctPicks,
        accuracy: totalPicks > 0 ? ((correctPicks / totalPicks) * 100).toFixed(0) : 0,
        streak: stats.streak || 0,
    };
}

// ══════════════════════════════════════════════
// FEATURE 7: REAL BOT LEADERBOARD
// ══════════════════════════════════════════════
function getBotPerformanceForLeague() {
    const trades = _botTradesCache;
    if (!trades.length) return null;
    const totalPnl = trades.reduce((s, t) => s + (t.realized_pnl || t.pnl || 0), 0);
    const wins = trades.filter(t => (t.realized_pnl || t.pnl || 0) > 0).length;
    return {
        name: 'Your Bot',
        pnl: totalPnl,
        trades: trades.length,
        wins,
        winRate: trades.length > 0 ? ((wins / trades.length) * 100).toFixed(0) : 0,
    };
}

// ══════════════════════════════════════════════
// FEATURE 8: CUSTOM ALERTS ENGINE
// ══════════════════════════════════════════════
function getCustomAlertRules() {
    try { return JSON.parse(localStorage.getItem('sygnal-custom-alerts') || '[]'); }
    catch { return []; }
}

function saveCustomAlertRules(rules) {
    localStorage.setItem('sygnal-custom-alerts', JSON.stringify(rules));
}

function addCustomAlertRule() {
    const condition = document.getElementById('alert-condition')?.value;
    const threshold = parseFloat(document.getElementById('alert-threshold')?.value) || 0;
    const category = document.getElementById('alert-category')?.value || 'all';

    const rules = getCustomAlertRules();
    rules.push({ id: Date.now(), condition, threshold, category, enabled: true, created: new Date().toISOString() });
    saveCustomAlertRules(rules);
    renderAlertRules();
    showToast('Alert rule added');
}

function removeAlertRule(id) {
    const rules = getCustomAlertRules().filter(r => r.id !== id);
    saveCustomAlertRules(rules);
    renderAlertRules();
}

function toggleAlertRule(id) {
    const rules = getCustomAlertRules();
    const rule = rules.find(r => r.id === id);
    if (rule) rule.enabled = !rule.enabled;
    saveCustomAlertRules(rules);
    renderAlertRules();
}

function renderAlertRules() {
    const el = document.getElementById('custom-alert-rules');
    if (!el) return;
    const rules = getCustomAlertRules();

    if (!rules.length) {
        el.innerHTML = '<p style="color:var(--text-dim);font-size:13px;">No alert rules yet. Create one above.</p>';
        return;
    }

    el.innerHTML = rules.map(r => {
        const condLabel = {
            'score-above': `Score > ${r.threshold}`,
            'score-below': `Score < ${r.threshold}`,
            'price-above': `YES > ${r.threshold}¢`,
            'price-below': `YES < ${r.threshold}¢`,
            'change-up': `+${r.threshold}¢ move`,
            'change-down': `-${r.threshold}¢ drop`,
            'signal-buy': 'Signal: BUY YES',
            'signal-sell': 'Signal: BUY NO',
        }[r.condition] || r.condition;
        const catLabel = r.category === 'all' ? 'All Markets' : r.category;
        return `<div class="alert-rule ${r.enabled ? 'active' : 'disabled'}">
            <div class="alert-rule-info">
                <span class="alert-rule-cond">${condLabel}</span>
                <span class="alert-rule-cat">${catLabel}</span>
            </div>
            <div class="alert-rule-actions">
                <button class="alert-rule-toggle" onclick="toggleAlertRule(${r.id})">${r.enabled ? 'ON' : 'OFF'}</button>
                <button class="alert-rule-delete" onclick="removeAlertRule(${r.id})">✕</button>
            </div>
        </div>`;
    }).join('');
}

function evaluateCustomAlertRules() {
    if (!notificationsEnabled) return;
    const rules = getCustomAlertRules().filter(r => r.enabled);
    if (!rules.length) return;

    for (const card of allMarketCards) {
        const m = card.market;
        const score = calcSygnalScore(m, 0);
        const sig = getSygnalSignal(m.ticker);
        const change = getMarketChange(m.ticker);
        const cat = categorize(m.question || m.title || '');

        for (const rule of rules) {
            if (rule.category !== 'all' && cat !== rule.category) continue;

            let triggered = false;
            if (rule.condition === 'score-above' && score > rule.threshold) triggered = true;
            if (rule.condition === 'score-below' && score < rule.threshold) triggered = true;
            if (rule.condition === 'price-above' && m.yes > rule.threshold) triggered = true;
            if (rule.condition === 'price-below' && m.yes < rule.threshold) triggered = true;
            if (rule.condition === 'change-up' && change >= rule.threshold) triggered = true;
            if (rule.condition === 'change-down' && change <= -rule.threshold) triggered = true;
            if (rule.condition === 'signal-buy' && sig.signal === 'BUY YES') triggered = true;
            if (rule.condition === 'signal-sell' && sig.signal === 'BUY NO') triggered = true;

            if (triggered) {
                sendNotification(
                    `Alert: ${shortenTitle(m.question, 40)}`,
                    `Rule matched — YES ${m.yes}¢, Score ${score}`,
                    'sygnal-rule-' + rule.id + '-' + m.ticker
                );
            }
        }
    }
}

// ══════════════════════════════════════════════
// FEATURE 9: MARKET COMPARISON TOOL
// ══════════════════════════════════════════════
function buildComparePanel() {
    const el = document.getElementById('compare-grid');
    if (!el) return;

    // Find markets that exist on both platforms using cross-platform map
    const pairs = [];
    const seen = new Set();
    for (const card of allMarketCards) {
        const m = card.market;
        if (seen.has(m.ticker)) continue;

        // Find matching market on other platform
        const q = (m.question || m.title || '').toLowerCase();
        const match = allMarketCards.find(c => {
            if (c.market.ticker === m.ticker) return false;
            if (c.platform === card.platform) return false;
            const q2 = (c.market.question || c.market.title || '').toLowerCase();
            return q2 === q || (q.length > 20 && q2.includes(q.substring(0, 20)));
        });

        if (match) {
            seen.add(m.ticker);
            seen.add(match.market.ticker);
            const kalshiM = card.platform === 'kalshi' ? m : match.market;
            const polyM = card.platform === 'poly' ? m : match.market;
            const spread = Math.abs((kalshiM.yes || 0) - (polyM.yes || 0));
            pairs.push({ question: m.question || m.title, kalshi: kalshiM, poly: polyM, spread });
        }
    }

    // Also use the cross-platform map
    if (_crossPlatformMap) {
        for (const [ticker, xp] of Object.entries(_crossPlatformMap)) {
            if (seen.has(ticker)) continue;
            const card = allMarketCards.find(c => c.market.ticker === ticker);
            if (!card) continue;
            seen.add(ticker);
            pairs.push({
                question: card.market.question || card.market.title,
                kalshi: card.platform === 'kalshi' ? card.market : { yes: xp.otherYes, no: 100 - xp.otherYes, volume: '—' },
                poly: card.platform === 'poly' ? card.market : { yes: xp.otherYes, no: 100 - xp.otherYes, volume: '—' },
                spread: Math.abs(xp.priceDiff || 0)
            });
        }
    }

    pairs.sort((a, b) => b.spread - a.spread);

    if (!pairs.length) {
        el.innerHTML = '<p style="color:var(--text-dim);font-size:14px;">No cross-platform markets found. Markets must exist on both Kalshi and Polymarket to compare.</p>';
        return;
    }

    el.innerHTML = pairs.map(p => {
        const spreadColor = p.spread >= 5 ? 'var(--green)' : p.spread >= 2 ? 'var(--gold)' : 'var(--text-dim)';
        const kScore = calcSygnalScore(p.kalshi, 0);
        const pScore = calcSygnalScore(p.poly, 0);
        return `<div class="compare-card">
            <div class="compare-title">${shortenTitle(p.question, 60)}</div>
            <div class="compare-platforms">
                <div class="compare-platform kalshi">
                    <span class="compare-plat-name">KALSHI</span>
                    <span class="compare-plat-price">YES ${p.kalshi.yes || '?'}¢</span>
                    <span class="compare-plat-price dim">NO ${p.kalshi.no || '?'}¢</span>
                    <span class="compare-plat-vol">${typeof p.kalshi.volume === 'string' ? p.kalshi.volume : formatVol(p.kalshi.volume)}</span>
                </div>
                <div class="compare-spread">
                    <span class="compare-spread-val" style="color:${spreadColor}">${p.spread}¢</span>
                    <span class="compare-spread-label">SPREAD</span>
                </div>
                <div class="compare-platform poly">
                    <span class="compare-plat-name">POLYMARKET</span>
                    <span class="compare-plat-price">YES ${p.poly.yes || '?'}¢</span>
                    <span class="compare-plat-price dim">NO ${p.poly.no || '?'}¢</span>
                    <span class="compare-plat-vol">${typeof p.poly.volume === 'string' ? p.poly.volume : formatVol(p.poly.volume)}</span>
                </div>
            </div>
            ${p.spread >= 3 ? `<div class="compare-arb-badge">⚡ Arbitrage Opportunity — ${p.spread}¢ edge</div>` : ''}
        </div>`;
    }).join('');
}

function formatVol(v) {
    if (!v) return '—';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
    return '$' + v;
}

// ══════════════════════════════════════════════
// INIT ALL NEW FEATURES
// ══════════════════════════════════════════════
setTimeout(() => {
    loadBotPerformance();
    buildNewsFeed();
}, 3000);

// Run alert checks every 2 minutes
setInterval(() => {
    checkWatchlistAlerts();
    evaluateCustomAlertRules();
}, 120000);

// ── SERVICE WORKER (PWA) ──
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW registered:', reg.scope))
        .catch(err => console.warn('SW failed:', err));
}
