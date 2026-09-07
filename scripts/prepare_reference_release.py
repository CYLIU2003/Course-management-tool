"""Prepare checksum-verified public reference bundles for a dashboard SQL import.

Alternative to import_supabase when only a logged-in SQL Editor is available.
Bundles contain official reference data only; never accounts or credentials.
"""

import argparse
import hashlib
import json
from pathlib import Path

from scripts.import_supabase import load_snapshot


def prepare(directory: Path, output: Path, origin: str):
    if not origin.startswith("https://") or any(char in origin for char in "'\n\r"):
        raise ValueError("A trusted HTTPS asset origin is required")
    rows = load_snapshot(directory)
    output.mkdir(parents=True, exist_ok=True)
    bundles = []
    current, size = [], 0

    def flush():
        raw = ("[" + ",".join(current) + "]").encode("utf-8")
        digest = hashlib.sha256(raw).hexdigest()
        filename = f"{digest}.json"
        (output / filename).write_bytes(raw)
        bundles.append((filename, digest))

    for route, payload in rows:
        record = json.dumps(
            dict(path=route, payload=json.loads(payload)),
            ensure_ascii=False,
            separators=(",", ":"),
        )
        record_size = len(record.encode("utf-8"))
        if record_size > 24 * 1024 * 1024:
            raise ValueError("Reference payload exceeds the asset limit")
        if current and size + record_size > 20 * 1024 * 1024:
            flush()
            current, size = [], 0
        current.append(record)
        size += record_size + 1
    if current:
        flush()
    values = ",\n".join(
        f"('{origin.rstrip('/')}/{filename}','{digest}')"
        for filename, digest in bundles
    )
    sql = f"""begin;
set local statement_timeout = '180s';
-- The http extension was verified absent before this one-off import.
create extension http with schema extensions;
select extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '60000');
create temporary table release_reference(path text primary key, payload jsonb not null) on commit drop;
do $release$
declare item record; response record;
begin
  for item in select * from (values {values}) as bundles(url,sha256) loop
    select * into response from extensions.http_get(item.url);
    if response.status <> 200 or encode(extensions.digest(response.content, 'sha256'),'hex') <> item.sha256 then
      raise exception 'Reference asset checksum or HTTP status mismatch: %', item.url;
    end if;
    insert into release_reference select entry->>'path',entry->'payload' from jsonb_array_elements(response.content::jsonb) entry;
  end loop;
  if (select count(*) from release_reference) <> {len(rows)} or exists(select 1 from release_reference where path not like '/api/%' or path like '/api/me%' or path like '/api/auth%') then
    raise exception 'Invalid reference snapshot';
  end if;
end $release$;
lock table public.reference_payloads in exclusive mode;
insert into public.reference_payloads select path,payload from release_reference on conflict(path) do update set payload=excluded.payload;
delete from public.reference_payloads where path not in (select path from release_reference);
drop extension http;
commit;
select count(*) as reference_payloads from public.reference_payloads;
"""
    (output / "import.sql").write_text(sql, encoding="utf-8")
    print(json.dumps(dict(payloads=len(rows), bundles=len(bundles))))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--directory", type=Path, default=Path("data/supabase-reference")
    )
    parser.add_argument("--output", type=Path, default=Path("data/reference-release"))
    parser.add_argument("--origin", required=True)
    args = parser.parse_args()
    prepare(args.directory, args.output, args.origin)
