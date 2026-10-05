const S='http://127.0.0.1:3401';
const songs=await (await fetch(S+'/api/songs')).json();
for(const s of songs){ const r=await fetch(`${S}/api/songs/${s.id}/score`); const t=await r.text(); let d; try{d=JSON.parse(t)}catch{d=t.slice(0,80)}
 if(d.state&&d.state==='hidden') continue; console.log(s.id.slice(0,8), s.id, JSON.stringify(s.title), s.bpm, r.status, JSON.stringify(d).slice(0,330)); }
