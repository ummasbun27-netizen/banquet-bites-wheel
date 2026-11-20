import { createFileRoute, redirect } from "@tanstack/react-router";

// The app opens on management; guests reach the menu at /menu through the QR code.
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Coffee Menu — Management" },
      { name: "description", content: "Manage your menu and download the QR code for your guests." },
      { property: "og:title", content: "Coffee Menu Management" },
      { property: "og:description", content: "Menu management and QR code." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: () => { throw redirect({ to: "/dashboard", replace: true }); },
});