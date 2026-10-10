import express from 'express';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {randomBytes} from 'node:crypto';
const app=express(),http=createServer(app),io=new Server(http);app.use(express.static('public'));
const rooms=new Map();
const recipes={burger:{name:'Burger',emoji:'🍔',prep:1,cook:2,points:100},fries:{name:'Fries',emoji:'🍟',prep:1,cook:2,points:80},salad:{name:'Salad',emoji:'🥗',prep:2,cook:0,points:90},pizza:{name:'Pizza',emoji:'🍕',prep:2,cook:3,points:140},soup:{name:'Soup',emoji:'🍲',prep:2,cook:3,points:130},steak:{name:'Steak',emoji:'🥩',prep:1,cook:4,points:160}};
const levels=[{name:'First Shift',time:120,keys:['burger','fries','salad'],goal:3,deadline:90},{name:'Lunch Rush',time:120,keys:['burger','fries','salad','pizza'],goal:4,deadline:75},{name:'Double Trouble',time:115,keys:['pizza','soup','burger','fries','salad'],goal:5,deadline:65},{name:'Dinner Disaster',time:110,keys:['steak','pizza','soup','burger','fries','salad'],goal:6,deadline:55},{name:'Final Frenzy',time:110,keys:['steak','pizza','soup','burger','fries','salad'],goal:7,deadline:45}];
function code(){let c;do{c=randomBytes(3).toString('hex').toUpperCase()}while(rooms.has(c));return c}
function newLevel(r){const l=levels[r.level];r.time=l.time;r.lives=3;r.served=0;r.running=false;r.finished=false;r.won=false;r.chefs=[{item:null},{item:null}];r.orders=Array.from({length:l.goal},(_,i)=>({id:i,key:l.keys[(i*3+r.level+Math.floor(i/3))%l.keys.length],remaining:l.deadline+Math.min(25,i*3),done:false,failed:false}));r.message='Both chefs ready? Host can start the shift.'}
function emit(r){io.to(r.code).emit('state',{code:r.code,level:r.level,levelName:levels[r.level].name,time:r.time,score:r.score,lives:r.lives,served:r.served,goal:levels[r.level].goal,running:r.running,finished:r.finished,won:r.won,chefs:r.chefs,orders:r.orders,recipes,keys:levels[r.level].keys,players:r.players.map((p,i)=>p?{number:i+1,connected:true}:null),message:r.message})}
function finish(r,won){r.running=false;r.finished=true;r.won=won;if(won){const bonus=r.time*5;r.score+=bonus;r.message=`🏆 Shift complete! +${bonus} time bonus`;}else r.message='💥 Shift failed. Try again!';emit(r)}
function tick(r){if(!r.running)return;r.time--;for(const o of r.orders){if(!o.done&&!o.failed&&--o.remaining<=0){o.failed=true;r.lives--;r.message=`⏰ Missed ${recipes[o.key].name}! Lost a life.`}}if(r.lives<=0||r.time<=0)finish(r,false);else if(r.orders.every(o=>o.done||o.failed))finish(r.orders.every(o=>o.done));else emit(r)}
setInterval(()=>{for(const r of rooms.values())tick(r)},1000);
io.on('connection',socket=>{
 socket.on('create',(_,ack)=>{if(socket.data.code)return ack?.({error:'Already in a room'});const c=code(),r={code:c,players:[socket.id,null],level:0,score:0};newLevel(r);rooms.set(c,r);socket.join(c);socket.data={code:c,player:0};ack?.({code:c,player:0});emit(r)});
 socket.on('join',(value,ack)=>{if(socket.data.code)return ack?.({error:'Already in a room'});const c=String(value||'').trim().toUpperCase(),r=rooms.get(c);if(!r)return ack?.({error:'Room not found'});if(r.players[1])return ack?.({error:'Room is full'});r.players[1]=socket.id;socket.join(c);socket.data={code:c,player:1};r.message='👩‍🍳 Both chefs are here!';ack?.({code:c,player:1});emit(r)});
 socket.on('start',()=>{const r=rooms.get(socket.data.code);if(!r||socket.data.player!==0||!r.players[1]||r.running||r.finished)return;r.running=true;r.message='🔥 Dinner rush started!';emit(r)});
 socket.on('next',()=>{const r=rooms.get(socket.data.code);if(!r||socket.data.player!==0||!r.finished)return;if(r.won){r.level=(r.level+1)%levels.length;if(r.level===0)r.score=0;}newLevel(r);emit(r)});
 socket.on('action',({type,key}={})=>{const r=rooms.get(socket.data.code),p=socket.data.player;if(!r||!r.running||r.players[p]!==socket.id)return;const chef=r.chefs[p],other=r.chefs[1-p];if(type==='prep'&&typeof key==='string'&&levels[r.level].keys.includes(key)&&!chef.item){chef.item={key,stage:'raw',progress:0};r.message=`Chef ${p+1} picked up ${recipes[key].name}`}
 else if(type==='work'&&chef.item){const it=chef.item,rec=recipes[it.key];if(it.stage==='raw'){if(++it.progress>=rec.prep){it.stage=rec.cook?'prepped':'ready';it.progress=0}}else if(it.stage==='prepped'){if(++it.progress>=rec.cook){it.stage='ready';it.progress=0}}else if(it.stage==='ready')it.stage='plated';else return;r.message=`Chef ${p+1} is preparing ${rec.name}`}
 else if(type==='serve'&&chef.item?.stage==='plated'){const o=r.orders.find(o=>o.key===chef.item.key&&!o.done&&!o.failed);if(!o){socket.emit('notice','No matching active order!');return}o.done=true;r.served++;r.score+=recipes[o.key].points+Math.max(0,Math.floor(o.remaining/5));r.message=`🔔 Chef ${p+1} served ${recipes[o.key].name}!`;chef.item=null;if(r.served===levels[r.level].goal){finish(r,true);return}}
 else if(type==='pass'&&chef.item&&!other.item){other.item=chef.item;chef.item=null;r.message=`🤝 Chef ${p+1} passed food to Chef ${2-p}`}
 else if(type==='discard'&&chef.item){chef.item=null;r.message=`🗑️ Chef ${p+1} discarded food`}
 else return;emit(r)});
 socket.on('disconnect',()=>{const r=rooms.get(socket.data.code);if(!r)return;r.players[socket.data.player]=null;r.running=false;r.message='A chef disconnected. Shift paused.';if(!r.players.some(Boolean))rooms.delete(r.code);else emit(r)});
});
app.get('/health',(_,res)=>res.json({ok:true}));
http.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Kitchen Chaos listening'));
