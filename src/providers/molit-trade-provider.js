import { PriceDataProvider } from "./price-provider.js";

const API_BASE = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";

export class MolitTradeProvider extends PriceDataProvider {
  syncRegion() {
    throw new Error("MOLIT provider is planned for commercial migration and is not implemented yet.");
  }

  constructor({ serviceKey = process.env.MOLIT_APT_TRADE_SERVICE_KEY, numOfRows = 1000 } = {}) {
    super();
    this.serviceKey = serviceKey;
    this.numOfRows = numOfRows;
  }

  async fetchDeals({ lawdCd, yearMonth }) {
    if (!this.serviceKey) {
      throw new Error("MOLIT_APT_TRADE_SERVICE_KEY is required.");
    }

    const firstPage = await this.fetchPage({ lawdCd, yearMonth, pageNo: 1 });
    const totalCount = firstPage.totalCount;
    const pageCount = Math.max(1, Math.ceil(totalCount / this.numOfRows));
    const items = [...firstPage.items];

    for (let pageNo = 2; pageNo <= pageCount; pageNo += 1) {
      const page = await this.fetchPage({ lawdCd, yearMonth, pageNo });
      items.push(...page.items);
    }

    return {
      totalCount,
      pageCount,
      items
    };
  }

  async fetchPage({ lawdCd, yearMonth, pageNo }) {
    const url = new URL(API_BASE);
    url.searchParams.set("LAWD_CD", lawdCd);
    url.searchParams.set("DEAL_YMD", yearMonth);
    url.searchParams.set("pageNo", String(pageNo));
    url.searchParams.set("numOfRows", String(this.numOfRows));

    const separator = url.toString().includes("?") ? "&" : "?";
    const keyParam = this.serviceKey.includes("%")
      ? this.serviceKey
      : encodeURIComponent(this.serviceKey);
    const response = await fetch(`${url}${separator}serviceKey=${keyParam}`);
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`MOLIT API HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    return parseTradeResponse(text);
  }
}

function parseTradeResponse(xml) {
  const resultCode = tagValue(xml, "resultCode");
  const resultMsg = tagValue(xml, "resultMsg");
  if (resultCode && resultCode !== "00") {
    throw new Error(`MOLIT API ${resultCode}: ${resultMsg || "unknown error"}`);
  }
  if (!xml.includes("<response")) {
    throw new Error(`Unexpected MOLIT API response: ${xml.slice(0, 200)}`);
  }

  return {
    totalCount: Number(tagValue(xml, "totalCount") || 0),
    items: [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => parseItem(match[1]))
  };
}

function parseItem(xml) {
  const item = {};
  for (const match of xml.matchAll(/<([^/][^>\s]*)>([\s\S]*?)<\/\1>/g)) {
    item[match[1]] = decodeXml(match[2]).trim();
  }
  return item;
}

function tagValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match ? decodeXml(match[1]).trim() : "";
}

function decodeXml(value) {
  return String(value || "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'");
}
