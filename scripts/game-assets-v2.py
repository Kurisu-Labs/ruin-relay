"""Build atlas metadata for the unmodified imagegen spritesheets.

PNG pixels are never edited. Frame rectangles and foot pivots are metadata only.
Python + Pillow are needed only when rebuilding this checked-in metadata.
"""
from pathlib import Path
from PIL import Image
import hashlib
import json

OUT = Path(__file__).resolve().parent.parent / 'public/assets/game/v2'
ENV = ['floor/stone-01', 'floor/stone-02', 'floor/stone-03', 'floor/stone-04',
       'wall/stone-01', 'wall/stone-02', 'wall/stone-03', 'wall/stone-04',
       'decor/pillar', 'decor/brazier', 'decor/urn', 'decor/bones',
       'endpoint/start', 'endpoint/exit', 'decor/guardian', 'decor/fern']
HERO = [f'player/{direction}/{frame}' for direction in ('n', 'e', 's', 'w') for frame in range(4)]
manifest = {'version': 2, 'projection': 'screen-aligned top-down', 'tileSize': 96,
            'provenance': {'method': 'Built-in imagegen; unmodified generated PNGs',
                           'aiGeneratedArt': True, 'thirdPartyArt': False,
                           'prompts': 'prompts.md', 'credits': 'credits.md'}, 'atlases': []}
for name, keys in [('environment', ENV), ('adventurer', HERO)]:
    path = OUT / f'{name}.png'
    im = Image.open(path)
    assert im.mode == 'RGBA'
    alpha = im.getchannel('A')
    cuts = []
    for col in range(4):
        left, right = round(col*im.width/4), round((col+1)*im.width/4)
        column_cuts = [0]
        for row in range(1, 4):
            nominal = round(row*im.height/4)
            def occupancy(y):
                return sum(a > 100 for a in alpha.crop((left+3, y, right-3, y+1)).getdata())
            # Generated props can overhang a nominal cell. Split at the nearest
            # transparent gutter so the guardian and stair rims are not clipped.
            cut = min(range(nominal-32, nominal+33), key=lambda y: (occupancy(y), abs(y-nominal)))
            column_cuts.append(cut)
        cuts.append(column_cuts + [im.height])
    frames = {}
    for index, key in enumerate(keys):
        col, row = index % 4, index // 4
        x, y = round(col * im.width/4), cuts[col][row]
        right, bottom = round((col+1)*im.width/4), cuts[col][row+1]
        w, h = right-x, bottom-y
        if name == 'adventurer':
            # Only inspect alpha to locate the feet; keep the source raster unchanged.
            bounds = im.getchannel('A').crop((x, y, right, bottom)).point(lambda a: 255 if a > 100 else 0).getbbox()
            assert bounds, key
            pivot = {'x': .5, 'y': bounds[3]/h}
        else:
            # The first four opaque floors omit only their source-sheet padding.
            if row == 0:
                x += 10; y += 10; w -= 20; h -= 20
            pivot = {'x': .5, 'y': .5}
        frames[key] = {'frame': {'x':x, 'y':y, 'w':w, 'h':h}, 'rotated':False, 'trimmed':False,
                       'spriteSourceSize':{'x':0,'y':0,'w':w,'h':h}, 'sourceSize':{'w':w,'h':h}, 'pivot':pivot}
    metadata = {'frames':frames, 'meta':{'app':'Ruin Relay imagegen atlas metadata', 'version':'2',
                 'image':f'{name}.png','format':'RGBA8888','size':{'w':im.width,'h':im.height},'scale':'1'}}
    (OUT/f'{name}.json').write_text(json.dumps(metadata,indent=2)+'\n')
    manifest['atlases'].append({'image':f'{name}.png','metadata':f'{name}.json', 'frames':len(frames),
                               'width':im.width,'height':im.height,'bytes':path.stat().st_size,
                               'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Metadata written for 32 generated frames; source PNGs preserved.')
