import { createFileRoute, redirect } from "@tanstack/react-router";

// Preserve old management bookmarks; the dashboard sends signed-out visitors to /login.
export const Route = createFileRoute("/auth")({
  beforeLoad: () => { throw redirect({ to: "/dashboard", replace: true }); },
});
