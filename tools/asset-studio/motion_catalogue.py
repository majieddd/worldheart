"""One independent guide and conversion receipt per animation, with explicit intent."""
CLIPS={
 'idle':('Idle',True,'Remain standing in a relaxed idle. Subtle breath and weight shift; feet planted. One continuous repeatable cycle.'),
 'walk':('Walk',True,'Walk in place for four complete alternating steps. Heel contact, flat support, toe-off, knee flexion, pelvis weight shift and opposite arm swing. Constant cadence.'),
 'run':('Run',True,'Run in place for four complete alternating strides, with clear flight phases, bent elbows, dynamic knee drive and stable head. Constant cadence.'),
 'strike':('Punch',False,'From neutral anticipate one right-hand punch. Pelvis leads chest; extend right fist with soft elbow, left hand guards. Recover fully to neutral. Exactly one strike.'),
 'jump':('Jump',False,'From neutral crouch to load both legs, jump vertically with both feet leaving the floor, land with bent knees and recover to neutral. Exactly one jump.'),
 'wave':('Wave',False,'From neutral lift right arm, make one clear friendly greeting wave, then lower it to neutral. Feet planted.'),
 'death':('Death',False,'From standing take a non-graphic defeat, knees buckle, fall naturally to the floor and remain still. No injury, blood or dismemberment.'),
 'sword':('Sword strike',False,'Hold a plain training sword in the right hand. One deliberate diagonal slash with anticipation, torso rotation, elbow extension, follow-through and recovery. Left hand balances. Feet remain grounded.'),
 'rifle':('Rifle fire',False,'Hold a compact plasma rifle with both hands, right hand at trigger and left under fore-end. Raise to aim, brace shoulders, fire one controlled recoil impulse, recover and lower. No muzzle effects, smoke or projectiles.'),
}

def clip_brief(recipe,clip):
    if clip not in CLIPS:raise ValueError('Unknown animation.')
    label,loop,action=CLIPS[clip]
    # Use the same identity/style paragraph, without the old combined timeline.
    prompt=recipe['prompt'].split('12 seconds, real-time:')[0]
    prompt=prompt.replace('three-quarter side camera','three-quarter front camera')
    prompt=prompt.replace('VFX, props, text or UI','VFX, unrelated props, text or UI')
    prompt+=f'8 seconds. {action} Keep a fixed three-quarter front camera so both shoulders, knees and feet remain visible throughout. '
    prompt+='Neutral for the first and last second. ' if not loop and clip!='death' else ''
    prompt+='Preserve identity, outfit and limb lengths exactly. Clear separations between arms and torso. No camera movement, cuts, slow motion or motion blur. Silent.'
    return {**recipe,'version':2,'clip':clip,'label':label,'loop':loop,'duration':8,'prompt':prompt,'requestedPhases':[],
      'boundary':'Generate and review this animation independently. Video-to-rig conversion creates a separate candidate; approval of the video does not approve the model animation.'}
