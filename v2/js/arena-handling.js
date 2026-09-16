// Measured demo tuning in world units / seconds. Input axes are normalized
// before rotating so diagonal movement cannot bypass pace or slide limits.
export const HANDLING=Object.freeze({walk:4.4,sprint:7.1,crouch:2.25,aim:2.8,slide:9.1,slideDuration:.82,slideCooldown:.35,adsTime:.20,standEye:2.02,crouchEye:1.24});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),damp=(a,b,k,dt)=>b+(a-b)*Math.exp(-k*dt);
export function newHandling(){return {vx:0,vz:0,ads:0,sprint:0,crouch:0,slide:0,cooldown:0,slideX:0,slideZ:0,slideSpeed:0,eye:HANDLING.standEye,mode:'walk',previousCrouch:false,land:0};}
export function updateHandling(s,dt,{x=0,z=0,yaw=0,run=false,crouch=false,aim=false,attack=false,grounded=true,flight=false,blocked=false}={}){
  dt=clamp(dt,0,.04);const n=Math.max(1,Math.hypot(x,z));x/=n;z/=n;
  const wx=x*Math.cos(yaw)+z*Math.sin(yaw),wz=z*Math.cos(yaw)-x*Math.sin(yaw),speed=Math.hypot(s.vx,s.vz);
  s.cooldown=Math.max(0,s.cooldown-dt);
  const start=!flight&&grounded&&crouch&&!s.previousCrouch&&run&&z<-.4&&speed>4.5&&!s.cooldown&&!s.slide;
  if(start){s.slide=HANDLING.slideDuration;s.slideSpeed=HANDLING.slide;s.slideX=s.vx/speed;s.slideZ=s.vz/speed;}
  s.previousCrouch=crouch;
  if(s.slide&&(!grounded||flight||blocked)){s.slide=0;s.cooldown=HANDLING.slideCooldown;}
  if(s.slide){
    s.slide=Math.max(0,s.slide-dt);s.slideSpeed*=Math.exp(-1.35*dt);
    // Looking remains free; steering can only gently bend retained momentum.
    s.slideX+=wx*dt*.45;s.slideZ+=wz*dt*.45;const length=Math.hypot(s.slideX,s.slideZ);s.slideX/=length;s.slideZ/=length;
    s.vx=s.slideX*s.slideSpeed;s.vz=s.slideZ*s.slideSpeed;if(!s.slide)s.cooldown=HANDLING.slideCooldown;
  }else{
    const sprint=run&&z<-.1&&!crouch&&!aim&&!attack&&!flight;
    const pace=flight?(run?12:6):crouch?HANDLING.crouch:aim?HANDLING.aim:sprint?HANDLING.sprint:HANDLING.walk;
    const response=flight?8:!grounded?5.5:Math.hypot(x,z)>.01?30:38;
    s.vx=damp(s.vx,wx*pace,response,dt);s.vz=damp(s.vz,wz*pace,response,dt);
  }
  const aiming=aim&&!flight; s.ads=clamp(s.ads+(aiming?1:-1)*dt/HANDLING.adsTime,0,1);
  s.crouch=damp(s.crouch,!flight&&(crouch||s.slide)?1:0,22,dt);
  s.eye=HANDLING.standEye+(HANDLING.crouchEye-HANDLING.standEye)*s.crouch;
  const sprintTarget=!flight&&run&&z<-.1&&!crouch&&!aim&&!attack&&!s.slide?1:0;
  s.sprint=damp(s.sprint,sprintTarget,20,dt);s.land=damp(s.land,0,18,dt);
  s.mode=flight?'flight':s.slide?'slide':!grounded?'air':crouch?'crouch':aim?'aim':sprintTarget?'sprint':'walk';
  return {startedSlide:start};
}
