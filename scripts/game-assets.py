"""Original Ruin Relay pixel art. Rebuild with Python 3 + Pillow; runtime needs neither.

No downloaded or AI-generated artwork. All shapes, textures and animation frames
are authored here and released under the repository's MIT license.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib
import json
import math
import random

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/assets/game/v1'
OUT.mkdir(parents=True, exist_ok=True)
frames = {}
images = []


def image(size):
    im = Image.new('RGBA', size)
    return im, ImageDraw.Draw(im)


def add(key, im, anchor):
    images.append((key, im, anchor))


def floor(variant):
    im, d = image((64, 32))
    shape = [(32, 0), (63, 15), (32, 31), (0, 15)]
    d.polygon(shape, fill='#293b40')
    d.line([(0, 15), (32, 0), (63, 15)], fill='#697773', width=1)
    d.line([(0, 16), (32, 31), (63, 16)], fill='#18272d', width=2)
    randomizer = random.Random(81 + variant)
    # World-aligned mortar lines; alpha clipping preserves the exact diamond.
    detail, ink = image((64, 32))
    for offset in (-24, -8, 8, 24):
        ink.line([(offset, 0), (offset + 64, 32)], fill='#17282d', width=1)
    for offset in (8, 24, 40, 56, 72):
        ink.line([(offset, 0), (offset - 64, 32)], fill='#1c2d32', width=1)
    for _ in range(80):
        x, y = randomizer.randrange(64), randomizer.randrange(32)
        ink.point((x, y), fill=randomizer.choice(['#3b4b4d', '#425352', '#25363b']))
    if variant == 1:
        ink.line([(20, 12), (28, 15), (25, 18), (31, 21)], fill='#102126')
        ink.line([(28, 15), (34, 13), (37, 14)], fill='#14252b')
    if variant == 2:
        for _ in range(18):
            x, y = randomizer.randrange(20, 42), randomizer.randrange(16, 24)
            ink.rectangle((x, y, x + 1, y), fill=randomizer.choice(['#4c6045', '#66744e']))
    detail.putalpha(Image.composite(detail.getchannel('A'), Image.new('L', im.size), im.getchannel('A')))
    im.alpha_composite(detail)
    return im


def wall(variant):
    im, d = image((64, 80))
    # Ground center (32,64), 36px elevation. Two visible foreground faces.
    left = [(0, 28), (32, 44), (32, 79), (0, 63)]
    right = [(32, 44), (63, 28), (63, 63), (32, 79)]
    top = [(0, 28), (32, 12), (63, 28), (32, 44)]
    d.polygon(left, fill='#455352'); d.polygon(right, fill='#2f4143')
    d.polygon(top, fill='#74817a')
    d.line([(0, 28), (32, 12), (63, 28)], fill='#b0b5a0', width=1)
    d.line([(0, 29), (32, 45), (63, 29)], fill='#97a18e', width=1)
    for level in (12, 24):
        d.line([(1, 28 + level), (32, 44 + level), (62, 28 + level)], fill='#213438', width=2)
        d.line([(1, 27 + level), (31, 42 + level)], fill='#596660', width=1)
    d.line([(17, 37), (17, 48)], fill='#273c3d', width=2)
    d.line([(9, 46), (9, 57)], fill='#24383b', width=2)
    d.line([(23, 65), (23, 74)], fill='#24383b', width=2)
    d.line([(47, 37), (47, 48)], fill='#1f3337', width=2)
    d.line([(55, 46), (55, 58)], fill='#1f3337', width=2)
    d.line([(41, 64), (41, 74)], fill='#1f3337', width=2)
    d.line([(32, 45), (32, 78)], fill='#667168', width=1)
    d.line([(12, 25), (28, 18), (42, 24), (28, 31), (12, 25)], fill='#5b6c65')
    d.line([(28, 18), (28, 31)], fill='#536760')
    if variant:
        d.line([(43, 24), (40, 28), (43, 34), (40, 37)], fill='#3b504c')
        for x, y in [(6, 29), (9, 30), (10, 32), (15, 34), (52, 33), (53, 35)]:
            d.rectangle((x, y, x + 3, y + 1), fill='#75835b')
    return im


def start():
    im, d = image((64, 64))
    d.polygon([(4, 48), (31, 34), (59, 48), (32, 62)], fill='#19282e')
    for step in range(4):
        y = 38 + step * 4
        d.polygon([(14, y + 8), (30, y), (50, y + 10), (34, y + 18)], fill=['#4b605f', '#405653', '#36504e', '#294540'][step])
        d.line([(14, y + 8), (34, y + 18), (50, y + 10)], fill='#80a798')
    d.polygon([(31, 41), (38, 44), (31, 48), (24, 44)], outline='#b8d9b5')
    return im


def exit_gate():
    im, d = image((64, 96))
    # An open portal, not a closed door requiring a key.
    d.polygon([(6, 79), (32, 66), (59, 79), (32, 93)], fill='#223d3b')
    d.polygon([(16, 75), (16, 30), (35, 21), (47, 29), (47, 74), (32, 83)], fill='#13282c')
    d.polygon([(22, 74), (22, 35), (35, 28), (41, 33), (41, 74), (32, 78)], fill='#438979')
    d.polygon([(26, 74), (26, 38), (35, 33), (38, 36), (38, 74), (32, 77)], fill='#94d5b8')
    d.polygon([(11, 77), (11, 31), (21, 26), (21, 76), (16, 81)], fill='#526861')
    d.polygon([(43, 77), (43, 28), (52, 32), (52, 77), (47, 81)], fill='#3c5551')
    for y in (40, 54, 68):
        d.line([(11, y), (21, y - 5)], fill='#263c3c', width=2)
        d.line([(43, y - 2), (52, y + 2)], fill='#203839', width=2)
    d.polygon([(9, 32), (9, 23), (32, 12), (55, 23), (55, 32), (32, 21)], fill='#8b9987')
    d.line([(9, 23), (32, 12), (55, 23)], fill='#c2c6a5')
    d.line([(32, 17), (32, 24), (29, 21), (32, 17), (35, 21), (32, 24)], fill='#a9eed1', width=1)
    d.line([(14, 80), (32, 88), (50, 80)], fill='#77bc9f')
    return im


def adventurer(direction, frame, walking):
    im, d = image((48, 64))
    right = direction in ('ne', 'se')
    back = direction in ('ne', 'nw')
    stride = int(round(math.sin(frame / 6 * math.tau) * 3)) if walking else 0
    bob = (1 if frame in (1, 4) else 0) if walking else (1 if frame == 2 else 0)
    y = bob
    # Thick pixel silhouettes and consistent foot contact.
    d.rectangle((17 + stride, 49, 22 + stride, 55), fill='#16252c')
    d.rectangle((25 - stride, 49, 30 - stride, 55), fill='#16252c')
    d.rectangle((16 + stride, 54, 23 + stride, 55), fill='#9a8060')
    d.rectangle((24 - stride, 54, 31 - stride, 55), fill='#a18d68')
    d.polygon([(17, 31+y), (30, 31+y), (35, 49), (29, 52), (24, 50), (18, 53), (12, 49)], fill='#162d36')
    d.polygon([(18, 31+y), (28, 31+y), (32, 48), (25, 50), (15, 48)], fill='#527f7c')
    d.line([(18, 34+y), (15, 47)], fill='#86aaa0', width=2)
    d.line([(28, 35+y), (31, 48)], fill='#33565c', width=2)
    if back:
        d.rectangle((18, 34+y, 29, 44+y), fill='#a18a60')
        d.rectangle((20, 36+y, 27, 42+y), fill='#756b4e')
        d.line([(24, 34+y), (24, 43+y)], fill='#cab482')
    else:
        d.line([(17, 39+y), (30, 42+y)], fill='#bca376', width=2)
        d.rectangle((23, 41+y, 26, 43+y), fill='#e2ce93')
    d.polygon([(15, 28+y), (18, 17+y), (28, 15+y), (34, 24+y), (31, 33+y), (20, 35+y)], fill='#18313a')
    d.polygon([(17, 27+y), (20, 19+y), (27, 18+y), (31, 25+y), (27, 32+y), (20, 32+y)], fill='#648f87')
    d.line([(19, 21+y), (22, 18+y), (27, 18+y)], fill='#a1b8a0', width=1)
    if not back:
        face_x = 25 if right else 19
        d.rectangle((face_x, 25+y, face_x+5, 30+y), fill='#e2bd87')
        d.point((face_x+(4 if right else 1), 26+y), fill='#253330')
        d.line([(face_x, 31+y), (face_x+5, 31+y)], fill='#a18661')
    else:
        d.line([(20, 26+y), (29, 24+y)], fill='#3c6566', width=2)
    # Lantern stays on the same world-facing side rather than arbitrary mirroring.
    lx = 34 if right else 10
    d.line([(29 if right else 17, 36+y), (lx, 40+y)], fill='#d8b17d', width=3)
    d.arc((lx-3, 39+y, lx+3, 45+y), 180, 360, fill='#d5bb7d')
    d.rectangle((lx-3, 44+y, lx+3, 51+y), fill='#202e32')
    d.rectangle((lx-2, 45+y, lx+2, 49+y), fill='#e9b866')
    d.rectangle((lx-1, 46+y, lx+1, 48+y), fill='#fff0bc')
    return im


def effect(kind, frame):
    im, d = image((96, 96))
    randomizer = random.Random(447 if kind == 'break' else 448)
    progress = frame / 7
    for _ in range(14):
        angle = randomizer.random() * math.tau
        radius = randomizer.randrange(10, 29) * progress
        px = round(48 + math.cos(angle)*radius)
        py = round(64 + math.sin(angle)*radius*0.5 - math.sin(progress*math.pi)*randomizer.randrange(8, 23))
        size = max(1, round((1-progress)*randomizer.randrange(2, 5)))
        color = (157, 162, 133, round((1-progress)*220)) if kind == 'break' else (130, 216, 181, round((1-progress)*220))
        d.rectangle((px, py, px+size, py+size), fill=color)
    return im


for n in range(3): add(f'floor/stone-0{n+1}', floor(n), (32, 16))
for n in range(2): add(f'wall/stone-0{n+1}', wall(n), (32, 64))
add('endpoint/start', start(), (32, 48))
add('endpoint/exit', exit_gate(), (32, 80))
for direction in ('nw', 'ne', 'se', 'sw'):
    for n in range(4): add(f'player/idle/{direction}/{n:02}', adventurer(direction, n, False), (24, 56))
    for n in range(6): add(f'player/walk/{direction}/{n:02}', adventurer(direction, n, True), (24, 56))
shadow, ink = image((32, 16)); ink.ellipse((1, 3, 30, 13), fill=(3, 13, 19, 105))
add('player/shadow', shadow, (16, 8))
for kind in ('build', 'break'):
    for n in range(8): add(f'fx/{kind}/{n:02}', effect(kind, n), (48, 64))

# Fixed untrimmed cells and 2px padding eliminate pivot ambiguity and atlas bleed.
CELL, COLS = 100, 8
rows = math.ceil(len(images)/COLS)
atlas = Image.new('RGBA', (COLS*CELL, rows*CELL))
for index, (key, im, anchor) in enumerate(images):
    x, y = index % COLS * CELL + 2, index // COLS * CELL + 2
    atlas.alpha_composite(im, (x, y))
    frames[key] = {
        'frame': {'x': x, 'y': y, 'w': im.width, 'h': im.height},
        'rotated': False, 'trimmed': False,
        'spriteSourceSize': {'x': 0, 'y': 0, 'w': im.width, 'h': im.height},
        'sourceSize': {'w': im.width, 'h': im.height},
        'pivot': {'x': anchor[0]/im.width, 'y': anchor[1]/im.height},
    }
atlas.save(OUT/'dungeon.png', optimize=True)
(OUT/'dungeon.json').write_text(json.dumps({'frames': frames, 'meta': {
    'app': 'Ruin Relay original art generator', 'version': '1',
    'image': 'dungeon.png', 'format': 'RGBA8888',
    'size': {'w': atlas.width, 'h': atlas.height}, 'scale': '1',
}}, indent=2)+'\n')
manifest = {
    'version': 1, 'projection': {'view': 'SW to NE', 'tileWidth': 64, 'tileHeight': 32},
    'atlas': 'dungeon.png', 'metadata': 'dungeon.json', 'frameCount': len(frames),
    'sha256': hashlib.sha256((OUT/'dungeon.png').read_bytes()).hexdigest(),
    'provenance': {'creator': 'Ruin Relay project', 'method': 'Original deterministic pixel drawing',
                   'source': 'scripts/game-assets.py', 'license': 'MIT',
                   'thirdPartyArt': False, 'aiGeneratedArt': False},
}
(OUT/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
(OUT/'credits.md').write_text('# Ruin Relay original dungeon assets\n\n'
    'All 64 frames are original pixel artwork drawn by `scripts/game-assets.py`.\n'
    'Licensed under the repository MIT license. No third-party or AI-generated artwork.\n'
    'Rebuild requires Python 3 and Pillow. Runtime uses the checked-in atlas.\n')
print(f'Wrote {len(frames)} frames, {atlas.width}×{atlas.height}, {(OUT/"dungeon.png").stat().st_size} bytes')
