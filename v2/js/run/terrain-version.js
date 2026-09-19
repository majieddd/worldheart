// Missing versions identify pre-kit saves. Never reinterpret their geometry.
export const CURRENT_TERRAIN_VERSION=2;
export const validTerrainVersion=v=>v===undefined||v===0||v===1||v===CURRENT_TERRAIN_VERSION;
export const savedTerrainVersion=record=>record?.terrainVersion??0;
