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

# Exact JSON keys → our currency codes
# median = value shown on eltoque.com website
KEY_MAP = {
    'USD':           'USD',
    'ECU':           'EUR',   # EUR is stored as "ECU" in the API
    'MLC':           'MLC',
    'CLA':           'CLA',
    'CAD':           'CAD',
    'MXN':           'MXN',
    'USD_Zelle.CUP': 'ZELLE',
}

RATE_RANGES = {
    'USD':   (80,  2000),
    'EUR':   (80,  2000),
    'MLC':   (50,  1500),
    'CLA':   (80,  2000),
    'ZELLE': (80,  2000),
    'CAD':   (60,  1500),
    'MXN':   (5,   300),
}


def extract_from_next_data(page_data):
    """
    Navigate props.pageProps looking for a dict whose keys include
    known currency codes and whose values have 'median'.
    Returns { 'USD': 533.51, 'MLC': 406.52, ... } or {}.
    """
    page_props = page_data.get('props', {}).get('pageProps', {})

    def find_rates_dict(obj, depth=0):
        if depth > 6 or not isinstance(obj, dict):
            return None
        known = set(KEY_MAP.keys()) & set(obj.keys())
        if known:
            sample = obj[next(iter(known))]
            if isinstance(sample, dict) and 'median' in sample:
                return obj
        for v in obj.values():
            result = find_rates_dict(v, depth + 1)
            if result:
                return result
        return None

    currency_dict = find_rates_dict(page_props)
    if not currency_dict:
        return {}

    rates = {}
    for json_key, our_code in KEY_MAP.items():
        entry = currency_dict.get(json_key)
        if not isinstance(entry, dict):
            continue
        raw = entry.get('median')
        if raw is None:
            continue
        try:
            val = float(raw)
        except (TypeError, ValueError):
            continue

        lo, hi = RATE_RANGES.get(our_code, (10, 2000))
        if lo <= val <= hi:
            rates[our_code] = round(val, 2)
            print(f'  {our_code}: {val} (from key "{json_key}")')
        else:
            print(f'  {our_code}: {val} OUT OF RANGE [{lo}-{hi}] — skipped')

    return rates


def fetch_rates():
    print(f'Fetching {URL} ...')
    resp = requests.get(URL, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    print(f'HTTP {resp.status_code}, {len(resp.text)} chars')

    # Extract __NEXT_DATA__
    match = re.search(
        r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',
        resp.text,
        re.DOTALL,
    )
    if not match:
        print('ERROR: __NEXT_DATA__ not found in page')
        sys.exit(1)

    try:
        page_data = json.loads(match.group(1))
    except json.JSONDecodeError as e:
        print(f'ERROR: JSON parse failed: {e}')
        sys.exit(1)

    print('Extracting rates from pageProps...')
    rates = extract_from_next_data(page_data)

    if not rates:
        print('ERROR: No valid rates found in __NEXT_DATA__')
        sys.exit(1)

    missing = set(KEY_MAP.values()) - set(rates.keys())
    if missing:
        print(f'WARNING: Missing currencies: {missing}')

    output = {
        'updated': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'source': 'eltoque.com',
        'rates': rates,
    }

    with open('rates.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f'\nOK — rates.json updated with {len(rates)} currencies: {rates}')


if __name__ == '__main__':
    fetch_rates()
