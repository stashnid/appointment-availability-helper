const { test, expect } = require('@playwright/test');
const path = require('node:path');

test('browser helper flow and safeguards', async ({ page }) => {
  const results = await (async (page) => {
  const fs = await import('node:fs/promises');
  const src = (await fs.readFile(path.join(__dirname, '..', 'extension', 'helper.js'), 'utf8')).replace('90*1000','500');
  const context = await page.context().browser().newContext({viewport:{width:1400,height:1000}});
  const services = {data:[{title:'Практичний іспит',services:[{title:'Практичний іспит на транспортному засобі Сервісного центру МВС',services:[{id:49,title:'категорія В (механічна КПП)'}]}]}]};
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>p.slot{cursor:pointer}.hidden{display:none}</style></head><body><main></main><script>
    window.state={bookings:0,confirmations:0,refreshes:0,centerEnabled:true,stage:'map',chosen:'',selectedDate:'',wrong:false,wrongDate:false,needContact:false};
    const main=document.querySelector('main');
    const button=(text,fn,disabled=false)=>{let b=document.createElement('button');b.textContent=text;b.disabled=disabled;b.onclick=fn;main.append(b);return b;};
    const title=t=>{main.innerHTML='<h3>'+t+'</h3>';};
    const service='категорія В (механічна КПП)';
    function map(){state.stage='map';title('Оберіть сервісний центр МВС');button(service,rootServices);button('ТСЦ МВС № 2641 м. Івано-Франківськ',dates,!state.centerEnabled);}
    function rootServices(){title('Оберіть послугу');button('Практичний іспит',()=>{title('Оберіть послугу');button('Практичний іспит на транспортному засобі Сервісного центру МВС',()=>{title('Оберіть послугу');button(service,()=>{state.refreshes++;map()})})});}
    function dates(){state.stage='dates';title('Оберіть дату');button('ТСЦ МВС № '+(state.wrong?'9999':'2641'),()=>{});
      const cal=document.createElement('div');cal.className='react-calendar';main.append(cal);
      for(const day of [1,2,3]) {const b=document.createElement('button');b.className='react-calendar__month-view__days__day';b.disabled=day===1;b.innerHTML='<abbr aria-label="'+day+' листопада 2026 р.">'+day+'</abbr>';b.onclick=()=>{state.selectedDate=day;times()};cal.append(b);}
    }
    function times(){state.stage='times';title('Оберіть час');button('ТСЦ МВС № 2641',()=>{});
      for(const time of ['13:12','08:00','14:04']){let p=document.createElement('p');p.className='slot';p.textContent=time;p.onclick=()=>{state.chosen=time;syncNext()};main.append(p);}
      const lab=document.createElement('label');lab.textContent='CAPTCHA (макет)';const c=document.createElement('input');c.id='captcha';c.type='checkbox';lab.append(c);main.append(lab);c.onchange=syncNext;
      button('Далі',()=>{state.bookings++;state.clickedAt=performance.now();contacts()},true);
    }
    function syncNext(){[...main.querySelectorAll('button')].find(b=>b.textContent==='Далі').disabled=!(state.chosen&&document.querySelector('#captcha').checked)}
    function contacts(){state.stage='contacts';title('Контактна інформація');main.insertAdjacentHTML('beforeend','<p>'+service+'</p><p>ТСЦ МВС № 2641</p><p>'+(state.wrongDate?'03':'02')+' Листопад 2026</p><p>'+state.chosen+'</p>');
      button('Далі',()=>{state.confirmations++;state.stage='done';main.innerHTML='<h3>1020</h3><p>Ваш номер у черзі>';},state.needContact);}
    map();
  </script></body></html>`;
  context.setDefaultTimeout(6000);
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/api/v2/test-rate-limit')return route.fulfill({status:429,contentType:'application/json',body:'{}'});
    if(url.pathname==='/api/v2/equeue/departments')return route.fulfill({status:200,contentType:'application/json',body:'{}'});
    if(url.pathname==='/cabinet/queue')return route.fulfill({contentType:'text/html',body:html});
    if(url.pathname==='/api/v2/equeue/services')throw Error('Helper must not request the catalogue');
    return route.abort();
  });
  const results=[];
  async function setup(){const p=await context.newPage();await p.goto('https://eqn.hsc.gov.ua/cabinet/queue');await p.addScriptTag({content:src});await p.locator('#sc-personal-helper').locator('#dry').check();return p;}
  const ui=p=>p.locator('#sc-personal-helper');
  async function waitText(p,needle){await p.waitForFunction(needle=>document.querySelector('#sc-personal-helper').shadowRoot.querySelector('#status').textContent.includes(needle),needle,{timeout:5000});}
  async function test(name,fn){try{await fn();results.push({name,ok:true});}catch(e){results.push({name,ok:false,error:String(e).slice(0,400),states:await Promise.all(context.pages().map(p=>p.evaluate(()=>document.querySelector('#sc-personal-helper')?.shadowRoot.querySelector('#status')?.textContent).catch(()=>null)))});}finally{await Promise.all(context.pages().map(p=>p.close()));}}
  const assert=(value,message)=>{if(!value)throw Error(message)};
  try{
    await test('Dry run: earliest enabled date and earliest time, no booking',async()=>{
      const p=await setup();await ui(p).locator('#now').click();await waitText(p,'Перевірку завершено');
      const s=await p.evaluate(()=>state);assert(s.selectedDate===2,'wrong date');assert(s.chosen==='08:00','wrong time');assert(s.bookings===0&&s.confirmations===0,'dry-run booked');await p.close();
    });
    await test('Waits for manual CAPTCHA then confirms exactly once',async()=>{
      const p=await setup();await ui(p).locator('#dry').uncheck();await ui(p).locator('#now').click();await waitText(p,'Пройдіть CAPTCHA');
      assert((await p.evaluate(()=>state.bookings))===0,'booked without CAPTCHA');await p.locator('#captcha').evaluate(e=>{e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}));});await waitText(p,'Талон отримано');
      const s=await p.evaluate(()=>state);assert(s.bookings===1&&s.confirmations===1,'duplicate/missing submission');await p.close();
    });
    await test('Refreshes unavailable map via same service and handles availability',async()=>{
      const p=await setup();await p.evaluate(()=>{state.centerEnabled=false;map()});await ui(p).locator('#now').click();
      await p.waitForFunction(()=>state.refreshes>=1);assert((await p.evaluate(()=>state.bookings))===0,'unexpected booking');
      await p.evaluate(()=>{state.centerEnabled=true;map()});await waitText(p,'Перевірку завершено');await p.close();
    });
    await test('Stop prevents submission after subsequent CAPTCHA',async()=>{
      const p=await setup();await ui(p).locator('#dry').uncheck();await ui(p).locator('#now').click();await waitText(p,'Пройдіть CAPTCHA');await ui(p).locator('#stop').click();await p.locator('#captcha').evaluate(e=>{e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}));});
      await p.waitForTimeout(400);assert((await p.evaluate(()=>state.bookings))===0,'submitted after stop');await p.close();
    });
    await test('Site error stops without booking',async()=>{
      const p=await setup();await ui(p).locator('#dry').uncheck();await ui(p).locator('#now').click();await waitText(p,'Пройдіть CAPTCHA');await p.evaluate(()=>{const d=document.createElement('div');d.role='alert';d.textContent='Перевищено ліміт реєстрацій';document.body.append(d)});
      await waitText(p,'Повідомлення сайту');assert((await p.evaluate(()=>state.bookings))===0,'booked despite error');await p.close();
    });
    await test('Wrong center blocks continuation',async()=>{
      const p=await setup();await p.evaluate(()=>state.wrong=true);await ui(p).locator('#now').click();await waitText(p,'Відкрито інший СЦ');assert((await p.evaluate(()=>state.bookings))===0,'wrong center booked');await p.close();
    });
    await test('Two tabs cannot run simultaneously',async()=>{
      const p=await setup();await p.evaluate(()=>{state.centerEnabled=false;map()});await ui(p).locator('#now').click();await p.waitForFunction(()=>state.refreshes>=1);
      const q=await setup();await ui(q).locator('#now').click();await waitText(q,'іншій вкладці');await ui(p).locator('#stop').click();await p.close();await q.close();
    });
    await test('Contact input waits until the website permits confirmation',async()=>{
      const p=await setup();await p.evaluate(()=>state.needContact=true);await ui(p).locator('#dry').uncheck();await ui(p).locator('#now').click();await waitText(p,'Пройдіть CAPTCHA');await p.locator('#captcha').evaluate(e=>{e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}));});await waitText(p,'Заповніть телефон');
      assert((await p.evaluate(()=>state.confirmations))===0,'confirmed invalid contacts');await p.evaluate(()=>{[...document.querySelectorAll('main button')].find(b=>b.textContent==='Далі').disabled=false});await waitText(p,'Талон отримано');await p.close();
    });
    await test('Wrong confirmation date blocks final submission',async()=>{
      const p=await setup();await p.evaluate(()=>state.wrongDate=true);await ui(p).locator('#dry').uncheck();await ui(p).locator('#now').click();await waitText(p,'Пройдіть CAPTCHA');await p.locator('#captcha').evaluate(e=>{e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}));});await waitText(p,'Дата у підтвердженні');assert((await p.evaluate(()=>state.confirmations))===0,'wrong date confirmed');await p.close();
    });
    await test('Expired session stops while CAPTCHA is pending',async()=>{
      const p=await setup();await ui(p).locator('#dry').uncheck();await ui(p).locator('#now').click();await waitText(p,'Пройдіть CAPTCHA');await p.evaluate(()=>history.pushState({},'', '/'));await waitText(p,'Сторінка змінилася');assert((await p.evaluate(()=>state.bookings))===0,'booked after session ended');await p.close();
    });
    await test('HTTP 429 immediately stops and prevents rapid restart',async()=>{
      const p=await setup();await ui(p).locator('#dry').uncheck();await ui(p).locator('#now').click();await waitText(p,'Пройдіть CAPTCHA');await p.evaluate(()=>fetch('/api/v2/test-rate-limit'));await waitText(p,'HTTP 429');
      assert((await p.evaluate(()=>state.bookings))===0,'booked after 429');await p.evaluate(()=>map());await ui(p).locator('#now').click();await waitText(p,'Зачекайте щонайменше хвилину');await p.close();
    });
    await test('Continue label: reacts to CAPTCHA activation without duplicate submission',async()=>{
      const p=await setup();await ui(p).locator('#dry').uncheck();await ui(p).locator('#now').click();await waitText(p,'Пройдіть CAPTCHA');
      await p.evaluate(()=>{const b=[...document.querySelectorAll('main button')].find(b=>b.textContent==='Далі');b.textContent='Продовжити';state.activatedAt=performance.now();b.disabled=false;});
      await waitText(p,'Талон отримано');const s=await p.evaluate(()=>state);assert(s.bookings===1&&s.confirmations===1,'duplicate/missing submission');assert(s.clickedAt-s.activatedAt<150,'slow activation reaction: '+(s.clickedAt-s.activatedAt));await p.close();
    });
    await test('Delayed CSS/ARIA activation waits then resumes automatically',async()=>{
      const p=await setup();await ui(p).locator('#dry').uncheck();await ui(p).locator('#now').click();await waitText(p,'Пройдіть CAPTCHA');
      await p.evaluate(()=>{const b=[...document.querySelectorAll('main button')].find(b=>b.textContent==='Далі');b.setAttribute('aria-disabled','true');b.classList.add('Mui-disabled');b.disabled=false;});
      await p.waitForTimeout(250);assert((await p.evaluate(()=>state.bookings))===0,'clicked while ARIA disabled');
      await p.evaluate(()=>{const b=[...document.querySelectorAll('main button')].find(b=>b.textContent==='Далі');state.activatedAt=performance.now();b.removeAttribute('aria-disabled');b.classList.remove('Mui-disabled');});
      await waitText(p,'Талон отримано');const s=await p.evaluate(()=>state);assert(s.bookings===1&&s.confirmations===1,'duplicate/missing submission');assert(s.clickedAt-s.activatedAt<150,'slow CSS reaction');await p.close();
    });
    await test('Real mode is explicitly shown and enabled by default',async()=>{
      const p=await context.newPage();await p.goto('https://eqn.hsc.gov.ua/cabinet/queue');await p.addScriptTag({content:src});assert(!(await ui(p).locator('#dry').isChecked()),'dry run enabled by default');assert((await ui(p).locator('#mode').innerText()).includes('Реальний запис'),'mode not shown');await p.close();
    });
    await test('Panel drags, remembers position, stays in viewport and resets',async()=>{
      let p=await setup();let box=await ui(p).boundingBox();const handle=await ui(p).locator('#drag').boundingBox();
      await p.mouse.move(handle.x+25,handle.y+12);await p.mouse.down();await p.mouse.move(handle.x-600,handle.y-150,{steps:8});await p.mouse.up();
      let moved=await ui(p).boundingBox();assert(moved.x<box.x-300,'panel did not move');const saved=moved;
      await p.reload();await p.addScriptTag({content:src});await p.waitForTimeout(100);let restored=await ui(p).boundingBox();assert(Math.abs(restored.x-saved.x)<2 && Math.abs(restored.y-saved.y)<2,'position not restored');
      await p.setViewportSize({width:700,height:550});await p.waitForTimeout(100);let small=await ui(p).boundingBox();assert(small.x>=0 && small.y>=0 && small.x+small.width<=701 && small.y+small.height<=551,'panel outside viewport');
      await ui(p).locator('#fold').click();assert(await ui(p).locator('#now').isHidden(),'fold not working');await ui(p).locator('#fold').click();assert(await ui(p).locator('#now').isVisible(),'unfold not working');
      await ui(p).locator('#reset').click();assert(await p.evaluate(()=>localStorage.getItem('sc-helper-panel-position-v1'))===null,'reset did not clear saved position');assert((await p.evaluate(()=>state.bookings))===0,'drag created booking');await p.close();
    });
    await test('Native department polling avoids extra navigation',async()=>{
      const p=await setup();await p.evaluate(()=>{state.centerEnabled=false;map()});await ui(p).locator('#now').click();
      await p.evaluate(()=>{window.nativePoll=setInterval(()=>fetch('/api/v2/equeue/departments?serviceId=49'),100)});
      await p.waitForTimeout(1100);assert((await p.evaluate(()=>state.refreshes))===0,'extra navigation despite native polling');
      await p.evaluate(()=>clearInterval(window.nativePoll));await p.close();
    });
    await test('Fallback refreshes only when native department polling stops',async()=>{
      const p=await setup();await p.evaluate(()=>{state.centerEnabled=false;map()});await ui(p).locator('#now').click();
      await p.waitForFunction(()=>state.refreshes===1);assert((await p.evaluate(()=>state.bookings))===0,'unexpected booking');await p.close();
    });
    await test('Still monitors after 16 minutes and selects a newly released slot',async()=>{
      const p=await setup();await p.evaluate(()=>{state.centerEnabled=false;map();window.clockOffset=0;const original=performance.now.bind(performance);Object.defineProperty(performance,'now',{value:()=>original()+window.clockOffset});});
      await ui(p).locator('#now').click();await p.waitForFunction(()=>state.refreshes>=1);await p.evaluate(()=>window.clockOffset=16*60*1000);await p.waitForTimeout(250);
      assert(await ui(p).locator('#stop').isEnabled(),'stopped before delayed release');await p.evaluate(()=>{state.centerEnabled=true;map()});await waitText(p,'Перевірку завершено');assert((await p.evaluate(()=>state.chosen))==='08:00','missed delayed slot');await p.close();
    });
    await test('Stops at 30 minutes rather than running indefinitely',async()=>{
      const p=await setup();await p.evaluate(()=>{state.centerEnabled=false;map();window.clockOffset=0;const original=performance.now.bind(performance);Object.defineProperty(performance,'now',{value:()=>original()+window.clockOffset});});
      await ui(p).locator('#now').click();await p.waitForFunction(()=>state.refreshes>=1);await p.evaluate(()=>window.clockOffset=31*60*1000);await waitText(p,'Минуло 30 хвилин');assert((await p.evaluate(()=>state.bookings))===0,'unexpected booking');await p.close();
    });
    await test('Kyiv 06:00 scheduling across winter/summer and DST changes',async()=>{
      const start=src.indexOf('function nextSix('),end=src.indexOf('async function start(',start);
      const nextSix=new Function(src.slice(start,end)+';return nextSix;')();
      for(const [now,want] of [
        ['2026-10-14T02:59:00Z','2026-10-14T03:00:00Z'],
        ['2026-10-14T03:01:00Z','2026-10-15T03:00:00Z'],
        ['2026-10-24T23:00:00Z','2026-10-25T04:00:00Z'],
        ['2027-03-27T23:00:00Z','2027-03-28T03:00:00Z'],
        ['2026-12-01T03:59:00Z','2026-12-01T04:00:00Z']])assert(nextSix(Date.parse(now))===Date.parse(want),now+' produced '+new Date(nextSix(Date.parse(now))).toISOString());
    });
    return results;
  }finally{await context.close()}
})(page);
  expect(results.filter(result => !result.ok)).toEqual([]);
});
