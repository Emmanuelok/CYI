import CYIApp from "../cyi-app";
import { siteMetadata } from "@/lib/site-metadata";

export const metadata = siteMetadata("Install CYI", "/install", "Keep your CYI family one tap away. Add CYI to your iPhone, iPad, Android device or computer, with clear instructions for your browser.");

export default function InstallPage() {
  return <CYIApp route="install" />;
}
