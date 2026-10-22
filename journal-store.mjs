import {normalizeEntry, legacyEntries, imageIDs, entryKey} from './journal-model.mjs?v=1.8.0-r2';
import {uid} from './core.mjs?v=1.8.0-r2';

const PREFIX='shiri.journal.', DB='shiri-journal-v1';
const asPromise=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
const done=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error('本机数据库写入失败。'));tx.onabort=()=>reject(tx.error||Error('本机数据库事务已取消。'));});
export class JournalStore {
  constructor(){this.db=null;this.tab=uid();this.fallback=false;this.opening=null;}
  async open(){
    if(this.db)return this.db;if(this.fallback)return null;if(this.opening)return this.opening;
    this.opening=new Promise((resolve,reject)=>{
      if(!globalThis.indexedDB){reject(Error('浏览器不支持 IndexedDB。'));return;}
      let settled=false;
      const request=indexedDB.open(DB,1),timer=setTimeout(()=>{settled=true;reject(Error('本机数据库未能打开；请关闭其他拾日页面后重试。'));},5000);
      request.onupgradeneeded=()=>{const db=request.result;for(const name of ['entries','assets','previous'])if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:name==='assets'?'id':'date'});};
      request.onsuccess=()=>{clearTimeout(timer);if(settled){request.result.close();return;}settled=true;this.db=request.result;this.db.onversionchange=()=>{this.db.close();this.db=null;};resolve(this.db);};
      request.onerror=()=>{clearTimeout(timer);settled=true;reject(request.error);};
    }).catch(error=>{this.fallback=true;this.openError=error;return null;});
    return this.opening;
  }
  checkpoint(entry){
    const record={entry:normalizeEntry(entry),savedAt:Date.now(),tab:this.tab};
    localStorage.setItem(PREFIX+'draft.'+entry.date+'.'+this.tab,JSON.stringify(record));
  }
  drafts(){
    const result=[];
    for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(PREFIX+'draft.')){try{const raw=JSON.parse(localStorage.getItem(key));result.push({...raw,entry:normalizeEntry(raw.entry),key});}catch{/* A malformed draft is retained, never erased. */}}}return result;
  }
  async list(){
    const db=await this.open();let entries=[];
    if(db)entries=await asPromise(db.transaction('entries').objectStore('entries').getAll());
    else for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(PREFIX+'entry.'))entries.push(normalizeEntry(JSON.parse(localStorage.getItem(key))));}
    return entries.map(e=>normalizeEntry(e));
  }
  async getAsset(id){const db=await this.open();if(!db)return null;return asPromise(db.transaction('assets').objectStore('assets').get(id));}
  async putAssets(assets){
    const db=await this.open();if(!db)throw Error('此浏览器无法持久保存图片，请换用支持 IndexedDB 的浏览器。文字草稿仍保留。');
    const tx=db.transaction('assets','readwrite'),complete=done(tx);for(const asset of assets)tx.objectStore('assets').put(asset);await complete;
  }
  async save(entry, expectedRevision='', recoveryKeys=[]){
    const clean=normalizeEntry(entry),record={...clean,revision:uid(),updatedAt:Date.now()},db=await this.open();
    if(db){
      const tx=db.transaction(['entries','assets','previous'],'readwrite'),complete=done(tx);let conflict=false,missing=false;
      const store=tx.objectStore('entries'),get=store.get(clean.date);
      get.onsuccess=()=>{
        const previous=get.result;
        if((previous?.revision||'')!==expectedRevision){conflict=true;tx.abort();return;}
        // Validate asset references in this transaction before changing the saved entry.
        const ids=[...new Set(imageIDs(clean))];let pending=ids.length;
        const write=()=>{if(previous)tx.objectStore('previous').put(previous);store.put(record);};
        if(!pending)write();
        for(const id of ids){const req=tx.objectStore('assets').get(id);req.onsuccess=()=>{if(!req.result){missing=true;tx.abort();return;}if(!--pending)write();};}
      };
      try{await complete;}catch(error){if(conflict)throw Error('另一页面已保存这一天的手记。当前草稿保留，请先导出草稿，再重新打开合并。');if(missing)throw Error('图片暂时无法读取，草稿保留，未覆盖已保存手记。');throw error;}
    }else{
      if(imageIDs(clean).length)throw Error('无法保存图片引用，请先导出手记。');
      const key=PREFIX+'entry.'+clean.date,previous=localStorage.getItem(key);
      if((previous?JSON.parse(previous).revision:'')!==expectedRevision)throw Error('这一天的记录已被其他页面修改，草稿保留。');
      if(previous)localStorage.setItem(PREFIX+'previous.'+clean.date,previous);
      localStorage.setItem(key,JSON.stringify(record));
    }
    for(const key of [PREFIX+'draft.'+clean.date+'.'+this.tab,...recoveryKeys]){try{localStorage.removeItem(key);}catch{}}
    return record;
  }
  async migrateLegacy(state){
    const sources=[state?.diary,state?.diaries];
    // When IndexedDB becomes available later, copy fallback text entries without deleting them.
    for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(PREFIX+'entry.'))sources.push([normalizeEntry(JSON.parse(localStorage.getItem(key)))]);}
    for(const key of ['shiri.diary.v1','shiri.diary']){const raw=localStorage.getItem(key);if(raw)sources.push(JSON.parse(raw));}
    const existing=new Map((await this.list()).map(e=>[e.date,e]));
    // Legacy sources are read-only. Commit each record before considering it migrated.
    for(const source of sources.filter(Boolean))for(const entry of legacyEntries(source)){
      if(existing.has(entry.date))continue;
      if(imageIDs(entry).length)throw Error('旧图文手记需要连同图片备份导入；原记录保留。');
      const saved=await this.save(entry);existing.set(entry.date,saved);
    }
    return [...existing.values()];
  }
}
export const blobDataURL = blob => new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
