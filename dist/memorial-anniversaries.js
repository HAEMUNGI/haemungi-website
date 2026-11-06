/* Date-only remembrance milestones, computed in Korean calendar dates (Asia/Seoul).
 * The day of passing is day 1 of the customary 49-day memorial observance.
 * Leap-day anniversaries use February 28 in non-leap years; no dates are inferred.
 */
(function(root){
  'use strict';
  const DAY=86400000;
  const valid=(value)=>{
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
    const [year,month,day]=value.split('-').map(Number);
    if(year<1900||year>2200||month<1||month>12||day<1||day>31)return null;
    const utc=Date.UTC(year,month-1,day),check=new Date(utc);
    if(check.getUTCFullYear()!==year||check.getUTCMonth()!==month-1||check.getUTCDate()!==day)return null;
    return {year,month,day,utc};
  };
  function todayInKorea(now=new Date()){
    const parts=new Intl.DateTimeFormat('en-US',{
      timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'
    }).formatToParts(now);
    const v=Object.fromEntries(parts.map(p=>[p.type,p.value]));
    return `${v.year}-${v.month}-${v.day}`;
  }
  const pad=n=>String(n).padStart(2,'0');
  const dateText=d=>`${d.year}.${pad(d.month)}.${pad(d.day)}`;
  const days=(a,b)=>Math.round((a.utc-b.utc)/DAY);
  function yearly(source,year){
    // Birthday/anniversary for February 29 is observed February 28 in a non-leap year.
    const max=new Date(Date.UTC(year,source.month,0)).getUTCDate();
    return valid(`${year}-${pad(source.month)}-${pad(Math.min(source.day,max))}`);
  }
  function nextAnnual(source,today){
    let year=Math.max(source.year,today.year),date=yearly(source,year);
    if(date.utc<today.utc){year++;date=yearly(source,year);}
    return {date,years:year-source.year,daysUntil:days(date,today)};
  }
  function calculate(record={},todayValue=todayInKorea()){
    const today=valid(todayValue),born=valid(record.born_on),passed=valid(record.passed_on);
    if(!today)return {since:null,summary:'',events:[]};
    const events=[];let since=null;
    if(passed&&passed.utc<=today.utc){
      since=days(today,passed);
      const day49=valid(new Date(passed.utc+48*DAY).toISOString().slice(0,10));
      const offset=days(day49,today);
      events.push({kind:'day49',label:'49재',date:dateText(day49),daysUntil:offset,
        note:offset>0?`D-${offset}`:offset===0?'오늘':'지난 일정'});
      const next=nextAnnual(passed,today);
      const yearLabel=next.years===1?'첫 기일 · 1주기':`${next.years}주기 기일`;
      events.push({kind:'memorial',label:yearLabel,date:dateText(next.date),daysUntil:next.daysUntil,
        note:next.daysUntil===0?'오늘':`D-${next.daysUntil}`});
    }
    if(born&&born.utc<=today.utc){
      const next=nextAnnual(born,today);
      events.push({kind:'birthday',label:'다음 생일',date:dateText(next.date),daysUntil:next.daysUntil,
        note:next.daysUntil===0?'오늘':`D-${next.daysUntil}`});
    }
    const upcoming=events.filter(e=>e.daysUntil>=0).sort((a,b)=>a.daysUntil-b.daysUntil);
    const soon=upcoming[0];
    const summary=since===null?(soon?`${soon.label} ${soon.note}`:''):
      `별이 된 지 ${since.toLocaleString('ko-KR')}일`+(soon?` · ${soon.label} ${soon.note}`:'');
    return {since,summary,events,hasBirthday:!!born,hasPassing:!!passed};
  }
  const api=Object.freeze({calculate,todayInKorea});
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.HAEMUNGI_MEMORIAL_DATES=api;
})(typeof window!=='undefined'?window:null);
