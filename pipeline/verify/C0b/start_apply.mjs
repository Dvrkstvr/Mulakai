const S='http://127.0.0.1:3701'; const [songId,text]=process.argv.slice(2);
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const j=async(m,u,b)=>{const r=await fetch(S+u,{method:m,headers:{'content-type':'application/json'},body:b?JSON.stringify(b):undefined});let body=null;try{body=await r.json()}catch{}return{status:r.status,body}};
const t=(await j('GET',`/api/chat/songs/${songId}/thread`)).body; const before=t.messages.length;
await j('POST',`/api/chat/threads/${t.id}/turns`,{text});
let edit=null; for(let i=0;i<90&&!edit;i++){await sleep(2000);const th=(await j('GET',`/api/chat/threads/${t.id}`)).body;edit=th.messages.slice(before).find(m=>m.role==='assistant'&&m.kind==='edit');}
const ap=await j('POST',`/api/chat/threads/${t.id}/apply`,{proposalId:edit.proposalId});
console.log(JSON.stringify({thread:t.id,edit:edit.id,job:ap.body.jobId,status:ap.status}));
for(let i=0;i<60;i++){const r=await j('GET',`/api/generate/${ap.body.jobId}`); if(r.body.progressText==='rendering'&&r.body.progressStage==='synthesis'){console.log('synthesis');break;} await sleep(500);}
