import sys, time
sys.path.insert(0,'.')
import toolkit as T, gen_music as G
name=sys.argv[1]
t0=time.time(); x=getattr(G,name)(); print(name, x.shape, x.shape[0]/48000, 's', round(time.time()-t0,1), 'render sec; peak', T.peak_db(x), 'lufs', T.lufs(x))
reg=T.Registry('/tmp/claude-0/test_audio')
reg.add(name,'music',[x],loop=name in('mus_menu','mus_hub','mus_verdant','mus_tension'),lufs_target=-18,peak=-2.5,bus='Music',is_mono=False,ceiling=-1.8,look_ms=12,fade_edges=name not in('mus_menu','mus_hub','mus_verdant','mus_tension'))
reg.write_manifest() if False else None
import json,os
p='/tmp/claude-0/test_audio/manifest.json'
m=json.load(open(p)) if os.path.exists(p) else {}
m.update(reg.events); json.dump(m,open(p,'w'))
