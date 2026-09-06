// Creates a compact visual review sheet from actual browser pose captures.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
const require=createRequire(process.env.WH_NODE_MODULES?resolve(process.env.WH_NODE_MODULES,'package.json'):import.meta.url);
const {chromium}=require('playwright');
const poses=[['0','Rest'],['0.22','Anticipation'],['0.4','Strike'],['0.68','Recovery'],['1','Return']];
writeFileSync('artifacts/pose-sheet.html',`<!doctype html><meta charset="utf-8"><title>Bulwark arm review</title><style>body{margin:0;padding:24px;background:#101629;color:#e8ecf8;font:16px system-ui}h1{font-size:24px}section{display:grid;grid-template-columns:1fr 1fr;gap:12px}figure{margin:0}img{width:100%;display:block}figcaption{padding:8px}p{color:#abb5cc}</style><h1>Bulwark arm: attachment and silhouette</h1><p>Existing procedural kit. Left: original attachment. Right: corrected elbow direction, shorter tapered forearm. Fixed-pose fixtures, not live attack timing evidence.</p><section>${poses.map(([p,name])=>['before','after'].map(side=>`<figure><figcaption>${name} / ${side}</figcaption><img src="m1-${side}/bulwark-${p}.png"></figure>`).join('')).join('')}</section>`);
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage({viewport:{width:1280,height:720}});await page.goto('http://127.0.0.1:8139/artifacts/pose-sheet.html');await page.screenshot({path:'artifacts/m1/pose-sheet.jpg',type:'jpeg',quality:85,fullPage:true});}finally{await browser.close();}
