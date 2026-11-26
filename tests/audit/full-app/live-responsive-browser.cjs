// Playwright run-code expects a top-level function expression.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
async (page) => {
  const results=[];
  for(const route of page.__qaResponsiveRoutes){
    await page.goto('http://localhost:5173'+route,{waitUntil:'networkidle',timeout:45000});
    await page.addScriptTag({path:'/Users/ricardoperez/Documents/ecommium_ui/node_modules/axe-core/axe.min.js'});
    for(const width of [1440,768,390]){
      await page.setViewportSize({width,height:1000});
      const geometry=await page.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:innerWidth}));
      const audit=await page.evaluate(async()=>{
        const result=await window.axe.run(document.querySelector('main')??document.body);
        return {violations:result.violations.map(v=>({id:v.id,impact:v.impact,count:v.nodes.length,targets:v.nodes.slice(0,3).map(n=>n.target)})),incomplete:result.incomplete.length};
      });
      results.push({route,width,overflow:geometry.document>geometry.viewport+1,...audit});
    }
  }
  await page.setViewportSize({width:1440,height:1000});
  return results;
}
