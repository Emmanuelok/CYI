import type { Metadata } from "next";
import "./globals.css";
import "./redesign.css";
import "./electric.css";
import CYIShell from "./cyi-shell";
export const metadata: Metadata = {title:{default:"CYI | Alive with Purpose.",template:"%s | CYI"},description:"Christ for Youth International. Find your community, grow in Christ, discover your gifts and make a difference. Explore our branches, camps, missions and media.",icons:{icon:"/favicon.png",shortcut:"/favicon.png"}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body><CYIShell>{children}</CYIShell></body></html>;}
