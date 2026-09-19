"""Explicit, hash-bound engine conditioning. Never silently drop reviewed views."""
import hashlib
from pathlib import Path

ROLES = ('front', 'left', 'back', 'right')

def conditioning(project, root, engine):
    root = Path(root).resolve()
    def entry(name):
        path = (root / name).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            raise ValueError('Missing or invalid conditioning image')
        return {'file': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    pack = project.get('referencePack', {})
    if engine == 'hunyuan-mv':
        if not pack.get('complete') or pack.get('sourceModel'):
            raise ValueError('Multiview reconstruction needs a complete independent concept pack, not renders of an existing reconstruction.')
        views = {}
        for role in ROLES:
            item = pack.get('outputs', {}).get(role)
            if not item:
                raise ValueError('Missing multiview conditioning image: '+role)
            views[role] = entry(item['file'])
            if views[role]['sha256'] != item['sha256']:
                raise ValueError('Reference bytes changed: '+role)
        return {'engine':engine, 'views':views, 'unusedViews':['top','bottom','motion'],
                'note':'Four directional images condition geometry. Top, bottom and motion remain review guides; this model does not support those camera slots.'}
    return {'engine':engine, 'views':{'hero':entry(project['art'])},
            'unusedViews':list(pack.get('outputs', {})),
            'note':'Single-image engine. Directional guides do not condition geometry.'}
