const CURRENCY_LABELS = {
    USD:   'Dólar americano',
    EUR:   'Euro',
    MLC:   'Moneda Lib. Conv.',
    CLA:   'Tarjeta Clásica',
    CAD:   'Dólar canadiense',
    MXN:   'Peso mexicano',
    ZELLE: 'Zelle',
    CUP:   'Peso cubano',
};

const Converter = {
    rates:        {},
    updated:      null,
    initialized:  false,
    _fromCur:     'USD',
    _toCur:       'CUP',
    _refreshing:  false,
    _timeInterval: null,

    async init() {
        if (!this.initialized) {
            // First open: show skeleton, fetch, render
            this.initialized = true;
            this._renderSkeleton();
            await this._loadRates();
            this._render();
        } else {
            // Subsequent opens: show existing data instantly, refresh silently
            this._silentRefresh();
        }
    },

    async _silentRefresh() {
        if (this._refreshing) return;
        this._refreshing = true;
        this._setRefreshIcon(true);
        const prevUpdated = this.updated;
        await this._loadRates();
        this._refreshing = false;
        if (this.updated !== prevUpdated) {
            this._render();
        } else {
            this._setRefreshIcon(false);
        }
    },

    async _manualRefresh() {
        if (this._refreshing) return;
        this._refreshing = true;
        this._setRefreshIcon(true);
        await this._loadRates();
        this._refreshing = false;
        this._render();
    },

    _setRefreshIcon(spinning) {
        const btn = document.getElementById('btn-refresh-rates');
        if (btn) btn.style.animation = spinning ? 'spin 1s linear infinite' : '';
    },

    startTimeTicker() {
        this.stopTimeTicker();
        this._timeInterval = setInterval(() => {
            const badge = document.querySelector('.rates-updated-text');
            if (badge && this.updated) {
                badge.textContent = `Actualizado ${this._timeAgo(this.updated)}`;
            }
        }, 60_000);
    },

    stopTimeTicker() {
        if (this._timeInterval) {
            clearInterval(this._timeInterval);
            this._timeInterval = null;
        }
    },

    async _loadRates() {
        try {
            const res = await fetch('./rates.json');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            this.rates   = data.rates || {};
            this.updated = data.updated || null;
        } catch (e) {
            this.rates   = {};
            this.updated = null;
        }
    },

    _headerHTML() {
        return `
            <div class="divisas-header">
                <button class="back-btn" onclick="showScreen('screen-calc')" aria-label="Volver">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                </button>
                <span class="divisas-title">Divisas</span>
                <button class="back-btn" id="btn-refresh-rates" onclick="Converter._manualRefresh()" aria-label="Actualizar tasas">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="23 4 23 10 17 10"/>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                    </svg>
                </button>
            </div>`;
    },

    _renderSkeleton() {
        const el = document.getElementById('divisas-content');
        if (!el) return;
        el.innerHTML = `
            ${this._headerHTML()}
            <div class="divisas-body">
                <div class="rates-updated skeleton-text">Cargando...</div>
                <div class="rates-grid skeleton-grid">
                    ${[...Array(6)].map(() => '<div class="rate-card rate-card--skeleton"></div>').join('')}
                </div>
            </div>
        `;
    },

    _render() {
        const el = document.getElementById('divisas-content');
        if (!el) return;

        const hasRates = Object.keys(this.rates).length > 0;
        const timeStr  = this.updated ? this._timeAgo(this.updated) : null;

        el.innerHTML = `
            ${this._headerHTML()}
            <div class="divisas-body">
                ${hasRates ? `
                    <div class="rates-updated">
                        <span class="rates-dot"></span>
                        <span class="rates-updated-text">${timeStr ? `Actualizado ${timeStr}` : 'Datos cargados'}</span>
                        <a class="rates-source" href="https://eltoque.com" target="_blank" rel="noopener">eltoque.com</a>
                    </div>
                    <div class="rates-grid">${this._renderCards()}</div>
                    <div class="converter-section">
                        <div class="converter-label">Convertir</div>
                        ${this._renderConverterHTML()}
                    </div>
                ` : `
                    <div class="rates-error">
                        <div style="font-size:2.5rem; margin-bottom:12px;">📡</div>
                        <p>Sin datos de tasa</p>
                        <p style="font-size:13px; color:#636366; margin-top:8px;">
                            Abre la app con conexión una vez para activar el modo offline.
                        </p>
                        <button class="retry-btn" onclick="Converter._retry()">Reintentar</button>
                    </div>
                `}
            </div>
        `;

        if (hasRates) {
            this._attachConverterEvents();
            this.startTimeTicker();
        }
    },

    _renderCards() {
        return Object.entries(this.rates).map(([code, rate]) => {
            const label = CURRENCY_LABELS[code] || code;
            const formatted = Number(rate).toLocaleString('es-CU', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
            return `
                <div class="rate-card">
                    <div class="rate-card__code">${code}</div>
                    <div class="rate-card__value">${formatted}</div>
                    <div class="rate-card__label">${label}</div>
                    <div class="rate-card__unit">CUP</div>
                </div>
            `;
        }).join('');
    },

    _renderConverterHTML() {
        const allCurrencies = ['CUP', ...Object.keys(this.rates)];

        const makeOptions = (selected) => allCurrencies.map(c =>
            `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`
        ).join('');

        return `
            <div class="converter-row">
                <input class="converter-input" id="conv-from-amount" type="number"
                    inputmode="decimal" placeholder="0" value="1">
                <select class="converter-select" id="conv-from-cur">
                    ${makeOptions(this._fromCur)}
                </select>
            </div>
            <button class="converter-swap" id="conv-swap" aria-label="Intercambiar monedas">⇅</button>
            <div class="converter-row">
                <input class="converter-input" id="conv-to-amount" type="text"
                    placeholder="0" readonly>
                <select class="converter-select" id="conv-to-cur">
                    ${makeOptions(this._toCur)}
                </select>
            </div>
        `;
    },

    _attachConverterEvents() {
        const fromAmount = document.getElementById('conv-from-amount');
        const fromCur    = document.getElementById('conv-from-cur');
        const toAmount   = document.getElementById('conv-to-amount');
        const toCur      = document.getElementById('conv-to-cur');
        const swapBtn    = document.getElementById('conv-swap');
        if (!fromAmount) return;

        const updateTo = () => {
            this._fromCur = fromCur.value;
            this._toCur   = toCur.value;
            const val = parseFloat(fromAmount.value);
            if (isNaN(val)) { toAmount.value = ''; toAmount.dataset.raw = ''; return; }
            const result = this._convert(val, fromCur.value, toCur.value);
            if (isFinite(result)) {
                // Store raw number for swap, display formatted string (type=text accepts any string)
                toAmount.dataset.raw = result;
                const decimals = result >= 100 ? 2 : result >= 1 ? 4 : 6;
                toAmount.value = result.toLocaleString('es', { maximumFractionDigits: decimals });
            } else {
                toAmount.value = '';
                toAmount.dataset.raw = '';
            }
        };

        fromAmount.addEventListener('input', updateTo);
        fromCur.addEventListener('change', updateTo);
        toCur.addEventListener('change', updateTo);

        swapBtn.addEventListener('click', () => {
            [this._fromCur, this._toCur] = [toCur.value, fromCur.value];
            // Use stored raw value — avoids misparse of locale-formatted strings
            const rawResult = parseFloat(toAmount.dataset.raw);
            fromAmount.value = isFinite(rawResult) ? rawResult : '';
            fromCur.value = this._fromCur;
            toCur.value   = this._toCur;
            updateTo();
        });

        // Initial calculation
        updateTo();
    },

    _convert(amount, from, to) {
        const ratesWithCUP = { ...this.rates, CUP: 1 };
        const fromRate = ratesWithCUP[from];
        const toRate   = ratesWithCUP[to];
        if (!fromRate || !toRate) return NaN;
        // Convert: amount (in `from`) → CUP → `to`
        return (amount * fromRate) / toRate;
    },

    _timeAgo(iso) {
        const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
        if (diff < 60)   return 'hace un momento';
        if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
        if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
        return `hace ${Math.floor(diff / 86400)} días`;
    },

    async _retry() {
        this.initialized = false;
        this.rates = {};
        await this.init();
    },
};
