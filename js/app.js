const calc = new Calculator();

// Pre-built lookup map: id → descriptor
const BUTTON_MAP = Object.fromEntries(BUTTON_LAYOUT.map(b => [b.id, b]));

// DOM refs (populated after buildDOM)
let displayEl, gridEl, clearBtn;

// ── Display font size thresholds ──────────────────────────────────────────────
const FONT_SIZES = [
    { maxLen: 6,  size: 'var(--display-font-xl)' },
    { maxLen: 9,  size: 'var(--display-font-lg)' },
    { maxLen: 12, size: 'var(--display-font-md)' },
    { maxLen: 999, size: 'var(--display-font-sm)' },
];

// ── Build DOM from config ─────────────────────────────────────────────────────
function buildDOM() {
    displayEl = document.getElementById('display-value');
    gridEl    = document.getElementById('btn-grid');
    clearBtn  = null;

    BUTTON_LAYOUT.forEach(desc => {
        const btn = document.createElement('button');
        btn.id        = desc.id;
        btn.className = `btn btn--${desc.type}${desc.wide ? ' btn--wide' : ''}`;
        btn.textContent = desc.label;
        btn.setAttribute('aria-label', desc.label);
        gridEl.appendChild(btn);

        if (desc.id === 'btn-clear') clearBtn = btn;
    });
}

// ── Render state to DOM ───────────────────────────────────────────────────────
function render(state) {
    displayEl.textContent = state.display;

    // Adaptive font size
    const raw = state.display.replace(/[,\s]/g, '');
    const len = raw.length;
    const entry = FONT_SIZES.find(f => len <= f.maxLen);
    displayEl.style.fontSize = entry.size;

    // AC / C toggle
    if (clearBtn) clearBtn.textContent = state.showClear ? 'C' : 'AC';

    // Highlight active operator
    document.querySelectorAll('.btn--operator').forEach(btn => {
        const desc = BUTTON_MAP[btn.id];
        const isActive = state.activeOperator && desc && desc.value === state.activeOperator;
        btn.classList.toggle('btn--active', !!isActive);
    });
}

// ── Event delegation ──────────────────────────────────────────────────────────
function attachEvents() {
    gridEl.addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const desc = BUTTON_MAP[btn.id];
        if (!desc) return;
        handleInput(desc.type, desc.value);
    });

    document.addEventListener('keydown', handleKeyboard);
}

function handleInput(type, value) {
    let state;
    switch (type) {
        case 'number':   state = calc.inputDigit(value); break;
        case 'decimal':  state = calc.inputDecimal(); break;
        case 'operator': state = calc.inputOperator(value); break;
        case 'equals':   state = calc.calculate(); break;
        case 'utility':
            if (value === 'AC' || value === 'C') state = calc.clear();
            else if (value === '±')              state = calc.toggleSign();
            else if (value === '%')              state = calc.inputPercent();
            break;
    }
    if (state) render(state);
}

// ── Keyboard support ──────────────────────────────────────────────────────────
const KEY_MAP = {
    '0': ['number', '0'], '1': ['number', '1'], '2': ['number', '2'],
    '3': ['number', '3'], '4': ['number', '4'], '5': ['number', '5'],
    '6': ['number', '6'], '7': ['number', '7'], '8': ['number', '8'],
    '9': ['number', '9'], '.': ['decimal', '.'], ',': ['decimal', '.'],
    '+': ['operator', '+'], '-': ['operator', '-'],
    '*': ['operator', '*'], 'x': ['operator', '*'], 'X': ['operator', '*'],
    '/': ['operator', '/'], 'Enter': ['equals', '='], '=': ['equals', '='],
    'Escape': ['utility', 'AC'], 'Backspace': ['utility', 'AC'],
    '%': ['utility', '%'],
};

function handleKeyboard(e) {
    const mapping = KEY_MAP[e.key];
    if (!mapping) return;
    e.preventDefault();

    // Visual feedback: flash the corresponding button
    const desc = BUTTON_LAYOUT.find(b => b.value === mapping[1] && b.type === mapping[0]);
    if (desc) {
        const btn = document.getElementById(desc.id);
        if (btn) {
            btn.style.filter = 'brightness(1.4)';
            setTimeout(() => (btn.style.filter = ''), 100);
        }
    }

    handleInput(mapping[0], mapping[1]);
}

// ── Service Worker registration ───────────────────────────────────────────────
function registerSW() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('./sw.js').then(reg => {
        const checkWorker = worker => {
            worker.addEventListener('statechange', () => {
                if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                    showUpdateBanner(reg);
                }
            });
        };

        reg.addEventListener('updatefound', () => checkWorker(reg.installing));
        if (reg.waiting) showUpdateBanner(reg);
    }).catch(() => {});

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
    });
}

function showUpdateBanner(registration) {
    const banner = document.getElementById('update-banner');
    if (!banner || banner.classList.contains('visible')) return;
    banner.classList.add('visible');

    document.getElementById('update-now-btn').addEventListener('click', () => {
        if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
    });

    document.getElementById('dismiss-update-btn').addEventListener('click', () => {
        banner.classList.remove('visible');
    });
}

// ── Offline indicator ─────────────────────────────────────────────────────────
function setupOfflineIndicator() {
    const update = () => document.body.classList.toggle('is-offline', !navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    buildDOM();
    render(calc.getState());
    attachEvents();
    registerSW();
    setupOfflineIndicator();
});
