import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// 行尾统一为 LF 后再拼接：macOS、Linux、Windows 的换行习惯不同，但同一份源码
// 在三个平台上必须产出逐字节相同的 bundle（可复现构建）。BOM 也在入口处去掉。
const read = path => readFileSync(new URL(path,import.meta.url),'utf8').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
// 内联 <script src> 时转义脚本内容里的 </script，否则脚本中的字符串会提前结束
// <script> 元素，页面被截断（与 netlify/build.mjs 的处理保持一致）。
const inlineScript = code => '<script>'+code.replace(/<\/script/gi,'<\\/script')+'</script>';

// 只计算产物、不写盘：verify-bundle.mjs 与其它脚本可以 import 后直接比较。
export function bundle(){
  let html=read('./dist/index.html').replace(/<link rel="stylesheet" href="([\w.-]+\.css)">/g,(_,file)=>'<style>'+read('./dist/'+file)+'</style>');
  html=html.replace(/<script src="([\w.-]+)"><\/script>/g,(_,file)=>inlineScript(read('./dist/'+file)));
  // Server modules are concatenated into a single scope, so their relative imports
  // are dropped: auth is emitted first and every later module uses those bindings.
  const serverModule = name => read('./server/'+name+'.mjs').replace(/^import .*;$/gm,'');
  const code=['layout','profile','specimen','duel-rules'].map(name=>read('./dist/'+name+'.js')).join('\n')+'\n'+
    ['auth','quota','account','friends','gifts','duel','identify','model'].map(serverModule).join('\n')+'\n'+
  'const page='+JSON.stringify(html)+';\n'+
  "export default {fetch(request,env){const path=new URL(request.url).pathname;if(path.startsWith('/api/auth/'))return publicAuth(request,env,path.slice(10));if(path==='/api/duel')return duelApi(request,env);if(path==='/api/faction')return duelFaction(request,env);if(path==='/api/gifts')return giftsApi(request,env);if(path==='/api/friends')return friendsApi(request,env);if(path==='/api/account')return accountGarden(request,env);if(path==='/api/model')return modelPlant(request,env);if(path==='/api/identify')return identify(request,env);if(path==='/'||path==='/index.html')return new Response(page,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-cache','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY'}});return new Response('Not found',{status:404})}};";
  return {code,html};
}

// 仅当作为主模块（node build.mjs）运行时才写文件，被 import 时保持只读。
// 保持原有 CLI：无参数只写 dist/server/index.js；带参数时额外写单文件 HTML。
function isMainModule(){
  if(!process.argv[1])return false;
  try{return pathToFileURL(resolve(process.argv[1])).href===import.meta.url}catch{return false}
}

if(isMainModule()){
  const {code,html}=bundle();
  mkdirSync(new URL('./dist/server/',import.meta.url),{recursive:true});
  writeFileSync(new URL('./dist/server/index.js',import.meta.url),code);
  if(process.argv[2])writeFileSync(process.argv[2],html);
}
