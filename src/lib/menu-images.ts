import espresso from "@/assets/espresso.jpg";
import flatwhite from "@/assets/flatwhite.jpg";
import icedlatte from "@/assets/icedlatte.jpg";
import frappe from "@/assets/frappe.jpg";
export const menuImages: Record<string, string> = { espresso, flatwhite, icedlatte, frappe };
export function menuImage(value: string) { return menuImages[value] ?? value; }

// Bundled /menu/<name>.jpg photos that also exist as WebP: public/menu/w480 (480px list thumbnails)
// and public/menu/webp (original size, for the product popup). Database values stay "/menu/<name>.jpg".
const WEBP_READY = new Set(["04eb7068-beans-half-clean","085fa2dc-power-studio","0f3de69d-sauces-studio","124c63d3-iced-latte-clean","1670bd6f-spris-clean","172e64af-egg-sandwich-clean","1f3e7de3-mango-shake-clean","209aa73b-strawberry-shake-studio","272675b4-papaya-shake-clean","28ba9a74-max-studio","2b2972cb-ummasbun-iced-clean","317691ff-beans-1kg-clean","31de804f-avocado-juice-clean","3ba77ff6-beans-harari-clean","4bb59362-chips-clean","59317c0e-orange-juice-clean","5cbf0ef6-water-2-studio","5d924aed-chocolate-soup-studio","6351aa7e-iced-americano-clean","68a485a0-ummasbun-shake-studio","6e6fcce3-water-small-studio","74942b82-tropical-mojito-clean","7b6ff50b-water-05-studio","872896e4-papaya-juice-clean","8d297bab-beans-quarter-clean","9146e439-strawberry-mojito-clean","970a0dcc-special-soup-clean","9921cdd4-soup-clean","9b55a008-tropical-blue-mojito-clean","9d5c8b40-protein-drink-studio","9da28ae0-potato-salad-clean","9e941830-food-ta-studio","a04b9f25-juice-cup-studio","a0fd8738-strawberry-juice-clean","a52bcc09-soft-cake-clean","ab2d830e-mini-donuts-clean","b030f48b-mango-spris-clean","b783588c-coffee-milk-clean","bb35b8b6-giant-cookies-clean","c046713c-milano-mojito-clean","c05ca5f4-coffee-cup-studio","c26af2b4-peanut-soup-clean","c8c4b3c9-ertib-clean","d9500fa2-ummas-sweet-clean","da5c9070-mint-mojito-clean","e103e029-mango-juice-clean","e4ff2256-avocado-shake-clean","e7023a22-water-1-studio","e7a0da96-steam-clean","eaf6e0aa-beetroot-salad-clean","eb27f358-spanish-latte-clean","eb6e89c2-bread-studio","fec0987a-jebena-clean"]);
function webpPath(src: string, dir: "w480" | "webp") {
  const m = /^\/menu\/([^/]+)\.jpe?g$/.exec(src);
  return m && WEBP_READY.has(m[1]!) ? `/menu/${dir}/${m[1]}.webp` : undefined;
}
export const menuThumbWebp = (src: string) => webpPath(src, "w480");
export const menuFullWebp = (src: string) => webpPath(src, "webp");
