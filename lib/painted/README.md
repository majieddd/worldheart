# Painted frontier assets

The commander, cannon and invader are the owner's existing reference assets,
pinned to worldheart-styles revision a7ade6bb5081ea852128becb42c0e9b14c64d020.
Source URLs, exact SHA-256 hashes and mesh counts are in provenance.json.
The source repository reports Meshy image_to_3d through Higgsfield. These models
were reused, not newly generated in this task. They are static, unrigged visual
specimens; retopology, articulated turrets, LODs and gameplay animation are open.

The GLTFLoader and BufferGeometryUtils in ../addons are official Three.js
0.180.0 modules, matching the existing vendored renderer. Sources:
https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js
https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/utils/BufferGeometryUtils.js
License: ../THREE-LICENSE.txt.

## Generated pigment texture

gouache.png was generated with the built-in image_gen tool for this study. Actual output: 1254 x 1254 pixels, 2,949,468 bytes (requested size differs).
SHA-256: 3cf37ea545196e7358c446183839dee36bbf686de2834e110b4aaa7957fc09c7.
Used as a restrained repeating world-space pigment multiplier on 3D surfaces.
Seamless tiling was requested; mathematical edge continuity was not verified.
The imported models retain their original embedded color textures.

Final generation prompt:

Use case: stylized-concept. Asset type: a reusable seamless PBR base-color texture for a live 3D game environment. Produce ONE square 1024 by 1024 seamless repeating texture tile, viewed orthographically straight down with no perspective. Hand-painted gouache and watercolor pigment on rough paper, soft retro-anime background-painting craft. Abstract mottled warm ivory and pale neutral gray pigment with medium and fine dry-brush strokes, broad irregular layered washes and tiny granular paper variation. Entire tile must have even neutral illumination with no directional shading, no recognizable objects, no horizon, no borders, no text, no rocks drawn as separate objects, no isolated focal point. This tile will multiply terrain and rock base colors in a shader; keep luminance variations restrained within roughly 65 to 95 percent lightness and saturation near zero. Edges must repeat seamlessly. Organic painterly surface, warm and tactile, never noisy static or photographic detail.
