import {database} from "@/db/raw";
import data from "../../content.json";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const COOKIE="__Host-cyi_session";
const records=[...data.programmes.map(x=>({...x,kind:"Programme",title:x.title})),...data.resources.map(x=>({...x,kind:"Media",title:x.title})),...data.devotionals.map(x=>({...x,kind:"Devotional",title:x.title})),...data.branches.map(x=>({...x,kind:"Branch",title:x.name,href:x.href})),...data.episodes.map(x=>({...x,kind:"Podcast",title:x.title}))];
const allowed=new Map(records.map(x=>[x.kind+":"+x.slug,{key:x.kind+":"+x.slug,title:x.title,href:x.href,kind:x.kind}]));
function token(request:Request){const m=request.headers.get("cookie")?.match(/(?:^|;\s*)__Host-cyi_session=([a-f0-9]{64})(?:;|$)/);return m?.[1]||null;}
function newToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join("");}
async function key(t:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(t))),x=>x.toString(16).padStart(2,"0")).join("");}
function headers(t?:string){const h=new Headers({"Cache-Control":"no-store, private","Content-Type":"application/json","X-Content-Type-Options":"nosniff","Vary":"Cookie"});if(t)h.set("Set-Cookie",`${COOKIE}=${t}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=7776000`);return h;}
async function collection(session:string){const db=database();const [saved,reflection]=await Promise.all([db.prepare("SELECT item_key FROM bookmarks WHERE session_key = ? ORDER BY created_at DESC").bind(session).all<{item_key:string}>(),db.prepare("SELECT content FROM reflections WHERE session_key = ?").bind(session).first<{content:string}>()]);return {saved:saved.results.map(x=>allowed.get(x.item_key)).filter(Boolean),journal:reflection?.content||""};}
export async function GET(request:Request){try{const t=token(request)||newToken();return Response.json(await collection(await key(t)),{headers:headers(t)})}catch(e){console.error("Collection read failed",e);return Response.json({error:"Your collection is temporarily unavailable. Please try again later."},{status:503,headers:headers()})}}
async function readSmallBody(request:Request){if(Number(request.headers.get("content-length")||0)>30000)throw Error("BODY_LIMIT");const reader=request.body?.getReader();if(!reader)throw Error("INVALID_BODY");let total=0;const chunks:Uint8Array[]=[];while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>30000){await reader.cancel();throw Error("BODY_LIMIT")}chunks.push(value)}const bytes=new Uint8Array(total);let offset=0;for(const x of chunks){bytes.set(x,offset);offset+=x.length}return JSON.parse(new TextDecoder().decode(bytes));}
export async function POST(request:Request){
 if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({error:"Please save from this website."},{status:403,headers:headers()});
 const t=token(request);if(!t)return Response.json({error:"Please reload the page to start your collection."},{status:401,headers:headers()});
 if(!request.headers.get("content-type")?.includes("application/json"))return Response.json({error:"Invalid request format."},{status:415,headers:headers()});
 let body:any;try{body=await readSmallBody(request)}catch{return Response.json({error:"Please use a shorter reflection and try again."},{status:400,headers:headers()})}
 try{const session=await key(t);const db=database();if(body.action==="journal"){
 if(typeof body.journal!=="string"||body.journal.length>20000)return Response.json({error:"Reflections can contain up to 20,000 characters."},{status:400,headers:headers()});
 await db.prepare("INSERT INTO reflections (session_key, content, updated_at) VALUES (?, ?, ?) ON CONFLICT(session_key) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at").bind(session,body.journal,Date.now()).run();
 }else if(body.action==="save"||body.action==="remove"){
 if(typeof body.item?.key!=="string"||!allowed.has(body.item.key))return Response.json({error:"This item cannot be saved."},{status:400,headers:headers()});
 if(body.action==="save")await db.prepare("INSERT INTO bookmarks (session_key, item_key, created_at) VALUES (?, ?, ?) ON CONFLICT(session_key, item_key) DO NOTHING").bind(session,body.item.key,Date.now()).run();
 else await db.prepare("DELETE FROM bookmarks WHERE session_key = ? AND item_key = ?").bind(session,body.item.key).run();
 }else return Response.json({error:"Unknown collection action."},{status:400,headers:headers()});
 return Response.json(await collection(session),{headers:headers(t)});
 }catch(e){console.error("Collection write failed",e);return Response.json({error:"Your changes could not be saved. Please try again; your text is still here."},{status:503,headers:headers()})}
}
