import {COUNTDOWN_MODES,COUNTDOWN_LABELS,countdownPreferences,normalizeCountdown,measureCountdown,moveCountdown} from './countdown-model.mjs?v=1.8.0-r2';
import {uid,bjDate,addDays,COLORS} from './core.mjs?v=1.8.0-r2';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const calendar='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v4m10-4v4M4 10h16M4 5h16v16H4zM8 14h3m2 3h3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
export class Countdowns{
  constructor({getSettings,mutate,notify,confirm}){
    this.getSettings=getSettings;this.mutate=mutate;this.notify=notify;this.confirm=confirm;this.hosts=new Map();this.editID=null;
    this.dialog=document.createElement('dialog');this.dialog.id='countdown-editor';this.dialog.className='countdown-editor';
    this.dialog.innerHTML=`<form id="countdown-form"><header><div><span class="eyebrow">TIME, LITTLE BY LITTLE</span><h2 id="countdown-editor-title">把时光排成一列</h2></div><button type="button" class="icon-button" data-countdown-close aria-label="关闭倒计时设置">×</button></header><label class="field"><span>类型</span><select name="mode" aria-label="倒计时类型">${COUNTDOWN_MODES.map((v,i)=>`<option value="${v}">${COUNTDOWN_LABELS[i]}</option>`).join('')}</select></label><label class="field"><span>名称</span><input name="title" maxlength="60" required placeholder="例如：下一次旅行" aria-label="倒计时名称"></label><label class="field" id="countdown-date-field"><span id="countdown-date-label">目标日期</span><input name="date" type="date" min="0001-01-01" max="9999-12-31" aria-label="倒计时日期"></label><label class="field" id="countdown-years-field" hidden><span>预计年数（1–150 年）</span><input name="lifeYears" type="number" min="1" max="150" value="90" step="1"></label><label class="field"><span>颜色</span><span class="countdown-palette">${[...new Set([...COLORS,'#3889D8','#7965C1','#D89C32'])].map(color=>`<button type="button" data-countdown-color="${color}" style="background:${color}" aria-label="使用颜色 ${color}" title="${color}"></button>`).join('')}</span><span class="countdown-color-row"><input type="color" id="countdown-color-picker" aria-label="调色板"><input name="color" maxlength="7" pattern="#[0-9a-fA-F]{6}" required aria-label="颜色色号" placeholder="#356A51"></span></label><label class="field"><span>图标（可选，输入表情或短符号）</span><input name="icon" maxlength="16" placeholder="例如：✈️，留空显示日历或进度环"></label><p class="field-hint">按北京时间计算日历日，当天显示 0 天。列表顺序与颜色同时应用到左栏和专注页。</p><p id="countdown-error" class="form-error" role="alert"></p><footer><button type="button" class="text-button danger" data-countdown-delete hidden>删除</button><span class="spacer"></span><button type="button" class="soft-button" data-countdown-close>取消</button><button class="primary" type="submit">保存倒计时</button></footer></form>`;
    document.body.append(this.dialog);this.form=this.dialog.querySelector('form');
    this.listDialog=document.createElement('dialog');this.listDialog.id='countdown-dialog';this.listDialog.className='countdown-dialog';this.listDialog.innerHTML='<header><div><span class="eyebrow">DAYS TO REMEMBER</span><h2>时光，正在发生</h2></div><button class="icon-button" data-countdown-list-close aria-label="关闭倒计时列表">×</button></header><div class="countdown-list-toolbar"><p class="fine-print">点击条目编辑，使用箭头排序。</p><button class="primary" data-countdown-add>＋ 新增</button></div><div id="expanded-countdowns" class="countdown-list expanded"></div><p class="fine-print">最多 100 条 · 按北京时间更新</p>';document.body.append(this.listDialog);
    this.context=document.createElement('div');this.context.id='countdown-context';this.context.className='countdown-context';this.context.hidden=true;this.context.setAttribute('role','menu');this.context.innerHTML='<button role="menuitem" data-countdown-command="edit">编辑</button><button role="menuitem" data-countdown-command="up">上移</button><button role="menuitem" data-countdown-command="down">下移</button><button role="menuitem" data-countdown-command="delete">删除</button>';document.body.append(this.context);
    this.listDialog.onclick=e=>{if(e.target.closest('[data-countdown-list-close]'))this.listDialog.close();};
    document.addEventListener('click',e=>this.click(e));
    document.addEventListener('contextmenu',e=>{const row=e.target.closest('[data-countdown-row]');if(!row)return;e.preventDefault();this.contextID=row.dataset.countdownRow;this.context.hidden=false;this.context.style.left=Math.min(e.clientX,innerWidth-155)+'px';this.context.style.top=Math.min(e.clientY,innerHeight-180)+'px';this.context.querySelector('button').focus();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')this.context.hidden=true;});
    document.addEventListener('scroll',()=>this.context.hidden=true,true);
    this.form.elements.mode.onchange=()=>this.updateFields();
    this.form.elements.color.oninput=()=>{if(/^#[\da-f]{6}$/i.test(this.form.elements.color.value))this.dialog.querySelector('#countdown-color-picker').value=this.form.elements.color.value;};
    this.dialog.querySelector('#countdown-color-picker').oninput=e=>this.form.elements.color.value=e.target.value;
    this.form.onsubmit=e=>{e.preventDefault();this.save();};
    this.lastSecond=0;
  }
  list(){return countdownPreferences(this.getSettings());}
  async click(e){
    const target=e.target instanceof Element?e.target:null;if(!target)return;
    if(target.closest('[data-countdown-add]')){this.openEditor();return;}
    if(target.closest('[data-countdown-expand]')){this.render();this.listDialog.showModal();return;}
    if(target.closest('[data-countdown-close]')){this.dialog.close();return;}
    const swatch=target.closest('[data-countdown-color]');if(swatch){this.form.elements.color.value=swatch.dataset.countdownColor;this.dialog.querySelector('#countdown-color-picker').value=swatch.dataset.countdownColor;return;}
    if(target.closest('[data-countdown-delete]')){if(await this.remove(this.editID))this.dialog.close();return;}
    const command=target.closest('[data-countdown-command]');if(command){const row=command.closest('[data-countdown-row]'),id=row?.dataset.countdownRow||this.contextID,name=command.dataset.countdownCommand;this.context.hidden=true;if(name==='edit')this.openEditor(id);else if(name==='delete')await this.remove(id);else this.move(id,name==='up'?-1:1);return;}
    const edit=target.closest('[data-countdown-edit]');if(edit){this.openEditor(edit.dataset.countdownEdit);return;}
    if(!target.closest('#countdown-context'))this.context.hidden=true;
  }
  openEditor(id=''){
    let list;try{list=this.list();}catch(error){this.notify(error.message);return;}
    const item=list.find(e=>e.id===id);if(!item&&list.length>=100){this.notify('最多保留 100 个倒计时或进度项目。');return;}
    this.editID=item?.id||'';const value=item||{mode:'Date',title:'',date:addDays(bjDate(),30),color:'#356A51',icon:'',lifeYears:90};
    for(const name of ['mode','title','date','color','icon','lifeYears'])this.form.elements[name].value=value[name];
    this.dialog.querySelector('#countdown-color-picker').value=value.color;this.dialog.querySelector('[data-countdown-delete]').hidden=!item;this.dialog.querySelector('#countdown-error').textContent='';this.updateFields();this.dialog.showModal();this.form.elements.title.focus();
  }
  updateFields(){const mode=this.form.elements.mode.value,dated=['Date','Anniversary','Life'].includes(mode);this.dialog.querySelector('#countdown-date-field').hidden=!dated;this.form.elements.date.required=dated;this.dialog.querySelector('#countdown-years-field').hidden=mode!=='Life';this.form.elements.lifeYears.required=mode==='Life';this.dialog.querySelector('#countdown-date-label').textContent=mode==='Life'?'出生日期':mode==='Anniversary'?'开始日期':'目标日期';}
  save(){
    try{const raw=Object.fromEntries(new FormData(this.form));raw.id=this.editID||uid();raw.title=raw.title.trim();raw.lifeYears=Number(raw.lifeYears);const value=normalizeCountdown(raw);
      const ok=this.mutate(()=>{const list=this.list(),i=list.findIndex(e=>e.id===value.id);if(i<0)list.push(value);else list[i]=value;this.getSettings().countdowns=list;},'倒计时已保存。');
      if(ok){this.dialog.close();this.render();}else this.dialog.querySelector('#countdown-error').textContent='保存失败，原列表保留。请检查存储空间后重试。';
    }catch(error){this.dialog.querySelector('#countdown-error').textContent=error.message;}
  }
  move(id,step){this.mutate(()=>this.getSettings().countdowns=moveCountdown(this.list(),id,step));this.render();}
  async remove(id){const item=this.list().find(e=>e.id===id);if(!item)return false;if(!await this.confirm('删除这个倒计时？',`将移除“${item.title}”，其他倒计时保留。`))return false;const ok=this.mutate(()=>this.getSettings().countdowns=this.list().filter(e=>e.id!==id),'倒计时已删除。');this.render();return ok;}
  tick(){const second=Math.floor(Date.now()/1000);if(second===this.lastSecond)return;this.lastSecond=second;this.render();}
  render(){
    let list;try{list=this.list();}catch(error){this.notify('倒计时未读取：'+error.message);return;}
    for(const [selector,compact]of [['#countdown-list',true],['#expanded-countdowns',false],['#focus-countdown-list',true]]){
      const host=document.querySelector(selector);if(!host)continue;if(!this.hosts.has(host))this.hosts.set(host,new Map());const rows=this.hosts.get(host),ids=new Set(list.map(e=>e.id));
      for(const [id,node]of rows)if(!ids.has(id)){node.remove();rows.delete(id);}
      let empty=host.querySelector('.countdown-empty');if(!list.length){if(!empty){empty=document.createElement('p');empty.className='countdown-empty';empty.textContent='添加日期、纪念日或时光进度';host.append(empty);}}else empty?.remove();
      for(let i=0;i<list.length;i++){
        const item=list[i],r=measureCountdown(item);let row=rows.get(item.id);
        if(!row){row=document.createElement('div');row.className='countdown-row';row.dataset.countdownRow=item.id;row.innerHTML=`<button class="countdown-main" data-countdown-edit="${esc(item.id)}"><span class="countdown-glyph"></span><span class="countdown-text"><strong></strong><small></small></span><span class="countdown-reading"><b></b><small></small></span></button><span class="countdown-order-tools"><button data-countdown-command="up" aria-label="上移倒计时">↑</button><button data-countdown-command="down" aria-label="下移倒计时">↓</button><button data-countdown-command="delete" aria-label="删除倒计时">×</button></span>`;rows.set(item.id,row);}
        const key=JSON.stringify([item,r.value,compact?r.compactDetail:r.detail]);
        if(row.dataset.reading!==key){row.dataset.reading=key;row.style.setProperty('--countdown-color',item.color);row.querySelector('strong').textContent=item.title;row.querySelector('.countdown-text small').textContent=compact?r.compactDetail:r.detail;row.querySelector('.countdown-reading b').textContent=r.value;row.querySelector('.countdown-reading small').textContent=r.unit;const glyph=row.querySelector('.countdown-glyph');glyph.classList.toggle('is-ring',!item.icon&&r.hasProgress);glyph.innerHTML=item.icon?esc(item.icon):r.hasProgress?'':calendar;glyph.style.setProperty('--progress',r.progress*100+'%');row.querySelector('.countdown-main').title=item.title+' · '+r.detail+' · '+r.value+r.unit+'，点击编辑';row.querySelector('.countdown-main').setAttribute('aria-label',row.querySelector('.countdown-main').title);}
        row.querySelector('[data-countdown-command="up"]').disabled=i===0;row.querySelector('[data-countdown-command="down"]').disabled=i===list.length-1;
        if(host.children[i]!==row)host.insertBefore(row,host.children[i]||null);
      }
    }
    const focus=document.querySelector('#focus-countdown-panel');if(focus)focus.hidden=!list.length;
  }
}
