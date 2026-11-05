#!/usr/bin/env python3
"""Read-only preservation manifest. Never imports the app or opens runtime data."""
import argparse
import datetime
import hashlib
import json
import pathlib
import subprocess

p = argparse.ArgumentParser()
p.add_argument('--source', type=pathlib.Path, required=True)
p.add_argument('--out', type=pathlib.Path, required=True)
a = p.parse_args()
root = a.source.resolve()
seed = json.loads((root / 'data/public-seed.json').read_text())
sha = lambda b: hashlib.sha256(b).hexdigest()
tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode().split('\0')
files = {name: sha((root / name).read_bytes()) for name in tracked if name and (root / name).is_file()}
categories = {x['name'] for x in seed['Category']}
supplemental = sorted({x.get('category', '') for x in seed['Businesses']} - categories)
assets = {str(path.relative_to(root)): sha(path.read_bytes()) for path in sorted((root / 'static/source-assets').glob('*')) if path.is_file()}
refs = {x.get('image_url', '') for kind in ['Businesses', 'Category'] for x in seed[kind] if x.get('image_url')}
manifest = {
    'captured_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'source': str(root),
    'commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root).decode().strip(),
    'scope': 'Read-only tracked source, sanitized public seed, and original static assets; no runtime database, accounts, uploads, or mail accessed.',
    'counts': {'businesses': len(seed['Businesses']), 'original_categories': len(seed['Category']), 'supplemental_category_names': len(supplemental), 'total_categories': len(seed['Category']) + len(supplemental), 'reviews': len(seed['Reviews']), 'asset_files': len(assets), 'distinct_image_references': len(refs)},
    'seed_sha256': sha((root / 'data/public-seed.json').read_bytes()),
    'source_ids_sha256': {kind: sha(json.dumps(sorted(str(x['id']) for x in seed[kind])).encode()) for kind in ['Businesses', 'Category', 'Reviews']},
    'supplemental_category_names': supplemental,
    'assets': assets,
    'tracked_files': files,
}
a.out.parent.mkdir(parents=True, exist_ok=True)
a.out.write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'saved': str(a.out), 'commit': manifest['commit'], 'counts': manifest['counts']}))
