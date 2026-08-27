from pathlib import Path
from PIL import Image

root = Path('/home/ubuntu/storage-cleaner-mobile/assets/images')
source = root / 'icon.png'
image = Image.open(source).convert('RGBA')
image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
for name in ('icon.png', 'splash-icon.png', 'favicon.png', 'android-icon-foreground.png'):
    image.save(root / name, format='PNG', optimize=True, compress_level=9)
