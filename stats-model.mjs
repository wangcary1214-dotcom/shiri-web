import {DAY,bjDate,dayStart,weekday,statistics} from './core.mjs?v=1.8.0-r2';
export function focusWeek(state,at=Date.now(),offset=0){
  const today=dayStart(at),monday=today-weekday(bjDate(today))*DAY,start=monday+Math.min(0,Math.trunc(offset))*7*DAY;
  const days=Array.from({length:7},(_,i)=>({at:start+i*DAY,ms:statistics(state,start+i*DAY).reduce((n,p)=>n+p.ms,0)}));
  return {start,end:start+6*DAY,days,total:days.reduce((n,d)=>n+d.ms,0)};
}
