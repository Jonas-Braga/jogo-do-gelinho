"""Gera os ícones do app (PWA) em icons/ a partir de tools/icon.html.

Precisa do servidor rodando (npm start) e do Playwright para Python:
    python tools/make-icons.py
"""
import base64
import os
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'icons')

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome')
    page = browser.new_page()
    page.goto('http://localhost:8137/tools/icon.html')
    page.wait_for_function('window.__icons')
    icons = page.evaluate('window.__icons')
    os.makedirs(OUT, exist_ok=True)
    for name, url in icons.items():
        data = base64.b64decode(url.split(',', 1)[1])
        with open(os.path.join(OUT, f'{name}.png'), 'wb') as f:
            f.write(data)
        print(f'icons/{name}.png ({len(data)} bytes)')
    browser.close()
