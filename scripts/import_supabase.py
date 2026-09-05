"""Publish a verified official snapshot in one PostgreSQL transaction."""
import argparse
import hashlib
import json
import os
from pathlib import Path


def load_snapshot(directory: Path):
    manifest = json.loads((directory / 'manifest.json').read_text(encoding='utf-8'))
    rows = []
    paths = set()
    for item in manifest:
        filename = item['file']
        if Path(filename).name != filename:
            raise ValueError('Invalid manifest filename')
        raw = (directory / filename).read_bytes()
        if len(raw) != item['bytes'] or hashlib.sha256(raw).hexdigest() != item['sha256']:
            raise ValueError('Snapshot checksum mismatch')
        row = json.loads(raw)
        route = row['path']
        if route != item['path'] or not route.startswith('/api/') or route.startswith(('/api/me', '/api/auth')) or route in paths:
            raise ValueError('Invalid or duplicate reference path')
        paths.add(route)
        rows.append((route, json.dumps(row['payload'], ensure_ascii=False)))
    if '/api/registration-options' not in paths:
        raise ValueError('Incomplete snapshot')
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=Path('data/supabase-reference'))
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    rows = load_snapshot(args.directory)
    if not args.apply:
        print(f'Validated {len(rows)} payloads; no remote changes. Use --apply after selecting the project.')
        return
    import psycopg
    connection_string = os.environ.get('SUPABASE_DB_URL')
    if not connection_string:
        raise SystemExit('Set SUPABASE_DB_URL in the operator environment, never a VITE_ variable.')
    # Failure rolls back the entire snapshot; readers never observe half an import.
    with psycopg.connect(connection_string, sslmode='require') as connection:
        connection.execute('LOCK TABLE public.reference_payloads IN EXCLUSIVE MODE')
        with connection.cursor() as cursor:
            cursor.executemany('INSERT INTO public.reference_payloads(path,payload) VALUES (%s,%s::jsonb) ON CONFLICT(path) DO UPDATE SET payload=excluded.payload', rows)
        connection.execute('DELETE FROM public.reference_payloads WHERE NOT (path = ANY(%s))', ([route for route, _ in rows],))
    print(f'Published {len(rows)} official payloads atomically.')


if __name__ == '__main__':
    main()
