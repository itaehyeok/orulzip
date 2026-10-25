import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { readNeighborhoodLab } from "../services/neighborhood-lab.js";

const cookieName = "orulzip_lab_review";
const maxAge = 86400;
const entryPaths = new Set(["/neighborhood-lab", "/neighborhood-lab.html"]);
const staticFiles = new Map([
  ["/js/app-neighborhood-map.js", ["js/app-neighborhood-map.js", "text/javascript; charset=utf-8"]],
  ["/js/neighborhood-map-provider.js", ["js/neighborhood-map-provider.js", "text/javascript; charset=utf-8"]],
  ["/js/neighborhood-map-renderer.js", ["js/neighborhood-map-renderer.js", "text/javascript; charset=utf-8"]],
  ["/js/neighborhood-map-evidence.js", ["js/neighborhood-map-evidence.js", "text/javascript; charset=utf-8"]],
  ["/css/neighborhood-map.css", ["css/neighborhood-map.css", "text/css; charset=utf-8"]]
]);
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
  return hasNeighborhoodLabAccess(req) ? { enabled: true } : { enabled: false };
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
  const isFeature = entryPaths.has(decoded) || staticFiles.has(decoded) || decoded === apiPath || nativeEntry;
  if (!isFeature) return false;
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" };
  const reply = (status, body, type = "application/json; charset=utf-8", extra = {}) => {
    res.writeHead(status, { ...headers, "Content-Type": type, ...extra }); res.end(req.method === "HEAD" ? undefined : body); return true;
  };
  if (environment !== "development") return reply(404, '{"error":"not_found"}');
  if (secret.length < 32) return reply(503, '{"error":"비공개 확인 링크가 설정되지 않았습니다."}');
  if (!["GET", "HEAD"].includes(req.method)) return reply(405, '{"error":"method_not_allowed"}', undefined, { Allow: "GET, HEAD" });
  const provided = url.searchParams.get("access") || "";
  if (entryPaths.has(decoded) && equal(provided, secret)) {
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
  if (entryPaths.has(decoded)) {
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
