import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
// site.json 与 OG 标签的生成规则只在根目录 build.mjs 里维护，Netlify 产物复用同一份，
// 避免两个构建脚本在换域名时各改一处、慢慢走偏。
import {siteOrigin,socialMeta} from '../build.mjs';
const src=new URL('../dist/',import.meta.url),out=new URL('../netlify-public/',import.meta.url);
await mkdir(out,{recursive:true});
const css=(await Promise.all(['style.css','choice.css'].map(file=>readFile(new URL(file,src),'utf8')))).join('\n');
let html=await readFile(new URL('index.html',src),'utf8');
html=html.replaceAll('__SITE_ORIGIN__',siteOrigin);
html=socialMeta(html);
html=html.replace('<link rel="stylesheet" href="choice.css">','').replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+css+'</style>');
function inlineScript(code){return '<script>'+code.replace(/<\/script/gi,'<\\/script')+'</script>'}
for(const match of [...html.matchAll(/<script src="([\w.-]+)"><\/script>/g)]){
  let code=await readFile(new URL(match[1],src),'utf8');
  if(match[1]==='app.js')code=code.replace(/const hosted='[^']*'/,()=>"const hosted='"+siteOrigin+"/'");
  if(match[1]==='account.js')code=(await readFile(new URL('./account-transport.js',import.meta.url),'utf8'))+'\n'+code.replaceAll("fetch('/api/account',","netlifyAccountFetch('/api/account',");
  html=html.replace(match[0],()=>inlineScript(code));
}
await writeFile(new URL('index.html',out),html);
// 静态站没有 Worker，OG 图作为普通文件发布；路径与 meta 里的 <origin>/og.png 对应。
await copyFile(new URL('assets/og.png',src),new URL('og.png',out));
