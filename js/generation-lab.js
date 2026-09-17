const byId=id=>document.getElementById(id),fixture=byId('fixture'),view=byId('view'),wipe=byId('wipe');
function reveal(){const amount=view.value==='before'?0:view.value==='after'?100:Number(wipe.value);byId('after').style.clipPath=`inset(0 ${100-amount}% 0 0)`;byId('divider').style.left=amount+'%';byId('percentage').value=amount+'%';wipe.disabled=view.value!=='wipe';}
try{
  const response=await fetch('lib/generation-lab/evidence.json');if(!response.ok)throw Error('Evidence unavailable');
  const evidence=await response.json();
  for(const [i,row]of evidence.worlds.entries()){const option=document.createElement('option');option.value=i;option.textContent=row.name;fixture.append(option);}
  let selection=0;
  async function select(){
    const token=++selection;
    const row=evidence.worlds[Number(fixture.value)],before=byId('before'),after=byId('after');
    before.src='lib/generation-lab/'+row.beforeImage;after.src='lib/generation-lab/'+row.afterImage;
    byId('timing').textContent=`${(row.beforeMs/1000).toFixed(1)}s → ${(row.afterMs/1000).toFixed(1)}s`;
    byId('measurement').textContent=row.method||evidence.method;
    byId('parity').textContent=row.exact?'Exact generated-array match':'Output mismatch: experiment rejected';
    byId('scene').textContent=`Requested seed ${row.seed}. Accepted seed ${row.acceptedSeed}. ${row.nodes.toLocaleString()} navigation nodes.`;
    const query=new URLSearchParams({map:'ninetynine',campaign:'0',worldgen:'1',seed:row.seed,terrain:row.terrain,planet:row.theme});
    byId('open-before').href='./?'+query;query.set('generation','parallel');byId('open-after').href='./?'+query;
    byId('status').textContent='Loading matched captures…';
    try{await Promise.all([before.decode(),after.decode()]);}catch(error){if(token===selection)byId('status').textContent=error.message;return;}
    if(token!==selection)return;
    byId('status').textContent=row.status||evidence.status;reveal();
  }
  fixture.addEventListener('change',()=>select().catch(e=>byId('status').textContent=e.message));view.addEventListener('change',reveal);wipe.addEventListener('input',reveal);await select();
}catch(error){byId('status').textContent=error.message;}
