import sys, time
sys.path.insert(0,'.')
import toolkit as T, importlib
mods=sys.argv[1:]
reg=T.Registry('/tmp/claude-0/test_audio')
for m in mods:
    t0=time.time(); importlib.import_module(m).build(reg); print(m, round(time.time()-t0,1),'s')
reg.write_manifest(); print(reg.bytes/1e6,'MB')
