#!/usr/bin/env python3
"""
Cut the website clips out of the recorded videos.

1. Run "README screenshots" from the Actions tab and download the
   "readme-screenshots" artifact.
2. python3 scripts/make-clips.py <artifact folder>/clips

Writes app/public/clips/<name>.mp4 (silent, looping-friendly H.264) and a
<name>.jpg poster (the clip's last frame). Waits for the network are sped up.
Needs ffmpeg.
"""
import json
import subprocess
import sys
from pathlib import Path

SPEEDUP = 6.0  # how much faster network waits play
PAD = 0.25  # seconds kept before and after each clip
OUT = Path(__file__).resolve().parent.parent / "app" / "public" / "clips"


def parts(clip):
    """(start, end, speed) pieces covering the clip, with waits sped up."""
    t, end = max(0.0, clip["start"] - PAD), clip["end"] + PAD
    out = []
    for a, b in sorted(clip["fast"]):
        a, b = max(a + 0.4, t), min(b - 0.3, end)  # keep a moment of the spinner at normal speed
        if b - a < 1.0:
            continue
        out.append((t, a, 1.0))
        out.append((a, b, SPEEDUP))
        t = b
    out.append((t, end, 1.0))
    return [p for p in out if p[1] - p[0] > 0.05]


def main(src: Path):
    timeline = json.loads((src / "timeline.json").read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    for clip in timeline["clips"]:
        video = src / f"{clip['who']}.webm"
        pieces = parts(clip)
        chains, labels = [], []
        for i, (a, b, speed) in enumerate(pieces):
            chains.append(f"[0:v]trim=start={a:.3f}:end={b:.3f},setpts=(PTS-STARTPTS)/{speed}[p{i}]")
            labels.append(f"[p{i}]")
        graph = ";".join(chains) + f";{''.join(labels)}concat=n={len(pieces)}:v=1:a=0,fps=25,format=yuv420p[v]"
        mp4 = OUT / f"{clip['name']}.mp4"
        tmp = OUT / f"{clip['name']}.tmp.mp4"
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(video), "-filter_complex", graph, "-map", "[v]", "-an",
             "-c:v", "libx264", "-preset", "slow", "-crf", "30", "-movflags", "+faststart", str(tmp)],
            check=True,
        )
        tmp.rename(mp4)
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-sseof", "-0.3", "-i", str(mp4), "-frames:v", "1", "-q:v", "4", str(OUT / f"{clip['name']}.jpg")],
            check=True,
        )
        length = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(mp4)],
                                      capture_output=True, text=True).stdout)
        print(f"{clip['name']}: {length:.1f}s, {mp4.stat().st_size // 1024} KB")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))
