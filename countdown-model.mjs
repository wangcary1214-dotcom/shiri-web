export const COUNTDOWN_MODES=['Date','Anniversary','Year','Quarter','Month','Day','Life'];
export const COUNTDOWN_LABELS=['日期倒计时','纪念日正计时','年进度','季度进度','月进度','日进度','人生进度'];
const DAY=86400000,OFFSET=8*3600000;
const dateOK=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&s>='0001-01-01'&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const utc=(y,m,d)=>{const value=new Date(0);value.setUTCFullYear(y,m-1,d);value.setUTCHours(0,0,0,0);return +value;};
export function normalizeCountdown(raw){
  if(!raw||typeof raw!=='object')throw Error('倒计时项目无效。');
  const e={id:raw.id??raw.Id,title:raw.title??raw.Title,mode:raw.mode??raw.Mode,date:raw.date??raw.Date??'',color:raw.color??raw.Color??'#356A51',icon:raw.icon??raw.Icon??'',lifeYears:raw.lifeYears??raw.LifeYears??90};
  if(typeof e.id!=='string'||!e.id.trim()||e.id.length>80)throw Error('倒计时编号无效。');
  if(typeof e.title!=='string'||!e.title.trim()||e.title.length>60)throw Error('名称需要 1–60 个字。');
  if(!COUNTDOWN_MODES.includes(e.mode))throw Error('倒计时类型无法识别。');
  if(!/^#[\da-f]{6}$/i.test(e.color))throw Error('请输入有效颜色，例如 #688FBA。');
  if(typeof e.icon!=='string'||e.icon.length>16)throw Error('图标请使用一个表情或短符号。');
  if(['Date','Anniversary','Life'].includes(e.mode)&&!dateOK(e.date))throw Error('请选择有效日期。');
  if(e.mode==='Life'&&(!Number.isInteger(e.lifeYears)||e.lifeYears<1||e.lifeYears>150||Number(e.date.slice(0,4))+e.lifeYears>9999))throw Error('人生进度需要 1–150 年，且结束日期须有效。');
  return e;
}
export function countdownPreferences(settings={}){
  let raw=settings.countdowns??settings.Countdowns;
  if(raw==null){const date=settings.countdownDate??settings.CountdownDate;raw=dateOK(date)?[{id:'legacy-countdown',title:settings.countdownTitle||settings.CountdownTitle||'期待的日子',date,mode:'Date'}]:[];}
  if(!Array.isArray(raw)||raw.length>100)throw Error('最多保留 100 个倒计时或进度项目。');
  const list=raw.map(normalizeCountdown);if(new Set(list.map(e=>e.id)).size!==list.length)throw Error('倒计时编号重复。');return list;
}
export function measureCountdown(raw,at=Date.now()){
  const item=normalizeCountdown(raw),now=at+OFFSET,today=Math.floor(now/DAY)*DAY,day=new Date(now),year=day.getUTCFullYear(),month=day.getUTCMonth()+1;
  if(item.mode==='Date'||item.mode==='Anniversary'){
    const target=Date.parse(item.date+'T00:00:00Z'),delta=Math.round((target-today)/DAY),suffix=delta>0?'还有':delta<0?'已过去':'就是今天',d=new Date(target),short=`${d.getUTCMonth()+1}月${d.getUTCDate()}日`;
    return {value:String(Math.abs(delta)),unit:'天',detail:`${d.getUTCFullYear()} 年 ${short} · ${suffix}`,compactDetail:`${short} · ${suffix}`,progress:0,hasProgress:false};
  }
  let start,end,prefix;
  if(item.mode==='Year'){start=utc(year,1,1);end=utc(year+1,1,1);prefix='按年';}
  else if(item.mode==='Quarter'){const m=Math.floor((month-1)/3)*3+1;start=utc(year,m,1);end=utc(year,m+3,1);prefix='按季度';}
  else if(item.mode==='Month'){start=utc(year,month,1);end=utc(year,month+1,1);prefix='按月';}
  else if(item.mode==='Day'){start=today;end=start+DAY;prefix='按日';}
  else{
    start=Date.parse(item.date+'T00:00:00Z');const birth=new Date(start),y=birth.getUTCFullYear()+item.lifeYears,m=birth.getUTCMonth()+1,d=birth.getUTCDate(),last=new Date(utc(y,m+1,1)-DAY).getUTCDate();end=utc(y,m,Math.min(d,last));prefix='一生';
  }
  const elapsed=Math.max(0,now-start),total=end-start,progress=Math.max(0,Math.min(1,elapsed/total));
  const detail=item.mode==='Day'?`按日 · ${Number(Math.min(24,elapsed/3600000).toFixed(1))}时 / 24时 · 已过去`:item.mode==='Life'?`一生 · ${Number((elapsed/DAY/365.2425).toFixed(2))}岁 / ${item.lifeYears}岁 · 已过去`:`${prefix} · ${Math.floor(Math.min(total,elapsed)/DAY)}天 / ${Math.round(total/DAY)}天 · 已过去`;
  return {value:String(Math.floor(progress*100+1e-8)),unit:'%',detail,compactDetail:prefix+' · 已过去',progress,hasProgress:true};
}
export function moveCountdown(list,id,step){const next=[...list],i=next.findIndex(e=>e.id===id),to=i+step;if(i>=0&&to>=0&&to<next.length){const [item]=next.splice(i,1);next.splice(to,0,item);}return next;}
