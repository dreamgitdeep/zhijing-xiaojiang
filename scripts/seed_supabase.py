# -*- coding: utf-8 -*-
"""把 public/data/plants.json 灌入 Supabase plants 表（方式 B，可选）。

用法：
    set SUPABASE_URL=https://xxx.supabase.co
    set SUPABASE_SERVICE_ROLE_KEY=eyJ...
    python scripts/seed_supabase.py
"""
import json, os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'public', 'data', 'plants.json')
URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')


def main():
    if not URL or not KEY:
        sys.exit('缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 环境变量')
    payload = json.load(open(DATA, encoding='utf-8'))
    rows = []
    for i, p in enumerate(payload['plants'], 1):
        w = p.get('warning') or {}
        rows.append({
            'id': p['id'],
            'name': p['name'],
            'latin': p.get('latin') or '',
            'category': p.get('category') or '',
            'layer': p.get('layer'),
            'is_warning': bool(p.get('isWarning')),
            'restriction': w.get('restriction'),
            'data': p,
            'sort_order': i,
        })
    body = json.dumps(rows, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(
        f'{URL}/rest/v1/plants?on_conflict=id',
        data=body,
        method='POST',
        headers={
            'apikey': KEY,
            'Authorization': f'Bearer {KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=minimal',
        },
    )
    with urllib.request.urlopen(req) as resp:
        print('upsert 成功:', resp.status, '共', len(rows), '条')


if __name__ == '__main__':
    main()
