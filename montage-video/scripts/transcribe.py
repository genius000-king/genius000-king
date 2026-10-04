import json, sys, time
from faster_whisper import WhisperModel
t=time.time()
m = WhisperModel(sys.argv[1], device="cpu", compute_type="int8", cpu_threads=4)
segs, info = m.transcribe(sys.argv[2], language="ar", word_timestamps=True, vad_filter=False, beam_size=5)
out=[]
for s in segs:
    out.append({"start":s.start,"end":s.end,"text":s.text,"words":[{"w":w.word,"s":w.start,"e":w.end,"p":w.probability} for w in s.words]})
    print(f"[{s.start:7.2f}-{s.end:7.2f}] {s.text}", flush=True)
json.dump(out, open(sys.argv[3],"w"), ensure_ascii=False, indent=1)
print("done in", round(time.time()-t), "s")
