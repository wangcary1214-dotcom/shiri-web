import {validDate, uid} from './core.mjs?v=1.8.0-r2';

export const LIMITS = {text:100000, images:30, edge:1600, bytes:25*1024*1024, pixels:50000000};
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const emptyEntry = date => ({date,title:'',mood:'',blocks:[{parts:[]}],updatedAt:0,revision:''});
export const textBlocks = text => String(text ?? '').replace(/\r\n?/g,'\n').split('\n').map(text=>({parts:text?[{text}]:[]}));
export const plainText = entry => entry.blocks.map(b=>b.parts.filter(p=>!p.image).map(p=>p.text).join('')).join('\n').replace(/\n+$/,'');
export const imageIDs = entry => entry.blocks.flatMap(b=>b.parts.filter(p=>p.image).map(p=>p.image));
export const entryKey = entry => JSON.stringify([entry.title,entry.mood,entry.blocks]);
export const isEmpty = entry => !entry.title && !entry.mood && !plainText(entry).trim() && !imageIDs(entry).length;
export function normalizeEntry(raw, date = raw?.date || raw?.Date) {
  if(!validDate(date))throw Error('日记日期无效。');
  const title=raw.title ?? raw.Title ?? '', mood=raw.mood ?? raw.Mood ?? '';
  if(typeof title!=='string'||title.length>80||typeof mood!=='string'||mood.length>20)throw Error('日记标题或心情超出上限。');
  let blocks=raw.blocks ?? raw.Blocks;
  if(blocks==null)blocks=textBlocks(raw.text ?? raw.Text ?? '');
  if(!Array.isArray(blocks)||blocks.length>20000)throw Error('日记段落过多。');
  let parts=0;
  blocks=blocks.map(block=>{
    const list=block.parts ?? block.Parts;
    if(!Array.isArray(list))throw Error('日记段落无效。');
    return {parts:list.map(p=>{
      if(++parts>30000||!p||typeof p!=='object')throw Error('日记内容过多或格式无效。');
      const image=p.image ?? p.Image;
      if(image!=null){if(typeof image!=='string'||!/^[a-zA-Z0-9._-]{1,100}$/.test(image))throw Error('日记图片引用无效。');return {image};}
      const text=p.text ?? p.Text ?? '';
      if(typeof text!=='string')throw Error('日记正文无效。');
      return {text,...(p.bold||p.Bold?{bold:true}:{}),...(p.italic||p.Italic?{italic:true}:{})};
    })};
  });
  const result={date,title,mood,blocks:blocks.length?blocks:[{parts:[]}],updatedAt:Number(raw.updatedAt)||0,revision:typeof raw.revision==='string'?raw.revision:''};
  if(plainText(result).length>LIMITS.text||imageIDs(result).length>LIMITS.images)throw Error('单篇最多 10 万字、30 张图片。');
  return result;
}
export function legacyEntries(raw) {
  const source=Array.isArray(raw)?raw:raw?.Entries ?? raw?.entries ?? raw;
  const entries=Array.isArray(source)?source:source&&typeof source==='object'?Object.entries(source).map(([date,value])=>typeof value==='string'?{date,text:value}:{...value,date:value.date||date}):[];
  if(entries.length>36600)throw Error('日记数量过多。');
  const dates=new Set();
  return entries.map(raw=>{const e=normalizeEntry(raw);if(dates.has(e.date))throw Error('日记日期重复。');dates.add(e.date);return e;});
}
export function standaloneHTML(entry, sources) {
  const body=entry.blocks.map(b=>'<p>'+b.parts.map(p=>{
    if(p.image){const src=sources.get(p.image);if(!src||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(src))throw Error('图片暂时无法读取，未导出。请保留本机数据并重试。');return `<img alt="日记图片" src="${src}">`;}
    let text=escapeHTML(p.text);if(p.bold)text=`<strong>${text}</strong>`;if(p.italic)text=`<em>${text}</em>`;return text;
  }).join('')+'</p>').join('');
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>${escapeHTML(entry.title||entry.date)}</title><style>body{max-width:760px;margin:48px auto;padding:0 24px;background:#f8f9f6;color:#30493d;font:17px/1.9 sans-serif}header{color:#81917e;font-size:14px}h1{font-size:30px;overflow-wrap:anywhere}p{white-space:pre-wrap;overflow-wrap:anywhere}img{display:block;max-width:100%;height:auto;border-radius:10px;margin:20px 0}</style><header>${entry.date} · ${escapeHTML(entry.mood)}</header><h1>${escapeHTML(entry.title||'每日手记')}</h1>${body}</html>`;
}
export class EntryHistory {
  constructor(entry){this.current=structuredClone(entry);this.undo=[];this.redo=[];this.lastEdit=0;}
  change(entry, atomic=false){
    if(entryKey(entry)===entryKey(this.current))return false;
    const now=Date.now(),sameImages=JSON.stringify(imageIDs(entry))===JSON.stringify(imageIDs(this.current));
    if(atomic||!sameImages||now-this.lastEdit>650||!this.undo.length)this.undo.push(structuredClone(this.current));
    this.undo=this.undo.slice(-80);this.redo=[];this.current=structuredClone(entry);this.lastEdit=atomic?0:now;return true;
  }
  step(redo=false){const from=redo?this.redo:this.undo,to=redo?this.undo:this.redo;if(!from.length)return null;to.push(structuredClone(this.current));this.current=from.pop();this.lastEdit=0;return structuredClone(this.current);}
}
export const newAssetID = () => 'img-'+uid();
