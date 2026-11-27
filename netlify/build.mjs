import {mkdir,readFile,writeFile} from 'node:fs/promises';
const src=new URL('../dist/',import.meta.url),out=new URL('../netlify-public/',import.meta.url);
await mkdir(out,{recursive:true});
const css=(await Promise.all(['style.css','choice.css'].map(file=>readFile(new URL(file,src),'utf8')))).join('\n');
let html=await readFile(new URL('index.html',src),'utf8');
html=html.replace('<link rel="stylesheet" href="choice.css">','').replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+css+'</style>');
function inlineScript(code){return '<script>'+code.replace(/<\/script/gi,'<\\/script')+'</script>'}
for(const match of [...html.matchAll(/<script src="([\w.-]+)"><\/script>/g)]){
  let code=await readFile(new URL(match[1],src),'utf8');
  if(match[1]==='account.js')code=(await readFile(new URL('./account-transport.js',import.meta.url),'utf8'))+'\n'+code.replaceAll("fetch('/api/account',","netlifyAccountFetch('/api/account',");
  html=html.replace(match[0],()=>inlineScript(code));
}
await writeFile(new URL('index.html',out),html);
