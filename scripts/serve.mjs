import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost'),name=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(!['index.html','styles.css','shopper.css','app.js','shopper.js','data.js','navigation.js'].includes(name)){res.writeHead(404);res.end();return;}
  try{const data=await readFile(path.join(root,name));res.setHeader('content-type',name.endsWith('.css')?'text/css':name.endsWith('.js')?'application/javascript':'text/html');res.end(data);}catch{res.writeHead(500);res.end();}
}).listen(4173,'127.0.0.1',()=>console.log('Dawwer preview: http://127.0.0.1:4173'));
