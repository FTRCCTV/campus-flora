import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
const read = path => readFileSync(new URL(path,import.meta.url),'utf8').replace(/^\uFEFF/,'');
let html=read('./dist/index.html').replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+read('./dist/style.css')+'</style>');
html=html.replace(/<script src="([\w.-]+)"><\/script>/g,(_,file)=>'<script>'+read('./dist/'+file)+'</script>');
const code=read('./server/auth.mjs')+'\n'+read('./server/account.mjs').replace("import {currentUser,wechatEnabled} from './auth.mjs';",'')+'\n'+read('./server/identify.mjs')+'\n'+read('./server/model.mjs')+'\nconst page='+JSON.stringify(html)+';\n'+
"export default {fetch(request,env){const path=new URL(request.url).pathname;if(path.startsWith('/api/auth/'))return publicAuth(request,env,path.slice(10));if(path==='/api/account')return accountGarden(request,env);if(path==='/api/model')return modelPlant(request,env);if(path==='/api/identify')return identify(request,env);if(path==='/'||path==='/index.html')return new Response(page,{headers:{'content-type':'text/html; charset=utf-8'}});return new Response('Not found',{status:404})}};";
mkdirSync(new URL('./dist/server/',import.meta.url),{recursive:true});
writeFileSync(new URL('./dist/server/index.js',import.meta.url),code);
if(process.argv[2])writeFileSync(process.argv[2],html);
