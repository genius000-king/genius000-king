import sys, json, numpy as np, soundfile as sf, os
root=os.environ.get('AUDIO_ROOT','/tmp/claude-0/test_audio')
man=json.load(open(root+'/manifest.json'))
edges=[0,100,250,600,1500,4000,8000,24000]
print('band %:', edges)
for ev in sys.argv[1:]:
    x,sr=sf.read(f"{root}/{man[ev]['files'][0]}"); x=x.mean(1) if x.ndim==2 else x
    sp=np.abs(np.fft.rfft(x))**2; f=np.fft.rfftfreq(len(x),1/sr)
    e=[sp[(f>=a)&(f<b)].sum() for a,b in zip(edges[:-1],edges[1:])]; e=np.array(e)/sum(e)*100
    print(f"{ev:22s}", ' '.join(f"{v:5.1f}" for v in e))
