(function () {
  'use strict';
  // Existing API coordinates are centimetres. One grid cell is 10 cm.
  const GRID = 10, WIDTH = 1200, HEIGHT = 720;
  const obstacleTypes = new Set(['shelf','wall','freezer','fridge','checkout','obstacle']);
  const key = (x,y) => `${x},${y}`;
  function localPoint(p,e) {
    const a=-(e.rotation||0)*Math.PI/180, dx=p.x-e.x-e.w/2, dy=p.y-e.y-e.h/2;
    return {x:dx*Math.cos(a)-dy*Math.sin(a),y:dx*Math.sin(a)+dy*Math.cos(a)};
  }
  function worldPoint(p,e) {
    const a=(e.rotation||0)*Math.PI/180;
    return {x:e.x+e.w/2+p.x*Math.cos(a)-p.y*Math.sin(a),y:e.y+e.h/2+p.x*Math.sin(a)+p.y*Math.cos(a)};
  }
  function buildBlocked(elements,padding=7) {
    const blocked=new Set();
    for(const e of elements.filter(e=>obstacleTypes.has(e.type))) {
      const radius=Math.hypot(e.w,e.h)/2+padding+GRID, cx=e.x+e.w/2, cy=e.y+e.h/2;
      for(let y=Math.max(0,Math.floor((cy-radius)/GRID));y<=Math.min(HEIGHT/GRID,Math.ceil((cy+radius)/GRID));y++)
        for(let x=Math.max(0,Math.floor((cx-radius)/GRID));x<=Math.min(WIDTH/GRID,Math.ceil((cx+radius)/GRID));x++) {
          const p=localPoint({x:x*GRID,y:y*GRID},e);
          if(Math.abs(p.x)<=e.w/2+padding+GRID/2 && Math.abs(p.y)<=e.h/2+padding+GRID/2) blocked.add(key(x,y));
        }
    }
    return blocked;
  }
  function findPath(startPoint,endPoint,elements,existingBlocked) {
    if(!startPoint||!endPoint) return [];
    const blocked=existingBlocked||buildBlocked(elements);
    const start={x:Math.round(startPoint.x/GRID),y:Math.round(startPoint.y/GRID)}, end={x:Math.round(endPoint.x/GRID),y:Math.round(endPoint.y/GRID)};
    const valid=p=>p.x>=0&&p.x<=WIDTH/GRID&&p.y>=0&&p.y<=HEIGHT/GRID&&!blocked.has(key(p.x,p.y));
    if(!valid(start)||!valid(end)) return [];
    const queue=[start],seen=new Set([key(start.x,start.y)]),parents=new Map();
    for(let head=0;head<queue.length;head++) {
      const p=queue[head];
      if(p.x===end.x&&p.y===end.y) {
        const path=[];let current=p;
        while(current){path.push({x:current.x*GRID,y:current.y*GRID});current=parents.get(key(current.x,current.y));}
        return simplify(path.reverse());
      }
      for(const [dx,dy] of [[0,-1],[1,0],[-1,0],[0,1]]) {
        const n={x:p.x+dx,y:p.y+dy},k=key(n.x,n.y);
        if(!valid(n)||seen.has(k)) continue;
        seen.add(k);parents.set(k,p);queue.push(n);
      }
    }
    return []; // Never fall back to a line through obstacles.
  }
  function simplify(points){return points.filter((p,i)=>!i||i===points.length-1||(p.x-points[i-1].x)*(points[i+1].y-p.y)!==(p.y-points[i-1].y)*(points[i+1].x-p.x));}
  function pathDistance(points){return points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);}
  // A is the left long face at 0 degrees, B the opposite. RTL does not change geometry.
  function getAccessPoint(e,fromPoint,blocked,side='A',section='B') {
    const index=Math.max(0,Math.min((e.sections||4)-1,section.charCodeAt(0)-65));
    const along=-e.h/2+(index+.5)*e.h/(e.sections||4);
    const p=worldPoint({x:(side==='B'?1:-1)*(e.w/2+22),y:side==='B'?-along:along},e);
    const point={x:Math.round(p.x/GRID)*GRID,y:Math.round(p.y/GRID)*GRID};
    return blocked.has(key(point.x/GRID,point.y/GRID))?null:point;
  }
  function getRoute(store,shelf,location={},origin=store.entrance) {
    const blocked=buildBlocked(store.elements),accessPoint=location.accessPoint||shelf.accessPoints?.[location.side||'A']||getAccessPoint(shelf,origin,blocked,location.side||'A',location.section||'B');
    const points=findPath(origin,accessPoint,store.elements,blocked),distance=pathDistance(points);
    return {points,accessPoint,distance,meters:distance*(store.metersPerUnit||.01),reachable:points.length>0};
  }
  function getMultiStopRoute(store,entries,origin=store.entrance) {
    let current=origin;const remaining=entries.slice(),ordered=[],points=[],unreachable=[];
    while(remaining.length) {
      const ranked=remaining.map(entry=>({entry,route:getRoute(store,entry.shelf||entry,entry.location||{},current)})).filter(x=>x.route.reachable).sort((a,b)=>a.route.distance-b.route.distance);
      if(!ranked.length){unreachable.push(...remaining);break;}
      const {entry,route}=ranked[0];ordered.push(entry);points.push(...(points.length?route.points.slice(1):route.points));current=route.accessPoint;remaining.splice(remaining.indexOf(entry),1);
    }
    return {points,ordered,unreachable,distance:pathDistance(points)};
  }
  function validate(store) {
    const issues=[];
    for(const p of store.products) if(!store.locations.some(l=>l.productId===p.id)) issues.push({kind:'unlocated',message:`${p.name}: بلا موقع`});
    for(const l of store.locations) {
      const shelf=store.elements.find(e=>e.shelfId===l.shelf);
      if(!shelf){issues.push({kind:'missing',message:`${l.shelf}: وحدة العرض غير موجودة`});continue;}
      if(!['A','B'].includes(l.side)||l.level<1||l.level>shelf.levels||l.position<1||l.position>3||!/^[A-F]$/.test(l.section)||l.section.charCodeAt(0)-65>=shelf.sections) issues.push({kind:'bounds',message:`${l.shelf}: خانة خارج حدود الرف`});
      if(!getRoute(store,shelf,l).reachable) issues.push({kind:'unreachable',message:`${l.shelf} / ${l.side}: موقع غير قابل للوصول`});
    }
    const fixtures=store.elements.filter(e=>obstacleTypes.has(e.type)&&e.type!=='wall');
    const corners=e=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>worldPoint({x:x*e.w/2,y:y*e.h/2},e));
    function overlaps(a,b) {
      const aa=corners(a),bb=corners(b);
      return [aa,bb].every(poly=>poly.every((p,i)=>{const q=poly[(i+1)%4],axis={x:-(q.y-p.y),y:q.x-p.x};const ap=aa.map(v=>v.x*axis.x+v.y*axis.y),bp=bb.map(v=>v.x*axis.x+v.y*axis.y);return Math.max(...ap)>Math.min(...bp)&&Math.max(...bp)>Math.min(...ap);}));
    }
    fixtures.forEach((a,i)=>fixtures.slice(i+1).forEach(b=>{if(overlaps(a,b)) issues.push({kind:'overlap',message:`تداخل بين ${a.shelfId||a.id} و${b.shelfId||b.id}`});}));
    return issues;
  }
  window.DawerNavigation={GRID,buildBlocked,getAccessPoint,findPath,getRoute,getMultiStopRoute,pathDistance,validate,localPoint,worldPoint};
})();
