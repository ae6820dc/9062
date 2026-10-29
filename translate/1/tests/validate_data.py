#!/usr/bin/env python3
"""Validate the shipped artifacts, independently recomputing every coverage count."""
import gzip
import hashlib
import itertools
import json
from pathlib import Path
import re
import sqlite3
import tempfile
import unicodedata
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
ROOT = Path(__file__).resolve().parents[1]
m = json.loads((ROOT/'data/manifest.json').read_text())
ISO = dict(hu='hun', en='eng', de='deu', fr='fra', es='spa', it='ita', ru='rus', ja='jpn', la='lat')
def norm(w): return unicodedata.normalize('NFC',unicodedata.normalize('NFC',w.strip()).lower())
def js(w): return w.encode('utf-16-be')

def records(meta, key):
    compressed = (ROOT/'data'/meta['path']).read_bytes()
    assert len(compressed) == meta['bytes'], meta['path']
    assert hashlib.sha256(compressed).hexdigest() == meta['sha256'], meta['path']
    raw = gzip.decompress(compressed)
    assert len(raw) == meta['rawBytes']
    raw.decode('utf-8',errors='strict')
    rows = list(map(json.loads,raw.splitlines()))
    assert len(rows) == meta['count'] <= 1024
    assert rows[0][key] == meta['first'] and rows[-1][key] == meta['last']
    assert all(js(a[key]) < js(b[key]) for a,b in zip(rows,rows[1:]))
    return rows

with tempfile.TemporaryDirectory(prefix='unicode-validation-') as tmp:
    db = sqlite3.connect(Path(tmp)/'verify.sqlite')
    db.executescript('PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; CREATE TABLE words(lang TEXT,norm TEXT,sense TEXT,head INT,PRIMARY KEY(lang,norm,sense)); CREATE TABLE refs(lang TEXT,norm TEXT,sense TEXT,PRIMARY KEY(lang,norm,sense)); CREATE TABLE masks(id TEXT PRIMARY KEY,mask INT);')
    assert set(m['targetLanguages']) == set(ISO)
    bits = {lang:1<<i for i,lang in enumerate(m['targetLanguages'])}
    expected_concepts = {lang:[] for lang in ISO}
    sense_count = 0
    fixture = None
    for index,meta in enumerate(m['concepts']):
        if index: assert js(m['concepts'][index-1]['last']) < js(meta['first'])
        langs = set()
        for sense in records(meta,'id'):
            sense_count += 1
            db.execute('INSERT INTO masks VALUES(?,?)',(sense['id'],sum(bits[l] for l in sense['words'])))
            for lang,ids in sense['definitionSources'].items():
                assert lang in ISO and lang in sense['definitions'] and all(s in m['sources'] for s in ids)
            if sense['id'] == 'wn:14845743-n':
                assert 'jwordnet' in sense['definitionSources']['en']
                assert any('binary compound' in d for d in sense['definitions']['en'])
                assert not any('binary compound' in d for d in sense['definitions']['ja'])
            assert sense['words'] and isinstance(sense['notes'],list)
            if set(sense['words']) == set(ISO) and fixture is None:
                fixture = {lang:words[0][0] for lang,words in sense['words'].items()}
                fixture['sense'] = sense['id']
            for lang,words in sense['words'].items():
                assert lang in ISO
                langs.add(lang)
                for word,sources in words:
                    assert word and '\ufffd' not in word and not any(ord(c)<32 for c in word)
                    assert word == unicodedata.normalize('NFC',word) and sources
                    assert all(s in m['sources'] for s in sources)
                    head = int(any(not sid.startswith('fd-') or sid[3:6] == ISO[lang] for sid in sources))
                    db.execute('''INSERT INTO words VALUES(?,?,?,?) ON CONFLICT(lang,norm,sense) DO UPDATE SET head=MAX(head,excluded.head)''', (lang,norm(word),sense['id'],head))
        for lang in langs: expected_concepts[lang].append(index)
    db.commit()
    print('Validated',sense_count,'attested senses',flush=True)
    for lang,l in m['languages'].items():
        assert l['concepts'] == expected_concepts[lang]
        total = 0
        for index,meta in enumerate(l['shards']):
            if index: assert js(l['shards'][index-1]['last']) < js(meta['first'])
            batch = records(meta,'norm')
            ids = sorted({sense for row in batch for sense in row['senses']})
            masks = {}
            for start in range(0,len(ids),900):
                chunk = ids[start:start+900]
                masks.update(db.execute('SELECT id,mask FROM masks WHERE id IN ('+','.join('?'*len(chunk))+')',chunk))
            for row in batch:
                assert row['masks'] == [masks[sense] for sense in row['senses']]
                total += 1
                assert row['lang'] == lang and row['key'] == lang+':'+row['norm']
                assert all(norm(word) == row['norm'] and len(word.encode('utf-16-le'))//2 <= 4096 for word in row['forms'])
                assert len(row['senses']) == len(set(row['senses']))
                db.executemany('INSERT INTO refs VALUES(?,?,?)',[(lang,row['norm'],sense) for sense in row['senses']])
        assert total == l['lookupForms']
        actual = db.execute('SELECT COUNT(DISTINCT norm) FROM words WHERE lang=? AND head=1',(lang,)).fetchone()[0]
        assert actual == l['headwords'],(lang,actual,l['headwords'])
        assert db.execute('SELECT COUNT(*) FROM words WHERE lang=? AND head=1',(lang,)).fetchone()[0] == l['headwordSenses']
        print(lang, total,'lookup forms;',actual,'headwords',flush=True)
    assert not db.execute('SELECT * FROM refs EXCEPT SELECT lang,norm,sense FROM words LIMIT 1').fetchall(), 'Dangling/incorrect lexicon reference'
    assert not db.execute('SELECT lang,norm,sense FROM words EXCEPT SELECT * FROM refs LIMIT 1').fetchall(), 'Missing lexicon reference'
    db.executescript('CREATE INDEX sense_words ON words(sense); CREATE TABLE presence AS SELECT DISTINCT sense,lang FROM words; CREATE UNIQUE INDEX presence_key ON presence(sense,lang);')
    assert len(m['pairs']) == 72
    for a,b in itertools.permutations(ISO,2):
        r = db.execute('''SELECT COUNT(DISTINCT w.norm),COUNT(DISTINCT CASE WHEN head=1 THEN norm END),COUNT(DISTINCT w.sense) FROM words w JOIN presence p ON w.sense=p.sense AND p.lang=? WHERE w.lang=?''',(b,a)).fetchone()
        expected = m['pairs'][a+'-'+b]
        assert r == (expected['sourceForms'],expected['sourceHeadwords'],expected['alignedSenses']),(a,b,r,expected)
        assert all(v>0 for v in r),(a,b)
    assert fixture, 'Need a real shared sense to exercise every direction'
    (ROOT/'tests/fixture.json').write_text(json.dumps(fixture,ensure_ascii=False,indent=2)+'\n')
    print('All 72 directed coverage counts recomputed; fixture',fixture,flush=True)

for sid,source in m['sources'].items():
    original = gzip.decompress((ROOT/'data'/source['original']).read_bytes())
    assert hashlib.sha256(original).hexdigest() == source['sha256'],sid
    for notice in source['notices']: assert (ROOT/notice).is_file(),notice
print('All',len(m['sources']),'original source hashes and notices verified',flush=True)
class Links(HTMLParser):
    def handle_starttag(self,tag,attrs):
        for name,value in attrs:
            if name not in ('href','src') or not value: continue
            url=urlsplit(value)
            if url.scheme or url.netloc or not url.path: continue
            assert (ROOT/unquote(url.path)).is_file(),value
all_ids=[]
canonical=None
for i in range(1,4):
    s=(ROOT/f'sample{i}.html').read_text()
    ids=[re.search(fr'name="{name}" content="([0-9A-F]{{16}})"',s).group(1) for name in ['program-id','storage-key']]
    all_ids+=ids
    clean=s
    for identifier in ids: clean=clean.replace(identifier,'IDENTIFIER')
    clean=clean.replace(f'Unicode Translate · Sample {i}', 'Unicode Translate · Sample N').replace(f'SAMPLE {i}', 'SAMPLE N')
    if canonical is None: canonical=clean
    else: assert clean == canonical,'Sample functionality diverged'
assert len(set(all_ids))==6
for p in ROOT.glob('*.html'): Links().feed(p.read_text())
print('Sample equivalence, six distinct identities, Unicode decoding and local HTML links PASS')
