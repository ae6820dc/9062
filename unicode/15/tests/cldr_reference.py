"""Independent CLDR UnicodeSet oracle using system ICU's normative parser.
Only test tooling needs ICU; the compiler and programs do not depend on it.
"""
import ctypes as C,ctypes.util,re,xml.etree.ElementTree as ET
libname=ctypes.util.find_library('icuuc')
if not libname:raise RuntimeError('Install system ICU (libicu-dev) for the independent CLDR parser test')
lib=C.CDLL(libname)
suffix=re.search(r'(?:\.so\.|\.)(\d+)',libname)
def fn(name,args,ret):
 f=getattr(lib,name+'_'+suffix[1]) if suffix else getattr(lib,name)
 f.argtypes=args;f.restype=ret;return f
U=C.c_uint16;I=C.c_int32;P=C.c_void_p
open_set=fn('uset_openPatternOptions',[C.POINTER(U),I,C.c_uint32,C.POINTER(I)],P)
close_set=fn('uset_close',[P],None)
count=fn('uset_getItemCount',[P],I)
get=fn('uset_getItem',[P,I,C.POINTER(I),C.POINTER(I),C.POINTER(U),I,C.POINTER(I)],I)
def parse(pattern):
 encoded=pattern.encode('utf-16-le');buf=(U*(len(encoded)//2)).from_buffer_copy(encoded);err=I(0)
 st=open_set(buf,len(buf),1,C.byref(err));assert err.value<=0,(pattern,err.value)
 points=set();strings=[]
 try:
  for i in range(count(st)):
   start=I();end=I();dest=(U*1024)();err=I(0)
   n=get(st,i,C.byref(start),C.byref(end),dest,1024,C.byref(err));assert err.value<=0
   if n:
    s=bytes(dest)[:n*2].decode('utf-16-le');strings.append(s);points.update(map(ord,s))
   else:points.update(range(start.value,end.value+1))
 finally:close_set(st)
 return points,strings

def reference(directory,locale):
 tree=ET.parse(directory/(locale+'.xml'));pts=set();strings=[];evidence=[]
 for e in tree.findall('./characters/exemplarCharacters'):
  kind=e.get('type','main');value=(e.text or '').strip()
  if kind not in ('main','auxiliary','index') or e.get('alt') or value=='↑↑↑':continue
  p,s=parse(value);pts|=p;strings+=s;evidence.append({'type':kind,'draft':e.get('draft','approved'),'pattern':value})
 return pts,sorted(set(strings)),evidence
