import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { menuQuery } from "@/lib/menu-queries";
import { menuImage, menuThumbWebp } from "@/lib/menu-images";
import { LOGO_JPEG, LOGO_WEBP } from "@/lib/logo";
import { MenuPhoto } from "@/components/menu/MenuPhoto";
import { useMemo, useState } from "react";
import { FerrisWheel, Heart, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductSheet } from "@/components/menu/ProductSheet";
import { CommentBox } from "@/components/menu/CommentBox";
import { GuestWheel } from "@/components/menu/GuestWheel";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Coffee Menu — Hot, Iced & Frappuccino" },
      { name: "description", content: "Discover our espresso, flat white, iced latte and frappuccino drinks." },
      { property: "og:title", content: "Coffee Menu" },
      { property: "og:description", content: "Discover our hot and iced coffee menu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(menuQuery),
  component: Menu,
});

type Item = { id: string; name: string; category: string; price: number; old?: number | undefined; img: string; desc: string };

const SORTS = [
  { id: "default", label: "Recommended" },
  { id: "asc", label: "Price: Low to High" },
  { id: "desc", label: "Price: High to Low" },
];

function Menu() {
  const { data } = useSuspenseQuery(menuQuery);
  const CATEGORIES = useMemo(() => [{ id: "all", label: "All" }, ...data.categories.map((c) => ({ id: c.id, label: c.name }))], [data]);
  const ITEMS: Item[] = useMemo(() => data.items.map((i) => ({ id: i.id, name: i.name, category: i.category_id, price: Number(i.price), old: i.old_price == null ? undefined : Number(i.old_price), img: menuImage(i.image), desc: i.description })), [data]);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("default");
  const [showSort, setShowSort] = useState(false);
  const [favs, setFavs] = useState<string[]>([]);
  const [wheel, setWheel] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const toggleFav = (id: string) => setFavs((f) => f.includes(id) ? f.filter((x) => x !== id) : [...f, id]);
  const openItem = ITEMS.find((i) => i.id === openId);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("en");
    let list = q
      ? ITEMS.filter((i) => (i.name + " " + i.desc).toLocaleLowerCase("en").includes(q))
      : category === "all" ? ITEMS : ITEMS.filter((i) => i.category === category);
    if (sort === "asc") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "desc") list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [category, query, sort, ITEMS]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-lg px-4 pb-10">
      <header className="relative -mx-4 h-44 overflow-hidden bg-cream">
        <Button type="button" variant="secondary" size="icon" onClick={() => setWheel(true)} aria-label="Lucky Wheel" title="Lucky Wheel" className="absolute left-4 top-4 z-10 size-11 rounded-full [&_svg]:size-6"><FerrisWheel strokeWidth={1.75} /></Button>
        <picture>
          <source srcSet={LOGO_WEBP} type="image/webp" />
          <img
            src={LOGO_JPEG}
            alt="Ummasbun Coffee"
            width={1024}
            height={398}
            loading="eager"
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
        </picture>
      </header>

      <CommentBox />

      <nav className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4">
        {CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => { setCategory(c.id); setQuery(""); }}
            className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${category === c.id && !query ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
            {c.label}
          </button>
        ))}
      </nav>

      <div className="relative mt-4 flex items-center gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-full bg-input px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search coffee..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </label>
        <button aria-label="Sort" onClick={() => setShowSort((s) => !s)}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <SlidersHorizontal className="h-4 w-4" />
        </button>
        {showSort && (
          <div className="absolute right-0 top-12 z-10 w-44 rounded-2xl bg-card p-2 shadow-xl">
            {SORTS.map((s) => (
              <button key={s.id} onClick={() => { setSort(s.id); setShowSort(false); }}
                className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${sort === s.id ? "bg-secondary text-primary" : "text-card-foreground"}`}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">The coffee you're looking for isn't on the menu.</p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-4">
          {visible.map((item, index) => {
            const fav = favs.includes(item.id);
            return (
              <article key={item.id} className="card-press cursor-pointer rounded-3xl bg-card p-2.5" role="button" tabIndex={0} aria-label={`${item.name} details`} onClick={() => setOpenId(item.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(item.id); } }}>
                <div className="relative">
                  <MenuPhoto src={item.img} webp={menuThumbWebp(item.img)} alt={item.name} size={480} priority={index < 2}
                    className="aspect-square w-full rounded-2xl object-cover" />
                  <button aria-label="Favorite"
                    onClick={(e) => { e.stopPropagation(); toggleFav(item.id); }}
                    className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-overlay text-foreground backdrop-blur">
                    <Heart className={`h-4 w-4 ${fav ? "fill-primary text-primary" : ""}`} />
                  </button>
                </div>
                <div className="px-1.5 pb-1.5 pt-3">
                  <h3 className="truncate font-medium">{item.name}</h3>
                  <p className="mt-1 flex items-baseline gap-2">
                    <span className="font-semibold text-primary">{item.price} Birr</span>
                    {item.old && <span className="text-xs text-muted-foreground line-through">{item.old} Birr</span>}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <GuestWheel open={wheel} onOpenChange={setWheel} />
      <ProductSheet
        item={openItem ? { ...openItem, categoryName: data.categories.find((c) => c.id === openItem.category)?.name } : null}
        fav={openId ? favs.includes(openId) : false}
        onToggleFav={() => { if (openId) toggleFav(openId); }}
        onClose={() => setOpenId(null)}
      />
    </main>
  );
}
