# Pevné řezy písem pro tiskoviny (tisk/fonts/).
# Chrome ukládá proměnná písma do PDF jako Type3, na což tiskárny při kontrole souboru upozorňují.
# Pevné řezy se vloží jako běžná TrueType písma. Vznikají z webových souborů v public/assets/fonts,
# takže obsahují i upravený háček. Stačí spustit jednou (python src/tiskova-pisma.py), vyžaduje fontTools.
import os
import shutil
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
src = os.path.join(root, 'public', 'assets', 'fonts')
out = os.path.join(root, 'tisk', 'fonts')
os.makedirs(out, exist_ok=True)

# zdroj, rodina, PostScriptový název, kurzíva, použité tloušťky, název výstupu
jobs = [
    ('editorial.woff2', 'Cormorant Garamond', 'CormorantGaramond', False, [300, 400, 500], 'editorial'),
    ('editorial-italic.woff2', 'Cormorant Garamond', 'CormorantGaramond', True, [400], 'editorial-italic'),
    ('text.woff2', 'Manrope', 'Manrope', False, [400, 500, 600], 'manrope'),
]
for file, family, ps, italic, weights, stem in jobs:
    for weight in weights:
        font = instantiateVariableFont(TTFont(os.path.join(src, file)), {'wght': weight})
        style = f"{weight}{' Italic' if italic else ''}"
        names = font['name']
        names.removeNames(nameID=25)
        for name_id, value in [(1, f'{family} {weight}'), (2, 'Italic' if italic else 'Regular'),
                               (4, f'{family} {style}'), (6, f"{ps}-{weight}{'Italic' if italic else ''}"),
                               (16, family), (17, style)]:
            names.setName(value, name_id, 3, 1, 0x409)
        font['OS/2'].usWeightClass = weight
        font.flavor = 'woff2'
        target = os.path.join(out, f'{stem}-{weight}.woff2')
        font.save(target)
        print(os.path.relpath(target, root), os.path.getsize(target), 'B')

for license_file in ('cormorantgaramond-OFL.txt', 'manrope-OFL.txt'):
    shutil.copy(os.path.join(src, license_file), out)
