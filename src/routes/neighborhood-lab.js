import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { readNeighborhoodLab } from "../services/neighborhood-lab.js";

const cookieName = "orulzip_lab_review";
const maxAge = 86400;
const staticFiles = new Map([
  ["/neighborhood-lab", ["neighborhood-lab.html", "text/html; charset=utf-8"]],
  ["/neighborhood-lab.html", ["neighborhood-lab.html", "text/html; charset=utf-8"]],
  ["/css/neighborhood-lab.css", ["css/neighborhood-lab.css", "text/css; charset=utf-8"]],
  ["/js/neighborhood-lab.js", ["js/neighborhood-lab.js", "text/javascript; charset=utf-8"]],
  ["/assets/neighborhood-lab-geometry.json", ["assets/neighborhood-lab-geometry.json", "application/json; charset=utf-8"]]
]);
staticFiles.set("/assets/neighborhood-lab-d3.min.js", ["assets/neighborhood-lab-d3.min.js", "text/javascript; charset=utf-8"]);
staticFiles.set("/assets/neighborhood-lab-d3-LICENSE.txt", ["assets/neighborhood-lab-d3-LICENSE.txt", "text/plain; charset=utf-8"]);
for (const [file, type] of [["js/app-neighborhood-map.js", "text/javascript; charset=utf-8"], ["js/neighborhood-map-provider.js", "text/javascript; charset=utf-8"], ["js/neighborhood-map-renderer.js", "text/javascript; charset=utf-8"], ["js/neighborhood-map-evidence.js", "text/javascript; charset=utf-8"], ["css/neighborhood-map.css", "text/css; charset=utf-8"], ["assets/neighborhood-map-leaflet.js", "text/javascript; charset=utf-8"], ["assets/neighborhood-map-leaflet.css", "text/css; charset=utf-8"], ["assets/neighborhood-map-leaflet-LICENSE.txt", "text/plain; charset=utf-8"]]) staticFiles.set("/"+file, [file, type]);
const apiPath = "/api/neighborhood-lab";

function equal(a, b) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function signature(value, secret) { return createHmac("sha256", secret).update(value).digest("base64url"); }
export function createLabSession(secret, now = Date.now()) {
  const expires = String(Math.floor(now / 1000) + maxAge);
  return `${expires}.${signature(expires, secret)}`;
}
export function isLabSessionValid(value, secret, now = Date.now()) {
  if (!secret || !/^\d{10}\.[\w-]{43}$/.test(value)) return false;
  const [expires, signed] = value.split(".");
  const seconds = Math.floor(now / 1000);
  return Number(expires) > seconds && Number(expires) <= seconds + maxAge
    && equal(signed, signature(expires, secret));
}

export function hasNeighborhoodLabAccess(req, { environment = process.env.ORULZIP_ENVIRONMENT, secret = process.env.ORULZIP_NEIGHBORHOOD_LAB_TOKEN || "" } = {}) {
  const cookie = String(req.headers.cookie || "").split(";").map(value => value.trim()).find(value => value.startsWith(cookieName+"="));
  return environment === "development" && secret.length >= 32 && isLabSessionValid(cookie ? cookie.slice(cookieName.length+1) : "", secret);
}
export function neighborhoodMapConfig(req) {
  return hasNeighborhoodLabAccess(req) ? { enabled: true, tileUrl: process.env.ORULZIP_DEVELOPMENT_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png" } : { enabled: false };
}

export async function handleNeighborhoodLab(req, res, url, {
  environment = process.env.ORULZIP_ENVIRONMENT,
  secret = process.env.ORULZIP_NEIGHBORHOOD_LAB_TOKEN || "",
  readData = readNeighborhoodLab
} = {}) {
  const path = url.pathname.replace(/\/+/g, "/").replace(/\/+$/, "") || "/";
  // Decode before checking, so static-file aliases cannot bypass the dev gate.
  let decoded;
  try { decoded = decodeURIComponent(path); } catch { return false; }
  const nativeEntry = decoded === "/map" && url.searchParams.get("lab") === "neighborhood";
  const isFeature = staticFiles.has(decoded) || decoded === apiPath || nativeEntry;
  if (!isFeature) return false;
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" };
  const reply = (status, body, type = "application/json; charset=utf-8", extra = {}) => {
    res.writeHead(status, { ...headers, "Content-Type": type, ...extra }); res.end(req.method === "HEAD" ? undefined : body); return true;
  };
  if (environment !== "development") return reply(404, '{"error":"not_found"}');
  if (secret.length < 32) return reply(503, '{"error":"비공개 확인 링크가 설정되지 않았습니다."}');
  if (!["GET", "HEAD"].includes(req.method)) return reply(405, '{"error":"method_not_allowed"}', undefined, { Allow: "GET, HEAD" });
  const provided = url.searchParams.get("access") || "";
  if (["/neighborhood-lab", "/neighborhood-lab.html"].includes(decoded) && equal(provided, secret)) {
    // LAN HTTP uses an HttpOnly cookie; HTTPS adds Secure. The link credential
    // is removed before the page and its subresources are requested.
    const secure = req.socket.encrypted ? "; Secure" : "";
    return reply(302, "", "text/plain", {
      Location: "/map?lab=neighborhood",
      "Set-Cookie": `${cookieName}=${createLabSession(secret)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`
    });
  }
  const cookie = String(req.headers.cookie || "").split(";").map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`));
  if (!isLabSessionValid(cookie ? cookie.slice(cookieName.length + 1) : "", secret)) {
    return reply(401, decoded === apiPath ? '{"error":"private_review_required"}' : "개인 확인 링크로 접속해 주세요.", decoded === apiPath ? undefined : "text/plain; charset=utf-8");
  }
  if (nativeEntry) {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Referrer-Policy", "origin");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    return false;
  }
  if (["/neighborhood-lab", "/neighborhood-lab.html"].includes(decoded) && url.searchParams.get("view") !== "reference") {
    return reply(302, "", "text/plain", { Location: "/map?lab=neighborhood" });
  }
  if (decoded === apiPath) {
    if (req.method === "HEAD") return reply(200, "");
    try { return reply(200, JSON.stringify(await readData(url.searchParams.get("dataset") || "validated"))); }
    catch (error) { return reply(error.statusCode || 503, JSON.stringify({ error: error.statusCode === 400 ? error.message : "자료를 읽지 못했습니다. 잠시 후 다시 확인해 주세요." })); }
  }
  const [file, type] = staticFiles.get(decoded);
  return reply(200, await readFile(new URL(`../public/${file}`, import.meta.url)), type);
}
