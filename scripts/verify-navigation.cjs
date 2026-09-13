const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),ts=require(root+'/node_modules/typescript');const React=require(root+'/node_modules/react');const {renderToString}=require(root+'/node_modules/react-dom/server');let current='/';const cache=new Map();
function load(file){if(cache.has(file))return cache.get(file).exports;if(file.endsWith('.json'))return JSON.parse(fs.readFileSync(file,'utf8'));const mod={exports:{}};cache.set(file,mod);const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;const req=(name)=>{if(name==='next/link')return {__esModule:true,default:({href,children,prefetch,...props})=>React.createElement('a',{href,...props},children)};if(name==='next/navigation')return {usePathname:()=>current};if(name.startsWith('@/')||name.startsWith('.')){let p=name.startsWith('@/')?root+'/'+name.slice(2):path.resolve(path.dirname(file),name);for(const ext of ['', '.tsx','.ts','.json','/index.ts'])if(fs.existsSync(p+ext)&&fs.statSync(p+ext).isFile())return load(p+ext);throw Error('Missing '+p)}return require(require.resolve(name,{paths:[root]}));};new Function('require','module','exports',js)(req,mod,mod.exports);return mod.exports;}

const assert=require('node:assert/strict');
const Nav=load(root+'/app/navigation.tsx');
const bus=new EventTarget();let pushes=0,events=0,scrolled=0,focused=0;
global.window=bus;window.location=new URL('https://cyi.test/');window.history={pushState(_,__,p){pushes++;window.location=new URL(p,window.location)}};window.scrollTo=()=>scrolled++;window.addEventListener('cyi:navigate',()=>events++);global.document={getElementById(){return {focus(){focused++},scrollIntoView(){scrolled++}}}};global.requestAnimationFrame=fn=>fn();
function click(href,props={},eventProps={}){const e={button:0,defaultPrevented:false,preventDefault(){this.defaultPrevented=true},...eventProps};Nav.default({href,children:'Go',...props}).props.onClick(e);return e;}
assert(click('/about').defaultPrevented);assert.equal(window.location.pathname,'/about');assert.equal(events,1);assert.equal(focused,1);
click('/branches?search=Adenta');assert.equal(window.location.search,'?search=Adenta');
click('/branches?search=Tema');assert.equal(window.location.search,'?search=Tema');assert.equal(events,3);
assert(!click('/resources',{}, {ctrlKey:true}).defaultPrevented);assert.equal(pushes,3);
assert(!click('https://connectcyi.org/opm-feedback/').defaultPrevented);assert.equal(pushes,3);
assert(!click('/gallery',{target:'_blank'}).defaultPrevented);assert.equal(pushes,3);
assert(!click('/gallery',{download:'photos'}).defaultPrevented);assert.equal(pushes,3);
click('/gallery',{onClick:e=>e.preventDefault()});assert.equal(pushes,3);
click('/branches?search=Tema');assert.equal(pushes,3);assert.equal(events,4);
click('/about#mission');assert.equal(window.location.hash,'#mission');
assert.equal(Nav.resolvePath('/my-cyi-story/'),'stories');assert.equal(Nav.resolvePath('/family-games/'),'programmes/family-games');assert.equal(Nav.resolvePath('/savedtoserve/'),'programmes/saved-2-serve');assert.equal(Nav.resolvePath('/'),'home');
document.querySelector=()=>({});assert(!click('/about').defaultPrevented);document.querySelector=undefined;
console.log('Navigation checks passed: immediate transitions, same-route queries, modifier clicks, external links, new tabs, downloads, cancellation, hash scrolling and legacy aliases.');
