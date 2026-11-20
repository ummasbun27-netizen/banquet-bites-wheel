import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Coffee, LayoutGrid, UtensilsCrossed, QrCode, Plus, Pencil, Trash2, Download, Copy, Search, Eye, EyeOff, Check, ImageOff, MessageSquareText, MailOpen, Mail, FerrisWheel, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { Tables } from "@/integrations/supabase/types";
import { dashboardQuery, commentsQuery } from "@/lib/menu-queries";
import { saveItem, saveCategory, deleteEntry, setItemAvailability, markComment, deleteComment } from "@/lib/menu.functions";
import { itemSchema } from "@/lib/menu-schema";
import { menuImage } from "@/lib/menu-images";
import { PhotoUploader } from "@/components/menu/PhotoUploader";
import { WheelPanel } from "@/components/menu/WheelPanel";
import { SocialPanel } from "@/components/menu/SocialPanel";
import { publishedMenuUrl, resolvedGuestMenuUrl } from "@/lib/menu-url";

export const Route = createFileRoute("/dashboard")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  head: () => ({ meta: [
    { title: "Dashboard — Coffee Menu" }, { name: "description", content: "Manage your categories, products, prices and menu QR code." },
    { property: "og:title", content: "Coffee Menu Dashboard" }, { property: "og:description", content: "Menu and category management." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { name: "robots", content: "noindex" },
  ] }), component: Dashboard,
});

type Item = Tables<"menu_items">;
type Category = Tables<"menu_categories">;
type Tab = "items" | "categories" | "comments" | "wheel" | "social" | "qr";
const field = "w-full rounded-xl border border-border bg-input px-3.5 py-3 text-base outline-none transition focus:border-primary focus:ring-1 focus:ring-ring sm:text-sm";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-sm font-medium">{label}</span>{hint && <span className="ml-1.5 text-xs text-muted-foreground">{hint}</span>}{children}</label>;
}

function Dashboard() {
  const [menuUrl, setMenuUrl] = useState<string | null>(publishedMenuUrl);
  useEffect(() => { setMenuUrl(resolvedGuestMenuUrl(window.location.origin)); }, []);
  const { data } = useSuspenseQuery(dashboardQuery);
  const client = useQueryClient();
  const saveProduct = useServerFn(saveItem); const saveCat = useServerFn(saveCategory); const remove = useServerFn(deleteEntry); const setAvailability = useServerFn(setItemAvailability);
  const comments = useQuery({ ...commentsQuery, refetchInterval: 30000 });
  const markRead = useServerFn(markComment); const removeComment = useServerFn(deleteComment);
  const [toggling, setToggling] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("items");
  const [search, setSearch] = useState(""); const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Partial<Item> | null>(null);
  const [category, setCategory] = useState<Partial<Category> | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; kind: "item" | "category"; name: string } | null>(null);
  const [saving, setSaving] = useState(false); const [photoBusy, setPhotoBusy] = useState(false); const qr = useRef<HTMLDivElement>(null);

  async function refresh() { await client.invalidateQueries({ queryKey: ["dashboard"] }); await client.invalidateQueries({ queryKey: ["menu"] }); }
  async function submitItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!editing) return;
    const values = new FormData(e.currentTarget);
    const parsed = itemSchema.safeParse({ id: editing.id, name: values.get("name"), category_id: values.get("category_id"), description: values.get("description") ?? "", price: Number(values.get("price")), old_price: values.get("old_price") ? Number(values.get("old_price")) : null, image: editing.image ?? "", available: editing.available ?? true, position: Number(values.get("position") ?? 0) });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Check the fields."); return; }
    setSaving(true);
    try { await saveProduct({ data: parsed.data }); await refresh(); setEditing(null); toast.success("Product saved."); } catch (err) { toast.error(err instanceof Error ? err.message : "Could not save."); } finally { setSaving(false); }
  }
  async function submitCategory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!category) return;
    const values = new FormData(e.currentTarget); setSaving(true);
    try { await saveCat({ data: { id: category.id, name: String(values.get("name")), position: Number(values.get("position")) } }); await refresh(); setCategory(null); toast.success("Category saved."); } catch { toast.error("Category could not be saved."); } finally { setSaving(false); }
  }
  async function confirmDelete() {
    if (!deleting) return; setSaving(true);
    try { await remove({ data: deleting }); await refresh(); setDeleting(null); toast.success("Deleted."); } catch (err) { toast.error(err instanceof Error ? err.message : "Could not delete."); } finally { setSaving(false); }
  }
  async function toggleItem(item: Item, available: boolean) {
    setToggling(item.id);
    client.setQueryData(dashboardQuery.queryKey, (old) => old ? { ...old, items: old.items.map((i) => i.id === item.id ? { ...i, available } : i) } : old);
    try { await setAvailability({ data: { id: item.id, available } }); toast.success(available ? `${item.name} is shown on the menu.` : `${item.name} hidden.`); }
    catch { toast.error("Product status could not be changed."); }
    finally { await refresh(); setToggling(null); }
  }
  async function setRead(id: string, is_read: boolean) {
    client.setQueryData(commentsQuery.queryKey, (old) => old?.map((c) => c.id === id ? { ...c, is_read } : c));
    try { await markRead({ data: { id, is_read } }); } catch { toast.error("Comment could not be updated."); }
    finally { await client.invalidateQueries({ queryKey: ["comments"] }); }
  }
  async function removeOne(id: string) {
    try { await removeComment({ data: { id } }); await client.invalidateQueries({ queryKey: ["comments"] }); toast.success("Comment deleted."); } catch { toast.error("Comment could not be deleted."); }
  }
  async function downloadQr() {
    const svg = qr.current?.querySelector("svg"); if (!svg) return;
    const exported = svg.cloneNode(true);
    if (!(exported instanceof SVGElement)) return;
    const sourceShapes = svg.querySelectorAll("[fill]");
    exported.querySelectorAll("[fill]").forEach((shape, index) => {
      const source = sourceShapes[index];
      if (source) shape.setAttribute("fill", getComputedStyle(source).fill);
    });
    exported.setAttribute("width", "960");
    exported.setAttribute("height", "960");
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(exported)], { type: "image/svg+xml" }));
    try {
      const image = new Image(); image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 1200; canvas.height = 1200;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image export unavailable.");
      context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--qr-background").trim();
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, (canvas.width - image.width) / 2, (canvas.height - image.height) / 2);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png"); link.download = "coffee-menu-qr.png";
      document.body.appendChild(link); link.click(); link.remove();
    } catch { toast.error("QR image could not be downloaded. Please try again."); }
    finally { URL.revokeObjectURL(url); }
  }

  const categoryName = (id: string) => data.categories.find((c) => c.id === id)?.name ?? "";
  const hiddenCount = data.items.filter((i) => !i.available).length;
  const products = data.items.filter((i) => (filter === "hidden" ? !i.available : !filter || i.category_id === filter) && i.name.toLocaleLowerCase("en").includes(search.toLocaleLowerCase("en")));
  const tabs: { id: Tab; label: string; icon: typeof Coffee; count?: number | undefined }[] = [
    { id: "items", label: "Products", icon: UtensilsCrossed, count: data.items.length },
    { id: "categories", label: "Categories", icon: LayoutGrid, count: data.categories.length },
    { id: "comments", label: "Comments", icon: MessageSquareText, count: comments.data?.filter((c) => !c.is_read).length || undefined },
    { id: "wheel", label: "Wheel", icon: FerrisWheel },
    { id: "social", label: "Social", icon: Share2 },
    { id: "qr", label: "QR code", icon: QrCode },
  ];
  const newItem = () => setEditing({ available: true, image: "", category_id: filter || data.categories[0]?.id || "", position: data.items.length + 1 });

  return <main className="min-h-screen pb-16">
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><Coffee className="size-5" /></div>
          <div><p className="font-semibold leading-tight">Coffee Menu</p><p className="text-xs text-muted-foreground">Dashboard</p></div>
        </div>
        <Button variant="outline" size="sm" asChild><Link to="/menu"><Eye />View menu</Link></Button>
      </div>
      <nav className="mx-auto grid max-w-5xl grid-cols-5 gap-1 px-4 pb-3" aria-label="Dashboard sections">
        {tabs.map((t) => <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined}
          className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs sm:flex-row sm:gap-2 sm:px-3 sm:py-2.5 sm:text-sm font-medium transition-colors ${tab === t.id ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}>
          <t.icon className="size-4 shrink-0" /><span className="whitespace-nowrap">{t.label}</span>
          {t.count !== undefined && <span className={`absolute right-1 top-1 rounded-full px-1.5 text-[10px] sm:static sm:text-xs ${tab === t.id ? "bg-primary-foreground/15" : "bg-secondary"}`}>{t.count}</span>}
        </button>)}
      </nav>
    </header>

    <section className="mx-auto max-w-5xl px-4 pt-6">
      {tab === "items" && <>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="text-2xl font-semibold">Products</h1><p className="mt-1 text-sm text-muted-foreground">{data.items.filter((i) => i.available).length} products visible on the menu</p></div>
          <Button size="lg" className="rounded-xl px-5" disabled={!data.categories.length} onClick={newItem}><Plus />Add new product</Button>
        </div>
        {!data.categories.length && <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center"><p className="text-sm text-muted-foreground">Create a category before adding products.</p><Button className="mt-4" variant="secondary" onClick={() => setTab("categories")}><Plus />Add category</Button></div>}
        <label className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-card px-3.5"><Search className="size-4 text-muted-foreground" /><input aria-label="Search products" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full min-w-0 bg-transparent py-3 text-base outline-none sm:text-sm" /></label>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Category filter">
          {[{ id: "", name: "All" }, ...data.categories].map((c) => <button key={c.id || "all"} type="button" onClick={() => setFilter(c.id)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors ${filter === c.id ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>{c.name}</button>)}
          {hiddenCount > 0 && <button type="button" onClick={() => setFilter("hidden")}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition-colors ${filter === "hidden" ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
            <EyeOff className="size-3.5" />Hidden<span className="rounded-full bg-secondary px-1.5 text-xs">{hiddenCount}</span>
          </button>}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((i) => <article key={i.id} className="flex flex-col rounded-2xl border border-border bg-card p-3">
            <div className="flex gap-3">
              {i.image ? <img src={menuImage(i.image)} alt={i.name} className={`size-20 shrink-0 rounded-xl object-cover ${i.available ? "" : "opacity-50"}`} /> : <div className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground"><ImageOff className="size-5" /></div>}
              <div className="min-w-0 flex-1">
                <h2 className="break-words font-medium leading-snug">{i.name}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{categoryName(i.category_id)}</p>
                <p className="mt-1.5 font-semibold text-primary">{i.price} Birr {i.old_price && <span className="ml-1 text-xs font-normal text-muted-foreground line-through">{i.old_price} Birr</span>}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
              <label className={`mr-auto inline-flex cursor-pointer items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs font-medium ${i.available ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"}`}>
                <Switch aria-label={`${i.name} show on menu`} checked={i.available} disabled={toggling === i.id} onCheckedChange={(available) => void toggleItem(i, available)} className="data-[state=checked]:bg-success data-[state=unchecked]:bg-muted-foreground/40" />
                {i.available ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}{i.available ? "On menu" : "Hidden"}
              </label>
              <Button size="sm" variant="secondary" aria-label={`${i.name} edit`} onClick={() => setEditing(i)}><Pencil />Edit</Button>
              <Button size="sm" variant="ghost" aria-label={`${i.name} delete`} className="text-destructive hover:text-destructive" onClick={() => setDeleting({ id: i.id, kind: "item", name: i.name })}><Trash2 />Delete</Button>
            </div>
          </article>)}
        </div>
        {!products.length && data.categories.length > 0 && <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No products found.</p>}
      </>}

      {tab === "categories" && <>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="text-2xl font-semibold">Categories</h1><p className="mt-1 text-sm text-muted-foreground">Menu sections, ordered by their position number</p></div>
          <Button size="lg" className="rounded-xl px-5" onClick={() => setCategory({ position: data.categories.length + 1 })}><Plus />New category</Button>
        </div>
        <div className="mt-6 space-y-3">
          {data.categories.map((c) => <article key={c.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-sm font-semibold text-primary">{c.position}</span>
            <div className="min-w-0 flex-1"><h2 className="break-words font-medium">{c.name}</h2><p className="text-xs text-muted-foreground">{data.items.filter((i) => i.category_id === c.id).length} products</p></div>
            <Button size="sm" variant="secondary" aria-label={`${c.name} edit`} onClick={() => setCategory(c)}><Pencil />Edit</Button>
            <Button size="icon" variant="ghost" title="Delete category" aria-label={`${c.name} delete`} className="text-destructive hover:text-destructive" onClick={() => setDeleting({ id: c.id, kind: "category", name: c.name })}><Trash2 /></Button>
          </article>)}
          {!data.categories.length && <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No categories yet.</p>}
        </div>
      </>}

      {tab === "comments" && <>
        <h1 className="text-2xl font-semibold">Comments</h1>
        <p className="mt-1 text-sm text-muted-foreground">Comments sent by guests. Only you can see them.</p>
        <div className="mt-6 space-y-3">
          {comments.isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {comments.isError && <p className="text-sm text-destructive">Comments could not be loaded.</p>}
          {comments.data?.map((c) => <article key={c.id} className={`rounded-2xl border p-4 ${c.is_read ? "border-border bg-card/60" : "border-primary/40 bg-card"}`}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {!c.is_read && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">New</span>}
              <h2 className="font-medium">{c.author_name || "Anonymous guest"}</h2>
              <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">{c.message}</p>
            <div className="mt-3 flex gap-2 border-t border-border pt-3">
              <Button size="sm" variant="secondary" onClick={() => void setRead(c.id, !c.is_read)}>{c.is_read ? <><Mail />Mark unread</> : <><MailOpen />Read</>}</Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => void removeOne(c.id)}><Trash2 />Delete</Button>
            </div>
          </article>)}
          {comments.data && !comments.data.length && <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No comments yet.</p>}
        </div>
      </>}

      {tab === "wheel" && <WheelPanel />}
      {tab === "social" && <SocialPanel />}

      {tab === "qr" && <>
        <h1 className="text-2xl font-semibold">QR code</h1>
        <p className="mt-1 text-sm text-muted-foreground">Guests scan this code to open the menu on their phones</p>
        <div className="mt-6 grid items-start gap-6 md:grid-cols-[300px_1fr]">
          <div className="qr-paper rounded-2xl p-7 text-center">
            <Coffee className="mx-auto size-7" />
            <h2 className="mb-5 mt-3 text-xl font-medium">Coffee Menu</h2>
            <div ref={qr} className="mx-auto flex aspect-square w-full max-w-[232px] items-center justify-center">
              {menuUrl ? <QRCodeSVG value={menuUrl} size={232} marginSize={2} level="M" bgColor="var(--qr-background)" fgColor="var(--qr-foreground)" /> : <QrCode className="size-24 opacity-40" strokeWidth={1} />}
            </div>
            <p className="mt-5 text-sm">{menuUrl ? "Scan for the menu" : "QR code is not ready yet"}</p>
          </div>
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
            {menuUrl ? <div><p className="mb-2 text-xs font-medium text-muted-foreground">MENU LINK</p><p className="break-all rounded-xl bg-secondary p-3 text-sm">{menuUrl}</p></div> : <p role="status" className="text-sm text-muted-foreground">The site must be published for the QR code.</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button size="lg" className="rounded-xl" disabled={!menuUrl} onClick={downloadQr}><Download />Download QR code</Button>
              <Button size="lg" className="rounded-xl" disabled={!menuUrl} variant="outline" onClick={async () => { if (!menuUrl) return; try { await navigator.clipboard.writeText(menuUrl); toast.success("Link copied."); } catch { toast.error("Could not copy the link."); } }}><Copy />Copy link</Button>
            </div>
          </div>
        </div>
      </>}
    </section>

    <Dialog open={editing !== null} onOpenChange={(open) => { if (!open && !saving) setEditing(null); }}>
      <DialogContent className="max-h-[92dvh] w-[calc(100%-1.5rem)] overflow-y-auto rounded-2xl p-5">
        <DialogTitle className="text-xl">{editing?.id ? "Edit product" : "Add new product"}</DialogTitle>
        <DialogDescription>Upload its photo and enter its name and price.</DialogDescription>
        {editing && <form onSubmit={submitItem} className="space-y-4">
          <PhotoUploader value={editing.image ?? ""} onChange={(image) => setEditing((current) => current ? { ...current, image } : current)} onBusyChange={setPhotoBusy} />
          <Field label="Product name"><input className={field} name="name" required maxLength={120} placeholder="e.g. Latte" defaultValue={editing.name} /></Field>
          <Field label="Category"><select className={field} name="category_id" defaultValue={editing.category_id ?? data.categories[0]?.id}>{data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (Birr)"><input className={field} type="number" inputMode="decimal" step="0.01" min="0" name="price" required placeholder="0" defaultValue={editing.price} /></Field>
            <Field label="Old price" hint="optional"><input className={field} type="number" inputMode="decimal" step="0.01" min="0" name="old_price" placeholder="For discounts" defaultValue={editing.old_price ?? ""} /></Field>
          </div>
          <Field label="Description" hint="optional"><textarea className={`${field} min-h-20`} name="description" maxLength={500} placeholder="Write a short description" defaultValue={editing.description} /></Field>
          <div className="flex items-center justify-between gap-4 rounded-xl bg-secondary p-3.5">
            <div><p className="text-sm font-medium">Show on menu</p><p className="text-xs text-muted-foreground">When off, guests won't see this product</p></div>
            <Switch aria-label="Show on menu" checked={editing.available ?? true} onCheckedChange={(available) => setEditing((current) => current ? { ...current, available } : current)} />
          </div>
          <Field label="Menu position"><input className={`${field} w-28`} type="number" min="0" name="position" defaultValue={editing.position ?? 0} /></Field>
          <Button size="lg" disabled={saving || photoBusy} className="w-full rounded-xl" type="submit"><Check />{saving ? "Saving..." : photoBusy ? "Uploading photo..." : "Save"}</Button>
        </form>}
      </DialogContent>
    </Dialog>

    <Dialog open={category !== null} onOpenChange={(open) => { if (!open && !saving) setCategory(null); }}>
      <DialogContent className="w-[calc(100%-1.5rem)] rounded-2xl p-5">
        <DialogTitle className="text-xl">{category?.id ? "Edit category" : "New category"}</DialogTitle>
        <DialogDescription>For example "Hot drinks" or "Desserts".</DialogDescription>
        {category && <form onSubmit={submitCategory} className="space-y-4">
          <Field label="Category name"><input name="name" required maxLength={80} className={field} defaultValue={category.name} /></Field>
          <Field label="Menu position"><input name="position" type="number" min="0" required className={`${field} w-28`} defaultValue={category.position} /></Field>
          <Button size="lg" disabled={saving} className="w-full rounded-xl" type="submit"><Check />Save</Button>
        </form>}
      </DialogContent>
    </Dialog>

    <Dialog open={deleting !== null} onOpenChange={(open) => { if (!open && !saving) setDeleting(null); }}>
      <DialogContent className="w-[calc(100%-1.5rem)] rounded-2xl p-5">
        <DialogTitle>Do you want to delete?</DialogTitle>
        <DialogDescription>"{deleting?.name}" will be permanently deleted.</DialogDescription>
        <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => setDeleting(null)} disabled={saving}>Cancel</Button><Button variant="destructive" onClick={confirmDelete} disabled={saving}><Trash2 />Delete</Button></div>
      </DialogContent>
    </Dialog>
  </main>;
}
