import * as THREE from 'three';
import {earthCoastDistance} from './run/earth-coast.js';

// A tiny isolated scene, never a second planet-generation job. No simulation.
export function openingCinema(host){
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.domElement.className='first-cinema-canvas';host.prepend(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,1,.1,100);camera.position.set(0,0,9);
  scene.add(new THREE.HemisphereLight(0x9abfee,0x19213d,2));const sun=new THREE.DirectionalLight(0xffddad,3);sun.position.set(-4,3,5);scene.add(sun);
  const textureCanvas=document.createElement('canvas');textureCanvas.width=512;textureCanvas.height=256;const ctx=textureCanvas.getContext('2d');
  for(let y=0;y<256;y++)for(let x=0;x<512;x++){
    const lat=90-y/256*180,lon=x/512*360-180,land=earthCoastDistance(lon,lat)>0;
    ctx.fillStyle=Math.abs(lat)>70?'#d9e8e2':land?(Math.abs(lat)<28?'#8b9b61':'#477963'):'#245687';ctx.fillRect(x,y,1,1);
  }
  const texture=new THREE.CanvasTexture(textureCanvas);texture.colorSpace=THREE.SRGBColorSpace;
  const earth=new THREE.Mesh(new THREE.SphereGeometry(2.1,64,40),new THREE.MeshStandardMaterial({map:texture,roughness:1}));earth.position.set(-1,-.8,0);earth.rotation.z=.18;scene.add(earth);
  const rim=new THREE.Mesh(new THREE.SphereGeometry(2.14,40,24),new THREE.MeshBasicMaterial({color:0x73c4eb,side:THREE.BackSide,transparent:true,opacity:.55}));earth.add(rim);
  const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.25,1),new THREE.MeshStandardMaterial({color:0x8a4b31,roughness:1,flatShading:true}));scene.add(rock);
  const tail=new THREE.Mesh(new THREE.ConeGeometry(.17,1.8,8),new THREE.MeshBasicMaterial({color:0xefaa6a,transparent:true,opacity:.55}));rock.add(tail);tail.position.set(.65,.65,0);tail.rotation.z=-Math.PI/4;
  const stars=new Float32Array(360);for(let i=0;i<stars.length;i+=3){stars[i]=Math.sin(i*13.7)*12;stars[i+1]=Math.sin(i*2.91)*7;stars[i+2]=-8-Math.abs(Math.cos(i)*8);}
  const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.BufferAttribute(stars,3));scene.add(new THREE.Points(starGeometry,new THREE.PointsMaterial({color:0xc8d2e2,size:.025})));
  const resize=()=>{renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();};resize();
  const observer=new ResizeObserver(resize);observer.observe(host);
  return {draw(t){earth.rotation.y=.8+t*.035;rock.position.set(3-t*.29,2-t*.18,1);rock.rotation.x=t*.3;renderer.render(scene,camera);},dispose(){observer.disconnect();scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});texture.dispose();renderer.dispose();renderer.domElement.remove();}};
}
