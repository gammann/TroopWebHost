// A real local HTTP server standing in for TroopWebHost (genuine 302s).
const http=require('http'), fs=require('fs'), path=require('path');
function parseMultipart(buf,ct){ const b='--'+ct.match(/boundary=(.+)$/)[1]; const out=[];
  for(const part of buf.toString('latin1').split(b)){ const m=part.match(/name="([^"]*)"\r\n\r\n([\s\S]*?)\r\n$/); if(m) out.push({name:m[1],value:m[2]}); } return out; }
module.exports=function create(opts){
  const state={posts:[],gets:[]};
  const toolHtml=()=>fs.readFileSync(opts.toolPath,'utf8');
  const server=http.createServer((req,res)=>{
    const u=new URL(req.url,'http://x'); state.gets.push(req.method+' '+u.pathname+u.search);
    const send=(code,type,body,h)=>{res.writeHead(code,Object.assign({'Content-Type':type},h||{}));res.end(body);};
    if(u.pathname==='/Custom.aspx') return send(200,'text/html','<!DOCTYPE html><html><head><title>'+(opts.title||'Troop 1776 - Custom Page')+'</title><style>body{background:'+(opts.bg||'#ffffff')+';font-family:Arial}</style></head><body>'+toolHtml()+'</body></html>');
    if(u.pathname==='/FormDetail.aspx'&&req.method==='GET'){
      if(opts.denyExport) return send(302,'text/html','',{Location:'/Default.aspx'});
      return send(200,'text/html',opts.exportHtml);
    }
    if(u.pathname==='/FormDetail.aspx'&&req.method==='POST'){
      const chunks=[]; req.on('data',c=>chunks.push(c)); req.on('end',()=>{
        state.posts.push(parseMultipart(Buffer.concat(chunks),req.headers['content-type']));
        if(opts.postRedirectsElsewhere) return send(302,'text/html','',{Location:'/Default.aspx'});
        send(302,'text/html','',{Location:'/FormCSV.aspx?Menu_Item_ID=45954&Form_ID=1690&Stack=2&ID=1&FK=0'}); });
      return;
    }
    if(u.pathname==='/Default.aspx') return send(200,'text/html','<html><body>Home</body></html>');
    if(u.pathname==='/FormCSV.aspx') return send(200,'text/csv',opts.csv,{'Content-Disposition':'attachment; filename=bluecards.csv'});
    if(u.pathname==='/FormReport.aspx'){
      const id=u.searchParams.get('Menu_Item_ID');
      if(id==='46012'){ if(opts.denyDirs) return send(302,'text/html','',{Location:'/Default.aspx'}); return send(200,'text/csv',opts.scoutDir||''); }
      if(id==='46013'){ if(opts.denyDirs) return send(302,'text/html','',{Location:'/Default.aspx'}); return send(200,'text/csv',opts.adultDir||''); }
    }
    if(u.pathname==='/blue-card-template.pdf') return send(200,'application/pdf',fs.readFileSync(opts.templatePath));
    send(404,'text/plain','nope');
  });
  return new Promise(r=>server.listen(0,'127.0.0.1',()=>r({server,port:server.address().port,state,close:()=>server.close()})));
};
