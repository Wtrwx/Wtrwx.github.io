"""Verify migrated output, exclusions, local links, images, search and Atom feed."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import json, sys, xml.etree.ElementTree as ET
root = Path(sys.argv[1] if len(sys.argv)>1 else 'public').resolve()
manifest = json.loads((Path(__file__).resolve().parents[1]/'migration/manifest.json').read_text())
kept = {row['url'] for row in manifest if row['status']=='kept'}
for row in manifest:
    assert (root/row['url'].lstrip('/')).is_file() == (row['status']=='kept'), row
class Links(HTMLParser):
    def __init__(self, page):
        super().__init__(); self.page = page
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key in ('src','href'):
            if key not in attrs: continue
            url = urlsplit(attrs[key])
            if url.scheme or url.netloc or not url.path: continue
            target = root/unquote(url.path.lstrip('/')) if url.path.startswith('/') else self.page.parent/unquote(url.path)
            assert target.exists() or (target/'index.html').exists(), (self.page, attrs[key])
for page in root.rglob('*.html'):
    Links(page).feed(page.read_text())
search=json.loads((root/'search/index.json').read_text())
indexed = {e['permalink'] for e in search}
excluded = {r['url'] for r in manifest if r['status'] != 'kept'}
assert kept <= indexed, 'Retained articles missing from search'
assert not (indexed & excluded), 'Excluded articles leaked into search'
for url in indexed:
    target = root/url.lstrip('/')
    assert target.is_file() or (target/'index.html').is_file(), url
feed=ET.parse(root/'atom.xml'); ns={'a':'http://www.w3.org/2005/Atom'}
assert {urlsplit(e.find('a:link',ns).get('href')).path for e in feed.findall('a:entry',ns)}==indexed, 'Feed differs from search index'
assert not list(root.rglob('*.md')), 'Source documents leaked into public output'
print(f'PASS: {len(kept)} migrated + {len(indexed-kept)} new article URLs, excluded pages, local links/assets, search index, Atom feed')
