import type { Metadata } from "next";

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://cyi-gilt.vercel.app").replace(/\/$/, "");
export const siteDescription = "Christ for Youth International. Find your community, grow in Christ, discover your gifts and make a difference. Explore our branches, camps, missions and media.";
const image = { url: "/og/cyi-share.jpg", width: 1200, height: 630, type: "image/jpeg", alt: "CYI — Christ for Youth International. Alive with Purpose. Faith. Friendship. Purpose." };

export function siteMetadata(title: string, path: string, description = siteDescription): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "en_GB",
      siteName: "Christ for Youth International",
      title,
      description,
      url: path,
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [{ url: image.url, alt: image.alt }] },
  };
}
