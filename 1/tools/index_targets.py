#!/usr/bin/env python3
"""Add exact target-language masks to lexical references, without a translation cross-product.

Called automatically by build_data.py. Standalone use upgrades existing generated
artifacts using a staging directory; original lexical content is unchanged.
"""
import gzip
import json
from pathlib import Path
import shutil
import sqlite3
import tempfile
import hashlib


def index_targets(data, manifest, concepts_root=None):
    concept_data = concepts_root or data
    order = list(manifest['languages'])
    bits = {lang:1<<i for i,lang in enumerate(order)}
    with tempfile.TemporaryDirectory(prefix='unicode-target-index-') as tmp:
        db = sqlite3.connect(Path(tmp)/'masks.sqlite')
        db.execute('PRAGMA journal_mode=OFF')
        db.execute('CREATE TABLE masks(id TEXT PRIMARY KEY, mask INT)')
        for meta in manifest['concepts']:
            rows = [json.loads(line) for line in gzip.decompress((concept_data/meta['path']).read_bytes()).splitlines()]
            db.executemany('INSERT INTO masks VALUES(?,?)', [(r['id'],sum(bits[l] for l in r['words'])) for r in rows])
        for language in manifest['languages'].values():
            for meta in language['shards']:
                path = data/meta['path']
                rows = [json.loads(line) for line in gzip.decompress(path.read_bytes()).splitlines()]
                ids = sorted({sense for row in rows for sense in row['senses']})
                masks = {}
                for start in range(0,len(ids),900):
                    chunk = ids[start:start+900]
                    masks.update(db.execute('SELECT id,mask FROM masks WHERE id IN ('+','.join('?'*len(chunk))+')',chunk))
                for row in rows:
                    row['masks'] = [masks[sense] for sense in row['senses']]
                raw = ('\n'.join(json.dumps(r,ensure_ascii=False,separators=(',',':')) for r in rows)+'\n').encode()
                compressed = gzip.compress(raw,mtime=0)
                path.write_bytes(compressed)
                meta.update(bytes=len(compressed),rawBytes=len(raw),sha256=hashlib.sha256(compressed).hexdigest())
    manifest['targetLanguages'] = order


def main():
    root = Path(__file__).resolve().parents[1]/'data'
    manifest = json.loads((root/'manifest.json').read_text())
    with tempfile.TemporaryDirectory(prefix='unicode-index-stage-') as tmp:
        stage = Path(tmp)
        shutil.copytree(root/'lex',stage/'lex')
        index_targets(stage,manifest,root)
        for path in (stage/'lex').iterdir():
            shutil.copyfile(path,root/'lex'/path.name)
        (root/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n')
    print('Target-language masks indexed; all lexical content retained.')


if __name__ == '__main__':
    main()
