"""Download immutable official Unicode release data; never used at runtime."""
from pathlib import Path
import urllib.request, hashlib, json
ROOT=Path(__file__).resolve().parents[1]
REF='e1521a0131d620999682a1f101252ad4b6024c7c'
FILES=['UnicodeData.txt','Blocks.txt','Scripts.txt','ScriptExtensions.txt','PropertyValueAliases.txt','SpecialCasing.txt','CaseFolding.txt','CompositionExclusions.txt','DerivedNormalizationProps.txt','NormalizationTest.txt','DerivedCoreProperties.txt','PropList.txt','auxiliary/GraphemeBreakProperty.txt','auxiliary/GraphemeBreakTest.txt','emoji/emoji-data.txt','ReadMe.txt']
def fetch():
 manifest={'version':'18.0.0','releaseTag':'final-18.0-20260916','commit':REF,'files':{}}
 for name in FILES:
  url=f'https://raw.githubusercontent.com/unicode-org/unicodetools/{REF}/unicodetools/data/ucd/dev/{name}'
  p=ROOT/'data/ucd'/name;p.parent.mkdir(parents=True,exist_ok=True)
  if not p.exists(): p.write_bytes(urllib.request.urlopen(url).read())
  manifest['files'][name]={'url':url,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
 url=f'https://raw.githubusercontent.com/unicode-org/unicodetools/{REF}/LICENSE'
 p=ROOT/'data/LICENSE.txt'
 if not p.exists(): p.write_bytes(urllib.request.urlopen(url).read())
 (ROOT/'data/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')

# CLDR exemplars provide maintained language evidence; legacy seeds only preserve v14 entries.
def fetch_cldr():
 ref='acd6d88ae493633240e19a87a721076a8a75c310'
 manifest={'version':'48','tag':'release-48','commit':ref,'files':{}}
 for locale in 'en de fr es it ru la ar hu he fa bn ne no fi sv el tr cs pl pt vi'.split():
  url=f'https://raw.githubusercontent.com/unicode-org/cldr/{ref}/common/main/{locale}.xml'
  p=ROOT/'data/cldr'/f'{locale}.xml';p.parent.mkdir(parents=True,exist_ok=True)
  if not p.exists():p.write_bytes(urllib.request.urlopen(url).read())
  manifest['files'][locale+'.xml']={'url':url,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
 (ROOT/'data/cldr-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
if __name__=='__main__':
 fetch()
 fetch_cldr()
