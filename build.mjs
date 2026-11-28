import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// 行尾统一为 LF 后再拼接：macOS、Linux、Windows 的换行习惯不同，但同一份源码
// 在三个平台上必须产出逐字节相同的 bundle（可复现构建）。BOM 也在入口处去掉。
const read = path => readFileSync(new URL(path,import.meta.url),'utf8').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
// 内联 <script src> 时转义脚本内容里的 </script，否则脚本中的字符串会提前结束
// <script> 元素，页面被截断（与 netlify/build.mjs 的处理保持一致）。
const inlineScript = code => '<script>'+code.replace(/<\/script/gi,'<\\/script')+'</script>';

// site.json 是站点 origin 的唯一来源：页面里的 __SITE_ORIGIN__ 占位符、app.js 的
// hosted 常量、og:image 的绝对地址都由它派生，换域名时只改这一处。
const site = JSON.parse(read('./site.json'));
export const siteOrigin = String(site&&site.origin||'').trim().replace(/\/+$/,'');
if(!/^https?:\/\/[^/?#]+/.test(siteOrigin))throw Error('build: site.json 需要形如 {"origin":"https://example.com"} 的字段');
// OG 图只有 40KB 左右，直接以 base64 塞进 bundle，Worker 就能自己回 /og.png。
export const ogPng = readFileSync(new URL('./dist/assets/og.png',import.meta.url)).toString('base64');

// 先替换 __SITE_ORIGIN__，再判断要不要补默认 OG 标签：页面自己带了 og:image
// （哪怕来自占位符）就原样保留，因此不会和手写的 meta 重复。
export function socialMeta(html){
  if(/property=["']og:image["']/i.test(html))return html;
  const image=siteOrigin+'/og.png';
  const tags='<meta property="og:type" content="website">'
    +'<meta property="og:title" content="植迹 · 校园植物手记">'
    +'<meta property="og:description" content="拍下校园植物，种进你的三维花园">'
    +'<meta property="og:image" content="'+image+'">'
    +'<meta property="og:site_name" content="植迹">'
    +'<meta name="twitter:card" content="summary_large_image">'
    +'<meta name="twitter:image" content="'+image+'">';
  return html.includes('</head>')?html.replace('</head>',tags+'</head>'):tags+html;
}

// OG 路由放在所有 API 分支之前：只做一次字符串比较，不需要 env 或鉴权。
const ogRoute = "if(path==='/og.png')return new Response(Uint8Array.from(atob(OG),c=>c.charCodeAt(0)),{headers:{'content-type':'image/png','cache-control':'public, max-age=86400'}});";

// 只计算产物、不写盘：verify-bundle.mjs 与其它脚本可以 import 后直接比较。
export function bundle(){
  let html=read('./dist/index.html').replaceAll('__SITE_ORIGIN__',siteOrigin);
  html=socialMeta(html);
  html=html.replace(/<link rel="stylesheet" href="([\w.-]+\.css)">/g,(_,file)=>'<style>'+read('./dist/'+file)+'</style>');
  html=html.replace(/<script src="([\w.-]+)"><\/script>/g,(_,file)=>{
    let code=read('./dist/'+file);
    // 只在 app.js 上改写站点地址：它决定离线提示里“打开在线版”的链接。
    if(file==='app.js')code=code.replace(/const hosted='[^']*'/,()=>"const hosted='"+siteOrigin+"/'");
    return inlineScript(code);
  });
  // Server modules are concatenated into a single scope, so their relative imports
  // are dropped: auth is emitted first and every later module uses those bindings.
  const serverModule = name => read('./server/'+name+'.mjs').replace(/^import .*;$/gm,'');
  const code=['layout','profile','specimen','duel-rules'].map(name=>read('./dist/'+name+'.js')).join('\n')+'\n'+
    ['auth','quota','account','friends','gifts','duel','identify','model'].map(serverModule).join('\n')+'\n'+
  'const page='+JSON.stringify(html)+';\n'+
  "const OG='"+ogPng+"';\n"+
  "export default {fetch(request,env){const path=new URL(request.url).pathname;"+ogRoute+"if(path.startsWith('/api/auth/'))return publicAuth(request,env,path.slice(10));if(path==='/api/duel')return duelApi(request,env);if(path==='/api/faction')return duelFaction(request,env);if(path==='/api/gifts')return giftsApi(request,env);if(path==='/api/friends')return friendsApi(request,env);if(path==='/api/account')return accountGarden(request,env);if(path==='/api/model')return modelPlant(request,env);if(path==='/api/identify')return identify(request,env);if(path==='/'||path==='/index.html')return new Response(page,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-cache','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY'}});return new Response('Not found',{status:404})}};";
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
  // 单文件 HTML 与 Worker 返回的页面走同一份 html，origin 替换自然生效。
  if(process.argv[2])writeFileSync(process.argv[2],html);
}
