import {bjDate,addDays,validDate,clone} from './core.mjs?v=1.8.0-r2';
import {LIMITS,emptyEntry,normalizeEntry,legacyEntries,textBlocks,plainText,imageIDs,entryKey,isEmpty,escapeHTML as esc,EntryHistory,newAssetID,standaloneHTML} from './journal-model.mjs?v=1.8.0-r2';
import {JournalStore,blobDataURL} from './journal-store.mjs?v=1.8.0-r2';

const moods=['','晴朗','平静','充实','有点累','有心事'];
const download=(content,name,type)=>{const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);};
export function captureEditor(root){
  const rows=[{parts:[]}];let current=()=>rows.at(-1);
  const add=p=>{const last=current().parts.at(-1);if(!p.image&&last&&!last.image&&!!p.bold===!!last.bold&&!!p.italic===!!last.italic)last.text+=p.text;else current().parts.push(p);};
  const visit=(node,style={})=>{
    if(node.nodeType===3){if(node.textContent)add({text:node.textContent,...style});return;}
    if(node.nodeType!==1)return;
    if(node.matches('[data-image-id]')){add({image:node.dataset.imageId});return;}
    if(node.matches('script,style,button,iframe,object'))return;
    if(node.tagName==='BR'){add({text:'\n',...style});return;}
    const block=/^(P|DIV|LI|H[1-6]|BLOCKQUOTE)$/.test(node.tagName);
    if(block&&current().parts.length)rows.push({parts:[]});
    const next={...style};if(node.matches('b,strong')||Number(node.style.fontWeight)>=600||node.style.fontWeight==='bold')next.bold=true;if(node.matches('i,em')||node.style.fontStyle==='italic')next.italic=true;
    for(const child of node.childNodes)visit(child,next);
    if(block)rows.push({parts:[]});
  };
  for(const child of root.childNodes)visit(child);
  if(rows.length>1&&!rows.at(-1).parts.length)rows.pop();
  return rows;
}

export class Journal {
  constructor(host,{legacyState,notify,onDate,onCount}){
    this.legacyState=legacyState;
    this.host=host;this.notify=notify;this.onDate=onDate;this.onCount=onCount;
    this.store=new JournalStore();this.entries=new Map();this.sessions=new Map();this.urls=new Map();this.loading=false;this.inserting=false;this.saving=null;this.timer=null;this.selection=null;this.active=null;this.initError='';
    host.innerHTML=`<article class="journal-card" aria-label="每日手记"><div class="journal-dates"><button type="button" data-journal-action="previous" aria-label="前一天">‹</button><input type="date" id="journal-date" aria-label="手记日期" min="0001-01-01" max="9999-12-31"><button type="button" data-journal-action="next" aria-label="后一天">›</button><span id="journal-weekday"></span><button type="button" class="journal-history-button" data-journal-action="history" aria-expanded="false">回看 <span id="journal-total">0 篇</span></button></div><section id="journal-history" class="journal-history" aria-label="最近 30 篇手记" hidden></section><div class="journal-title-row"><input id="journal-title" aria-label="日记标题" maxlength="80" placeholder="给今天起个名字…" autocomplete="off"><select id="journal-mood" aria-label="此刻心情">${moods.map(v=>`<option value="${v}">${v||'此刻心情'}</option>`).join('')}</select></div><div class="journal-toolbar" role="toolbar" aria-label="手记编辑工具"><button class="journal-insert" type="button" data-journal-action="images">＋ 图片</button><button type="button" data-journal-action="bold" aria-label="加粗" title="加粗 · Ctrl / ⌘ B"><b>B</b></button><button type="button" data-journal-action="italic" aria-label="斜体" title="斜体 · Ctrl / ⌘ I"><i>I</i></button><button type="button" data-journal-action="undo" aria-label="撤销" title="撤销 · Ctrl / ⌘ Z">↶</button><button type="button" data-journal-action="redo" aria-label="重做" title="重做 · Ctrl / ⌘ Shift Z">↷</button><span class="journal-toolbar-note">文字与照片，都留在这一天</span></div><div class="journal-writing"><div id="journal-editor" class="journal-editor" contenteditable="true" role="textbox" aria-multiline="true" aria-label="日记正文" spellcheck="false" data-placeholder="今天，有什么想记下来的？&#10;&#10;写几句话，或放一张喜欢的照片。"></div></div><footer class="journal-footer"><div><p id="journal-status" role="status" aria-live="polite">正在打开手记…</p><small id="journal-count">0 字</small></div><div class="journal-footer-actions"><button type="button" data-journal-action="export-menu" aria-expanded="false">导出</button><button type="button" data-journal-action="save" class="journal-save">保存</button></div></footer><div id="journal-export-menu" class="journal-export-menu" hidden><button type="button" data-journal-action="export-html">图文 HTML（包含图片）</button><button type="button" data-journal-action="export-text">纯文本 TXT</button><button type="button" data-journal-action="import-legacy">导入旧版 diary.json</button></div><p id="journal-error" class="journal-error" role="alert" hidden></p><input type="file" id="journal-images" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,.png,.jpg,.jpeg,.webp,.gif,.bmp" multiple hidden><input type="file" id="journal-import" accept=".json,application/json" hidden></article><p class="journal-help">自动保存 · Ctrl / ⌘ S 保存 · 支持粘贴截图、拖入图片<br><span>每篇最多 30 张图片、10 万字；图片最长边缩至 1600 像素。PNG / JPEG / WebP / GIF / BMP 按浏览器解码，GIF 仅保留静态首帧；不支持 TIFF / HEIC，请先转为 PNG 或 JPEG。</span></p>`;
    this.$=s=>host.querySelector(s);this.editor=this.$('#journal-editor');
    this.viewer=document.createElement('dialog');this.viewer.id='journal-image-viewer';this.viewer.className='journal-image-viewer';this.viewer.innerHTML='<header><h2>日记图片</h2><button type="button" aria-label="关闭图片">×</button></header><img alt="放大的日记图片">';document.body.append(this.viewer);this.viewer.querySelector('button').onclick=()=>this.viewer.close();
    const retry=document.createElement('button');retry.type='button';retry.id='journal-retry';retry.className='text-button';retry.dataset.journalAction='retry';retry.textContent='重试读取日记';retry.hidden=true;this.$('.journal-card').append(retry);
    this.bind();
    this.ready=this.initialize(legacyState);
  }
  async initialize(state){
    try{for(const e of await this.store.migrateLegacy(state))this.entries.set(e.date,e);}catch(error){this.initError='旧日记读取或迁移未完成，原记录未修改：'+error.message;try{for(const e of await this.store.list())this.entries.set(e.date,e);}catch(e){this.initError+=' '+e.message;}}
    try{this.recoveries=this.store.drafts();}catch{this.recoveries=[];}
    this.updateHistory();
    this.$('#journal-retry').hidden=!this.initError;
  }
  bind(){
    this.host.addEventListener('click',async event=>{
      const recent=event.target.closest('[data-journal-date]');if(recent){await this.go(recent.dataset.journalDate);return;}
      const remove=event.target.closest('[data-remove-image]');if(remove){event.preventDefault();if(this.inserting)return;remove.closest('[data-image-id]').remove();this.changed(true);this.editor.focus();return;}
      const zoom=event.target.closest('[data-zoom-image]');if(zoom){const img=zoom.closest('[data-image-id]').querySelector('img');if(img.src){this.viewer.querySelector('img').src=img.src;this.viewer.showModal();}return;}
      const button=event.target.closest('[data-journal-action]');if(!button)return;
      event.preventDefault();const action=button.dataset.journalAction;
      try{
        if(action==='images'){this.rememberSelection();this.$('#journal-images').click();}
        if(action==='bold'||action==='italic'){this.restoreSelection();this.editor.focus();document.execCommand(action,false);this.changed(true);}
        if(action==='undo'||action==='redo')this.undo(action==='redo');
        if(action==='save')await this.save(true);
        if(action==='previous'||action==='next')await this.go(addDays(this.active.date,action==='previous'?-1:1));
        if(action==='history'){const panel=this.$('#journal-history');panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));}
        if(action==='export-menu'){const menu=this.$('#journal-export-menu');menu.hidden=!menu.hidden;button.setAttribute('aria-expanded',String(!menu.hidden));}
        if(action==='export-html'||action==='export-text')await this.export(action==='export-html');
        if(action==='import-legacy')this.$('#journal-import').click();
        if(action==='retry')await this.retryReading();
      }catch(error){this.error(error.message);}
    });
    this.host.addEventListener('pointerdown',e=>{if(e.target.closest('.journal-toolbar button')){this.rememberSelection();if(e.pointerType==='mouse')e.preventDefault();}});
    this.editor.addEventListener('input',()=>this.changed(false));
    this.editor.addEventListener('compositionend',()=>this.changed(false));
    this.$('#journal-title').addEventListener('input',()=>this.changed(false));
    this.$('#journal-title').addEventListener('compositionend',()=>this.changed(false));
    this.$('#journal-mood').onchange=()=>this.changed(true);
    this.$('#journal-date').onchange=e=>{const date=e.target.value;e.target.value=this.active?.date||bjDate();this.go(date).catch(error=>this.error(error.message));};
    this.$('#journal-images').onchange=async e=>{const files=[...e.target.files];e.target.value='';await this.insertImages(files);};
    this.$('#journal-import').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(file)try{if(file.size>32*1024*1024)throw Error('旧日记文件超过 32 MB。');await this.importLegacy(JSON.parse((await file.text()).replace(/^\uFEFF/,'')));}catch(error){this.error(error.message);}};
    this.editor.addEventListener('paste',async e=>{
      e.preventDefault();const files=[...e.clipboardData.files];
      if(files.length){await this.insertImages(files);return;}
      const markup=e.clipboardData.getData('text/html'),text=e.clipboardData.getData('text/plain');
      const detached=document.createElement('template');if(markup){detached.innerHTML=markup;for(const node of detached.content.querySelectorAll('[data-image-id]'))node.removeAttribute('data-image-id');}
      const blocks=markup?captureEditor(detached.content):textBlocks(text);
      try{const clean=normalizeEntry({...this.active.history.current,blocks});if(plainText(this.active.history.current).length+plainText(clean).length>LIMITS.text)throw Error('粘贴内容过长，单篇最多 10 万字。');const fragment=this.fragment(clean.blocks);this.insertFragment(fragment);this.changed(true);}catch(error){this.error(error.message);}
    });
    this.editor.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';this.editor.classList.add('dragging');});
    this.editor.addEventListener('dragleave',()=>this.editor.classList.remove('dragging'));
    this.editor.addEventListener('drop',async e=>{e.preventDefault();this.editor.classList.remove('dragging');const files=[...e.dataTransfer.files];let range=document.caretRangeFromPoint?.(e.clientX,e.clientY);if(!range&&document.caretPositionFromPoint){const p=document.caretPositionFromPoint(e.clientX,e.clientY);if(p){range=document.createRange();range.setStart(p.offsetNode,p.offset);range.collapse(true);}}if(range&&this.editor.contains(range.startContainer)){const sel=getSelection();sel.removeAllRanges();sel.addRange(range);}if(files.length)await this.insertImages(files);else this.error('请拖入本机图片文件。');});
    this.editor.addEventListener('beforeinput',e=>{if(e.inputType==='historyUndo'||e.inputType==='historyRedo'){e.preventDefault();this.undo(e.inputType==='historyRedo');}});
    this.editor.addEventListener('dblclick',e=>{const image=e.target.closest('[data-image-id]');if(image)image.querySelector('[data-zoom-image]').click();});
    this.imageMenu=document.createElement('div');this.imageMenu.className='countdown-context';this.imageMenu.id='journal-image-context';this.imageMenu.hidden=true;this.imageMenu.innerHTML='<button type="button" data-image-menu="zoom">放大图片</button><button type="button" data-image-menu="remove">移除此图片</button>';document.body.append(this.imageMenu);
    this.editor.addEventListener('contextmenu',e=>{const token=e.target.closest('[data-image-id]');if(!token)return;e.preventDefault();this.menuImage=token;this.imageMenu.hidden=false;this.imageMenu.style.left=Math.min(e.clientX,innerWidth-155)+'px';this.imageMenu.style.top=Math.min(e.clientY,innerHeight-90)+'px';this.imageMenu.querySelector('button').focus();});
    document.addEventListener('click',e=>{const button=e.target.closest('[data-image-menu]');if(button&&this.menuImage?.isConnected){this.menuImage.querySelector(button.dataset.imageMenu==='zoom'?'[data-zoom-image]':'[data-remove-image]').click();}this.imageMenu.hidden=true;});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')this.imageMenu.hidden=true;});document.addEventListener('scroll',()=>this.imageMenu.hidden=true,true);
    this.host.addEventListener('keydown',e=>{
      if(e.isComposing)return;
      if((e.ctrlKey||e.metaKey)&&['s','z','y'].includes(e.key.toLowerCase())){e.preventDefault();e.stopPropagation();const key=e.key.toLowerCase();if(key==='s')this.save(true);else this.undo(key==='y'||e.shiftKey);}
    });
    document.addEventListener('selectionchange',()=>this.rememberSelection());
    window.addEventListener('beforeunload',e=>{this.changed(true);this.checkpoint();if(this.hasUnsaved()){e.preventDefault();e.returnValue='';}});
    window.addEventListener('pagehide',()=>{this.checkpoint();this.save();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.checkpoint();this.save();}});
  }
  async show(date){await this.ready;if(this.active?.date!==date)await this.open(date);else this.updateStatus();}
  async retryReading(){if(!await this.leave())return;const date=this.active?.date;this.initError='';this.store.db?.close();this.store.db=null;this.store.fallback=false;this.store.opening=null;await this.initialize(this.legacyState);if(this.initError){this.error(this.initError);return;}this.sessions.clear();this.active=null;if(date)await this.open(date);this.$('#journal-retry').hidden=true;this.notify('日记已重新读取，原来源保留。');}
  async go(date){if(!validDate(date)||date===this.active?.date)return;const ok=await this.open(date);if(ok){this.$('#journal-history').hidden=true;this.$('[data-journal-action="history"]').setAttribute('aria-expanded','false');this.onDate(date);}}
  async open(date){
    if(!validDate(date)||this.loading)return false;
    if(this.active?.date===date)return true;
    if(this.active&&!await this.leave())return false;
    this.loading=true;
    try{
      let session=this.sessions.get(date);
      if(!session){
        const entry=this.entries.get(date)||emptyEntry(date);let draft=entry,keys=[];
        const recoveries=(this.recoveries||[]).filter(r=>r.entry.date===date&&r.savedAt>=entry.updatedAt&&entryKey(r.entry)!==entryKey(entry)).sort((a,b)=>b.savedAt-a.savedAt);
        if(recoveries.length){draft=recoveries[0].entry;keys=[recoveries[0].key];}
        session={date,history:new EntryHistory(draft),savedKey:entryKey(entry),revision:entry.revision||'',dirty:entryKey(draft)!==entryKey(entry),version:0,recoveryKeys:keys};this.sessions.set(date,session);
      }
      this.active=session;this.selection=null;this.paint();await this.hydrate();
      this.$('#journal-error').hidden=true;
      if(this.initError)this.error(this.initError);
      else if(session.dirty){this.status('已恢复未保存草稿 · 请检查后保存',true);}
      else this.updateStatus();
      return true;
    }finally{this.loading=false;}
  }
  snapshot(){return normalizeEntry({...this.active.history.current,title:this.$('#journal-title').value,mood:this.$('#journal-mood').value,blocks:captureEditor(this.editor)});}
  changed(atomic){
    if(!this.active||this.loading)return;
    try{
      const next=this.snapshot();if(!this.active.history.change(next,atomic))return;
      this.active.version++;this.active.dirty=entryKey(next)!==this.active.savedKey;
      this.checkpoint();this.$('#journal-error').hidden=true;this.status('编辑中 · 稍后自动保存');this.updateCounts();
      clearTimeout(this.timer);const session=this.active;this.timer=setTimeout(()=>{if(this.active===session)this.save();},900);
    }catch(error){this.paint();this.hydrate();this.error(error.message);}
  }
  undo(redo=false){if(!this.active||this.inserting)return;const next=this.active.history.step(redo);if(!next)return;this.active.version++;this.active.dirty=entryKey(next)!==this.active.savedKey;this.paint();this.hydrate();this.checkpoint();this.status('编辑中 · 稍后自动保存');clearTimeout(this.timer);this.timer=setTimeout(()=>this.save(),900);this.editor.focus();}
  fragment(blocks){const root=document.createElement('div');root.innerHTML=blocks.map(b=>'<p>'+b.parts.map(p=>{if(p.image)return this.imageMarkup(p.image);let text=esc(p.text).replace(/\n/g,'<br>');if(p.bold)text='<strong>'+text+'</strong>';if(p.italic)text='<em>'+text+'</em>';return text;}).join('')+'</p>').join('');const fragment=document.createDocumentFragment();fragment.append(...root.childNodes);return fragment;}
  imageMarkup(id){return `<span class="journal-image" contenteditable="false" data-image-id="${esc(id)}"><img alt="日记图片" draggable="false"><span class="journal-image-tools"><button type="button" data-zoom-image="${esc(id)}" aria-label="放大日记图片">放大</button><button type="button" data-remove-image="${esc(id)}" aria-label="移除日记图片">移除</button></span><span class="journal-image-missing">正在读取本机图片…</span></span>`;}
  paint(){const e=this.active.history.current;this.$('#journal-date').value=e.date;this.$('#journal-weekday').textContent='星期'+'日一二三四五六'[new Date(e.date+'T00:00:00Z').getUTCDay()];this.$('#journal-title').value=e.title;this.$('#journal-mood').value=moods.includes(e.mood)?e.mood:'';if(e.mood&&!moods.includes(e.mood)){const option=new Option(e.mood,e.mood);this.$('#journal-mood').add(option);this.$('#journal-mood').value=e.mood;}this.editor.replaceChildren(this.fragment(e.blocks));this.updateCounts();}
  async hydrate(){
    const date=this.active?.date;
    for(const node of this.editor.querySelectorAll('[data-image-id]')){
      const id=node.dataset.imageId;try{let url=this.urls.get(id);if(!url){const asset=await this.store.getAsset(id);if(!asset?.blob)throw Error('图片暂时无法读取，请保留本机数据。');url=URL.createObjectURL(asset.blob);this.urls.set(id,url);}if(this.active?.date!==date)return;node.querySelector('img').src=url;node.querySelector('.journal-image-missing').hidden=true;}catch(error){node.querySelector('.journal-image-missing').textContent=error.message;}
    }
  }
  rememberSelection(){const selection=getSelection();if(selection?.rangeCount&&this.editor.contains(selection.anchorNode)&&this.editor.contains(selection.focusNode))this.selection=selection.getRangeAt(0).cloneRange();}
  restoreSelection(){const sel=getSelection();if(this.selection&&this.editor.contains(this.selection.startContainer)){sel.removeAllRanges();sel.addRange(this.selection);}else{const r=document.createRange();r.selectNodeContents(this.editor);r.collapse(false);sel.removeAllRanges();sel.addRange(r);}const range=sel.getRangeAt(0),node=range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement,token=node?.closest('[data-image-id]');if(token){range.setStartAfter(token);range.collapse(true);sel.removeAllRanges();sel.addRange(range);}}
  insertFragment(fragment){this.restoreSelection();const sel=getSelection(),range=sel.getRangeAt(0);range.deleteContents();const last=fragment.lastChild;range.insertNode(fragment);if(last){range.setStartAfter(last);range.collapse(true);sel.removeAllRanges();sel.addRange(range);}this.editor.focus();this.rememberSelection();}
  async prepareImage(file){
    if(file.size>LIMITS.bytes)throw Error(`${file.name||'图片'}：单张原文件不能超过 25 MB。`);
    if(!/^(image\/(png|jpeg|webp|gif|bmp|x-ms-bmp))$/.test(file.type)&&!(file.type===''&&/\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)))throw Error(`${file.name||'此文件'}：不支持此格式，请转换为 PNG 或 JPEG。`);
    const source=URL.createObjectURL(file),img=new Image();
    try{
      img.src=source;await img.decode();const width=img.naturalWidth,height=img.naturalHeight;
      if(!width||!height||width*height>LIMITS.pixels)throw Error('图片尺寸无效或超过 5000 万像素。');
      const scale=Math.min(1,LIMITS.edge/Math.max(width,height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('浏览器无法转换这张图片。')),'image/png'));
      if(blob.size>20*1024*1024)throw Error('转换后的图片超过 20 MB，请先压缩。');
      return {id:newAssetID(),blob,width:canvas.width,height:canvas.height,name:file.name||'粘贴截图',createdAt:Date.now()};
    }catch(error){throw Error(`${file.name||'图片'}：${error.name==='EncodingError'?'浏览器无法读取这张图片，请转换为 PNG 或 JPEG。':error.message||'浏览器无法读取，请转换为 PNG 或 JPEG。'}`);}finally{img.src='';URL.revokeObjectURL(source);}
  }
  async insertImages(files){
    if(!files.length||!this.active||this.inserting)return;
    this.rememberSelection();const session=this.active;this.inserting=true;this.status('正在处理图片 · 请稍候');
    try{
      if(imageIDs(session.history.current).length+files.length>LIMITS.images)throw Error('单篇最多 30 张图片，请减少本次选择。');
      const assets=[];for(const file of files)assets.push(await this.prepareImage(file));
      await this.store.putAssets(assets);
      for(const asset of assets)this.urls.set(asset.id,URL.createObjectURL(asset.blob));
      if(this.active!==session)throw Error('日期已变化，图片未插入。');
      const fragment=document.createDocumentFragment();for(const a of assets){const holder=document.createElement('span');holder.innerHTML=this.imageMarkup(a.id);fragment.append(holder.firstChild,document.createElement('br'));}
      this.insertFragment(fragment);this.changed(true);await this.hydrate();
    }catch(error){this.error('图片未插入：'+error.message);}finally{this.inserting=false;this.updateCounts();}
  }
  checkpoint(){if(!this.active?.dirty)return true;try{this.store.checkpoint(this.active.history.current);return true;}catch{return false;}}
  hasUnsaved(){return this.inserting||[...this.sessions.values()].some(s=>s.dirty);}
  async save(manual=false){
    clearTimeout(this.timer);if(this.loading&&!this.active)return false;
    if(this.inserting){this.error('图片正在处理，请完成后再保存或切换。');return false;}
    if(this.saving){await this.saving;if(this.active?.dirty)return this.save(manual);return !this.lastSaveError;}
    const session=this.active;if(!session)return true;
    if(!session.dirty){if(manual)this.status('已保存到本机');return true;}
    const snapshot=clone(session.history.current),version=session.version;this.checkpoint();this.status('正在保存…');
    this.saving=(async()=>{
      try{
        const record=await this.store.save(snapshot,session.revision,session.recoveryKeys);session.revision=record.revision;session.savedKey=entryKey(snapshot);session.recoveryKeys=[];this.entries.set(session.date,record);session.dirty=version!==session.version;
        if(session.dirty)this.checkpoint();this.lastSaveError=false;this.updateHistory();this.$('#journal-error').hidden=true;
        if(this.active===session)this.status(session.dirty?'编辑中 · 仍有内容待保存':this.store.fallback?'文字已保存到本机 · 此浏览器不支持图片存储':'已保存到本机');return true;
      }catch(error){session.dirty=true;this.lastSaveError=true;this.checkpoint();this.error('保存失败，草稿保留：'+error.message+' 请重试保存或导出手记。');return false;}
    })();
    const result=await this.saving;this.saving=null;if(result&&session.dirty)return this.save(manual);return result;
  }
  async leave(){if(this.inserting){this.error('图片正在处理，请稍候再切换。');return false;}return this.save();}
  status(message,error=false){this.$('#journal-status').textContent=message;this.$('#journal-status').classList.toggle('unsaved',error);}
  error(message){this.$('#journal-error').textContent=message;this.$('#journal-error').hidden=false;this.status(this.active?.dirty?'草稿待保存 · 请处理下方提示':'请查看下方提示',true);this.notify(message);}
  updateStatus(){if(this.active?.dirty)this.status('草稿待保存',true);else this.status(this.store.fallback?'文字已保存到本机 · 图片存储不可用':'已保存到本机');}
  updateCounts(){if(!this.active)return;const entry=this.active.history.current;this.$('#journal-count').textContent=`${plainText(entry).replace(/\s/g,'').length} 字 · ${imageIDs(entry).length} / 30 张图片`;this.editor.dataset.empty=String(!plainText(entry)&&!imageIDs(entry).length);this.$('[data-journal-action="undo"]').disabled=!this.active.history.undo.length||this.inserting;this.$('[data-journal-action="redo"]').disabled=!this.active.history.redo.length||this.inserting;}
  updateHistory(){
    const entries=new Map(this.entries);for(const s of this.sessions.values())entries.set(s.date,s.history.current);
    const list=[...entries.values()].filter(e=>!isEmpty(e)).sort((a,b)=>b.date.localeCompare(a.date));
    this.$('#journal-total').textContent=list.length+' 篇';this.onCount(list.length);
    this.$('#journal-history').innerHTML=list.length?list.slice(0,30).map(e=>`<button type="button" data-journal-date="${e.date}"><time>${e.date}</time><span>${esc(e.title||plainText(e).slice(0,35)||'照片手记')}</span></button>`).join(''):'<p>写下第一篇手记后，在这里回看。</p>';
  }
  async export(asHTML=true){
    if(!this.active)return;if(this.inserting)throw Error('图片正在处理，请稍候导出。');
    const entry=this.snapshot();if(isEmpty(entry))throw Error('这一天还没有手记内容。');
    if(asHTML){const sources=new Map();for(const id of new Set(imageIDs(entry))){const asset=await this.store.getAsset(id);if(!asset?.blob)throw Error('图片暂时无法读取，未导出；请保留本机数据。');sources.set(id,await blobDataURL(asset.blob));}download(standaloneHTML(entry,sources),`拾日手记-${entry.date}.html`,'text/html;charset=utf-8');}
    else download(`${entry.date}\n${entry.title}\n${entry.mood}\n\n${plainText(entry)}`,`拾日手记-${entry.date}.txt`,'text/plain;charset=utf-8');
    this.notify(this.active.dirty?'已导出当前草稿，请继续保存到本机。':'手记已导出。');
  }
  async importLegacy(raw){
    if(!await this.leave())throw Error('请先保存或导出当前草稿。');
    const entries=legacyEntries(raw);if(entries.some(e=>imageIDs(e).length))throw Error('此 diary.json 包含外部图片引用。请先在 Windows 版导出独立 HTML；当前入口仅导入旧版纯文字日记。');
    await this.importEntries(entries);this.notify('旧版文字日记已合并，同日期保留当前记录。');
  }
  async importEntries(entries){for(const raw of entries){const entry=normalizeEntry(raw);if(this.entries.has(entry.date)&&!isEmpty(this.entries.get(entry.date)))continue;const old=this.entries.get(entry.date);const saved=await this.store.save(entry,old?.revision||'');this.entries.set(entry.date,saved);this.sessions.delete(entry.date);}const date=this.active?.date;this.active=null;if(date)await this.open(date);this.updateHistory();}
  async backup(){
    await this.ready;if(!await this.leave())throw Error('手记尚未保存，请先重试或单独导出当前草稿。');
    const entries=(await this.store.list()).filter(e=>!isEmpty(e)),assets=[];
    for(const id of new Set(entries.flatMap(imageIDs))){const asset=await this.store.getAsset(id);if(!asset?.blob)throw Error('手记图片暂时无法读取，完整备份未导出。');assets.push({id,data:await blobDataURL(asset.blob)});}
    return {version:1,entries,assets};
  }
  async restoreBackup(bundle){
    if(!bundle)return;await this.ready;if(!await this.leave())throw Error('请先保存当前手记草稿。');
    if(bundle.version!==1||!Array.isArray(bundle.entries)||!Array.isArray(bundle.assets)||bundle.entries.length>36600||bundle.assets.length>50000)throw Error('图文手记备份格式无效。');
    const entries=legacyEntries(bundle.entries),needed=new Set(entries.filter(e=>!this.entries.has(e.date)||isEmpty(this.entries.get(e.date))).flatMap(imageIDs)),assets=[];
    for(const item of bundle.assets){if(!needed.has(item.id))continue;if(typeof item.data!=='string'||item.data.length>28*1024*1024||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(item.data))throw Error('备份包含无效图片。');const blob=await(await fetch(item.data)).blob();const decoded=await this.prepareImage(new File([blob],'备份图片.png',{type:'image/png'}));assets.push({...decoded,id:item.id});}
    for(const id of needed)if(!assets.some(a=>a.id===id)&&!await this.store.getAsset(id))throw Error('备份缺少手记图片，未导入。');
    if(assets.length)await this.store.putAssets(assets);await this.importEntries(entries);
  }
}
