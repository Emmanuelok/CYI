"use client";
import {useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent} from "react";
import data from "./content.json";

const eventName = "cyi:navigate";
const aliases: Record<string,string> = {"my-cyi-story":"stories","family-games":"programmes/family-games","savedtoserve":"programmes/saved-2-serve"};
export function resolvePath(path:string) {
  let route=path.split(/[?#]/)[0].replace(/^\/+|\/+$/g,"");
  route=aliases[route]||route;
  if(data.devotionals.some(x=>x.slug===route))route="devotionals/"+route;
  if(data.projects.some(x=>x.slug===route))route="projects/"+route;
  return route||"home";
}
function subscribe(listener:()=>void){window.addEventListener(eventName,listener);window.addEventListener("popstate",listener);window.addEventListener("hashchange",listener);return()=>{window.removeEventListener(eventName,listener);window.removeEventListener("popstate",listener);window.removeEventListener("hashchange",listener)}}
export function useAppLocation(serverRoute="home") {return useSyncExternalStore(subscribe,()=>window.location.pathname+window.location.search+window.location.hash,()=>serverRoute==="home"?"/":"/"+serverRoute)}

export default function Link({href="/",onClick,children,...props}:AnchorHTMLAttributes<HTMLAnchorElement>){
  function navigate(e:MouseEvent<HTMLAnchorElement>){
    onClick?.(e);
    if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||props.target||props.download)return;
    if(document.querySelector?.("[data-cyi-not-found]"))return;
    const url=new URL(href,window.location.href);
    if(url.origin!==window.location.origin||!/^https?:$/.test(url.protocol))return;
    e.preventDefault();
    const next=url.pathname+url.search+url.hash;
    if(next!==window.location.pathname+window.location.search+window.location.hash)window.history.pushState({},"",next);
    window.dispatchEvent(new Event(eventName));
    if(url.hash)requestAnimationFrame(()=>document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView({behavior:"smooth"}));
    else {window.scrollTo({top:0,left:0,behavior:"instant"});requestAnimationFrame(()=>{const main=document.getElementById("main-content");main?.focus({preventScroll:true})})}
  }
  return <a {...props} href={href} onClick={navigate}>{children}</a>;
}
