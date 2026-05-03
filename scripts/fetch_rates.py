import re
import json
import sys
import datetime
import requests

URL = 'https://eltoque.com/tasas-de-cambio-de-moneda-en-cuba-hoy'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; RatesBot/1.0; +https://github.com)',
    'Accept-Language': 'es,en;q=0.9',
}

WANTED = {'USD', 'EUR', 'MLC', 'CLA', 'CAD', 'MXN', 'ZELLE'}

# Realistic CUP exchange rate ranges — anything outside is rejected
RATE_RANGES = {
    'USD':   (80,  2000),
    'EUR':   (80,  2000),
    'MLC':   (50,  1500),
    'CLA':   (80,  2000),
    'ZELLE': (80,  2000),
    'CAD':   (60,  1500),
    'MXN':   (5,   300),
}


def collect_rates(obj, found):
    """Recursively collect ALL values found for each currency code."""
    if isinstance(obj, dict):
        code = (
            obj.get('code') or obj.get('currency') or obj.get('tipo') or
            obj.get('moneda') or obj.get('symbol') or obj.get('name')
        )
        # Check multiple field names for the numeric value
        raw_value = (
            obj.get('value') or obj.get('rate') or obj.get('tasa') or
            obj.get('informal') or obj.get('promedio') or obj.get('precio') or
            obj.get('venta') or obj.get('compra')
        )
        if code and raw_value:
            key = str(code).upper().strip()
            if key in WANTED:
                try:
                    found.setdefault(key, []).append(float(raw_value))
                except (TypeError, ValueError):
                    pass
        for v in obj.values():
            collect_rates(v, found)
    elif isinstance(obj, list):
        for item in obj:
            collect_rates(item, found)


def pick_best(found):
    """For each currency, keep the first value that falls within its valid range."""
    rates = {}
    for code, values in found.items():
        lo, hi = RATE_RANGES.get(code, (10, 2000))
        valid = [v for v in values if lo <= v <= hi]
        if valid:
            rates[code] = valid[0]
            print(f'  {code}: picked {valid[0]} from candidates {values}')
        else:
            print(f'  {code}: all candidates rejected {values} (range {lo}-{hi})')
    return rates


def regex_fallback(html):
    """Last resort: find rates directly in the raw HTML text."""
    rates = {}
    for currency in WANTED:
        lo, hi = RATE_RANGES.get(currency, (10, 2000))
        # Match: USD...535.00 or 535.00...USD within ~80 chars
        pattern = rf'(?:{currency}[^0-9]{{0,80}}?(\d{{2,4}}(?:[.,]\d{{1,2}})?)|(\d{{2,4}}(?:[.,]\d{{1,2}})?)[^0-9]{{0,30}}?{currency})'
        matches = re.findall(pattern, html, re.IGNORECASE)
        for groups in matches:
            raw = next((g for g in groups if g), None)
            if raw:
                try:
                    val = float(raw.replace(',', '.'))
                    if lo <= val <= hi:
                        rates[currency] = val
                        break
                except ValueError:
                    pass
    return rates


def fetch_rates():
    print(f'Fetching {URL} ...')
    resp = requests.get(URL, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    print(f'HTTP {resp.status_code}, {len(resp.text)} chars')

    rates = {}

    # Strategy 1: __NEXT_DATA__ JSON tree — collect all, pick best per range
    match = re.search(
        r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',
        resp.text,
        re.DOTALL,
    )
    if match:
        try:
            page_data = json.loads(match.group(1))
            found = {}
            collect_rates(page_data, found)
            print('Strategy 1 (NEXT_DATA) — all candidates found:')
            rates = pick_best(found)
        except json.JSONDecodeError as e:
            print(f'Strategy 1 JSON error: {e}')
    else:
        print('Strategy 1: __NEXT_DATA__ not found')

    # Strategy 2: regex on raw HTML
    if not rates:
        print('Strategy 2 (HTML regex)...')
        rates = regex_fallback(resp.text)
        print(f'Strategy 2 result: {rates}')

    if not rates:
        print('ERROR: No rates found by any strategy')
        sys.exit(1)

    # Warn if fewer currencies than expected
    missing = WANTED - set(rates.keys())
    if missing:
        print(f'WARNING: Missing currencies: {missing}')

    # Sanity check: if 3+ currencies share the exact same value, something is wrong
    from collections import Counter
    value_counts = Counter(rates.values())
    for val, count in value_counts.items():
        if count >= 3:
            bad = [k for k, v in rates.items() if v == val]
            print(f'WARNING: {count} currencies share value {val}: {bad} — removing them')
            for k in bad:
                del rates[k]

    if not rates:
        print('ERROR: All rates removed by sanity checks')
        sys.exit(1)

    output = {
        'updated': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'source': 'eltoque.com',
        'rates': rates,
    }

    with open('rates.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f'\nOK — rates.json updated: {rates}')


if __name__ == '__main__':
    fetch_rates()
