"""Strict parser for the literal/range/string UnicodeSet subset in these pinned CLDR exemplars.
Unsupported property sets, operators and syntax raise rather than silently dropping data.
"""
import re,xml.etree.ElementTree as ET
from pathlib import Path
TOKEN=re.compile(r'\\(?:u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8}|x\{[0-9A-Fa-f]+\}|.)|\{(?:\\.|[^}])*\}|.',re.S)
def decode(t):
 if not t.startswith('\\'):return t
 if t[1:2] in ('u','U'):return chr(int(t[2:],16))
 if t.startswith('\\x{'):return chr(int(t[3:-1],16))
 return t[1:]
def parse(s):
 assert s.startswith('[') and s.endswith(']'),s
 tokens=[t for t in TOKEN.findall(s[1:-1]) if not t.isspace()];points=set();strings=[];i=0
 while i<len(tokens):
  t=tokens[i]
  if t.startswith('{'):
   seq=''.join(decode(x) for x in TOKEN.findall(t[1:-1]));assert seq
   strings.append(seq);points.update(map(ord,seq));i+=1;continue
  assert t not in '[]^&:',('Unsupported UnicodeSet syntax',t,s)
  c=decode(t);assert len(c)==1
  if i+2<len(tokens) and tokens[i+1]=='-':
   b=decode(tokens[i+2]);assert len(b)==1 and ord(c)<=ord(b)
   points.update(range(ord(c),ord(b)+1));i+=3
  else:points.add(ord(c));i+=1
 return points,strings

def load(directory,locale):
 tree=ET.parse(Path(directory)/(locale+'.xml'));pts=set();strings=[];evidence=[]
 for e in tree.findall('./characters/exemplarCharacters'):
  kind=e.get('type','main')
  if kind not in ('main','auxiliary','index') or e.get('alt'):continue
  value=(e.text or '').strip()
  if value=='↑↑↑':continue
  p,s=parse(value);pts|=p;strings+=s;evidence.append({'type':kind,'draft':e.get('draft','approved'),'pattern':value})
 assert evidence,locale
 return pts,sorted(set(strings)),evidence
