"""Original synthesized audio, deterministic, no samples or external input. Python stdlib only."""
from pathlib import Path
import math, struct, wave
OUT=Path(__file__).resolve().parents[1]/'public/audio'
RATE=22050
OUT.mkdir(exist_ok=True,parents=True)
def save(name, samples):
 with wave.open(str(OUT/(name+'.wav')),'wb') as f:
  f.setnchannels(1); f.setsampwidth(2); f.setframerate(RATE)
  f.writeframes(b''.join(struct.pack('<h',int(max(-1,min(1,v))*32767)) for v in samples))
def note(freq,seconds,amp=.23):
 n=int(seconds*RATE)
 return [amp*math.sin(2*math.pi*freq*i/RATE)*min(1,i/(RATE*.008))*math.exp(-5*i/n) for i in range(n)]
for name,freq in [('pickup',520),('place',330),('reject',155),('clear',660),('combo',785),('perfect',1047),('gameover',196)]:
 save(name,note(freq,.14 if name in ('pickup','place') else .35))
# 32-second quiet original arpeggio; each phrase decays to silence for a clean loop.
scale=[220,277.1826,329.6276,415.3047,246.9417,293.6648,369.9944,440]
samples=[0.]*(RATE*32)
for beat in range(64):
 freq=scale[(beat*3+beat//16)%len(scale)]
 tone=note(freq,1.25,.10)
 start=int(beat*.5*RATE)
 for j,v in enumerate(tone):
  if start+j<len(samples): samples[start+j]+=v
save('workshop',samples)
