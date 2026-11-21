import {randomUUID} from 'node:crypto';
import {getDatabase,getConnectionString} from '@netlify/database';

let pool,activeConnection;

export function storage(){
  const connection=getConnectionString();
  if(connection!==activeConnection||!pool){
    const previous=pool;
    pool=getDatabase().pool;activeConnection=connection;
    if(previous)void previous.end().catch(()=>{});
  }
  const current=pool,query=(sql,params)=>current.query(sql,params);
  const bucket={
    async get(key){
      const {rows:[row]}=await query('SELECT value,version FROM flora_documents WHERE key=$1',[key]);
      return row?{httpEtag:row.version,json:async()=>JSON.parse(row.value)}:null;
    },
    async put(key,value,options){
      const version='"'+randomUUID().replaceAll('-','')+'"',condition=options?.onlyIf;
      let sql='INSERT INTO flora_documents(key,value,version) VALUES($1,$2,$3)',args=[key,value,version];
      if(condition?.has('If-Match')){
        sql='UPDATE flora_documents SET value=$2,version=$3 WHERE key=$1 AND version=$4';args.push(condition.get('If-Match'));
      }else if(condition?.has('If-None-Match'))sql+=' ON CONFLICT DO NOTHING';
      else sql+=' ON CONFLICT(key) DO UPDATE SET value=excluded.value,version=excluded.version';
      const {rowCount}=await query(sql,args);
      return rowCount?{httpEtag:version}:null;
    },
    async delete(key){await query('DELETE FROM flora_documents WHERE key=$1',[key])}
  };
  const db={prepare(sql){
    let index=0;const statement=sql.replace(/\?/g,()=>'$'+(++index));
    return {bind(...args){return {
      first:async()=>(await query(statement,args)).rows[0],
      all:async()=>({results:(await query(statement,args)).rows}),
      run:async()=>({meta:{changes:(await query(statement,args)).rowCount}})
    }}};
  }};
  return {BUCKET:bucket,DB:db,query};
}
