'use strict';
(async () => {
  const response = await fetch('data/manifest.json');
  if (!response.ok) throw new Error('Manifest unavailable');
  const manifest = await response.json();
  const list = document.getElementById('source-list');
  for (const source of Object.values(manifest.sources)) {
    const p = document.createElement('p');
    const label = document.createElement('strong'); label.textContent = source.id + ' — ' + source.license + ' ';
    p.append(label);
    const links = [['upstream original',source.url],['bundled original (gzip)','data/'+source.original],...source.notices.map(path => [path.split('/').pop(),path])];
    for (const [name,href] of links) {const link = document.createElement('a'); link.textContent = name; link.href = href; p.append(link,document.createTextNode(' · '));}
    const checksum = document.createElement('small'); checksum.textContent = ' Original SHA-256: ' + source.sha256 + (source.rejectedForms ? ' · Rejected invalid forms: ' + source.rejectedForms : '');
    p.append(checksum); list.append(p);
  }
})().catch(() => {document.getElementById('source-list').textContent = 'Open data/manifest.json for all source paths, hashes and licenses.';});
