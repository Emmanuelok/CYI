"use client";

import {useEffect,useRef,useState} from "react";
import type Player from "@vimeo/player";
import {Play,Pause,Volume2,VolumeX,ExternalLink,RotateCcw} from "lucide-react";
import {D} from "./cyi-shell";

const FILM_URL="https://vimeo.com/1210826257";
const EMBED_URL="https://player.vimeo.com/video/1210826257?background=1&controls=0&muted=1&loop=1&playsinline=1&autopause=1&dnt=1&title=0&byline=0&portrait=0";

type HeroFilmProps={onPlaybackChange:(playing:boolean)=>void};

export default function HeroFilm({onPlaybackChange}:HeroFilmProps){
 const mountRef=useRef<HTMLDivElement>(null);
 const frameRef=useRef<HTMLDivElement>(null);
 const playerRef=useRef<Player|null>(null);
 const aliveRef=useRef(false);
 const [attempt,setAttempt]=useState(0);
 const [ready,setReady]=useState(false);
 const [started,setStarted]=useState(false);
 const [playing,setPlaying]=useState(false);
 const [muted,setMuted]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");

 useEffect(()=>{
  let active=true;
  let player:Player|null=null;
  let inView=true;
  let rewinding=false;
  aliveRef.current=true;
  setReady(false);setStarted(false);setPlaying(false);setMuted(true);setError("");setNotice("");
  onPlaybackChange(false);
  const preference=window.matchMedia("(prefers-reduced-motion: reduce)");
  const pause=()=>{if(player)void player.pause().catch(()=>{});};
  const visibility=()=>{if(document.hidden)pause();};
  const motionChanged=()=>{if(preference.matches)pause();};
  const otherMedia=(event:Event)=>{if(event.target instanceof HTMLMediaElement)pause();};
  document.addEventListener("visibilitychange",visibility);
  document.addEventListener("play",otherMedia,true);
  preference.addEventListener("change",motionChanged);
  const observer=typeof IntersectionObserver!=="undefined"?new IntersectionObserver(entries=>{
   inView=!!entries[0]?.isIntersecting&&(entries[0]?.intersectionRatio??0)>=.15;
   if(!inView)pause();
  },{threshold:.15}):null;
  if(frameRef.current)observer?.observe(frameRef.current);
  const timeout=window.setTimeout(()=>{if(active)setError("The film is taking longer to load. Try again or open it on Vimeo.");},15000);

  void import("@vimeo/player").then(async({default:VimeoPlayer})=>{
   if(!active||!mountRef.current)return;
   // Vimeo owns this iframe so cleanup is safe during React remounts.
   const iframe=document.createElement("iframe");
   iframe.src=EMBED_URL+"&autoplay="+(preference.matches?"0":"1");
   iframe.title="CYI – Together: the Christ for Youth International film";
   iframe.allow="autoplay; fullscreen; picture-in-picture; encrypted-media";
   iframe.tabIndex=-1;
   iframe.setAttribute("aria-hidden","true");
   iframe.setAttribute("frameborder","0");
   mountRef.current.replaceChildren(iframe);
   player=new VimeoPlayer(iframe);
   playerRef.current=player;
   player.on("playing",()=>{
    if(!active)return;
    window.clearTimeout(timeout);
    setStarted(true);setPlaying(true);setError("");setNotice("");onPlaybackChange(true);
   });
   player.on("timeupdate",event=>{
    if(event.seconds>=45&&!rewinding&&player){
     rewinding=true;
     void player.setCurrentTime(0).catch(()=>{}).finally(()=>{rewinding=false;});
    }
   });
   player.on("pause",()=>{if(active){setPlaying(false);onPlaybackChange(false);}});
   player.on("volumechange",()=>{
    if(player)void player.getMuted().then(value=>{if(active)setMuted(value);}).catch(()=>{});
   });
   player.on("error",event=>{
    if(!active)return;
    setPlaying(false);onPlaybackChange(false);
    if(event.method==="play"&&event.name==="NotAllowedError"){
     setNotice("Tap play to start the film.");
    }else{
     setError("The film couldn’t play here. Please try again or open it on Vimeo.");
    }
   });
   await player.ready();
   if(!active)return;
   window.clearTimeout(timeout);
   setReady(true);setError("");
   await player.setMuted(true);
   if(!active)return;
   if(!preference.matches&&inView&&!document.hidden){
    try{await player.play();if(active){setStarted(true);setPlaying(true);onPlaybackChange(true);}}catch{if(active)setNotice("Tap play to start the background video.");}
   }
  }).catch(()=>{if(active){window.clearTimeout(timeout);setError("The film couldn’t load here. Please try again or open it on Vimeo.");}});

  return()=>{
   active=false;aliveRef.current=false;
   window.clearTimeout(timeout);
   observer?.disconnect();
   document.removeEventListener("visibilitychange",visibility);
   document.removeEventListener("play",otherMedia,true);
   preference.removeEventListener("change",motionChanged);
   playerRef.current=null;
   if(player)void player.destroy().catch(()=>{});
  };
 },[attempt,onPlaybackChange]);


 async function togglePlayback(){
  const player=playerRef.current;
  if(!player)return;
  try{
   if(playing)await player.pause();else await player.play();
  }catch{if(aliveRef.current)setNotice("The video could not start. Please try again.");}
 }
 async function toggleSound(){
  const player=playerRef.current;
  if(!player)return;
  try{const value=await player.setMuted(!muted);if(aliveRef.current)setMuted(value);}
  catch{if(aliveRef.current)setNotice("Sound is unavailable in this browser.");}
 }

 return <>
  <div className={"cinematic-background"+(started?" has-played":"")} ref={frameRef} aria-hidden="true">
   <img className="cinematic-poster" src={D.media.hero} alt="" fetchPriority="high"/>
   <div className="cinematic-video" ref={mountRef}/>
  </div>
  <div className="cinematic-shade" aria-hidden="true"/>
  <div className="cinematic-controls" role="group" aria-label="Background video controls">
   {error?<button onClick={()=>setAttempt(x=>x+1)} aria-label="Retry background video"><RotateCcw size={17}/><span>Retry video</span></button>:<button onClick={togglePlayback} disabled={!ready} aria-label={playing?"Pause background video":"Play background video"}>{playing?<Pause size={17}/>:<Play size={17}/>}<span>{playing?"Pause":"Play video"}</span></button>}
   <button onClick={toggleSound} disabled={!ready||!!error} aria-label={muted?"Turn background video sound on":"Mute background video"} aria-pressed={!muted}>{muted?<VolumeX size={18}/>:<Volume2 size={18}/>}<span>{muted?"Sound on":"Mute"}</span></button>
  </div>
  {(error||notice)&&<div className="cinematic-status" role="status"><p>{error||notice}</p>{error&&<a href={FILM_URL} target="_blank" rel="noreferrer">Watch the film <ExternalLink size={13}/></a>}</div>}
 </>;
}
