// Playwright run-code expects a top-level function expression.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
async (page) => {
  const {routes, base = "http://localhost:5173"} = page.__qaReadOptions;
  const evidence={checks:[]};
  const summaries=[];
  for (const route of routes) {
    const started=Date.now();
    const entry={route,checkedAt:new Date().toISOString(),status:'APROBADO',level:'LECTURA',viewport:page.viewportSize(),errors:[],httpErrors:[]};
    const onError=error=>entry.errors.push(error.name || 'BrowserError');
    const onResponse=response=>{
      if (response.status()>=400 && new URL(response.url()).origin===new URL(base).origin) {
        entry.httpErrors.push({path:new URL(response.url()).pathname,status:response.status()});
      }
    };
    page.on('pageerror',onError);page.on('response',onResponse);
    try {
      const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:45000});
      await page.waitForLoadState('networkidle',{timeout:15000});
      entry.httpStatus=response?.status();
      entry.finalPath=new URL(page.url()).pathname;
      entry.headings=await page.locator('h1').allTextContents();
      entry.rows=await page.locator('tbody tr').count();
      entry.alerts=await page.locator('.adminBannerError,.storefrontUnavailable').allTextContents();
      // Scope evidence to public error descriptions; omit customer and employee records.
      entry.alerts=entry.alerts.map(text=>text.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]+/g,'[email]').slice(0,400));
      entry.emptyState=entry.alerts.some(text=>text.includes('No hay productos visibles'));
      const actionableAlerts=entry.alerts.filter(text=>!text.includes('No hay productos visibles'));
      if ((entry.httpStatus??0)>=400 || entry.errors.length || actionableAlerts.length || entry.httpErrors.length) entry.status='FALLIDO';
      if(route.startsWith('/admin') && !entry.finalPath.startsWith('/admin')) entry.status='BLOQUEADO';
      entry.overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
      if(entry.overflow)entry.status='FALLIDO';
    } catch(error) {entry.status='FALLIDO';entry.failure=(error.message || error.name || 'NavigationError').replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]+/g,'[email]').slice(0,350);}
    finally {page.off('pageerror',onError);page.off('response',onResponse);}
    entry.durationMs=Date.now()-started;
    evidence.checks.push(entry);
    summaries.push({route,status:entry.status,http:entry.httpStatus,rows:entry.rows,headings:entry.headings,alerts:entry.alerts,errors:entry.errors,overflow:entry.overflow});
  }
  return evidence.checks;
}
