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


def find_rates_in_obj(obj, rates):
    """Recursively search a JSON tree for currency code + value pairs."""
    if isinstance(obj, dict):
        code = (
            obj.get('code') or obj.get('currency') or
            obj.get('tipo') or obj.get('moneda') or obj.get('symbol')
        )
        value = (
            obj.get('value') or obj.get('rate') or obj.get('tasa') or
            obj.get('precio') or obj.get('informal') or obj.get('promedio')
        )
        if code and value:
            key = str(code).upper().strip()
            if key in WANTED:
                try:
                    rates[key] = float(value)
                except (TypeError, ValueError):
                    pass
        for v in obj.values():
            find_rates_in_obj(v, rates)
    elif isinstance(obj, list):
        for item in obj:
            find_rates_in_obj(item, rates)


def fetch_rates():
    print(f'Fetching {URL} ...')
    resp = requests.get(URL, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    print(f'HTTP {resp.status_code}, {len(resp.text)} chars')

    rates = {}

    # Strategy 1: Next.js __NEXT_DATA__ JSON (most reliable)
    match = re.search(
        r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',
        resp.text,
        re.DOTALL,
    )
    if match:
        try:
            page_data = json.loads(match.group(1))
            find_rates_in_obj(page_data, rates)
            print(f'Strategy 1 (NEXT_DATA): found {rates}')
        except json.JSONDecodeError as e:
            print(f'Strategy 1 JSON parse error: {e}')
    else:
        print('Strategy 1: __NEXT_DATA__ not found')

    # Strategy 2: Regex on raw HTML (fallback)
    if not rates:
        print('Trying strategy 2 (HTML regex)...')
        for currency in WANTED:
            # Look for patterns like "USD" followed by a 3-4 digit number
            pattern = rf'\b{currency}\b[^0-9]{{0,50}}?(\d{{3,4}}(?:[.,]\d{{1,2}})?)'
            m = re.search(pattern, resp.text, re.IGNORECASE)
            if m:
                raw = m.group(1).replace(',', '.')
                try:
                    rates[currency] = float(raw)
                except ValueError:
                    pass
        print(f'Strategy 2 (regex): found {rates}')

    if not rates:
        print('ERROR: No rates found by any strategy')
        sys.exit(1)

    # Validate: rates should be in a reasonable range for CUP
    for code, value in list(rates.items()):
        if value < 10 or value > 10000:
            print(f'WARNING: {code}={value} looks out of range, removing')
            del rates[code]

    if not rates:
        print('ERROR: All found rates failed validation')
        sys.exit(1)

    output = {
        'updated': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'source': 'eltoque.com',
        'rates': rates,
    }

    with open('rates.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f'OK — rates.json updated: {rates}')


if __name__ == '__main__':
    fetch_rates()
