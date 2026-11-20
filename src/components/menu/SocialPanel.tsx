import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { socialAdminQuery } from "@/lib/menu-queries";
import { saveSocial } from "@/lib/social.functions";
import { socialLabels, type SocialAccount } from "@/lib/social";

const field = "w-full rounded-xl border border-border bg-input px-3.5 py-3 text-base outline-none transition focus:border-primary focus:ring-1 focus:ring-ring sm:text-sm";

export function SocialPanel() {
  const client = useQueryClient();
  const save = useServerFn(saveSocial);
  const { data } = useQuery(socialAdminQuery);
  const [rows, setRows] = useState<SocialAccount[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setRows(data); }, [data]);
  const set = (id: string, patch: Partial<SocialAccount>) => setRows((r) => r.map((a) => a.id === id ? { ...a, ...patch } : a));

  async function submit() {
    setBusy(true);
    try {
      await save({ data: { accounts: rows.map(({ id, url }) => ({ id, url: url.trim() })) } });
      await client.invalidateQueries({ queryKey: ["social"] });
      toast.success("Social accounts saved.");
    } catch (e) { toast.error(e instanceof Error && e.message.includes("https") ? "Links must start with https://" : "Could not save. Please try again."); }
    finally { setBusy(false); }
  }

  return <>
    <h1 className="text-2xl font-semibold">Social media</h1>
    <p className="mt-1 text-sm text-muted-foreground">Guests see these in the comment window. Leave a link empty to hide that account.</p>
    <div className="mt-5 space-y-3">
      {rows.map((a) => <div key={a.id} className="rounded-2xl border border-border bg-card p-4">
        <p className="font-semibold">{socialLabels[a.id]}</p>
        <div className="mt-3 grid gap-3">
          <input aria-label={`${socialLabels[a.id]} link`} className={field} placeholder="https://..." value={a.url} onChange={(e) => set(a.id, { url: e.target.value })} />
        </div>
      </div>)}
    </div>
    <Button size="lg" className="mt-5 rounded-xl" disabled={busy || !rows.length} onClick={() => void submit()}><Save />{busy ? "Saving..." : "Save"}</Button>
  </>;
}
