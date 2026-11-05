import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import ipaddr from "ipaddr.js";
import { load } from "cheerio";
import { ApiFailure } from "./auth.js";
import { safeUrl } from "./domain.js";
export function publicAddress(address: string) {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}
export function validateWebsiteUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiFailure(400, "invalid_url", "Enter an HTTP or HTTPS website.");
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port)) ||
    !url.hostname.includes(".") ||
    url.hostname.endsWith(".local") ||
    url.hostname === "localhost"
  )
    throw new ApiFailure(
      400,
      "unsafe_url",
      "Only public HTTP(S) websites on standard ports are allowed.",
    );
  return url;
}
async function fetchPage(
  value: string,
  redirects = 0,
): Promise<{ html: string; url: string }> {
  const url = validateWebsiteUrl(value);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = await lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new ApiFailure(
      400,
      "unsafe_url",
      "Private or reserved network addresses are not allowed.",
    );
  const selected = addresses[0];
  return new Promise((resolve, reject) => {
    const requester = url.protocol === "https:" ? https : http;
    const req = requester.get(
      url,
      {
        headers: {
          "User-Agent": "GoldCountryDirectory-Metadata/2.0",
          Accept: "text/html,application/xhtml+xml",
        },
        lookup: ((_hostname: any, _options: any, callback: any) => {
          if (_options?.all) callback(null, [selected]);
          else callback(null, selected.address, selected.family);
        }) as any,
      },
      (response) => {
        if (
          response.statusCode &&
          [301, 302, 303, 307, 308].includes(response.statusCode)
        ) {
          response.resume();
          if (redirects >= 3 || !response.headers.location)
            return reject(
              new ApiFailure(
                400,
                "fetch_failed",
                "Too many website redirects.",
              ),
            );
          let target: string;
          try {
            target = new URL(response.headers.location, url).toString();
          } catch {
            return reject(
              new ApiFailure(400, "fetch_failed", "Invalid website redirect."),
            );
          }
          fetchPage(target, redirects + 1).then(resolve, reject);
          return;
        }
        if (
          response.statusCode !== 200 ||
          !/text\/html|application\/xhtml\+xml/i.test(
            response.headers["content-type"] || "",
          )
        ) {
          response.resume();
          reject(
            new ApiFailure(
              400,
              "fetch_failed",
              "The website did not return a public HTML page.",
            ),
          );
          return;
        }
        const parts: Buffer[] = [];
        let length = 0;
        response.on("data", (chunk: Buffer) => {
          length += chunk.length;
          if (length > 1024 * 1024) {
            req.destroy();
            reject(
              new ApiFailure(
                400,
                "fetch_failed",
                "Website HTML exceeds the 1 MB import limit.",
              ),
            );
          } else parts.push(chunk);
        });
        response.on("end", () =>
          resolve({
            html: Buffer.concat(parts).toString("utf8"),
            url: url.toString(),
          }),
        );
        response.on("error", reject);
      },
    );
    req.setTimeout(5000, () =>
      req.destroy(new Error("Website fetch timed out.")),
    );
    req.on("error", reject);
  });
}
export function extractMetadata(html: string, url: string) {
  const $ = load(html);
  let structured: any = {};
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      const value = JSON.parse($(el).text());
      const rows = Array.isArray(value) ? value : value["@graph"] || [value];
      const found = rows.find(
        (r: any) =>
          r.name &&
          (r.telephone ||
            r.address ||
            r["@type"] === "LocalBusiness" ||
            r["@type"] === "Organization"),
      );
      if (found && !structured.name) structured = found;
    } catch {}
  });
  const plain = (s: any, max = 5000) =>
    typeof s === "string"
      ? load(`<span>${s}</span>`)("span").text().trim().slice(0, max)
      : "";
  const address =
    typeof structured.address === "object" ? structured.address : {};
  return {
    name: plain(
      structured.name ||
        $('meta[property="og:title"]').attr("content") ||
        $("title").text(),
      250,
    ),
    description: plain(
      structured.description ||
        $('meta[name="description"]').attr("content") ||
        $('meta[property="og:description"]').attr("content"),
    ),
    website: safeUrl(url),
    phones: plain(structured.telephone, 500),
    email: plain(structured.email, 254).replace(/^mailto:/, ""),
    address_street: plain(address.streetAddress, 250),
    city: plain(address.addressLocality, 500),
    address_state: plain(address.addressRegion, 100),
    address_zip: plain(address.postalCode, 30),
  };
}
export async function importWebsite(value: string) {
  const page = await fetchPage(value);
  return extractMetadata(page.html, page.url);
}
