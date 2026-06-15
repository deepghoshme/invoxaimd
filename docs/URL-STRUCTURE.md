# URL Structure — invoxai.io

The complete routing map. Pairs with `FINAL-master-prompt.md` and `FULL-PLAN-CHECKLIST.md`.

---

## Platform domains

| Surface | URL |
|---|---|
| Main marketing website | `invoxai.io` |
| Seller dashboard | `app.invoxai.io` |
| Admin panel | `admin.invoxai.io` |
| `www` | redirect `www.invoxai.io` → `invoxai.io` |

---

## Seller public pages

Live on the seller's subdomain `name.invoxai.io`. The **same paths apply on a connected custom domain** (e.g. `mybrand.com/store`).

| Page type | Path | Instances per seller |
|---|---|---|
| Website (home) | `name.invoxai.io/` | one |
| Store | `name.invoxai.io/store` | one |
| Bio | `name.invoxai.io/bio` | one |
| Courses | `name.invoxai.io/courses` | one (course hub) |
| One-page product | `name.invoxai.io/opp/{id}` | many |
| Payment page | `name.invoxai.io/pay/{id}` | many |
| 1-to-1 booking | `name.invoxai.io/book/{id}` | many |
| Lead form | `name.invoxai.io/ldf/{id}` | many |
| VIP channel/group | `name.invoxai.io/vpc/{id}` | many |
| Landing page | `name.invoxai.io/led/{id}` | many |
| Event booking | `name.invoxai.io/env/{id}` | many |
| Checkout | `name.invoxai.io/{page_type}/checkout/{order_id}` | per order |

**Custom domain mapping:** once a seller connects `mybrand.com`, every path moves to it and old `name.invoxai.io/...` URLs **301-redirect** to the custom domain.

---

## Checkout routing (page-type aware)

Checkout sits **under the page type** that started it. The `{order_id}` resolves the exact product, amount, and seller from the database.

Pattern: `name.invoxai.io/{page_type}/checkout/{order_id}`

| From | Checkout URL |
|---|---|
| Store | `name.invoxai.io/store/checkout/{order_id}` |
| One-page product | `name.invoxai.io/opp/checkout/{order_id}` |
| Payment page | `name.invoxai.io/pay/checkout/{order_id}` |
| Courses | `name.invoxai.io/courses/checkout/{order_id}` |
| 1-to-1 booking | `name.invoxai.io/book/checkout/{order_id}` |
| VIP channel/group | `name.invoxai.io/vpc/checkout/{order_id}` |
| Event booking | `name.invoxai.io/env/checkout/{order_id}` |

(Bio, lead form, and landing pages have no direct checkout — their CTA points to a paid page type.)

---

## Routing recommendations

1. **Reserve system subdomains** — block: `app`, `admin`, `www`, `api`, `mail`, `smtp`, `ftp`, `cdn`, `assets`, `static`, `blog`, `help`, `support`, `status`, `ns1`, `ns2`, plus offensive/brand terms. (Enforced in DB via `reserved_subdomains` + `is_subdomain_available()`.)
2. **Lowercase all paths** — normalize `/Courses` → `/courses`.
3. **Short, random, non-sequential `{id}`s** — 8–10 char nanoid (`opp/a7Bx9KmQ`), not `1,2,3`. Optionally allow a seller-chosen custom slug (`/opp/summer-sale`).
4. **Checkout is page-type aware + needs an order id** — `/{page_type}/checkout/{order_id}`. Page type gives source attribution; order_id gives amount/product/seller/pixels.
5. **Pixels fire on every public path**, including checkout.
6. **Routing precedence** — fixed paths (`/store`, `/bio`, `/courses`, `/checkout`) win; prefixed dynamic routes (`/opp/`, `/pay/`, `/book/`, `/ldf/`, `/vpc/`, `/led/`, `/env/`) match their `{id}`.

---

## Abbreviations
- `led` = landing page, `env` = event booking (kept as specified).

## Path prefix reference

| Prefix | Meaning |
|---|---|
| `/opp/` | one-page product |
| `/pay/` | payment page |
| `/book/` | 1-to-1 booking |
| `/ldf/` | lead form |
| `/vpc/` | VIP premium channel/group |
| `/led/` | landing page |
| `/env/` | event booking |
| `/{page_type}/checkout/` | checkout, nested under its source page type (per order) |
