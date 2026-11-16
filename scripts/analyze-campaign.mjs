import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const server = await createServer({root:fileURLToPath(new URL('../',import.meta.url)),server:{middlewareMode:true},optimizeDeps:{noDiscovery:true,include:[]}});
const {CAMPAIGN_CATALOG:orders} = await server.ssrLoadModule('/src/campaign/CampaignCatalog.ts');
const {initialAttempt,placeCampaign} = await server.ssrLoadModule('/src/campaign/CampaignSession.ts');
const {findPieceById} = await server.ssrLoadModule('/src/pieces.ts');
const {canPlace} = await server.ssrLoadModule('/src/engine.ts');
// Offline QA player: prefer target clears, then nearly-filled target axes and compact packing.
function play(order, seed, recovery=false, defeat=false) {
 let state=initialAttempt(order,seed), moves=[];
 if(recovery){
  outer:for(let slot=0;slot<3;slot++)for(let r=0;r<10;r++)for(let c=0;c<10;c++){
   const p=findPieceById(state.trayIds[slot]);if(!p||!canPlace(state.board,p,r,c))continue;
   const n=placeCampaign(state,slot,r,c);if(n.remainingTargets.length===state.remainingTargets.length){state=n;moves.push([slot,r,c]);break outer;}
  }
 }
 for(let turn=0;turn<200 && state.status==='running';turn++){
  let best, bestScore=-Infinity, move;
  for(let slot=0;slot<3;slot++){
   const p=findPieceById(state.trayIds[slot]); if(!p)continue;
   for(let r=0;r<10;r++)for(let c=0;c<10;c++){
    if(!canPlace(state.board,p,r,c))continue;
    const n=placeCampaign(state,slot,r,c);
    let score=(state.remainingTargets.length-n.remainingTargets.length)*1000+(n.score-state.score)*.2;
    if(n.status==='failed')score-=10000;
    for(const cell of n.remainingTargets){const row=Math.floor(cell/10),col=cell%10;
     score+= Math.pow(n.board[row].filter(Boolean).length,3)*.025+Math.pow(n.board.filter(row=>row[col]).length,3)*.025;
    }
    for(const [dr,dc] of p.cells){const rr=r+dr,cc=c+dc;score+=(rr===0||rr===9?1:0)+(cc===0||cc===9?1:0);for(const [a,b]of [[rr-1,cc],[rr+1,cc],[rr,cc-1],[rr,cc+1]])if(state.board[a]?.[b])score+=.5;}
    if(defeat)score=-score;
    if(score>bestScore){best=n;bestScore=score;move=[slot,r,c];}
   }
  }
  if(!best)throw Error('running with no legal moves');state=best;moves.push(move);
 }
 return {seed,moves,status:state.status};
}
const summary=[];
try {
 for(const order of orders.slice(3)){
  const results=Array.from({length:25},(_,i)=>play(order,i+1));
  const wins=results.filter(r=>r.status==='succeeded');
  const defeat=play(order,17,false,true);
  if(!wins.length||defeat.status!=='failed')throw Error(`Missing win/loss evidence for ${order.id}`);
  summary.push({id:order.id,seeds:25,wins:wins.length,losses:results.length-wins.length,
   shortestWin:Math.min(...wins.map(r=>r.moves.length)),longestWin:Math.max(...wins.map(r=>r.moves.length)),deliberateCrowding:defeat.status});
 }
 console.log(JSON.stringify({method:'Greedy offline QA player, seeds 1–25; deliberate crowding seed 17. Not a human win-rate estimate.',orders:summary},null,2));
} finally { await server.close(); }
