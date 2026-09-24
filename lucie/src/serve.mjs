import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
const root=resolve(import.meta.dirname,'../dist');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const port=Number(process.env.PORT || 4173);
createServer((req,res)=>{
  try {
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let file=resolve(root,'.'+path);
    if(file!==root && !file.startsWith(root+sep)){res.writeHead(403).end();return;}
    if(statSync(file).isDirectory()){
      if(!path.endsWith('/')){res.writeHead(301,{Location:path+'/'}).end();return;}
      file=resolve(file,'index.html');
    }
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, follow'});
    res.end(readFileSync(file));
  }catch {res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});res.end(readFileSync(resolve(root,'404.html')));}
}).listen(port,'127.0.0.1',()=>console.log('Local preview: http://127.0.0.1:'+port));
