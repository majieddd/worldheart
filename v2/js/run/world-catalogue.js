// Authored composition data shared by the pure campaign and rendering shell.
// Packs describe geology; biomes describe its surface ecology and materials.
export const TERRAIN_PACKS = Object.freeze({
  varied:{name:'Mixed Landscapes',range:100,canyon:54,snow:50,ocean:0,flight:32,spacing:116,valley:7,noise:1,weights:{range:5,hills:4,plateau:5,caldera:3,mesa:2,buttes:3,gorge:4,grand:3,forest:3,dunes:3,ravine:2,crevice:2,basin:2,volcano:2,valley:2,chaos:2,spine:2,labyrinth:2,impact:2,yardangs:2,drumlins:2,fan:2,karst:2,spiral:2,blades:2,spider:2,cells:2,stripes:2,escarpment:2,canyon:2,grotto:2,sky:1,geyser:2,delta:2,amphitheatre:2,cuesta:2,crescents:2,dome:2,pedestals:2,honeycomb:2,wave:2,scablands:2,box:2,kame:2,atoll:2,trunks:2,oxbow:2,shields:2,kettles:2,fulgurite:2}},
  alpine:{name:'Giant Peaks',range:150,canyon:65,snow:85,ocean:-.06,flight:65,spacing:194,valley:9,noise:.7,weights:{range:12,spine:4}},
  canyon:{name:'Deep Canyons',range:45,canyon:118,snow:70,ocean:-.09,flight:32,spacing:150,valley:8,noise:.45,weights:{grand:9,gorge:6,crevice:4,ravine:4,labyrinth:4,box:4,oxbow:3,spider:3,karst:3}},
  ocean:{name:'Ocean World',range:90,canyon:40,snow:50,ocean:.14,flight:36,spacing:118,valley:7,noise:.5,weights:{atoll:7,drumlins:4,volcano:3,caldera:3,plateau:4,range:3,fan:3,kame:3,delta:4,dome:2}},
  badlands:{name:'Badlands',range:82,canyon:70,snow:60,ocean:-.1,flight:38,spacing:126,valley:8,noise:.55,weights:{buttes:8,plateau:6,mesa:5,cuesta:6,amphitheatre:5,fan:3,box:4,pedestals:4,honeycomb:3}},
  karst:{name:'Karst Labyrinth',range:70,canyon:88,snow:60,ocean:-.04,flight:38,spacing:124,valley:8,noise:.35,weights:{karst:7,grotto:8,pedestals:5,honeycomb:4,box:3,labyrinth:4,forest:3}},
  geothermal:{name:'Geothermal Fields',range:118,canyon:56,snow:95,ocean:-.14,flight:50,spacing:140,valley:8,noise:.5,weights:{volcano:9,caldera:5,shields:7,geyser:8,chaos:4,stripes:3,fulgurite:2}},
  glacial:{name:'Glacial Frontiers',range:100,canyon:75,snow:28,ocean:.01,flight:48,spacing:142,valley:8,noise:.3,weights:{valley:8,spiral:6,drumlins:5,blades:5,kame:6,kettles:5,stripes:4,dome:3,cells:3}},
  aeolian:{name:'Windlands',range:92,canyon:38,snow:70,ocean:-.16,flight:38,spacing:128,valley:8,noise:.4,weights:{crescents:9,dunes:7,yardangs:6,wave:6,cuesta:4,fan:3,spider:2}},
  sky:{name:'Sky Reaches',range:104,canyon:60,snow:60,ocean:.06,flight:55,spacing:138,valley:8,noise:.6,weights:{sky:10,plateau:5,forest:5,trunks:5,fulgurite:5,grotto:3,dome:2}},
});

export const NEW_BIOMES = Object.freeze({
  redwood:{name:'Titan redwoods',ground:0x4b6747,rock:0x746755,accent:0x8b4436,decor:'redwood',note:'Towering russet trunks with high layered crowns and clear forest floor.'},
  bamboo:{name:'Bamboo thicket',ground:0x688646,rock:0x8c986c,accent:0xa4bc59,decor:'bamboo',note:'Jointed green stalk clusters and fans of narrow leaves.'},
  cherry:{name:'Cherry grove',ground:0x939471,rock:0x918993,accent:0xf2a8b9,decor:'cherry',note:'Low spreading pink blossom umbrellas on pale meadow.'},
  autumn:{name:'Copper woods',ground:0x9b7044,rock:0x82634e,accent:0xe07b36,decor:'autumn',note:'Copper, scarlet and amber crowns over rust leaf litter.'},
  baobab:{name:'Baobab scrub',ground:0xb19b57,rock:0x958061,accent:0x79864a,decor:'baobab',note:'Bottle trunks with a broad sparse crown in golden scrub.'},
  cloudforest:{name:'Cloud forest',ground:0x4d8d83,rock:0x678d8a,accent:0x98c9b3,decor:'cloudforest',note:'High mist-coloured crowns with hanging moss curtains.'},
  salt:{name:'Mirror salt flats',ground:0xe7dfcf,rock:0xc1b7b8,accent:0xa8d7d6,decor:'salt',note:'Pale polygon crust plates and low turquoise salt pools.'},
  sulfur:{name:'Sulfur springs',ground:0xc3ae36,rock:0x645743,accent:0xe8d749,decor:'sulfur',note:'Yellow mineral terraces and ochre steaming vents.'},
  obsidian:{name:'Obsidian wastes',ground:0x292735,rock:0x171d28,accent:0x756686,decor:'obsidian',note:'Dark glossy fractured fans and glass-black ground.'},
  coralreef:{name:'Coral gardens',ground:0x528f96,rock:0x8dcec1,accent:0xec987f,decor:'coralreef',note:'Branching coral antlers and colourful shallow reef shelves.'},
  kelp:{name:'Kelp forest',ground:0x305b68,rock:0x477b73,accent:0x9eb36c,decor:'kelp',note:'Tall winding ribbons anchored under ocean water.'},
  lichen:{name:'Lichen steppe',ground:0xadb49b,rock:0x80918c,accent:0xd9ba87,decor:'lichen',note:'Low rounded cushions, orange lichen and exposed grey stones.'},
  sponge:{name:'Sponge heath',ground:0x9b8183,rock:0x997f74,accent:0xe0b98b,decor:'sponge',note:'Hollow ochre tubes and perforated barrel colonies.'},
  carnivorous:{name:'Pitcher marsh',ground:0x3c5c57,rock:0x6f6d80,accent:0xb56179,decor:'carnivorous',note:'Large open pitcher cups, hooked hoods and low rosettes.'},
  aurora:{name:'Aurora grove',ground:0x283c55,rock:0x577889,accent:0x83e8cb,decor:'aurora',note:'Arching luminous fronds with pendant turquoise lights.'},
});

export const NEW_PLANET_THEMES = Object.freeze({
  titanforest:{name:'Titan Forest',orbit:.94,wetness:.36,activity:.13,pack:'karst',coverage:.72,biomes:['redwood','bamboo','cloudforest','woodland'],water:0x335f65,shore:0x829f79,weights:{forest:12,trunks:9,grotto:7,plateau:6},note:'Giant forest canopies above cave corridors and fallen fossil bridges.'},
  bloomsanctuary:{name:'Bloom Sanctuary',orbit:1,wetness:.08,activity:.06,pack:'badlands',coverage:.4,biomes:['cherry','meadow','autumn','cloudforest'],water:0x648ea7,shore:0xdbbdb5,weights:{plateau:12,mesa:6,hills:6,amphitheatre:7,fan:4},note:'Pink blossom terraces and copper foothills around pale open courts.'},
  sulfurfurnace:{name:'Sulfur Furnace',orbit:.63,wetness:-.58,activity:.96,pack:'geothermal',coverage:1,biomes:['sulfur','obsidian','volcanic'],water:0x9b812c,shore:0xd3bd43,weights:{geyser:12,shields:8,volcano:6,stripes:4},note:'Yellow mineral fields, black shields and erupting geothermal stairways.'},
  saltmirror:{name:'Salt Mirror',orbit:.85,wetness:-.72,activity:.08,pack:'aeolian',coverage:.8,biomes:['salt','lichen','desert'],water:0x8bc4c7,shore:0xf0e5d3,weights:{basin:12,cells:8,crescents:5,fan:6},note:'Bright salt continents cut by shallow blue pockets and wind-sculpted margins.'},
  reefocean:{name:'Reef Ocean',orbit:.97,wetness:.64,activity:.09,pack:'ocean',coverage:1,biomes:['coralreef','kelp','mangrove','wetland'],water:0x287f9a,shore:0xb7d8bd,weights:{atoll:16,delta:8,drumlins:5,fan:5},note:'Broken reef rings, ribbon kelp and wet islands separated by turquoise sea.'},
  skyarchipelago:{name:'Sky Archipelago',orbit:1.14,wetness:.17,activity:.16,pack:'sky',coverage:1,biomes:['aurora','cloudforest','lichen'],water:0x5878ab,shore:0xb3c0d9,weights:{sky:18,plateau:5,grotto:4,fulgurite:4},note:'Detached high slabs and luminous groves above misty lowland basins.'},
  fossil:{name:'Fossil World',orbit:1.21,wetness:-.37,activity:.05,pack:'badlands',coverage:.8,biomes:['salt','obsidian','lichen'],water:0x60757d,shore:0xcbbca3,weights:{trunks:15,pedestals:9,scablands:7,buttes:5},note:'Bleached fallen trunks and mushroom rock caps over charcoal and ivory ground.'},
  copperharvest:{name:'Copper Harvest',orbit:1.03,wetness:-.09,activity:.14,pack:'badlands',coverage:.55,biomes:['autumn','baobab','sponge','savanna'],water:0x607962,shore:0xceaa67,weights:{cuesta:10,kame:8,amphitheatre:7,mesa:5},note:'Amber step country, bottle trees and hollow sponge colonies on climbing benches.'},
  carnivorousfen:{name:'Carnivorous Fen',orbit:.9,wetness:.49,activity:.19,pack:'karst',coverage:.7,biomes:['carnivorous','bamboo','kelp','fungal'],water:0x405d59,shore:0x9a7187,weights:{oxbow:13,grotto:8,delta:8,karst:6},note:'Pitcher marshes occupy twisting drowned lowlands under tangled cave uplands.'},
  stormglass:{name:'Stormglass',orbit:1.33,wetness:-.11,activity:.45,pack:'sky',coverage:.85,biomes:['obsidian','aurora','sulfur'],water:0x393b73,shore:0x8c91c3,weights:{fulgurite:18,wave:9,spine:6,sky:3},note:'Black lightning-shaped ridges and luminous fronds border violet seas.'},
});
