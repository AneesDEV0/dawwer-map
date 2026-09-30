import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const context={window:{}};vm.createContext(context);
for(const file of ['data.js','navigation.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
const {DawerData:data,DawerNavigation:nav}=context.window,store=data.createDemoStore();
const blocked=nav.buildBlocked(store.elements);let count=0;
for(const l of store.locations){
  const shelf=store.elements.find(e=>e.shelfId===l.shelf),route=nav.getRoute(store,shelf,l);
  assert.ok(route.reachable,`Reachable ${l.productId} ${l.shelf}`);
  assert.ok(route.accessPoint.x<shelf.x,'Face A reached from left');
  assert.equal(route.meters,route.distance*.01);
  for(let i=1;i<route.points.length;i++){
    const a=route.points[i-1],b=route.points[i];assert.ok(a.x===b.x||a.y===b.y);
    const steps=Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y))/10;
    for(let j=0;j<=steps;j++)assert.ok(!blocked.has(`${(a.x+(b.x-a.x)*j/steps)/10},${(a.y+(b.y-a.y)*j/steps)/10}`));
  }count++;
}
const target=store.elements.find(e=>e.shelfId==='S-12');
assert.ok(nav.getRoute(store,target,{side:'B',section:'A'}).accessPoint.x>target.x+target.w);
const walls=[{type:'wall',x:0,y:300,w:1200,h:20}];
assert.equal(nav.findPath({x:100,y:100},{x:100,y:600},walls).length,0,'No fabricated fallback');
assert.equal(nav.findPath({x:100,y:310},{x:100,y:600},walls).length,0,'Blocked origin rejected');
const rotated={type:'shelf',x:300,y:300,w:40,h:160,rotation:90};
assert.ok(nav.buildBlocked([rotated]).has('26,38'),'Rotation included in obstacle rasterization');
const entries=store.locations.map(l=>({id:l.productId,shelf:store.elements.find(e=>e.shelfId===l.shelf),location:l}));
assert.equal(nav.getMultiStopRoute(store,entries).ordered.length,7);
assert.equal(nav.validate(store).filter(x=>x.kind==='unlocated').length,8);
const invalid=structuredClone(store);invalid.locations[0].level=99;assert.ok(nav.validate(invalid).some(x=>x.kind==='bounds'));
const overlapped=structuredClone(store);overlapped.elements.push({...target,id:'duplicate'});assert.ok(nav.validate(overlapped).some(x=>x.kind==='overlap'));
console.log(`PASS: ${count} routes, collision sampling, face A/B, centimetres, blocked route/origin, rotation, list ordering, validation.`);
