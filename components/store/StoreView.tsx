"use client";

import { useState, useEffect, useRef } from "react";
import { type StoreContent, type StoreProduct, ACCENTS, FONT_FAMILY, WIDTH_PX } from "@/lib/store";
import StoreCheckout from "./StoreCheckout";

/** Storefront renderer. Namespaced under .storeview. Products are the seller's
 * store catalog (passed in on the live site; sample set in the builder). */
export default function StoreView({
  content: c, device = "web", stage = false, products, payEnabled = false,
}: { content: StoreContent; device?: "web" | "mobile"; stage?: boolean; products?: StoreProduct[]; payEnabled?: boolean }) {
  const [buyP, setBuyP] = useState<StoreProduct | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState("featured");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [wish, setWish] = useState<Record<string, boolean>>({});
  const [drawer, setDrawer] = useState<"none" | "cart" | "acct">("none");
  const rootRef = useRef<HTMLDivElement>(null);

  // auto-advance the banner + top-selling carousels
  useEffect(() => {
    const root = rootRef.current; if (!root) return;
    const tracks = Array.from(root.querySelectorAll<HTMLElement>("[data-auto]"));
    if (!tracks.length) return;
    const id = setInterval(() => {
      tracks.forEach((tr) => {
        const step = tr.firstElementChild ? (tr.firstElementChild as HTMLElement).offsetWidth + 16 : tr.clientWidth;
        const nl = tr.scrollLeft >= tr.scrollWidth - tr.clientWidth - 4 ? 0 : tr.scrollLeft + step;
        tr.scrollTo({ left: nl, behavior: "smooth" });
      });
    }, 3800);
    return () => clearInterval(id);
  }, [c]);

  // products = the seller's real published products (passed in) + any quick inline
  // items; in the builder (no real products) we show samples so the design is visible.
  const SAMPLE: StoreProduct[] = [
    { id: "s1", name: "Calm Masterclass", cat: "Courses", price: "₹999", compareAt: "₹2,999", rating: "4.9", badge: "Bestseller", url: "#" },
    { id: "s2", name: "Ebook Bundle", cat: "Ebooks", price: "₹399", compareAt: "₹799", rating: "4.8", url: "#" },
    { id: "s3", name: "Audio Pack", cat: "Audio", price: "₹299", compareAt: "₹599", rating: "4.7", url: "#" },
    { id: "s4", name: "Habit Templates", cat: "Templates", price: "₹199", compareAt: "₹499", rating: "4.6", badge: "New", url: "#" },
  ];
  const inline: StoreProduct[] = (c.products ?? []).map((p) => ({
    id: p.id, name: p.name, cat: p.cat || "Shop", price: p.price, compareAt: p.compareAt,
    img: p.img, rating: p.rating, badge: p.badge, url: p.url || "#",
  }));
  const real = products ?? [];
  const items: StoreProduct[] = (inline.length || real.length) ? [...inline, ...real] : SAMPLE;

  const grad = c.accentColor
    ? `linear-gradient(135deg, ${c.accentColor}, color-mix(in srgb, ${c.accentColor} 70%, #000))`
    : (ACCENTS[c.accent ?? 0]?.[1] ?? ACCENTS[0][1]);
  const fontFam = FONT_FAMILY[c.font ?? "sora"] ?? "'Sora'";
  const ww = WIDTH_PX[c.pageWidth ?? "wide"] ?? 1400;
  const bt = c.btshape ? `bt${c.btshape}` : "btsoft";
  const m = device === "mobile" ? " m" : "";
  const order = c.order ?? [];
  const sections = c.sections ?? {};
  const head = (k: string, dt: string) => c.heads?.[k]?.title ?? dt;

  const cats = ["all", ...Array.from(new Set(items.map((p) => p.cat).filter(Boolean)))];
  const num = (s?: string) => parseFloat((s || "").replace(/[^0-9.]/g, "")) || 0;
  let list = items.filter((p) => cat === "all" || p.cat === cat);
  if (q.trim()) list = list.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));
  if (sort === "low") list = [...list].sort((a, b) => num(a.price) - num(b.price));
  else if (sort === "high") list = [...list].sort((a, b) => num(b.price) - num(a.price));
  else if (sort === "rated") list = [...list].sort((a, b) => num(b.rating) - num(a.rating));
  const topSelling = [...items].sort((a, b) => num(b.rating) - num(a.rating)).slice(0, 6);

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const addCart = (id: string) => { setCart((p) => ({ ...p, [id]: (p[id] || 0) + 1 })); setDrawer("cart"); };
  // Buy a single product inline (live site only); samples in the builder are inert.
  const go = (p?: StoreProduct | null) => { if (!p) return; if (p.buyable) { if (stage) { setDrawer("none"); setBuyP(p); } } else if (p.url && p.url !== "#") window.location.href = p.url; };
  // Clicking a product opens its detail page in a new tab; sample cards are inert.
  const hasPage = (p: StoreProduct) => !!p.url && p.url !== "#";
  const openPDP = (p: StoreProduct) => (e: React.MouseEvent) => { if (!hasPage(p)) e.preventDefault(); };
  const subtotal = Object.keys(cart).reduce((s, id) => s + num(items.find((p) => p.id === id)?.price) * cart[id], 0);
  const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

  const logo = c.logo
    ? // eslint-disable-next-line @next/next/no-img-element
      <img src={c.logo} alt={c.store || ""} />
    : <><span className="d" />{c.store || "Your store"}</>;

  const Card = (p: StoreProduct) => (
    <div className="pc" key={p.id}>
      <a className="pcimg" href={p.url} target={hasPage(p) ? "_blank" : undefined} rel="noreferrer" onClick={openPDP(p)} style={p.img ? { backgroundImage: `url('${p.img}')` } : undefined}>
        {p.badge && <span className="pcbadge">{p.badge}</span>}
        <button className={`wish${wish[p.id] ? " on" : ""}`} onClick={(e) => { e.preventDefault(); setWish((w) => ({ ...w, [p.id]: !w[p.id] })); }}>♥</button>
      </a>
      <div className="pcb">
        <div className="pccat">{p.cat}</div>
        <a className="pcname" href={p.url} target={hasPage(p) ? "_blank" : undefined} rel="noreferrer" onClick={openPDP(p)}>{p.name}</a>
        {p.rating && <div className="pcrate"><span className="st">★</span> <b>{p.rating}</b></div>}
        <div className="pcprice">{p.price && <span className="po">{p.price}</span>}{p.compareAt && <span className="pr">{p.compareAt}</span>}</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="addc" onClick={() => addCart(p.id)}>Add to cart</button>
          {p.buyable && <button className="addc buynow" onClick={() => go(p)}>Buy now</button>}
        </div>
      </div>
    </div>
  );

  const REN: Record<string, () => React.ReactNode> = {
    banner: () => (
      <div className="bannerwrap" data-sec="banner" key="banner">
        <div className="bstrack" data-auto>{(c.banner ?? []).map((b, i) => (
          <div className="bslide" key={i} style={b.img ? { backgroundImage: `url('${b.img}')` } : undefined}>
            <div className="bc"><h2>{b.heading}</h2><p>{b.sub}</p>{b.cta && <a className="bcta" href={b.url || "#"}>{b.cta}</a>}</div>
          </div>
        ))}</div>
      </div>
    ),
    brands: () => {
      const make = (pfx: string) => (c.brandLogos?.length
        ? c.brandLogos.map((g, i) => /* eslint-disable-next-line @next/next/no-img-element */ <img className="bimg" key={pfx + i} src={g} alt="" />)
        : (c.brands ?? "").split(",").map((b, i) => <span className="brand" key={pfx + i}>{b.trim()}</span>));
      return <div className="brandwrap" data-sec="brands" key="brands"><div className="mtrack">{make("a")}{make("b")}{make("c")}{make("d")}</div></div>;
    },
    topselling: () => (
      <div data-sec="topselling" key="topselling">
        <div className="secrow"><h2>{head("topselling", "Top selling")}</h2><span className="sa" onClick={() => { setCat("all"); }}>View all →</span></div>
        <div className="autoslide"><div className="strack" data-auto>{topSelling.map(Card)}</div></div>
      </div>
    ),
    featured: () => {
      const p = items[c.featuredIdx ?? 0] || items[0];
      if (!p) return null;
      return (
        <div className="fbanner" data-sec="featured" key="featured">
          <div className="fbi" style={p.img ? { backgroundImage: `url('${p.img}')` } : undefined} />
          <div className="fbb">
            <div className="tag">Featured</div><h2>{p.name}</h2>
            <div className="fp">{p.price && <span className="fo">{p.price}</span>}{p.compareAt && <span className="fr">{p.compareAt}</span>}</div>
            <a className="fbuy" href={p.url} target={hasPage(p) ? "_blank" : undefined} rel="noreferrer" onClick={openPDP(p)}>View product</a>
          </div>
        </div>
      );
    },
    catalog: () => (
      <div data-sec="catalog" key="catalog">
        <div className="secrow"><h2>{head("catalog", "All products")}</h2></div>
        <div className="controls">
          <input className="search" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="cats">{cats.map((ct) => <div key={ct} className={`cat${cat === ct ? " on" : ""}`} onClick={() => setCat(ct)}>{ct === "all" ? "All" : ct}</div>)}</div>
          <select className="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="featured">Featured</option><option value="low">Price: Low to High</option>
            <option value="high">Price: High to Low</option><option value="rated">Top rated</option>
          </select>
        </div>
        <div className={`catalog ${c.display ?? "grid"}`} style={(c.display ?? "grid") === "grid" ? { gridTemplateColumns: `repeat(${c.cols ?? 3}, 1fr)` } : undefined}>
          {list.length ? list.map(Card) : <div className="empty"><div className="e">🔍</div>No products match.</div>}
        </div>
      </div>
    ),
  };

  return (
    <div className={`storeview${stage ? " stage" : ""}${c.theme === "dark" ? " dark-store" : ""}`} ref={rootRef}>
      <div className={`site ${bt}${m}`} style={{ ["--sGrad" as string]: grad, ["--font-sora" as string]: fontFam, ["--ww" as string]: `${ww}px` } as React.CSSProperties}>
        {c.announce?.on && <div className="annbar">{c.announce.text}</div>}
        <div className="stopbar">
          <div className="slogo">{logo}</div>
          <div className="smenu">{(c.menu ?? []).map((mm, i) => <a key={i}>{mm}</a>)}</div>
          <button className="acctbtn" onClick={() => setDrawer("acct")}>👤 Login</button>
          <button className="carticon" onClick={() => setDrawer("cart")}>🛒{cartCount > 0 && <span className="cbadge">{cartCount}</span>}</button>
        </div>
        {order.map((k) => (sections[k] && REN[k] ? REN[k]() : null))}
        <Footer c={c} />
        {(c.bottomNav !== false) && (
          <div className="bottomnav">
            <button><span className="bn-ic">🏠</span>Home</button>
            <button><span className="bn-ic">🗂️</span>Category</button>
            <button onClick={() => setDrawer("cart")}><span className="bn-ic">🛒</span>Cart{cartCount > 0 && <span className="bnbadge">{cartCount}</span>}</button>
            <button onClick={() => setDrawer("acct")}><span className="bn-ic">👤</span>Account</button>
          </div>
        )}
        {drawer !== "none" && (
          <div className="storelayer open">
            <div className="coverlay" onClick={() => setDrawer("none")} />
            <div className="drawer">
              {drawer === "cart" ? (
                <>
                  <div className="cdh">Your cart <button className="cdx" onClick={() => setDrawer("none")}>✕</button></div>
                  <div className="cditems">{Object.keys(cart).filter((id) => cart[id] > 0).length ? Object.keys(cart).filter((id) => cart[id] > 0).map((id) => {
                    const p = items.find((x) => x.id === id); if (!p) return null;
                    return (
                      <div className="ci" key={id}>
                        <div className="cim" style={p.img ? { backgroundImage: `url('${p.img}')` } : undefined} />
                        <div style={{ flex: 1 }}>
                          <div className="cn">{p.name}</div><div className="cp">{p.price}</div>
                          <div className="qty">
                            <button onClick={() => setCart((c2) => ({ ...c2, [id]: Math.max(0, c2[id] - 1) }))}>−</button>
                            <span>{cart[id]}</span>
                            <button onClick={() => setCart((c2) => ({ ...c2, [id]: c2[id] + 1 }))}>+</button>
                            <a className="rm" href={p.url}>view</a>
                          </div>
                        </div>
                      </div>
                    );
                  }) : <div className="cdempty"><div className="e">🛒</div><p>Your cart is empty</p></div>}</div>
                  <div className="cdfoot">
                    <div className="sub"><span>Subtotal</span><b>{inr(subtotal)}</b></div>
                    <button className="checkout" onClick={() => { const first = Object.keys(cart).find((id) => cart[id] > 0); const p = first ? items.find((x) => x.id === first) : null; if (p?.buyable) go(p); else if (p?.url) window.location.href = p.url; }}>Checkout · {inr(subtotal)}</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="cdh">Buyer corner <button className="cdx" onClick={() => setDrawer("none")}>✕</button></div>
                  <div className="login">
                    <div className="lhead">Sign in to {c.store}</div>
                    <p>Track orders, save your wishlist and check out faster.</p>
                    <input className="lemail" placeholder="Email address" />
                    <button className="lotp">Send OTP</button>
                    <div className="ldiv">or</div>
                    <button className="lgoogle">Continue with Google</button>
                    <p className="lnote">Buyer accounts are coming soon.</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {buyP && <StoreCheckout product={buyP} storeName={c.store || "Store"} payEnabled={payEnabled} onClose={() => setBuyP(null)} />}
      </div>
    </div>
  );
}

function Footer({ c }: { c: StoreContent }) {
  const legal = c.legal ?? {};
  const links = Object.keys(legal).filter((k) => legal[k]?.on).map((k) => <a key={k}>{legal[k].title}</a>);
  const PAYS = ["UPI", "VISA", "Mastercard", "RuPay", "Net Banking"];
  return (
    <div className="sfoot">
      <div className="b">{c.store}</div>
      {links}
      {c.footerPay !== false && <div className="paywrap">{PAYS.map((p) => <span className="paym" key={p}>{p}</span>)}</div>}
      <div style={{ marginTop: 6 }}>© 2026 {c.store} · Powered by invoxai</div>
    </div>
  );
}
