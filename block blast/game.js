'use strict';
// ═══════════════════════════════════════════════════════════
//  BLOCK BLAST — game.js
// ═══════════════════════════════════════════════════════════

// ── BLOCK SHAPE DEFINITIONS ─────────────────────────────────
// Each shape is an array of [row, col] offsets from origin (0,0)
const SHAPES = [
  { name:'Single',    cells:[[0,0]],                                          color:'#f0f0f0' },
  { name:'DominoH',   cells:[[0,0],[0,1]],                                    color:'#38bdf8' },
  { name:'DominoV',   cells:[[0,0],[1,0]],                                    color:'#38bdf8' },
  { name:'TrioH',     cells:[[0,0],[0,1],[0,2]],                              color:'#86efac' },
  { name:'TrioV',     cells:[[0,0],[1,0],[2,0]],                              color:'#86efac' },
  { name:'QuadH',     cells:[[0,0],[0,1],[0,2],[0,3]],                        color:'#fde047' },
  { name:'QuadV',     cells:[[0,0],[1,0],[2,0],[3,0]],                        color:'#fde047' },
  { name:'LShape',    cells:[[0,0],[1,0],[2,0],[2,1]],                        color:'#fb923c' },
  { name:'JShape',    cells:[[0,1],[1,1],[2,0],[2,1]],                        color:'#fb923c' },
  { name:'SShape',    cells:[[0,1],[0,2],[1,0],[1,1]],                        color:'#f87171' },
  { name:'ZShape',    cells:[[0,0],[0,1],[1,1],[1,2]],                        color:'#f87171' },
  { name:'TShape',    cells:[[0,0],[0,1],[0,2],[1,1]],                        color:'#a78bfa' },
  { name:'Square2x2', cells:[[0,0],[0,1],[1,0],[1,1]],                        color:'#e879f9' },
  { name:'BigL',      cells:[[0,0],[1,0],[2,0],[2,1],[2,2]],                  color:'#f97316' },
  { name:'BigSquare', cells:[[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]], color:'#14b8a6' },
  { name:'Corner',    cells:[[0,0],[0,1],[1,0]],                              color:'#818cf8' },
  { name:'UShape',    cells:[[0,0],[0,2],[1,0],[1,1],[1,2]],                  color:'#fbbf24' },
  { name:'Plus',      cells:[[0,1],[1,0],[1,1],[1,2],[2,1]],                  color:'#22d3ee' },
];

// ── AUDIO ────────────────────────────────────────────────────
const Audio = {
  ctx:null, enabled:false,
  init(){
    if(this.ctx) return;
    this.ctx = new (window.AudioContext||window.webkitAudioContext)();
    this.enabled = true;
  },
  _tone(freq,type,dur,gain=0.3,freqEnd=null){
    if(!this.enabled||!this.ctx) return;
    const t=this.ctx.currentTime;
    const o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,t);
    if(freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd,t+dur);
    g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t+dur);
  },
  place(){ this._tone(300,'sine',0.1,0.25,200); },
  clear(n=1){ // n = number of lines
    const freqs=[440,550,660,770,880];
    for(let i=0;i<Math.min(n,freqs.length);i++)
      setTimeout(()=>this._tone(freqs[i],'sine',0.2,0.3),i*60);
  },
  gameOver(){ this._tone(200,'sawtooth',0.8,0.3,60); },
  newBest(){ [523,659,784,1047].forEach((f,i)=>setTimeout(()=>this._tone(f,'sine',0.2,0.3),i*80)); },
  combo(level){ this._tone(400+level*120,'square',0.15,0.25); },
};

// ── CONSTANTS ────────────────────────────────────────────────
const GRID = 8;
let CELL = 52; // dynamic, recalculated on resize
const GAP  = 3;

// ── GAME STATE ───────────────────────────────────────────────
let board, tray, score, best, linesCleared, blocksPlaced;
let hintCount, streakCount, consecutiveClear;
let hintsHighlight; // {slotIdx, r, c} or null
let gameRunning = false;

// Animation state
let clearingCells = []; // [{r,c,color,alpha,scale}]
let particles = [];
let scorePopups = [];

// ── CANVAS & DOM ─────────────────────────────────────────────
const boardCanvas = document.getElementById('board-canvas');
const boardCtx    = boardCanvas.getContext('2d');

const blockCanvases = [0,1,2].map(i=>document.getElementById(`block-${i}`));
const blockCtxs     = blockCanvases.map(c=>c.getContext('2d'));

const scoreEl    = document.getElementById('score-display');
const bestEl     = document.getElementById('best-display');
const hintBtn    = document.getElementById('hint-btn');
const hintCount2 = document.getElementById('hint-count');
const comboBanner= document.getElementById('combo-banner');
const popupsEl   = document.getElementById('popups');
const gameoverEl = document.getElementById('gameover');
const menuEl     = document.getElementById('menu');

// ── DRAG STATE ───────────────────────────────────────────────
let drag = null;
// drag = { slotIdx, shape, ghost:{r,c}|null, px, py, offsetX, offsetY }

// Ghost canvas (drawn on board)
let ghostR = -1, ghostC = -1, ghostShape = null, ghostValid = false;

// ── SIZING ───────────────────────────────────────────────────
function resize(){
  const appEl = document.getElementById('app');
  const totalH = window.innerHeight;
  const totalW = window.innerWidth;

  // Reserve space: score bar ~70, tray ~110, hints ~44, gaps ~50
  const boardMaxH = totalH - 70 - 120 - 44 - 60;
  const boardMaxW = totalW - 24;
  const maxCell = Math.min(
    Math.floor((boardMaxH - GAP*(GRID+1)) / GRID),
    Math.floor((boardMaxW - GAP*(GRID+1)) / GRID)
  );
  CELL = Math.max(28, Math.min(maxCell, 64));

  const boardPx = GRID*CELL + (GRID+1)*GAP;
  boardCanvas.width  = boardPx;
  boardCanvas.height = boardPx;

  // Tray block previews
  const trayCell = Math.round(CELL * 0.58);
  blockCanvases.forEach(c=>{
    c.width  = trayCell*5 + 6;
    c.height = trayCell*5 + 6;
  });
}

// ── INIT / NEW GAME ──────────────────────────────────────────
function newGame(){
  board = Array.from({length:GRID},()=>Array(GRID).fill(null));
  tray  = [null,null,null];
  score = 0; linesCleared = 0; blocksPlaced = 0;
  hintCount = 3; streakCount = 0; consecutiveClear = false;
  hintsHighlight = null;
  clearingCells = []; particles = [];
  scorePopups.forEach(p=>p.el.remove()); scorePopups = [];
  best = parseInt(localStorage.getItem('blockBlastBest')||'0');
  refillTray(true);
  updateUI();
  gameRunning = true;
}

// ── BLOCK GENERATION ─────────────────────────────────────────
function weightedShape(){
  const filled = board.flat().filter(Boolean).length;
  const ratio  = filled / (GRID*GRID);

  // Weighted pool based on fill ratio
  let pool;
  if(ratio < 0.2){
    pool = SHAPES.filter(s=>s.cells.length>=5);
    if(!pool.length) pool = SHAPES;
  } else if(ratio < 0.5){
    pool = SHAPES;
  } else if(ratio < 0.75){
    pool = SHAPES.filter(s=>s.cells.length<=4);
    if(!pool.length) pool = SHAPES;
  } else {
    pool = SHAPES.filter(s=>s.cells.length<=3);
    if(!pool.length) pool = SHAPES;
  }

  let shape = {...pool[Math.floor(Math.random()*pool.length)]};
  shape = {...shape, cells:[...shape.cells]};

  // Bomb block 3%
  if(Math.random()<0.03) shape.isBomb = true;
  // Rainbow 1%
  if(!shape.isBomb && Math.random()<0.01){ shape.isRainbow = true; shape.cells=[[0,0]]; shape.color='rainbow'; }
  return shape;
}

function refillTray(force=false){
  // Only fill slots that are null
  for(let i=0;i<3;i++){
    if(tray[i]===null || force) tray[i] = weightedShape();
  }
  drawTray();
}

// ── BOARD HELPERS ─────────────────────────────────────────────
function canPlace(shape, r, c){
  if(shape.isRainbow) return r>=0&&r<GRID&&c>=0&&c<GRID; // can place anywhere
  for(const [dr,dc] of shape.cells){
    const nr=r+dr, nc=c+dc;
    if(nr<0||nr>=GRID||nc<0||nc>=GRID) return false;
    if(board[nr][nc] && !shape.isRainbow) return false;
  }
  return true;
}

function placePiece(shape, r, c){
  for(const [dr,dc] of shape.cells){
    const nr=r+dr, nc=c+dc;
    if(shape.isRainbow) board[nr][nc]=shape.color;
    else board[nr][nc] = shape.isBomb ? '#ff4444' : shape.color;
  }
  // Bomb: clear row+col of first cell
  if(shape.isBomb && shape.cells.length>0){
    const [br,bc]=[r+shape.cells[0][0], c+shape.cells[0][1]];
    for(let cc=0;cc<GRID;cc++) boardAddClear(br,cc);
    for(let rr=0;rr<GRID;rr++) boardAddClear(rr,bc);
    score += 300;
  }
}

function boardAddClear(r,c){ clearingCells.push({r,c,color:board[r][c]||'#ffffff',alpha:1,scale:1}); }

// Returns array of cleared line indices {type:'row'|'col', idx}
function findCompletedLines(){
  const lines=[];
  for(let r=0;r<GRID;r++) if(board[r].every(v=>v!==null)) lines.push({type:'row',idx:r});
  for(let c=0;c<GRID;c++) if(board.every(row=>row[c]!==null)) lines.push({type:'col',idx:c});
  return lines;
}

function clearLines(lines){
  // Collect cells for animation
  for(const line of lines){
    if(line.type==='row')
      for(let c=0;c<GRID;c++) boardAddClear(line.idx,c);
    else
      for(let r=0;r<GRID;r++) boardAddClear(r,line.idx);
  }
  // Remove content
  for(const line of lines){
    if(line.type==='row') for(let c=0;c<GRID;c++) board[line.idx][c]=null;
    else for(let r=0;r<GRID;r++) board[r][line.idx]=null;
  }
  return lines.length;
}

function calcScore(lineCount){
  const table=[0,100,250,450,700];
  let s = lineCount<table.length ? table[lineCount] : table[4]+(lineCount-4)*200;
  return s;
}

// ── DRAG & DROP ──────────────────────────────────────────────
function getCellFromBoardXY(x,y){
  const r = Math.floor((y - GAP) / (CELL+GAP));
  const c = Math.floor((x - GAP) / (CELL+GAP));
  return {r,c};
}

function getBoardXY(r,c){
  return {
    x: GAP + c*(CELL+GAP),
    y: GAP + r*(CELL+GAP)
  };
}

// Ghost canvas for drag
const ghostCanvas = document.createElement('canvas');
ghostCanvas.id='drag-ghost';
ghostCanvas.style.position='fixed';
ghostCanvas.style.pointerEvents='none';
ghostCanvas.style.zIndex='500';
ghostCanvas.style.display='none';
document.body.appendChild(ghostCanvas);
const ghostCtx = ghostCanvas.getContext('2d');

function startDrag(slotIdx, clientX, clientY){
  if(!gameRunning) return;
  const shape = tray[slotIdx];
  if(!shape) return;
  Audio.init();
  drag = {slotIdx, shape, px:clientX, py:clientY};
  document.getElementById(`slot-${slotIdx}`).classList.add('used','dragging');
  // Draw ghost canvas
  drawGhostCanvas(shape);
  updateGhostPos(clientX, clientY);
  ghostCanvas.style.display='block';
}

function drawGhostCanvas(shape){
  const sz = CELL+GAP;
  const cells = shape.cells;
  const maxR = Math.max(...cells.map(c=>c[0]));
  const maxC = Math.max(...cells.map(c=>c[1]));
  ghostCanvas.width  = (maxC+1)*sz + GAP;
  ghostCanvas.height = (maxR+1)*sz + GAP;
  ghostCtx.clearRect(0,0,ghostCanvas.width,ghostCanvas.height);
  drawBlockOnCtx(ghostCtx, shape, 0, 0, CELL, GAP, 0.85);
}

function updateGhostPos(cx, cy){
  if(!ghostCanvas) return;
  const hw = ghostCanvas.width/2, hh = ghostCanvas.height/2;
  ghostCanvas.style.left  = (cx - hw)+'px';
  ghostCanvas.style.top   = (cy - hh - 20)+'px';
}

function moveDrag(clientX, clientY){
  if(!drag) return;
  drag.px=clientX; drag.py=clientY;
  updateGhostPos(clientX, clientY);

  // Map to board coords
  const rect = boardCanvas.getBoundingClientRect();
  const scaleX = boardCanvas.width/rect.width;
  const scaleY = boardCanvas.height/rect.height;
  const bx = (clientX - rect.left)*scaleX;
  const by = (clientY - rect.top)*scaleY;

  // Snap so center of shape aligns to cell
  const cells=drag.shape.cells;
  const midR = (Math.max(...cells.map(c=>c[0])) / 2);
  const midC = (Math.max(...cells.map(c=>c[1])) / 2);
  const {r,c} = getCellFromBoardXY(bx - midC*(CELL+GAP), by - midR*(CELL+GAP));

  ghostR = r; ghostC = c; ghostShape = drag.shape;
  ghostValid = canPlace(drag.shape, r, c);
  drawBoard();
}

function endDrag(clientX, clientY){
  if(!drag) return;
  const rect = boardCanvas.getBoundingClientRect();
  const scaleX = boardCanvas.width/rect.width;
  const scaleY = boardCanvas.height/rect.height;
  const bx = (clientX - rect.left)*scaleX;
  const by = (clientY - rect.top)*scaleY;

  const cells=drag.shape.cells;
  const midR = (Math.max(...cells.map(c=>c[0])) / 2);
  const midC = (Math.max(...cells.map(c=>c[1])) / 2);
  const {r,c} = getCellFromBoardXY(bx - midC*(CELL+GAP), by - midR*(CELL+GAP));

  const valid = canPlace(drag.shape, r, c);
  if(valid){
    doPlace(drag.slotIdx, drag.shape, r, c);
  } else {
    document.getElementById(`slot-${drag.slotIdx}`).classList.remove('used','dragging');
  }
  ghostCanvas.style.display='none';
  ghostShape=null; ghostR=-1; ghostC=-1;
  drag=null;
  drawBoard(); drawTray();
}

function doPlace(slotIdx, shape, r, c){
  // Place on board
  placePiece(shape, r, c);
  score += shape.cells.length * 5 + (shape.isRainbow?50:0);
  blocksPlaced++;
  tray[slotIdx] = null;
  Audio.place();
  hintsHighlight = null;

  // Check completed lines
  const lines = findCompletedLines();
  let cleared = 0;
  if(lines.length>0){
    cleared = clearLines(lines);
    const lineScore = calcScore(cleared);
    // Streak
    if(consecutiveClear){ streakCount++; score += 50*streakCount; }
    else { streakCount=1; }
    consecutiveClear = true;
    score += lineScore;
    linesCleared += cleared;
    Audio.clear(cleared);
    showCombo(cleared, streakCount);
    spawnScorePopup(lineScore, r, c);
  } else {
    consecutiveClear = false;
    streakCount = 0;
  }

  document.getElementById(`slot-${slotIdx}`).classList.remove('used','dragging');

  // Refill if all 3 placed
  if(tray.every(s=>s===null)) refillTray();

  updateUI();
  drawBoard();
  drawTray();

  // Check game over
  setTimeout(()=>checkGameOver(), 300);
}

function showCombo(lines, streak){
  const labels=['','','DOUBLE!','TRIPLE!','MEGA!','ULTRA!'];
  let text = lines>=2 ? (labels[lines]||'INSANE!') : '';
  if(streak>=2) text = (text?text+' ':'') + `🔥 STREAK ×${streak}`;
  if(!text) return;
  comboBanner.textContent=text;
  comboBanner.classList.remove('hidden');
  setTimeout(()=>comboBanner.classList.add('hidden'),1400);
  Audio.combo(lines+streak);
}

function spawnScorePopup(pts, r, c){
  const rect = boardCanvas.getBoundingClientRect();
  const {x,y} = getBoardXY(r,c);
  const scaleX = rect.width/boardCanvas.width;
  const scaleY = rect.height/boardCanvas.height;
  const el = document.createElement('div');
  el.className='popup';
  el.textContent=`+${pts}`;
  el.style.left = (rect.left + x*scaleX + 20)+'px';
  el.style.top  = (rect.top  + y*scaleY - 10)+'px';
  popupsEl.appendChild(el);
  setTimeout(()=>el.remove(),1300);
}

// ── GAME OVER ────────────────────────────────────────────────
function checkGameOver(){
  if(!gameRunning) return;
  const remaining = tray.filter(Boolean);
  if(remaining.length===0) return; // all placed, refill happened
  const canAny = remaining.some(shape=>{
    for(let r=0;r<GRID;r++) for(let c=0;c<GRID;c++) if(canPlace(shape,r,c)) return true;
    return false;
  });
  if(!canAny) triggerGameOver();
}

function triggerGameOver(){
  gameRunning = false;
  Audio.gameOver();
  const isNewBest = score>best;
  if(isNewBest){ best=score; localStorage.setItem('blockBlastBest',best); Audio.newBest(); }
  document.getElementById('go-score').textContent=score;
  document.getElementById('go-best').textContent=best;
  document.getElementById('go-lines').textContent=linesCleared;
  document.getElementById('go-blocks').textContent=blocksPlaced;
  document.getElementById('gameover-new-best').classList.toggle('hidden',!isNewBest);
  bestEl.textContent=best;
  gameoverEl.classList.remove('hidden');
}

// ── HINTS ────────────────────────────────────────────────────
function doHint(){
  if(hintCount<=0||!gameRunning) return;
  // Find best placement for any tray block
  let bestScore=-1, bestPlacement=null;
  for(let si=0;si<3;si++){
    const shape=tray[si]; if(!shape) continue;
    for(let r=0;r<GRID;r++) for(let c=0;c<GRID;c++){
      if(!canPlace(shape,r,c)) continue;
      // Score: how many lines would be cleared
      const tmp = board.map(row=>[...row]);
      for(const [dr,dc] of shape.cells) tmp[r+dr][c+dc]=shape.color;
      let lc=0;
      for(let rr=0;rr<GRID;rr++) if(tmp[rr].every(v=>v)) lc++;
      for(let cc=0;cc<GRID;cc++) if(tmp.every(row=>row[cc])) lc++;
      if(lc>bestScore){ bestScore=lc; bestPlacement={si,r,c,shape}; }
    }
  }
  if(!bestPlacement) return;
  hintsHighlight=bestPlacement;
  hintCount--;
  hintCount2.textContent=hintCount;
  if(hintCount<=0) hintBtn.disabled=true;
  drawBoard(); drawTray();
}

// ── DRAWING ──────────────────────────────────────────────────
function rainbowColor(t){ return `hsl(${(t*180)%360},100%,60%)`; }

function drawBlockOnCtx(ctx, shape, startX, startY, cell, gap, alphaVal=1){
  const now = Date.now()/500;
  ctx.save(); ctx.globalAlpha=alphaVal;
  for(const [dr,dc] of shape.cells){
    const x=startX+dc*(cell+gap);
    const y=startY+dr*(cell+gap);
    const col = shape.isRainbow ? rainbowColor(now+dr*0.3+dc*0.4)
               : shape.isBomb  ? '#ff4444'
               : shape.color;
    // Cell fill
    ctx.fillStyle=col;
    ctx.beginPath();
    roundRect(ctx, x, y, cell, cell, Math.max(3, cell*0.15));
    ctx.fill();
    // Inner highlight
    ctx.fillStyle='rgba(255,255,255,0.25)';
    ctx.beginPath();
    roundRect(ctx, x+2, y+2, cell*0.55, cell*0.22, 3);
    ctx.fill();
    // Bomb overlay
    if(shape.isBomb){
      ctx.fillStyle='rgba(0,0,0,0.4)';
      ctx.beginPath(); roundRect(ctx,x,y,cell,cell,Math.max(3,cell*0.15)); ctx.fill();
      ctx.fillStyle='#fff'; ctx.font=`bold ${Math.round(cell*0.55)}px sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('⚡',x+cell/2,y+cell/2);
    }
    // Rainbow overlay
    if(shape.isRainbow){
      ctx.fillStyle='rgba(255,255,255,0.2)';
      ctx.beginPath(); roundRect(ctx,x,y,cell,cell,Math.max(3,cell*0.15)); ctx.fill();
      ctx.font=`bold ${Math.round(cell*0.55)}px sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('🌈',x+cell/2,y+cell/2);
    }
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r);
  ctx.closePath();
}

function drawBoard(){
  const ctx=boardCtx;
  const W=boardCanvas.width, H=boardCanvas.height;
  const now=Date.now()/500;

  // Background
  ctx.fillStyle='#0f3460';
  ctx.beginPath(); roundRect(ctx,0,0,W,H,12); ctx.fill();

  // Grid cells
  for(let r=0;r<GRID;r++) for(let c=0;c<GRID;c++){
    const x=GAP+c*(CELL+GAP), y=GAP+r*(CELL+GAP);
    const cell=board[r][c];
    const clearing=clearingCells.find(cc=>cc.r===r&&cc.c===c);

    if(clearing){
      ctx.save();
      ctx.globalAlpha=clearing.alpha;
      const cx2=x+CELL/2, cy2=y+CELL/2;
      ctx.translate(cx2,cy2); ctx.scale(clearing.scale,clearing.scale); ctx.translate(-cx2,-cy2);
      ctx.fillStyle='#ffffff';
      ctx.beginPath(); roundRect(ctx,x,y,CELL,CELL,CELL*0.15); ctx.fill();
      ctx.restore();
    } else if(cell){
      const col=cell==='rainbow'?rainbowColor(now+r*0.2+c*0.3):cell;
      ctx.fillStyle=col;
      ctx.beginPath(); roundRect(ctx,x,y,CELL,CELL,CELL*0.15); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.22)';
      ctx.beginPath(); roundRect(ctx,x+3,y+3,CELL*0.5,CELL*0.2,3); ctx.fill();
    } else {
      ctx.fillStyle='#0d2a4a';
      ctx.beginPath(); roundRect(ctx,x,y,CELL,CELL,CELL*0.15); ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,0.04)'; ctx.lineWidth=1;
      ctx.stroke();
    }
  }

  // Ghost preview
  if(ghostShape && ghostR>=0 && drag){
    for(const [dr,dc] of ghostShape.cells){
      const nr=ghostR+dr, nc=ghostC+dc;
      if(nr<0||nr>=GRID||nc<0||nc>=GRID) continue;
      const x=GAP+nc*(CELL+GAP), y=GAP+nr*(CELL+GAP);
      ctx.globalAlpha=ghostValid?0.4:0.18;
      ctx.fillStyle=ghostValid?'#00ff88':'#ff4444';
      ctx.beginPath(); roundRect(ctx,x,y,CELL,CELL,CELL*0.15); ctx.fill();
      if(ghostValid){
        ctx.strokeStyle='#00ff88'; ctx.lineWidth=2;
        ctx.stroke();
      }
      ctx.globalAlpha=1;
    }
  }

  // Hint highlight
  if(hintsHighlight){
    const {shape,r,c}=hintsHighlight;
    for(const [dr,dc] of shape.cells){
      const nr=r+dr, nc=c+dc;
      if(nr<0||nr>=GRID||nc<0||nc>=GRID) continue;
      const x=GAP+nc*(CELL+GAP), y=GAP+nr*(CELL+GAP);
      ctx.globalAlpha=0.35+0.25*Math.sin(Date.now()/300);
      ctx.fillStyle='#f5e642';
      ctx.beginPath(); roundRect(ctx,x,y,CELL,CELL,CELL*0.15); ctx.fill();
      ctx.strokeStyle='#f5e642'; ctx.lineWidth=2.5; ctx.stroke();
      ctx.globalAlpha=1;
    }
  }

  // Clear animation update
  let anyClearing=false;
  for(const cc of clearingCells){
    cc.alpha-=0.05; cc.scale-=0.04;
    if(cc.alpha>0) anyClearing=true;
    // Particles
    if(Math.random()<0.3 && cc.alpha>0){
      const x=GAP+cc.c*(CELL+GAP)+CELL/2, y=GAP+cc.r*(CELL+GAP)+CELL/2;
      particles.push({x,y,vx:rnd(-3,3),vy:rnd(-5,-1),col:cc.color,life:1,r:rnd(2,5)});
    }
  }
  clearingCells=clearingCells.filter(cc=>cc.alpha>0);

  // Draw particles
  for(const p of particles){
    ctx.globalAlpha=p.life;
    ctx.fillStyle=p.col;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r*p.life,0,Math.PI*2); ctx.fill();
    p.x+=p.vx; p.y+=p.vy; p.vy+=0.2; p.life-=0.03;
  }
  particles=particles.filter(p=>p.life>0);
  ctx.globalAlpha=1;

  if(anyClearing||particles.length>0) requestAnimationFrame(drawBoard);
}

function drawTray(){
  const cell = Math.round(CELL*0.58);
  const gap  = Math.round(GAP*0.7);
  for(let i=0;i<3;i++){
    const ctx=blockCtxs[i];
    const cw=blockCanvases[i].width, ch=blockCanvases[i].height;
    ctx.clearRect(0,0,cw,ch);
    const shape=tray[i];
    if(!shape) continue;
    if(drag&&drag.slotIdx===i) continue; // being dragged
    drawBlockOnCtx(ctx, shape, gap, gap, cell, gap, 1.0);
  }
  // Animate rainbow cells
  requestAnimationFrame(()=>{ if(tray.some(s=>s&&s.isRainbow)) drawTray(); });
}

function updateUI(){
  scoreEl.textContent=score;
  bestEl.textContent=Math.max(score,best);
}

// ── ANIMATION LOOP ───────────────────────────────────────────
function rnd(a,b){ return Math.random()*(b-a)+a; }

// ── EVENTS ────────────────────────────────────────────────────
function getClientXY(e){
  if(e.touches) return {x:e.touches[0].clientX, y:e.touches[0].clientY};
  return {x:e.clientX, y:e.clientY};
}

function getSlotFromEvent(e){
  const {x,y} = getClientXY(e);
  for(let i=0;i<3;i++){
    const slot=document.getElementById(`slot-${i}`);
    const rect=slot.getBoundingClientRect();
    if(x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom) return i;
  }
  return -1;
}

// Mouse events
document.addEventListener('mousedown', e=>{
  const si=getSlotFromEvent(e);
  if(si>=0&&tray[si]){ e.preventDefault(); startDrag(si,e.clientX,e.clientY); }
});
document.addEventListener('mousemove', e=>{ if(drag){ e.preventDefault(); moveDrag(e.clientX,e.clientY); }});
document.addEventListener('mouseup',   e=>{ if(drag){ e.preventDefault(); endDrag(e.clientX,e.clientY); }});

// Touch events
document.addEventListener('touchstart', e=>{
  const t=e.touches[0];
  const si=getSlotFromEvent(e);
  if(si>=0&&tray[si]){ e.preventDefault(); startDrag(si,t.clientX,t.clientY); }
},{passive:false});
document.addEventListener('touchmove', e=>{ if(drag){ e.preventDefault(); moveDrag(e.touches[0].clientX,e.touches[0].clientY); }},{passive:false});
document.addEventListener('touchend',  e=>{ if(drag){ e.preventDefault(); const t=e.changedTouches[0]; endDrag(t.clientX,t.clientY); }},{passive:false});

// Hint button
hintBtn.addEventListener('click',()=>{ Audio.init(); doHint(); });

// Game Over buttons
document.getElementById('btn-retry').addEventListener('click',()=>{
  gameoverEl.classList.add('hidden');
  Audio.init(); newGame(); drawBoard(); drawTray();
});
document.getElementById('btn-menu').addEventListener('click',()=>{
  gameoverEl.classList.add('hidden');
  document.getElementById('menu-best-val').textContent=best;
  menuEl.classList.remove('hidden');
});

// Start button
document.getElementById('btn-start').addEventListener('click',()=>{
  Audio.init();
  menuEl.classList.add('hidden');
  newGame(); drawBoard(); drawTray();
});

// ── STARTUP ──────────────────────────────────────────────────
window.addEventListener('resize', ()=>{ resize(); if(gameRunning){ drawBoard(); drawTray(); } });
resize();
best=parseInt(localStorage.getItem('blockBlastBest')||'0');
document.getElementById('menu-best-val').textContent=best;
bestEl.textContent=best;

// Redraw loop for rainbow + hints pulse
setInterval(()=>{
  if(!gameRunning) return;
  if(hintsHighlight) drawBoard();
  if(tray.some(s=>s&&s.isRainbow)) drawTray();
},80);
