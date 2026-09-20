// Missing versions identify pre-kit saves. Never reinterpret their geometry.
export const CURRENT_TERRAIN_VERSION=3;
export const validTerrainVersion=v=>v===undefined||Number.isInteger(v)&&v>=0&&v<=CURRENT_TERRAIN_VERSION;
export const savedTerrainVersion=record=>record?.terrainVersion??0;
