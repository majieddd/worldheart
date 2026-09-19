// Applied after legacy generation prompts are composed, so saved image receipts stay exact.
export function applyXenoCanon(catalogue){
 catalogue.direction='Painted-Anime-Inkline';
 const f=catalogue.factions.find(f=>f.id==='alien');if(!f)return catalogue;
 f.name='Xeno';f.origin='Original invading species';f.color='#c9b1ec';
 f.identity='Layered living chitin and an ivory hooked brow unite five elemental forms. Purple Void scouts arrive first; reddish-brown Physical Xeno endure Mars and travel inside meteors.';
 f.materials='Element-colored chitin, an ivory hooked brow and contained capillary light. Brown Physical shells are heavy; purple Void armor is thin and narrow.';
 f.motto='The scouts arrive before the stone.';
 f.world={...f.world,name:'Mars / The meteor dwellers',terrain:'Reddish-brown Physical Xeno inhabit Martian canyons and shelter inside hollow meteors. Layered rust rock, deep cool shadows and enormous natural cavities establish their weight and endurance. Void scouts use a separate teleportation system; their homeworld remains undefined.',play:'Narrow canyon approaches favor slow armored defenders; side passages expose their turning weakness. Open craters offer construction space, with meteor cavities as visible threat sources.'};
 f.commanders[0].role='Physical vanguard';f.commanders[0].canon='Original Xeno commander proposal. Physical lineage; brown meteor-dweller material study.';
 f.commanders[1].role='Physical brood guardian';f.commanders[1].canon='Original Xeno commander proposal. Slow Physical endurance specialist from the Martian lineage.';
 f.commanders[2].role='Void scout commander';f.commanders[2].canon='Original Xeno commander proposal. Purple, physically fragile and element-resistant. The updated roster and elemental lineup establish the current appearance.';
 f.commanders[2].stats={Power:1,Speed:5,Health:1,Complexity:4};
 f.commanders[2].active.effect='Teleport to a visible nearby scouting position after a clear departure tell.';
 f.commanders[2].active.limit='Physically fragile and briefly exposed on reappearance; elemental resistance does not stop physical attacks.';
 f.commanders[2].active.cue='A sharp violet aperture collapses to a thin outline at the landing point.';
 f.units[0].role='Void recon unit';f.units[0].behavior='Scout ahead and briefly teleport between exposed approach positions after a visible tell.';f.units[0].tradeoff='Very weak to physical pressure; teleport recovery leaves the scout exposed.';
 f.units[1].role='Physical defender';f.units[2].role='Poison ranged support';f.units[2].behavior='Float behind the frontline and lob small, outlined toxin pools that shape an approach.';f.units[2].tradeoff='Little immediate damage; mobile enemies can leave the marked pools.';
 return catalogue;
}
