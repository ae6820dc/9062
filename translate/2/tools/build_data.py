#!/usr/bin/env python3
"""Reproduce the bundled, source-backed dictionary using Python's standard library.

Usage: python tools/build_data.py --omw /path/to/omw-data --freedict /path/to/fd-dictionaries
Inputs must be the commits recorded below; no network access or invented translations.
The SQLite staging database is outside the repository and bounds importer memory.
"""
import argparse
import collections
import gzip
import hashlib
import itertools
import json
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tempfile
import unicodedata
import xml.etree.ElementTree as ET
from index_targets import index_targets

ROOT = Path(__file__).resolve().parents[1]
OMW_COMMIT = '406bf83b3c507a3d1f26e88252d5d66893fd36bf'
FD_COMMIT = '5bdceeac8d0dba3298c1bebe734f60d54dad30f7'
LANGS = {'hu': ('hun', 'Hungarian', 'Magyar'), 'en': ('eng', 'English', 'English'),
         'de': ('deu', 'German', 'Deutsch'), 'fr': ('fra', 'French', 'Français'),
         'es': ('spa', 'Spanish', 'Español'), 'it': ('ita', 'Italian', 'Italiano'),
         'ru': ('rus', 'Russian', 'Русский'), 'ja': ('jpn', 'Japanese', '日本語'),
         'la': ('lat', 'Latin', 'Latina')}
ISO = {v[0]: k for k, v in LANGS.items()}
NS = {'t': 'http://www.tei-c.org/ns/1.0'}


def norm(s):
    return unicodedata.normalize('NFC', unicodedata.normalize('NFC', s.strip()).lower())


def dump(x):
    return json.dumps(x, ensure_ascii=False, separators=(',', ':'))


def compress(path, raw):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(gzip.compress(raw, mtime=0))


def text(el):
    return ' '.join(''.join(el.itertext()).split()) if el is not None else ''


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--omw', type=Path, required=True)
    ap.add_argument('--freedict', type=Path, required=True)
    args = ap.parse_args()
    for repo, commit in [(args.omw, OMW_COMMIT), (args.freedict, FD_COMMIT)]:
        assert subprocess.check_output(['git', '-C', str(repo), 'rev-parse', 'HEAD']).decode().strip() == commit, 'Wrong source revision'
        assert not subprocess.check_output(['git', '-C', str(repo), 'status', '--porcelain']), 'Source checkout must be clean'
    sources = {}
    out = ROOT / 'data'
    # Build in a fresh temporary directory; replace generated data only after success.
    with tempfile.TemporaryDirectory(prefix='unicode-translate-build-') as tmp:
        stage = Path(tmp) / 'data'
        stage.mkdir()
        db = sqlite3.connect(Path(tmp) / 'build.sqlite')
        db.execute('PRAGMA journal_mode=OFF')
        db.execute('PRAGMA synchronous=OFF')
        db.create_collation('JS', lambda a, b: (a.encode('utf-16-be') > b.encode('utf-16-be')) - (a.encode('utf-16-be') < b.encode('utf-16-be')))
        db.executescript('''CREATE TABLE senses(id TEXT PRIMARY KEY, pos TEXT, defs TEXT, notes TEXT, defsources TEXT);
        CREATE TABLE words(lang TEXT, norm TEXT COLLATE JS, text TEXT, sense TEXT, source TEXT, head INTEGER,
        PRIMARY KEY(lang,norm,text,sense,source));''')

        def archive(path, sid, repo, commit, license_name, notices):
            relative = str(path.relative_to(repo))
            raw = path.read_bytes()
            dest = f'sources/{sid}{path.suffix}.gz'
            compress(stage / dest, raw)
            sources[sid] = dict(id=sid, path=relative, sha256=hashlib.sha256(raw).hexdigest(),
                url=f'https://github.com/{"omwn/omw-data" if repo == args.omw else "freedict/fd-dictionaries"}/blob/{commit}/{relative}',
                revision=commit, license=license_name, original=dest, notices=[])
            for n in notices:
                if n.exists():
                    target = f'licenses/{sid}-{n.name}'
                    # Preserve original bytes, including the declared legacy encoding of CeCILL-C HTML.
                    (ROOT / target).write_bytes(n.read_bytes())
                    sources[sid]['notices'].append(target)

        def addword(lang, word, sense, sid, head=1):
            word = unicodedata.normalize('NFC', word.strip())
            if not word or '\ufffd' in word or any(ord(c) < 32 for c in word):
                sources[sid]['rejectedForms'] = sources[sid].get('rejectedForms', 0) + 1
                return
            db.execute('INSERT OR IGNORE INTO words VALUES(?,?,?,?,?,?)', (lang, norm(word), word, sense, sid, head))

        # OMW files all use the aligned Princeton WordNet 3.0 sense namespace.
        omw = [(f'wikt/wn-wikt-{iso}.tab', lang, f'wikt-{lang}', 'CC-BY-SA-3.0') for lang, (iso, _, _) in LANGS.items()]
        omw += [('eng/wn-data-eng.tab', 'en', 'pwn', 'WordNet-3.0'),
                ('fra/wn-data-fra.tab', 'fr', 'wolf', 'CECILL-C'),
                ('ita/wn-data-ita.tab', 'it', 'multiwordnet', 'CC-BY-3.0'),
                ('iwn/wn-data-ita.tab', 'it', 'italwordnet', 'ODC-By-1.0'),
                ('jpn/wn-data-jpn.tab', 'ja', 'jwordnet', 'Japanese-WordNet'),
                ('mcr/wn-data-spa.tab', 'es', 'mcr-es', 'CC-BY-3.0')]
        for rel, lang, sid, lic in omw:
            p = args.omw / 'wns' / rel
            archive(p, sid, args.omw, OMW_COMMIT, lic, [p.parent/'LICENSE', p.parent/'citation.bib', p.parent/'README'])
            defs = collections.defaultdict(lambda: collections.defaultdict(list))
            for line in p.read_text().splitlines():
                if not line or line.startswith('#'):
                    continue
                cols = line.split('\t')
                sense, field = 'wn:' + cols[0], cols[1].split(':')[-1]
                field_lang = ISO.get(cols[1].split(':')[0], lang)
                db.execute('INSERT OR IGNORE INTO senses VALUES(?,?,?,?,?)', (sense, cols[0][-1], '{}', '[]', '{}'))
                if field == 'lemma':
                    addword(field_lang, cols[2], sense, sid)
                elif field == 'def':
                    defs[sense][field_lang].append(cols[-1])
            for sense, d in defs.items():
                old_json, old_source_json = db.execute('SELECT defs,defsources FROM senses WHERE id=?', (sense,)).fetchone()
                old = json.loads(old_json)
                old_sources = json.loads(old_source_json)
                for l, values in d.items():
                    old[l] = sorted(set(old.get(l, []) + values))
                    old_sources[l] = sorted(set(old_sources.get(l, []) + [sid]))
                db.execute('UPDATE senses SET defs=?,defsources=? WHERE id=?', (dump(old), dump(old_sources), sense))
            db.commit()
            print('Imported', sid, flush=True)

        # FreeDict records remain separate bilingual senses. Never pivot through a
        # bilingual gloss to infer a third-language link or merge unrelated senses.
        for p in sorted(args.freedict.glob('*/*.tei')):
            pair = p.stem.split('-')
            if len(pair) != 2 or not all(x in ISO for x in pair):
                continue
            a, b = map(ISO.get, pair)
            sid = 'fd-' + p.stem
            header = None
            for _, el in ET.iterparse(p):
                if el.tag == '{%s}teiHeader' % NS['t']:
                    header = el
                    break
            availability = text(header.find('.//t:availability', NS))
            lic = 'CC-BY-SA-3.0' if 'Creative Commons' in availability else ('GPL-2.0-only' if p.stem == 'hun-eng' else 'GPL-2.0-or-later')
            assert 'Creative Commons' in availability or 'GENERAL PUBLIC LICENSE' in availability or 'General Public License' in availability
            archive(p, sid, args.freedict, FD_COMMIT, lic, [p.parent/'COPYING', p.parent/'ChangeLog'])
            sources[sid]['availability'] = availability
            sources[sid]['attribution'] = text(header.find('.//t:titleStmt', NS))
            compress(stage / f'sources/{sid}-header.xml.gz', ET.tostring(header, encoding='utf-8'))
            entry_no = 0
            # Remove each processed entry from its parent so source XML is streamed.
            stack = []
            for event, el in ET.iterparse(p, events=['start', 'end']):
                if event == 'start':
                    stack.append(el)
                    continue
                if el.tag == '{%s}entry' % NS['t']:
                    entry_no += 1
                    heads = [text(x) for x in el.findall('./t:form/t:orth', NS)]
                    for n, sense in enumerate(el.findall('.//t:sense', NS)):
                        quotes = [text(x) for x in sense.findall('./t:cit[@type="trans"]/t:quote', NS)]
                        if not quotes or not heads:
                            continue
                        key = f'{sid}:{entry_no}:{n}'
                        pos = [text(x) for x in el.findall('./t:gramGrp/t:pos', NS) + sense.findall('./t:gramGrp/t:pos', NS) + sense.findall('./t:note[@type="pos"]', NS)]
                        notes = [text(x) for x in el.findall('./t:gramGrp', NS) + sense.findall('./t:note', NS) + sense.findall('./t:usg', NS)]
                        definitions = [text(x) for x in sense.findall('./t:def', NS)]
                        db.execute('INSERT INTO senses VALUES(?,?,?,?,?)', (key, '; '.join(pos), dump({a:definitions} if definitions else {}), dump(notes), dump({a:[sid]} if definitions else {})))
                        for word in heads:
                            addword(a, word, key, sid)
                        for word in quotes:
                            addword(b, word, key, sid, 0)
                    stack[-2].remove(el)
                stack.pop()
            db.commit()
            print('Imported', sid, entry_no, 'source entries', flush=True)

        db.executescript('CREATE INDEX by_sense ON words(sense); CREATE INDEX by_word ON words(lang,norm);')
        # Definitions without a lemma in any of our languages are not dictionary entries.
        db.execute('DELETE FROM senses WHERE NOT EXISTS(SELECT 1 FROM words WHERE sense=senses.id)')
        manifest = dict(schema=1, version='omw-406bf83-fd-5bdceea-v1', target=100000,
                        normalization='NFC + Unicode default lowercase + NFC; whitespace trimmed; accents retained',
                        sources=sources, languages={}, concepts=[], pairs={})
        # A bounded concept shard holds at most 1024 senses. Text of all nine
        # languages stays on disk/IndexedDB; no giant JS object is required.
        language_concepts = collections.defaultdict(list)
        cursor = db.execute('SELECT * FROM senses ORDER BY id')
        for number in itertools.count():
            batch = list(itertools.islice(cursor, 1024))
            if not batch:
                break
            records = []
            langs = set()
            for key, pos, defs, notes, defsources in batch:
                words = collections.defaultdict(dict)
                for lang, word, sid in db.execute('SELECT lang,text,source FROM words WHERE sense=? ORDER BY lang,text,source', (key,)):
                    words[lang].setdefault(word, []).append(sid)
                    langs.add(lang)
                records.append(dict(id=key, pos=pos, definitions=json.loads(defs), definitionSources=json.loads(defsources), notes=json.loads(notes),
                                    words={l: list(w.items()) for l, w in words.items()}))
            meta = write_shard(stage, f'concepts/{number:04d}.ndjson.gz', records, batch[0][0], batch[-1][0])
            manifest['concepts'].append(meta)
            for lang in langs:
                language_concepts[lang].append(number)
        for lang, (_, name, native) in LANGS.items():
            lexical_count = db.execute('SELECT COUNT(DISTINCT norm) FROM words WHERE lang=? AND head=1', (lang,)).fetchone()[0]
            count = db.execute('SELECT COUNT(DISTINCT norm) FROM words WHERE lang=?', (lang,)).fetchone()[0]
            senses_count = db.execute('SELECT COUNT(*) FROM (SELECT DISTINCT norm,sense FROM words WHERE lang=? AND head=1)', (lang,)).fetchone()[0]
            shards = []
            cursor = db.execute('SELECT norm,text,sense FROM words WHERE lang=? ORDER BY norm,text,sense', (lang,))
            records = []
            for normalized, rows in itertools.groupby(cursor, key=lambda row: row[0]):
                forms, senses = set(), set()
                for _, word, sense in rows:
                    forms.add(word)
                    senses.add(sense)
                records.append(dict(key=f'{lang}:{normalized}', lang=lang, norm=normalized,
                                    forms=sorted(forms), senses=sorted(senses)))
                if len(records) == 1024:
                    shards.append(write_shard(stage, f'lex/{lang}-{len(shards):04d}.ndjson.gz', records, records[0]['norm'], records[-1]['norm']))
                    records = []
            if records:
                shards.append(write_shard(stage, f'lex/{lang}-{len(shards):04d}.ndjson.gz', records, records[0]['norm'], records[-1]['norm']))
            manifest['languages'][lang] = dict(name=name, native=native, headwords=lexical_count,
                headwordSenses=senses_count, lookupForms=count, shards=shards, concepts=language_concepts[lang])
            print(lang, lexical_count, 'headwords;', count, 'lookup forms', flush=True)
        # Explicit, directional coverage: source lookup forms, genuine source
        # headwords and aligned senses with at least one target form. No 8x assumption.
        db.execute('CREATE TABLE presence AS SELECT DISTINCT sense,lang FROM words')
        db.execute('CREATE UNIQUE INDEX present ON presence(sense,lang)')
        for a, b in itertools.permutations(LANGS, 2):
            row = db.execute('''SELECT COUNT(DISTINCT w.norm), COUNT(DISTINCT CASE WHEN head=1 THEN norm END),
            COUNT(DISTINCT w.sense) FROM words w JOIN presence p ON w.sense=p.sense AND p.lang=? WHERE w.lang=?''', (b, a)).fetchone()
            manifest['pairs'][f'{a}-{b}'] = dict(sourceForms=row[0], sourceHeadwords=row[1], alignedSenses=row[2])
        index_targets(stage, manifest)
        (stage / 'manifest.json').write_text(dump(manifest) + '\n')
        # Scope is strictly generated dictionary artifacts, never user files.
        for name in ['lex', 'concepts', 'sources']:
            if (out/name).exists():
                shutil.rmtree(out/name)
            shutil.move(stage/name, out/name)
        shutil.copyfile(stage/'manifest.json', out/'manifest.json')
        print('Data ready:', sum(p.stat().st_size for p in out.rglob('*') if p.is_file()), 'bytes')


def write_shard(stage, path, records, first, last):
    raw = ('\n'.join(map(dump, records)) + '\n').encode()
    compress(stage/path, raw)
    return dict(path=path, first=first, last=last, count=len(records), bytes=(stage/path).stat().st_size,
                rawBytes=len(raw), sha256=hashlib.sha256((stage/path).read_bytes()).hexdigest())


if __name__ == '__main__':
    main()
