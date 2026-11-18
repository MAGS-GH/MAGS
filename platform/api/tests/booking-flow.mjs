// Requires the local-issuer.mjs test issuer, the API and a disposable database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = new URL(process.env.SALON_TEST_API || 'http://127.0.0.1:54931');
const issuer = new URL(process.env.SALON_TEST_ISSUER || 'http://127.0.0.1:54930');
for (const url of [base, issuer]) assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
const jwt = (await (await fetch(new URL('/test-token?role=admin',issuer),{method:'POST'})).json()).access_token;
const dateString = date => new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Copenhagen'}).format(date);
const day = dateString(new Date(Date.now()+4*86400000));
const slug = 'bookingtest-'+randomUUID().slice(0,8);
const headers = {'content-type':'application/json'};
// Simulate an independently forwarded visitor IP per test run on the private API.
headers['x-real-ip'] = '2001:db8::'+randomUUID().slice(0,4);
async function request(path,{data,auth=false,method,expected=200}={}) {
  const response = await fetch(new URL('/api'+path,base),{method:method ?? (data?'POST':'GET'),
    headers:auth?{...headers,authorization:'Bearer '+jwt}:headers,body:JSON.stringify(data)});
  const body = await response.text();
  assert.ok([expected].flat().includes(response.status), path.split('/').slice(0,3).join('/')+' got '+response.status+' '+body.slice(0,200));
  return body ? (response.headers.get('content-type').includes('json')?JSON.parse(body):body) : null;
}
const admin = (path,data,expected=200,method) => request(path,{auth:true,data,expected,method});
const salon = await admin('/admin/salons',{name:'Testsalonen',address:'Testgade 1',phone:'70000001',slug},201);
const desk='/salons/'+salon.id, shop='/public/salons/'+slug;
await request(shop,{expected:404});
const initial=(await admin(desk+'/setup')).salon;
await admin(desk+'/settings',{...initial,horizonDays:365},200,'PUT');
const serviceForm={name:'Klip',description:'',priceOre:45000,durationMinutes:45,cleanupMinutes:15,active:true};
const service=await admin(desk+'/services',serviceForm);
const shifts=Array.from({length:7},(_,i)=>({weekday:i+1,startMin:540,endMin:960}));
// Make the next daylight-saving discontinuity bookable to exercise actual UTC durations.
const clock = instant => new Intl.DateTimeFormat('da-DK',{timeZone:'Europe/Copenhagen',hour:'2-digit'}).format(instant);
let transition;
for(let i=5;i<=364;i++){
  const date=new Date(Date.now()+i*86400000);
  const noon=new Date(dateString(date)+'T12:00:00Z');
  if(clock(noon)!==clock(new Date(noon.getTime()-86400000))){transition=dateString(date);break;}
}
assert.ok(transition);
const employee={name:'Frisør A',active:true,serviceIds:[service.id],shifts,exceptions:[{date:transition,startMin:60,endMin:300}]};
const first=await admin(desk+'/staff',employee);
const second=await admin(desk+'/staff',{...employee,name:'Frisør B'});
await admin(desk+'/publication',{status:'published'},200,'PUT');
const catalogue=await request(shop);
assert.ok(catalogue.services[0].firstAvailableDate);
assert.equal(catalogue.staff.length,2);
const availability=(d=day) => request(shop+'/availability?serviceId='+service.id+'&from='+d+'&days=1');
const opts=(await availability()).days[0].slots;
assert.deepEqual(new Set(opts[0].staffIds),new Set([first.id,second.id]));
assert.equal(opts.length,25); // 09:00 to 15:00 inclusive, with customer plus cleanup fitting by 16:00.
const dst=(await availability(transition)).days[0].slots;
const summer=clock(new Date(transition+'T12:00:00Z'))==='14';
assert.equal(dst.length,summer?9:17);
for(const slot of dst) assert.equal(Date.parse(slot.end)-Date.parse(slot.start),45*60000);

const create=(start,overrides={})=>({serviceId:service.id,staffId:first.id,start,name:'Ida Eksempel',phone:'70000004',requestId:randomUUID(),
  expectedPriceMinor:45000,expectedDurationMinutes:45,...overrides});
const write=(body,expected=200) => request(shop+'/appointments',{data:body,expected});
const original=create(opts[0].start);
const [one,retried]=await Promise.all([write(original),write(original)]);
assert.equal(one.appointment.id,retried.appointment.id);
assert.equal(one.token,retried.token);
await write({...original,name:'Anden gæst'},409);
await write(create(opts[1].start),409); // Different start, same occupied interval.
await write(create(opts[3].start),409); // Customer has finished at 09:45, cleanup continues.
const replacement=await write(create(opts[0].start,{staffId:null,name:'Lise Eksempel',phone:'70000005'}));
assert.equal(replacement.appointment.staffId,second.id);
const races=await Promise.all([0,1].map(i=>write(create(opts[12+i].start,{phone:'7000000'+(6+i)}),[200,409])));
assert.equal(races.filter(v=>v.appointment).length,1);
const history=await admin(desk+'/calendar?date='+day);
assert.equal(history.appointments.length,3);
const guest='/guest/'+one.token;
const appointment=await request(guest);
assert.equal(appointment.customerName,'Ida Eksempel');
const ics=await request(guest+'/calendar.ics');
assert.match(ics,/BEGIN:VEVENT/);
assert.ok(!ics.includes(one.token));
assert.ok(!ics.includes(appointment.customerName));
const touched=await admin(desk+'/blocks',{staffId:first.id,start:opts[1].start,end:opts[2].end,reason:'Pause'},409);
assert.equal(touched.appointments[0].id,one.appointment.id);
const block=await admin(desk+'/blocks',{staffId:first.id,start:opts[20].start,end:opts[20].end,reason:'Pause'});
const filtered=(await availability()).days[0].slots.find(s=>s.start===opts[20].start);
assert.ok(!filtered.staffIds.includes(first.id));
await admin(desk+'/blocks/'+block.id,undefined,200,'DELETE');

await admin(desk+'/services/'+service.id,{...serviceForm,priceOre:52000,durationMinutes:60},200,'PUT');
const stale=await write(create(opts[20].start),409);
assert.equal(stale.code,'catalogue_changed');
await admin(desk+'/publication',{status:'paused'},200,'PUT');
await request(shop,{expected:404});
const changes=await request(guest+'/availability?from='+day+'&days=1');
assert.equal(changes.staff.length,2);
const moved=await request(guest+'/move',{data:{start:opts[20].start,staffId:first.id}});
assert.equal(moved.priceMinor,45000);
assert.equal(Date.parse(moved.end)-Date.parse(moved.start),45*60000);
const customer=history.appointments.find(a=>a.id===one.appointment.id).customerId;
await admin(desk+'/customers/'+customer+'/anonymize',{},409);
const cancelled=await request(guest+'/cancel',{method:'POST'});
assert.equal(cancelled.status,'cancelled');
assert.equal((await request(guest+'/cancel',{method:'POST'})).status,'cancelled');
await admin(desk+'/customers/'+customer+'/anonymize',{});
await request(guest,{expected:404});
assert.equal((await admin(desk+'/customers?q=70000004')).customers.length,0);
await admin(desk+'/publication',{status:'published'},200,'PUT');
assert.ok((await availability()).days[0].slots.find(s=>s.start===opts[20].start).staffIds.includes(first.id));
await admin(desk+'/settings',{...initial,horizonDays:365,changeHours:168},200,'PUT');
assert.equal((await request('/guest/'+replacement.token)).canChange,true);
headers['x-real-ip']='2001:db8:2::'+randomUUID().slice(0,4);
const late=await write(create(opts[20].start,{expectedPriceMinor:52000,expectedDurationMinutes:60}));
const locked='/guest/'+late.token;
assert.equal((await request(locked)).canChange,false);
await request(locked+'/move',{data:{start:opts[20].start},expected:409});
await request(locked+'/cancel',{method:'POST',expected:409});
await admin(desk+'/appointments/'+late.appointment.id+'/cancel',{});
const receiver='70001109';
headers['x-real-ip']='2001:db8:1::'+randomUUID().slice(0,4);
for(let i=0;i<6;i++){
  const extra=await write(create(opts[20].start,{phone:receiver,expectedPriceMinor:52000,expectedDurationMinutes:60}));
  await admin(desk+'/appointments/'+extra.appointment.id+'/cancel',{});
}
await write(create(opts[20].start,{phone:receiver,expectedPriceMinor:52000,expectedDurationMinutes:60}),429);
for(let i=0;i<8;i++) await request('/guest/bad-token/cancel',{method:'POST',expected:404});
await request('/guest/bad-token/cancel',{method:'POST',expected:429});
console.log('PASS: DST, 15-minute grid, cleanup, concurrency, assignment, private link, ICS, blocks, price changes, snapshot, pause, move/cancel, change deadline, rate limits, anonymization.');
