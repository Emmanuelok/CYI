"use client";
import {Component,type ReactNode} from "react";
export default class ClientBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 render(){if(this.state.failed)return <section className="error-recovery"><h1>Let’s get you moving again.</h1><p>This page could not finish loading. Reload it or return to the CYI homepage.</p><div className="row" style={{justifyContent:"center",gap:20}}><button className="btn" onClick={()=>window.location.reload()}>Reload this page</button><a className="underlink" href="/">Return to CYI</a></div></section>;return this.props.children}
}
