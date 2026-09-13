import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "CYI — Alive with Purpose",
    short_name: "CYI",
    description: "Your CYI family, wherever life takes you. Explore communities, experiences and daily encouragement.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#120b22",
    theme_color: "#120b22",
    lang: "en",
    categories: ["lifestyle", "education", "social"],
    prefer_related_applications: false,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Find your CYI family", short_name: "Branches", description: "Explore CYI communities near you", url: "/branches", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Precious Moments", short_name: "Read", description: "Make room for a moment of encouragement", url: "/precious-moments", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Camps & experiences", short_name: "Experiences", description: "Discover your next CYI experience", url: "/environments", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
