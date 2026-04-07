'use strict';
// ═══════════════════════════════════════════════════════════════
//  NEON SIEGE — Top-Down Retro Shooter
// ═══════════════════════════════════════════════════════════════

// ── CONFIG ──────────────────────────────────────────────────────
const W = 1280, H = 720;
const TAU = Math.PI * 2;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const lerp  = (a,b,t) => a+(b-a)*t;
const dist  = (ax,ay,bx,by) => Math.hypot(bx-ax,by-ay);
const rnd   = (a,b) => Math.random()*(b-a)+a;
const rndI  = (a,b) => Math.floor(rnd(a,b+1));
const pick  = arr => arr[Math.floor(Math.random()*arr.length)];

// ── INPUT ────────────────────────────────────────────────────────
const Input = {
  keys:{}, fresh:new Set(), mouse:{x:W/2,y:H/2,down:false,clicked:false},
  init(canvas){
    window.addEventListener('keydown', e=>{
      if(!this.keys[e.code]) this.fresh.add(e.code);
      this.keys[e.code]=true;
      // Only prevent default for game keys to avoid breaking browser shortcuts
      const gameCodes=['KeyW','KeyA','KeyS','KeyD','KeyE','ShiftLeft','ShiftRight',
        'ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'];
      if(gameCodes.includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e=>{ this.keys[e.code]=false; });
    canvas.addEventListener('mousemove', e=>{
      const r=canvas.getBoundingClientRect();
      this.mouse.x=(e.clientX-r.left)*(W/r.width);
      this.mouse.y=(e.clientY-r.top )*(H/r.height);
    });
    canvas.addEventListener('mousedown', e=>{ if(e.button===0){ this.mouse.down=true; this.mouse.clicked=true; } });
    canvas.addEventListener('mouseup',   e=>{ if(e.button===0) this.mouse.down=false; });
    canvas.addEventListener('contextmenu', e=>e.preventDefault());
  },
  pressed(c){ return this.fresh.has(c); },
  held(c){ return !!this.keys[c]; },
  update(){ this.fresh.clear(); this.mouse.clicked=false; }
};

// ── AUDIO ────────────────────────────────────────────────────────
const Audio = {
  ctx:null, master:null, enabled:false,
  init(){
    if(this.ctx) return;
    this.ctx = new (window.AudioContext||window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.25;
    this.master.connect(this.ctx.destination);
    this.enabled = true;
  },
  _tone(freq,type,dur,gain=0.4,freqEnd=null){
    if(!this.enabled) return;
    const t=this.ctx.currentTime, o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,t);
    if(freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd,t+dur);
    g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t+dur);
  },
  _noise(dur,gain=0.3,lp=2000){
    if(!this.enabled) return;
    const sr=this.ctx.sampleRate, n=Math.ceil(sr*dur),
          buf=this.ctx.createBuffer(1,n,sr), d=buf.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=Math.random()*2-1;
    const src=this.ctx.createBufferSource(),
          f=this.ctx.createBiquadFilter(), g=this.ctx.createGain();
    f.type='lowpass'; f.frequency.value=lp;
    src.buffer=buf;
    const t=this.ctx.currentTime;
    g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t);
  },
  gunshot(){ this._tone(900,'square',0.07,0.3,200); this._noise(0.05,0.15,4000); },
  death(){   this._noise(0.12,0.35,800); this._tone(150,'sawtooth',0.1,0.2,60); },
  hit(){     this._tone(110,'sawtooth',0.25,0.4,55); this._noise(0.1,0.25,400); },
  powerup(){ [350,550,750,1100].forEach((f,i)=>setTimeout(()=>this._tone(f,'sine',0.12,0.25),i*50)); },
  waveStart(){ this._tone(220,'square',0.12,0.35); setTimeout(()=>this._tone(330,'square',0.12,0.35),100); setTimeout(()=>this._tone(440,'square',0.2,0.4),200); },
  bossArrive(){ this._tone(55,'sawtooth',1.2,0.6,35); this._noise(0.6,0.4,250); },
  overcharge(){ [180,360,540,720,900,1080,1260,1440].forEach((f,i)=>setTimeout(()=>this._tone(f,'square',0.08,0.25),i*25)); },
  heartbeat(){ this._tone(75,'sine',0.08,0.25,65); },
  nuke(){    this._tone(35,'sawtooth',1.8,0.7,18); this._noise(1.0,0.55,600); },
};

// ── CAMERA ───────────────────────────────────────────────────────
const Camera = {
  x:0, y:0, shakeTime:0, shakeMag:0,
  shake(mag,dur){ this.shakeMag=mag; this.shakeTime=dur; },
  update(dt){
    if(this.shakeTime>0){
      this.shakeTime-=dt;
      const m=this.shakeMag*(this.shakeTime/0.3);
      this.x=rnd(-m,m); this.y=rnd(-m,m);
    } else { this.x=0; this.y=0; }
  },
  apply(ctx){ ctx.translate(this.x,this.y); }
};

// ── PARTICLES ─────────────────────────────────────────────────────
class Particle {
  constructor(x,y,vx,vy,col,r,life){
    Object.assign(this,{x,y,vx,vy,col,r,life,maxLife:life});
  }
  update(dt){ this.x+=this.vx*dt; this.y+=this.vy*dt; this.vx*=0.93; this.vy*=0.93; this.life-=dt; }
  draw(ctx){
    const a=this.life/this.maxLife;
    ctx.globalAlpha=a;
    ctx.fillStyle=this.col;
    ctx.beginPath(); ctx.arc(this.x,this.y,this.r*a,0,TAU); ctx.fill();
    ctx.globalAlpha=1;
  }
  get dead(){ return this.life<=0; }
}

const Particles = {
  list:[],
  emit(x,y,col,n=12,spd=160){
    for(let i=0;i<n;i++){
      const a=rnd(0,TAU), s=rnd(spd*0.3,spd);
      this.list.push(new Particle(x,y,Math.cos(a)*s,Math.sin(a)*s,col,rnd(2,5),rnd(0.3,0.9)));
    }
  },
  muzzle(x,y,angle){
    for(let i=0;i<6;i++){
      const a=angle+rnd(-0.4,0.4), s=rnd(80,280);
      this.list.push(new Particle(x,y,Math.cos(a)*s,Math.sin(a)*s,'#ffff44',rnd(1,3),0.1));
    }
  },
  update(dt){ this.list=this.list.filter(p=>{ p.update(dt); return !p.dead; }); },
  draw(ctx){ this.list.forEach(p=>p.draw(ctx)); }
};

// ── BULLET ───────────────────────────────────────────────────────
class Bullet {
  constructor(x,y,angle,spd,dmg,fromPlayer,col='#ffff00'){
    this.x=x; this.y=y;
    this.vx=Math.cos(angle)*spd; this.vy=Math.sin(angle)*spd;
    this.dmg=dmg; this.fromPlayer=fromPlayer; this.col=col;
    this.r=fromPlayer?4:5; this.dead=false;
    this.trail=[];
  }
  update(dt){
    this.trail.push({x:this.x,y:this.y});
    if(this.trail.length>7) this.trail.shift();
    this.x+=this.vx*dt; this.y+=this.vy*dt;
    if(this.x<-30||this.x>W+30||this.y<-30||this.y>H+30) this.dead=true;
  }
  draw(ctx){
    for(let i=0;i<this.trail.length;i++){
      ctx.globalAlpha=(i/this.trail.length)*0.45;
      ctx.fillStyle=this.col;
      ctx.beginPath(); ctx.arc(this.trail[i].x,this.trail[i].y,this.r*(i/this.trail.length)*0.6,0,TAU); ctx.fill();
    }
    ctx.globalAlpha=1;
    ctx.shadowBlur=14; ctx.shadowColor=this.col;
    ctx.fillStyle=this.col;
    ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,TAU); ctx.fill();
    ctx.shadowBlur=0;
  }
}

// ── POWER-UPS ────────────────────────────────────────────────────
const PU_TYPES=[
  {id:'MEDKIT',   icon:'❤', col:'#ff4455', label:'MED KIT'},
  {id:'RAPIDFIRE',icon:'⚡', col:'#ffff00', label:'RAPID FIRE'},
  {id:'SHIELD',   icon:'🛡', col:'#4488ff', label:'SHIELD'},
  {id:'NUKE',     icon:'💥', col:'#ff8800', label:'NUKE'},
  {id:'FREEZE',   icon:'❄', col:'#44ffff', label:'FREEZE'},
];
class PowerUp {
  constructor(x,y){ this.x=x; this.y=y; this.type=pick(PU_TYPES); this.life=8; this.maxLife=8; this.dead=false; this.r=14; this.t=0; }
  update(dt){ this.life-=dt; this.t+=dt; if(this.life<=0) this.dead=true; }
  draw(ctx){
    const lf=this.life/this.maxLife, pulse=Math.sin(this.t*5)*0.3+0.7;
    // Lifetime ring
    ctx.strokeStyle=this.type.col; ctx.lineWidth=3; ctx.globalAlpha=0.65;
    ctx.beginPath(); ctx.arc(this.x,this.y,this.r+8,-Math.PI/2,-Math.PI/2+TAU*lf); ctx.stroke();
    ctx.globalAlpha=1;
    // Glow
    ctx.shadowBlur=20*pulse; ctx.shadowColor=this.type.col;
    ctx.fillStyle=this.type.col+'33';
    ctx.beginPath(); ctx.arc(this.x,this.y,this.r*pulse,0,TAU); ctx.fill();
    ctx.shadowBlur=0;
    // Icon
    ctx.font=`${Math.round(this.r*1.3)}px serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.globalAlpha=lf<0.3?lf/0.3:1;
    ctx.fillText(this.type.icon,this.x,this.y);
    ctx.globalAlpha=1;
  }
}

// ── ENEMY BASE ────────────────────────────────────────────────────
class Enemy {
  constructor(x,y,hp,spd,dmg,score,col,r=16){
    this.x=x; this.y=y; this.hp=hp; this.maxHp=hp;
    this.baseSpeed=spd; this.speed=spd; this.dmg=dmg;
    this.score=score; this.col=col; this.r=r;
    this.dead=false; this.flashT=0; this.slowFactor=1; this.frozenT=0;
    this.t=0;
  }
  scale(wave){
    if(wave>5){
      const m=Math.pow(1.05,wave-5);
      this.speed=Math.min(this.baseSpeed*m, this.speedCap||300);
      this.hp=Math.ceil(this.maxHp*Math.pow(1.10,wave-5));
      this.maxHp=this.hp;
    }
  }
  takeDamage(d){ this.hp-=d; this.flashT=0.1; if(this.hp<=0) this.dead=true; }
  freeze(dur,factor){ this.frozenT=dur; this.slowFactor=factor; }
  update(dt,player){
    this.t+=dt;
    if(this.flashT>0) this.flashT-=dt;
    if(this.frozenT>0){ this.frozenT-=dt; if(this.frozenT<=0) this.slowFactor=1; }
    this._move(dt,player);
  }
  _move(dt,player){
    const a=Math.atan2(player.y-this.y,player.x-this.x);
    this.x+=Math.cos(a)*this.speed*this.slowFactor*dt;
    this.y+=Math.sin(a)*this.speed*this.slowFactor*dt;
  }
  _drawHpBar(ctx){
    if(this.hp>=this.maxHp) return;
    const bw=36, bh=4, bx=this.x-bw/2, by=this.y-this.r-10;
    ctx.fillStyle='#222'; ctx.fillRect(bx,by,bw,bh);
    ctx.fillStyle='#ff3333'; ctx.fillRect(bx,by,bw*(this.hp/this.maxHp),bh);
  }
  _drawFreeze(ctx){
    if(this.frozenT<=0) return;
    ctx.strokeStyle='#44ffff'; ctx.lineWidth=2; ctx.globalAlpha=0.55;
    ctx.beginPath(); ctx.arc(this.x,this.y,this.r+5,0,TAU); ctx.stroke();
    ctx.globalAlpha=1;
  }
  get fill(){ return this.flashT>0?'#ffffff':this.col; }
}

class Grunt extends Enemy {
  constructor(x,y,wave){
    super(x,y,20,70,10,10,'#ff4444',14);
    this.speedCap=220; this.scale(wave);
  }
  draw(ctx){
    ctx.shadowBlur=12; ctx.shadowColor=this.col;
    ctx.fillStyle=this.fill;
    ctx.fillRect(this.x-10,this.y-10,20,20);
    if(this.flashT<=0){ ctx.fillStyle='#000'; ctx.fillRect(this.x-5,this.y-4,3,3); ctx.fillRect(this.x+2,this.y-4,3,3); }
    ctx.shadowBlur=0;
    this._drawHpBar(ctx); this._drawFreeze(ctx);
  }
}

class Rusher extends Enemy {
  constructor(x,y,wave){
    super(x,y,10,160,15,20,'#ff8800',10);
    this.speedCap=280; this.scale(wave);
  }
  _move(dt,player){
    const base=Math.atan2(player.y-this.y,player.x-this.x);
    const a=base+Math.sin(this.t*9)*1.3;
    this.x+=Math.cos(a)*this.speed*this.slowFactor*dt;
    this.y+=Math.sin(a)*this.speed*this.slowFactor*dt;
  }
  draw(ctx){
    ctx.save(); ctx.translate(this.x,this.y);
    const a=Math.atan2(0,1);
    ctx.shadowBlur=12; ctx.shadowColor=this.col;
    ctx.fillStyle=this.fill;
    ctx.beginPath(); ctx.moveTo(12,0); ctx.lineTo(-9,-9); ctx.lineTo(-9,9); ctx.closePath(); ctx.fill();
    ctx.shadowBlur=0; ctx.restore();
    this._drawHpBar(ctx); this._drawFreeze(ctx);
  }
}

class Tank extends Enemy {
  constructor(x,y,wave){
    super(x,y,80,40,25,50,'#ffdd00',22);
    this.speedCap=100; this.scale(wave);
  }
  draw(ctx){
    ctx.shadowBlur=15; ctx.shadowColor=this.col;
    ctx.fillStyle=this.fill;
    ctx.fillRect(this.x-16,this.y-16,32,32);
    if(this.flashT<=0){
      ctx.fillStyle='#aa8800';
      ctx.fillRect(this.x-19,this.y-8,5,16);
      ctx.fillRect(this.x+14,this.y-8,5,16);
      ctx.fillRect(this.x-8,this.y-19,16,5);
      ctx.fillRect(this.x-8,this.y+14,16,5);
    }
    ctx.shadowBlur=0;
    this._drawHpBar(ctx); this._drawFreeze(ctx);
  }
}

class Shooter extends Enemy {
  constructor(x,y,wave,eBullets){
    super(x,y,30,55,12,40,'#cc44ff',14);
    this.speedCap=150; this.eBullets=eBullets;
    this.shootT=1.5; this.prefDist=260;
    this.scale(wave);
  }
  _move(dt,player){
    const dx=player.x-this.x, dy=player.y-this.y, d=Math.hypot(dx,dy)||1;
    const spd=this.speed*this.slowFactor;
    if(d>this.prefDist+25){ this.x+=dx/d*spd*dt; this.y+=dy/d*spd*dt; }
    else if(d<this.prefDist-25){ this.x-=dx/d*spd*dt; this.y-=dy/d*spd*dt; }
    this.shootT-=dt*this.slowFactor;
    if(this.shootT<=0){
      this.shootT=2;
      const a=Math.atan2(dy,dx);
      this.eBullets.push(new Bullet(this.x,this.y,a,220,12,false,'#ff44ff'));
    }
  }
  draw(ctx){
    ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(Math.PI/4);
    ctx.shadowBlur=12; ctx.shadowColor=this.col;
    ctx.fillStyle=this.fill;
    ctx.fillRect(-10,-10,20,20);
    ctx.restore();
    if(this.flashT<=0){ ctx.fillStyle='#888'; ctx.fillRect(this.x,this.y-2,14,4); }
    ctx.shadowBlur=0;
    this._drawHpBar(ctx); this._drawFreeze(ctx);
  }
}

class Boss extends Enemy {
  constructor(x,y,encounter,eBullets){
    const hp=500+200*(encounter-1);
    super(x,y,hp,60,40,500,'#aa00ff',44);
    this.eBullets=eBullets; this.encounter=encounter;
    this.phase='chase'; this.phaseT=3;
    this.cvx=0; this.cvy=0;
  }
  _move(dt,player){
    const dx=player.x-this.x, dy=player.y-this.y;
    const spd=this.speed*this.slowFactor;
    if(this.phase==='chase'){
      const a=Math.atan2(dy,dx);
      this.x+=Math.cos(a)*spd*dt; this.y+=Math.sin(a)*spd*dt;
      this.phaseT-=dt;
      if(this.phaseT<=0){
        if(Math.random()<0.5){
          this.phase='charge';
          const d=Math.hypot(dx,dy)||1;
          this.cvx=dx/d*260; this.cvy=dy/d*260;
          this.phaseT=1.5;
        } else { this.phase='spread'; this.phaseT=0.8; }
      }
    } else if(this.phase==='charge'){
      this.x+=this.cvx*this.slowFactor*dt; this.y+=this.cvy*this.slowFactor*dt;
      this.cvx=lerp(this.cvx,0,dt*2.5); this.cvy=lerp(this.cvy,0,dt*2.5);
      this.phaseT-=dt;
      if(this.phaseT<=0){ this.phase='chase'; this.phaseT=3; }
    } else if(this.phase==='spread'){
      this.phaseT-=dt;
      if(this.phaseT<=0){
        for(let i=0;i<8;i++){
          const a=(i/8)*TAU;
          this.eBullets.push(new Bullet(this.x,this.y,a,230,20,false,'#ff00ff'));
        }
        this.phase='chase'; this.phaseT=4;
      }
    }
    this.x=clamp(this.x,this.r,W-this.r);
    this.y=clamp(this.y,this.r,H-this.r);
  }
  draw(ctx){
    const pulse=Math.sin(this.t*3)*0.2+0.8;
    ctx.shadowBlur=30*pulse; ctx.shadowColor='#aa00ff';
    ctx.fillStyle=this.flashT>0?'#fff':'#220033';
    ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,TAU); ctx.fill();
    ctx.strokeStyle=this.flashT>0?'#fff':'#aa00ff'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,TAU); ctx.stroke();
    ctx.strokeStyle=this.flashT>0?'#fff':'#ff44ff'; ctx.lineWidth=2;
    for(let i=0;i<6;i++){
      const a=(i/6)*TAU+this.t*0.8;
      ctx.beginPath(); ctx.moveTo(this.x,this.y);
      ctx.lineTo(this.x+Math.cos(a)*this.r*0.75,this.y+Math.sin(a)*this.r*0.75); ctx.stroke();
    }
    ctx.shadowBlur=0;
    ctx.fillStyle='#fff'; ctx.font='bold 10px monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('BOSS',this.x,this.y);
    this._drawFreeze(ctx);
  }
  _drawHpBar(){}
}

// ── PLAYER ───────────────────────────────────────────────────────
class Player {
  constructor(){
    this.x=W/2; this.y=H/2;
    this.angle=0; this.hp=100; this.maxHp=100; this.hpVis=100;
    this.r=14; this.speed=180;
    this.fireRate=8; this.fireT=0;
    this.bullets=[];
    this.dashCD=0; this.dashT=0; this.dashing=false; this.invincible=false;
    this.dashDX=0; this.dashDY=0;
    this.ocReady=true; this.ocActive=false; this.ocT=0;
    this.rapidT=0; this.shield=0;
    this.comboKills=0; this.comboMult=1;
    this.comboBanner=''; this.comboShowT=0;
    this.dead=false; this.t=0;
  }
  takeDamage(amount){
    if(this.invincible||this.dashing) return;
    if(this.shield>0){ this.shield=Math.max(0,this.shield-amount); Camera.shake(5,0.15); return; }
    this.hp=Math.max(0,this.hp-amount);
    Camera.shake(12,0.35); Audio.hit();
    this.comboKills=0; this.comboMult=1;
    if(this.hp<=0) this.dead=true;
  }
  activateOC(){
    if(!this.ocReady||this.ocActive) return;
    this.ocReady=false; this.ocActive=true; this.ocT=3;
    Audio.overcharge();
  }
  rechargeOC(){ this.ocReady=true; }
  onKill(){
    this.comboKills++;
    if(this.comboKills>=5){
      this.comboMult=1.5;
      this.comboBanner=`COMBO ×${this.comboKills}!`;
      this.comboShowT=2;
    }
  }
  update(dt){
    this.t+=dt;
    this.hpVis=lerp(this.hpVis,this.hp,dt*8);
    // Low HP heartbeat
    if(this.hp<25 && Math.floor(this.t*2)!==Math.floor((this.t-dt)*2)) Audio.heartbeat();

    let dx=0,dy=0;
    if(Input.held('KeyW')||Input.held('ArrowUp'))    dy-=1;
    if(Input.held('KeyS')||Input.held('ArrowDown'))  dy+=1;
    if(Input.held('KeyA')||Input.held('ArrowLeft'))  dx-=1;
    if(Input.held('KeyD')||Input.held('ArrowRight')) dx+=1;
    if(dx||dy){ const l=Math.hypot(dx,dy); dx/=l; dy/=l; }

    if(this.dashing){
      this.dashT-=dt;
      this.x+=this.dashDX*800*dt; this.y+=this.dashDY*800*dt;
      this.invincible=true;
      if(this.dashT<=0){ this.dashing=false; this.invincible=false; }
    } else {
      this.x+=dx*this.speed*dt; this.y+=dy*this.speed*dt;
      if((Input.pressed('ShiftLeft')||Input.pressed('ShiftRight'))&&this.dashCD<=0){
        this.dashDX=dx||Math.cos(this.angle); this.dashDY=dy||Math.sin(this.angle);
        this.dashing=true; this.dashT=0.13; this.dashCD=2;
      }
    }
    this.dashCD=Math.max(0,this.dashCD-dt);
    this.x=clamp(this.x,this.r,W-this.r); this.y=clamp(this.y,this.r,H-this.r);
    this.angle=Math.atan2(Input.mouse.y-this.y,Input.mouse.x-this.x);
    if(Input.pressed('KeyE')) this.activateOC();

    let fr=this.fireRate;
    if(this.rapidT>0){ fr*=2; this.rapidT-=dt; }
    if(this.ocActive){ fr*=3; this.ocT-=dt; if(this.ocT<=0) this.ocActive=false; }

    this.fireT-=dt;
    if(this.fireT<=0&&Input.mouse.down){
      this.fireT=1/fr;
      if(this.ocActive){
        for(let i=0;i<12;i++){
          const a=(i/12)*TAU;
          this.bullets.push(new Bullet(this.x,this.y,a,600,10,true,'#ffff44'));
        }
      } else {
        const bx=this.x+Math.cos(this.angle)*22, by=this.y+Math.sin(this.angle)*22;
        this.bullets.push(new Bullet(bx,by,this.angle,600,10,true,'#ffff44'));
        Particles.muzzle(bx,by,this.angle);
        Audio.gunshot();
      }
    }
    if(this.comboShowT>0) this.comboShowT-=dt;
    this.bullets=this.bullets.filter(b=>{ b.update(dt); return !b.dead; });
  }
  draw(ctx){
    const pulse=Math.sin(this.t*6)*0.5+0.5;
    // Draw bullets
    this.bullets.forEach(b=>b.draw(ctx));

    ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.angle);
    const col=this.ocActive?'#ffffff':this.dashing?'#00ffff':'#00ccff';
    ctx.shadowBlur=this.ocActive?30*pulse:this.dashing?20:10;
    ctx.shadowColor=this.ocActive?'#ffffff':'#00ffff';
    ctx.fillStyle=col; ctx.fillRect(-11,-8,22,16);
    ctx.fillStyle=this.ocActive?'#fff':'#aaffff'; ctx.fillRect(9,-2,14,5);
    ctx.fillStyle=col; ctx.fillRect(-6,-6,12,12);
    if(!this.ocActive){ ctx.fillStyle='#001122'; ctx.fillRect(2,-3,4,4); }
    ctx.shadowBlur=0; ctx.restore();

    // Shield ring
    if(this.shield>0){
      ctx.strokeStyle='#4488ff'; ctx.lineWidth=3;
      ctx.shadowBlur=15; ctx.shadowColor='#4488ff'; ctx.globalAlpha=0.7;
      ctx.beginPath(); ctx.arc(this.x,this.y,this.r+9,0,TAU); ctx.stroke();
      ctx.shadowBlur=0; ctx.globalAlpha=1;
    }
    // OC ready ring
    if(this.ocReady&&!this.ocActive){
      ctx.strokeStyle='#ffff00'; ctx.lineWidth=2;
      ctx.shadowBlur=10*pulse; ctx.shadowColor='#ffff00'; ctx.globalAlpha=0.5+0.5*pulse;
      ctx.beginPath(); ctx.arc(this.x,this.y,this.r+18,0,TAU); ctx.stroke();
      ctx.shadowBlur=0; ctx.globalAlpha=1;
    }
    // Dash ready brackets
    if(this.dashCD<=0&&!this.dashing){
      ctx.strokeStyle='#00ffff'; ctx.lineWidth=1.5; ctx.globalAlpha=0.35;
      ctx.strokeRect(this.x-22,this.y-22,44,44);
      ctx.globalAlpha=1;
    }
    // Combo banner
    if(this.comboShowT>0){
      ctx.fillStyle='#ffff00'; ctx.globalAlpha=Math.min(1,this.comboShowT);
      ctx.font='11px "Press Start 2P", monospace';
      ctx.textAlign='center'; ctx.textBaseline='bottom';
      ctx.shadowBlur=10; ctx.shadowColor='#ffff00';
      ctx.fillText(this.comboBanner,this.x,this.y-30);
      ctx.shadowBlur=0; ctx.globalAlpha=1;
    }
  }
}

// ── WAVE MANAGER ─────────────────────────────────────────────────
class WaveManager {
  constructor(){
    this.wave=0; this.enemies=[]; this.eBullets=[]; this.powerUps=[];
    this.queue=[]; this.spawnT=0; this.bossCount=0; this.bossAlive=false;
    this.totalSpawned=0; this.totalKilled=0;
  }
  startWave(n){
    this.wave=n; this.enemies=[]; this.eBullets=[]; this.bossAlive=false;
    this.queue=this._buildQueue(n); this.totalSpawned=this.queue.length;
    this.totalKilled=0; this.spawnT=0.6;
  }
  _count(w){ if(w===1)return 6; if(w===2)return 10; if(w===3)return 12; if(w===4)return 14; if(w===5)return 16; return Math.min(6+w*3,55); }
  _buildQueue(w){
    const q=[];
    for(let i=0;i<this._count(w);i++){
      const r=Math.random();
      let t='GRUNT';
      if(w>=5){ t=r<0.2?'SHOOTER':r<0.4?'TANK':r<0.6?'RUSHER':'GRUNT'; }
      else if(w>=4){ t=r<0.25?'TANK':r<0.5?'RUSHER':'GRUNT'; }
      else if(w>=3){ t=r<0.35?'RUSHER':'GRUNT'; }
      q.push(t);
    }
    return q;
  }
  _spawnPos(){
    const e=rndI(0,3), m=35;
    if(e===0) return {x:rnd(0,W),y:-m};
    if(e===1) return {x:W+m,y:rnd(0,H)};
    if(e===2) return {x:rnd(0,W),y:H+m};
    return {x:-m,y:rnd(0,H)};
  }
  _make(type){
    const p=this._spawnPos();
    if(type==='GRUNT')   return new Grunt(p.x,p.y,this.wave);
    if(type==='RUSHER')  return new Rusher(p.x,p.y,this.wave);
    if(type==='TANK')    return new Tank(p.x,p.y,this.wave);
    if(type==='SHOOTER') return new Shooter(p.x,p.y,this.wave,this.eBullets);
    return new Grunt(p.x,p.y,this.wave);
  }
  spawnBoss(){
    this.bossCount++;
    const p=this._spawnPos();
    const boss=new Boss(p.x,p.y,this.bossCount,this.eBullets);
    this.enemies.push(boss); this.bossAlive=true;
    Audio.bossArrive();
  }
  get boss(){ return this.enemies.find(e=>e instanceof Boss); }
  get complete(){ return this.queue.length===0&&this.enemies.length===0; }
  freezeAll(dur,factor){ this.enemies.forEach(e=>e.freeze(dur,factor)); }
  nukeAll(){
    this.enemies=this.enemies.filter(e=>{
      if(e instanceof Boss) return true;
      e.dead=true; return false;
    });
  }
  update(dt,player){
    this.spawnT-=dt;
    if(this.spawnT<=0&&this.queue.length>0){
      const g=rndI(2,3);
      for(let i=0;i<Math.min(g,this.queue.length);i++) this.enemies.push(this._make(this.queue.shift()));
      this.spawnT=1.5;
    }
    // Enemy update & contact damage
    for(const e of this.enemies){
      e.update(dt,player);
      if(dist(e.x,e.y,player.x,player.y)<e.r+player.r) player.takeDamage(e.dmg*dt*60);
    }
    // Player bullets vs enemies
    for(const b of player.bullets){
      for(const e of this.enemies){
        if(b.dead||e.dead) continue;
        if(dist(b.x,b.y,e.x,e.y)<e.r+b.r){ e.takeDamage(b.dmg); b.dead=true; }
      }
    }
    // Enemy bullets vs player
    for(const b of this.eBullets){
      if(b.dead) continue;
      if(dist(b.x,b.y,player.x,player.y)<player.r+b.r){ player.takeDamage(b.dmg); b.dead=true; }
    }
    // Power-up collection
    for(const pu of this.powerUps){
      if(pu.dead) continue;
      if(dist(pu.x,pu.y,player.x,player.y)<player.r+pu.r){ this._applyPU(pu,player); pu.dead=true; }
    }
    // Cleanup + score
    let score=0;
    for(const e of this.enemies){
      if(e.dead){
        score+=Math.round(e.score*player.comboMult);
        Particles.emit(e.x,e.y,e.col,18,190); Audio.death();
        player.onKill();
        if(Math.random()<0.15) this.powerUps.push(new PowerUp(e.x,e.y));
        this.totalKilled++;
        if(e instanceof Boss) this.bossAlive=false;
      }
    }
    this.enemies=this.enemies.filter(e=>!e.dead);
    this.eBullets=this.eBullets.filter(b=>{ b.update(dt); return !b.dead; });
    this.powerUps=this.powerUps.filter(p=>{ p.update(dt); return !p.dead; });
    return score;
  }
  _applyPU(pu,player){
    Audio.powerup();
    Particles.emit(pu.x,pu.y,pu.type.col,22,210);
    switch(pu.type.id){
      case 'MEDKIT':    player.hp=Math.min(player.maxHp,player.hp+30); break;
      case 'RAPIDFIRE': player.rapidT=8; break;
      case 'SHIELD':    player.shield=40; break;
      case 'NUKE':      this.nukeAll(); Camera.shake(22,1.0); Audio.nuke(); break;
      case 'FREEZE':    this.freezeAll(5,0.2); break;
    }
  }
  draw(ctx){
    this.powerUps.forEach(p=>p.draw(ctx));
    this.enemies.forEach(e=>e.draw(ctx));
    this.eBullets.forEach(b=>b.draw(ctx));
  }
}

// ── HUD ──────────────────────────────────────────────────────────
function drawHUD(ctx,player,wave,state,stateT,score,best,wm){
  // HP bar
  const hpF=player.hpVis/player.maxHp, lowHp=player.hp<25;
  const hpPulse=lowHp?(Math.sin(Date.now()/280)*0.5+0.5):1;
  ctx.fillStyle='#111'; ctx.fillRect(18,18,224,24);
  ctx.fillStyle=lowHp?`rgb(255,${Math.floor(hpPulse*80)},${Math.floor(hpPulse*80)})`:'#cc2233';
  ctx.fillRect(18,18,224*hpF,24);
  ctx.strokeStyle='#ff3344'; ctx.lineWidth=2; ctx.strokeRect(18,18,224,24);
  ctx.fillStyle='#fff'; ctx.font='9px "Press Start 2P",monospace'; ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText(`HP: ${Math.ceil(player.hp)} / ${player.maxHp}`,24,30);
  if(player.shield>0){
    ctx.fillStyle='#4488ff'; ctx.font='8px "Press Start 2P",monospace';
    ctx.fillText(`SHIELD: ${Math.ceil(player.shield)}`,18,52);
  }

  // Wave + status (top center)
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillStyle='#fff'; ctx.font='16px "Press Start 2P",monospace';
  ctx.shadowBlur=10; ctx.shadowColor='#00ffff';
  ctx.fillText(`WAVE ${wave}`,W/2,14);
  ctx.shadowBlur=0;
  if(state==='GET_READY'){
    ctx.fillStyle='#ffff44'; ctx.font='11px "Press Start 2P",monospace';
    ctx.fillText(`GET READY! ${Math.ceil(stateT)}`,W/2,42);
  } else if(state==='WAVE_CLEAR'){
    ctx.fillStyle='#44ff88'; ctx.font='11px "Press Start 2P",monospace';
    ctx.fillText('WAVE CLEARED!',W/2,42);
    ctx.fillStyle='#ffff44'; ctx.font='9px "Press Start 2P",monospace';
    ctx.fillText(`NEXT WAVE IN ${Math.ceil(stateT)}s`,W/2,62);
  } else if(state==='BOSS'){
    ctx.fillStyle='#ff00ff'; ctx.font='11px "Press Start 2P",monospace';
    ctx.shadowBlur=15; ctx.shadowColor='#ff00ff';
    ctx.fillText('⚠ BOSS FIGHT ⚠',W/2,42);
    ctx.shadowBlur=0;
  }

  // Score (top right)
  ctx.textAlign='right'; ctx.textBaseline='top';
  ctx.fillStyle='#ffff44'; ctx.font='13px "Press Start 2P",monospace';
  ctx.shadowBlur=8; ctx.shadowColor='#ffff00';
  ctx.fillText(`SCORE: ${String(score).padStart(6,'0')}`,W-18,14);
  ctx.shadowBlur=0;
  ctx.fillStyle='#888'; ctx.font='8px "Press Start 2P",monospace';
  ctx.fillText(`BEST: ${String(best).padStart(6,'0')}`,W-18,38);

  // Overcharge indicator (bottom center)
  drawOC(ctx,player);

  // Boss HP bar
  const boss=wm&&wm.boss;
  if(boss&&!boss.dead){
    const bw=500, bx=W/2-bw/2, by=H-40, bh=22;
    ctx.fillStyle='#111'; ctx.fillRect(bx,by,bw,bh);
    const hf=boss.hp/boss.maxHp;
    ctx.fillStyle='#aa00ff'; ctx.fillRect(bx,by,bw*hf,bh);
    ctx.strokeStyle='#ff00ff'; ctx.lineWidth=2; ctx.strokeRect(bx,by,bw,bh);
    ctx.fillStyle='#fff'; ctx.font='8px "Press Start 2P",monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(`BEHEMOTH  ${boss.hp} / ${boss.maxHp}`,W/2,by+bh/2);
  }

  // Rapid fire active
  if(player.rapidT>0){
    ctx.fillStyle='#ffff44'; ctx.font='8px "Press Start 2P",monospace'; ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillText(`⚡ RAPID ${Math.ceil(player.rapidT)}s`,18,56);
  }
}

function drawOC(ctx,player){
  const cx=W/2, cy=H-52, r=22;
  const pulse=Math.sin(Date.now()/400)*0.5+0.5;
  if(player.ocActive){
    const p2=Math.sin(Date.now()/120)*0.5+0.5;
    ctx.fillStyle='#ffffff'; ctx.shadowBlur=25*p2; ctx.shadowColor='#ffffff';
    ctx.beginPath(); ctx.arc(cx,cy,r,0,TAU); ctx.fill();
    ctx.shadowBlur=0;
    ctx.fillStyle='#000'; ctx.font='8px "Press Start 2P",monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('OC',cx,cy);
  } else if(player.ocReady){
    ctx.strokeStyle=`rgba(255,255,80,${0.5+0.5*pulse})`; ctx.lineWidth=3;
    ctx.shadowBlur=15*pulse; ctx.shadowColor='#ffff00';
    ctx.beginPath(); ctx.arc(cx,cy,r,0,TAU); ctx.stroke();
    ctx.fillStyle='#ffee00'; ctx.beginPath(); ctx.arc(cx,cy,r-5,0,TAU); ctx.fill();
    ctx.shadowBlur=0;
    ctx.fillStyle='#000'; ctx.font='8px "Press Start 2P",monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('E',cx,cy);
    ctx.fillStyle='#ffff44'; ctx.font='6px "Press Start 2P",monospace';
    ctx.fillText('OVERCHARGE',cx,cy+r+12);
  } else {
    ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(cx,cy,r,0,TAU); ctx.fill();
    ctx.fillStyle='#555'; ctx.font='8px "Press Start 2P",monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('E',cx,cy);
    ctx.fillStyle='#444'; ctx.font='6px "Press Start 2P",monospace';
    ctx.fillText('OVERCHARGE',cx,cy+r+12);
  }
}

// ── BACKGROUND ────────────────────────────────────────────────────
function drawBG(ctx,t){
  ctx.fillStyle='#050508'; ctx.fillRect(0,0,W,H);
  // Grid
  const gs=60;
  ctx.strokeStyle='rgba(0,200,255,0.07)'; ctx.lineWidth=1;
  for(let x=0;x<W;x+=gs){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for(let y=0;y<H;y+=gs){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  // Subtle glow center
  const grd=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,500);
  grd.addColorStop(0,'rgba(0,150,255,0.05)'); grd.addColorStop(1,'transparent');
  ctx.fillStyle=grd; ctx.fillRect(0,0,W,H);
  // Vignette
  const vig=ctx.createRadialGradient(W/2,H/2,250,W/2,H/2,720);
  vig.addColorStop(0,'transparent'); vig.addColorStop(1,'rgba(0,0,0,0.7)');
  ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);
}

// ── SCREEN FLASH ─────────────────────────────────────────────────
let flashAlpha=0, flashCol='#ffffff';
function triggerFlash(col='#ffffff',a=0.7){ flashCol=col; flashAlpha=a; }
function drawFlash(ctx,dt){ if(flashAlpha>0){ ctx.fillStyle=flashCol; ctx.globalAlpha=flashAlpha; ctx.fillRect(0,0,W,H); ctx.globalAlpha=1; flashAlpha=Math.max(0,flashAlpha-dt*3); } }

// ── SCREENS ──────────────────────────────────────────────────────
function drawMenu(ctx,t){
  drawBG(ctx,t);
  const pulse=Math.sin(t*2)*0.3+0.7;
  ctx.textAlign='center';
  // Title
  ctx.font='48px "Press Start 2P",monospace';
  ctx.shadowBlur=30; ctx.shadowColor='#00ffff';
  ctx.fillStyle='#00ffff'; ctx.fillText('NEON',W/2,220);
  ctx.shadowColor='#ff00ff'; ctx.fillStyle='#ff00ff'; ctx.fillText('SIEGE',W/2,280);
  ctx.shadowBlur=0;
  // Subtitle
  ctx.font='13px "Press Start 2P",monospace'; ctx.fillStyle='#888';
  ctx.fillText('TOP-DOWN RETRO ARENA SHOOTER',W/2,330);
  // Start prompt
  ctx.font='12px "Press Start 2P",monospace';
  ctx.fillStyle=`rgba(255,255,100,${pulse})`;
  ctx.shadowBlur=8*pulse; ctx.shadowColor='#ffff00';
  ctx.fillText('PRESS ENTER TO START',W/2,420);
  ctx.shadowBlur=0;
  // Controls
  ctx.font='8px "Press Start 2P",monospace'; ctx.fillStyle='#444';
  ctx.fillText('WASD: MOVE   MOUSE: AIM   LMB: SHOOT   SHIFT: DASH   E: OVERCHARGE',W/2,520);
}

function drawGameOver(ctx,score,best,wave,newBest,t){
  ctx.fillStyle='rgba(0,0,0,0.8)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';
  const pulse=Math.sin(t*3)*0.3+0.7;
  ctx.font='54px "Press Start 2P",monospace';
  ctx.shadowBlur=25*pulse; ctx.shadowColor='#ff0033';
  ctx.fillStyle='#ff1144'; ctx.fillText('GAME OVER',W/2,220);
  ctx.shadowBlur=0;
  ctx.font='14px "Press Start 2P",monospace'; ctx.fillStyle='#fff';
  ctx.fillText(`SCORE: ${String(score).padStart(6,'0')}`,W/2,310);
  ctx.fillText(`WAVE REACHED: ${wave}`,W/2,345);
  if(newBest){ ctx.fillStyle='#ffff44'; ctx.fillText('★ NEW HIGH SCORE! ★',W/2,385); }
  ctx.fillStyle='#aaa'; ctx.font='10px "Press Start 2P",monospace';
  ctx.fillText(`BEST: ${String(best).padStart(6,'0')}`,W/2,415);
  ctx.fillStyle=`rgba(255,255,100,${0.5+0.5*pulse})`;
  ctx.font='11px "Press Start 2P",monospace';
  ctx.fillText('[PRESS ENTER TO RETRY]',W/2,500);
}

// ── MAIN GAME ────────────────────────────────────────────────────
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
Input.init(canvas);

// Game state
let state='MENU'; // MENU | GET_READY | PLAYING | WAVE_CLEAR | BOSS | GAME_OVER
let stateT=0;
let wave=0, score=0, best=parseInt(localStorage.getItem('neonSiegeBest')||'0');
let newBest=false;
let player=null, wm=null;
let globalT=0;
let bossWaveClearing=false;

function startGame(){
  Audio.init();
  player=new Player();
  wm=new WaveManager();
  score=0; wave=0; newBest=false; bossWaveClearing=false;
  beginWave();
}

function beginWave(){
  wave++;
  state='GET_READY'; stateT=5;
  player.rechargeOC();
  Particles.list=[];
}

function startPlaying(){
  wm.startWave(wave);
  state='PLAYING'; stateT=0;
  Audio.waveStart();
  triggerFlash('#00ffff',0.4);
}

function waveClear(){
  state='WAVE_CLEAR'; stateT=3;
  const bonus=Math.floor(player.hp*2);
  score+=bonus;
  triggerFlash('#44ff88',0.5);
}

function checkWaveEnd(){
  if(wm.complete){
    if(wave%5===0&&!bossWaveClearing){
      bossWaveClearing=true;
      wm.spawnBoss();
      state='BOSS';
    } else if(bossWaveClearing&&!wm.bossAlive){
      bossWaveClearing=false;
      waveClear();
    } else if(!bossWaveClearing){
      waveClear();
    }
  }
}

let last=0;
function loop(ts){
  requestAnimationFrame(loop);
  const dt=Math.min((ts-last)/1000,0.05); last=ts;
  globalT+=dt;
  Camera.update(dt);

  ctx.save(); Camera.apply(ctx);
  drawBG(ctx,globalT);

  if(state==='MENU'){
    drawMenu(ctx,globalT);
    if(Input.pressed('Enter')||Input.pressed('Space')||Input.pressed('KeyZ')||Input.mouse.clicked){ startGame(); }
  }
  else if(state==='GET_READY'||state==='PLAYING'||state==='WAVE_CLEAR'||state==='BOSS'){
    stateT-=dt;

    // State transitions
    if(state==='GET_READY'&&stateT<=0) startPlaying();
    if((state==='PLAYING'||state==='BOSS')) checkWaveEnd();
    if(state==='WAVE_CLEAR'&&stateT<=0) beginWave();

    // Update
    if(state==='PLAYING'||state==='BOSS'){
      player.update(dt);
      const gained=wm.update(dt,player);
      score+=gained;
      Particles.update(dt);
      if(player.dead){ endGame(); }
    } else {
      Particles.update(dt);
    }

    // Draw
    Particles.draw(ctx);
    if(state!=='GET_READY') wm.draw(ctx);
    if(player) player.draw(ctx);
    drawFlash(ctx,dt);
    const hudState=(state==='BOSS')?'BOSS':state;
    drawHUD(ctx,player,wave,hudState,stateT,score,best,wm);
  }
  else if(state==='GAME_OVER'){
    drawBG(ctx,globalT);
    drawGameOver(ctx,score,best,wave,newBest,globalT);
    if(Input.pressed('Enter')||Input.pressed('Space')){ startGame(); }
  }

  ctx.restore();
  // MUST be last — clears freshly pressed keys after all pressed() checks this frame
  Input.update();
}

function endGame(){
  state='GAME_OVER';
  if(score>best){ best=score; newBest=true; localStorage.setItem('neonSiegeBest',best); }
  triggerFlash('#ff1144',0.9);
  Camera.shake(25,1.0);
}

requestAnimationFrame(ts=>{ last=ts; requestAnimationFrame(loop); });
