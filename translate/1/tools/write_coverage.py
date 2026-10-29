#!/usr/bin/env python3
"""Embed the manifest's measured coverage into the README, including without JS."""
import html
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
m = json.loads((ROOT/'data/manifest.json').read_text())
rows = ['<div id="coverage-report"><div class="table-scroll"><table><caption>Bundled lexical coverage</caption><thead><tr><th>Language</th><th>Headwords</th><th>Headword–sense associations</th><th>Lookup forms</th><th>Gap to 100,000</th></tr></thead><tbody>']
for l in m['languages'].values():
    rows.append(f'<tr><th>{html.escape(l["name"])}</th><td>{l["headwords"]:,}</td><td>{l["headwordSenses"]:,}</td><td>{l["lookupForms"]:,}</td><td>{max(0,100000-l["headwords"]):,}</td></tr>')
rows += ['</tbody></table></div><div class="table-scroll"><table><caption>All 72 directed pairs: source lookup forms with at least one translation</caption><thead><tr><th>Source ↓ / Target →</th>']
for code in m['languages']: rows.append(f'<th>{code.upper()}</th>')
rows.append('</tr></thead><tbody>')
for a,l in m['languages'].items():
    rows.append(f'<tr><th>{l["name"]}</th>')
    for b in m['languages']:
        c = m['pairs'].get(a+'-'+b)
        rows.append('<td>—</td>' if c is None else f'<td title="{c["sourceHeadwords"]:,} source headwords; {c["alignedSenses"]:,} aligned senses">{c["sourceForms"]:,}</td>')
    rows.append('</tr>')
rows.append('</tbody></table></div></div>')
p = ROOT/'readme.html'
s = p.read_text()
start = s.index('<div id="coverage-report">')
end = s.index('\n<p><strong>Definitions of counts:',start)
p.write_text(s[:start] + '\n'.join(rows) + s[end:])
print('README coverage generated from',m['version'])
