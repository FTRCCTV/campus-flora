import {publicAuth,authJson} from '../../server/auth.mjs';
import {accountGarden} from '../../server/account.mjs';
import {friendsApi} from '../../server/friends.mjs';
import {giftsApi} from '../../server/gifts.mjs';
import {duelApi,duelFaction} from '../../server/duel.mjs';
import {identify} from '../../server/identify.mjs';
import {modelPlant} from '../../server/model.mjs';
import {storage} from '../storage.mjs';
import {readGarden,uploadGarden} from '../garden-transport.mjs';

export const config={path:'/api/*'};
export default async function flora(request,context){
  const {pathname}=new URL(request.url);
  const env=storage();
  // Paid endpoints need the key-value store too, not just the API keys.
  if(pathname==='/api/identify')return identify(request,{...env,PLANTNET_API_KEY:process.env.PLANTNET_API_KEY});
  if(pathname==='/api/model')return modelPlant(request,{...env,DEEPSEEK_API_KEY:process.env.DEEPSEEK_API_KEY});
  try{
    const headers=new Headers(request.headers);
    headers.set('cf-connecting-ip',context.ip||'unknown');
    const req=new Request(request,{headers});
    if(pathname.startsWith('/api/auth/'))return await publicAuth(req,env,pathname.slice(10));
    if(pathname==='/api/account/parts')return await uploadGarden(req,env);
    if(pathname==='/api/account')return req.method==='GET'?await readGarden(req,env):await accountGarden(req,env);
    if(pathname==='/api/friends')return await friendsApi(req,env);
    if(pathname==='/api/gifts')return await giftsApi(req,env);
    if(pathname==='/api/duel')return await duelApi(req,env);
    if(pathname==='/api/faction')return await duelFaction(req,env);
    return authJson({error:'接口不存在。'},404);
  }catch{
    return authJson({error:'服务暂不可用，请稍后重试。'},503);
  }
}
