import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const dir=resolve(process.argv[2]),browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1600,height:600}});
try{for(const lane of ['formations','terrain','biomes','themes']){
 const files=readdirSync(dir).filter(f=>f.startsWith(lane+'-')&&f.endsWith('.png'));
 for(let offset=0;offset<files.length;offset+=10){const batch=files.slice(offset,offset+10);
  const html=`<style>*{box-sizing:border-box}body{margin:0;background:#122332;color:#e6eeea;font:16px sans-serif}main{display:grid;grid-template-columns:repeat(5,320px)}article{height:300px;overflow:hidden}p{margin:6px}div{height:270px;overflow:hidden;position:relative}img{position:absolute;width:435px;height:272px;left:-100px;top:0}</style><main>${batch.map(file=>`<article><p>${file.replace(lane+'-','').replace('.png','')}</p><div><img src="data:image/png;base64,${readFileSync(resolve(dir,file)).toString('base64')}"></div></article>`).join('')}</main>`;
  await page.setContent(html);await page.screenshot({path:resolve(dir,`sheet-${lane}-${offset/10+1}.png`)});
 }
}}finally{await browser.close();}
