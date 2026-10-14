"""Generate read-aloud MP3s for lesson stories (tap-*.html -> audio/tap-*.mp3).

Each story sentence is synthesized separately (split exactly like the page JS does),
then concatenated; sentence start times go into <body data-audio-times> so the page
can highlight the sentence being read.

Usage:  python tools/build-audio.py            # only lessons without audio yet
        python tools/build-audio.py --all      # regenerate everything
        python tools/build-audio.py tap-109.html tap-110.html
Requires: pip install edge-tts
"""
import asyncio, glob, html, os, re, sys

import edge_tts

VOICE = 'vi-VN-HoaiMyNeural'
RATE = '-5%'
BITRATE = 48000  # edge-tts default output: audio-24khz-48kbitrate-mono-mp3
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SENT_RE = re.compile(r'[^.!?…]+[.!?…]*')  # mirrors splitSentences() in the page script


def speakable_numbers(text):
    """'1.920.000đ' -> '1 triệu 920 nghìn đồng', '180.000đ' -> '180 nghìn đồng' (dots break sentence split)."""
    def conv(m):
        parts = m.group(1).split('.')
        n = int(''.join(parts))
        tr, ng, dv = n // 1_000_000, (n // 1000) % 1000, n % 1000
        out = []
        if tr: out.append(f'{tr} triệu')
        if ng: out.append(f'{ng} nghìn')
        if dv: out.append(str(dv))
        return ' '.join(out) + ' đồng'
    return re.sub(r'(\d{1,3}(?:\.\d{3})+)\s?(?:đồng|đ)(?![\wà-ỹ])', conv, text)


def story_sentences(page):
    inner = re.search(r'<div class="story-box">(.*?)</div>', page, re.S).group(1)
    out = []
    for p in re.findall(r'<p>(.*?)</p>', inner, re.S):
        t = html.unescape(re.sub(r'<[^>]+>', '', p))
        out.extend(SENT_RE.findall(t) or [t])
    return out


async def tts(text, sem):
    async with sem:
        for attempt in range(4):
            try:
                buf = bytearray()
                async for ch in edge_tts.Communicate(text, VOICE, rate=RATE).stream():
                    if ch['type'] == 'audio':
                        buf += ch['data']
                return bytes(buf)
            except Exception:
                if attempt == 3:
                    raise
                await asyncio.sleep(2 * (attempt + 1))


async def build(fname, sem):
    path = os.path.join(ROOT, fname)
    page = open(path, encoding='utf-8').read()
    # make prices speakable inside the story only
    page = re.sub(r'(<div class="story-box">.*?</div>)', lambda m: speakable_numbers(m.group(1)), page, count=1, flags=re.S)
    sents = story_sentences(page)
    clips = await asyncio.gather(*[tts(s.strip(), sem) if re.search(r'\w', s) else asyncio.sleep(0, b'') for s in sents])
    times, t = [], 0.0
    for c in clips:
        times.append(round(t, 2))
        t += len(c) * 8 / BITRATE
    stem = fname[:-5]
    os.makedirs(os.path.join(ROOT, 'audio'), exist_ok=True)
    with open(os.path.join(ROOT, 'audio', stem + '.mp3'), 'wb') as f:
        f.write(b''.join(clips))
    body = f'<body data-audio="audio/{stem}.mp3" data-audio-times="{",".join(map(str, times))}">'
    page = re.sub(r'<body[^>]*>', body, page, count=1)
    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(page)
    print(f'{fname}: {len(sents)} câu, {t:.0f}s', flush=True)


async def main(args):
    files = [a for a in args if a.endswith('.html')]
    if not files:
        files = sorted(os.path.basename(p) for p in glob.glob(os.path.join(ROOT, 'tap-*.html')))
        if '--all' not in args:
            files = [f for f in files if not os.path.exists(os.path.join(ROOT, 'audio', f[:-5] + '.mp3'))]
    sem = asyncio.Semaphore(6)
    for i in range(0, len(files), 6):
        await asyncio.gather(*[build(f, sem) for f in files[i:i + 6]])


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    asyncio.run(main(sys.argv[1:]))
