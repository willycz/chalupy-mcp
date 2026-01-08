import fetch, { Response as FetchResponse } from "node-fetch";
import * as cheerio from "cheerio";

// Configuration constants
const BASE_URL = "https://www.e-chalupy.cz";
const ALLOWED_HOSTNAME = "www.e-chalupy.cz";
const FETCH_TIMEOUT_MS = 30000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface SearchParams {
  query?: string;
  region?: string;
  features?: string[];
  persons?: number;
  dateFrom?: string;
  dateTo?: string;
  priceMin?: number;
  priceMax?: number;
  maxResults?: number;
}

export interface PropertyListing {
  title: string;
  price: string;
  location: string;
  description: string;
  url: string;
  imageUrl?: string;
  rating?: string;
}

export interface PropertyDetails extends PropertyListing {
  fullDescription: string;
  features: string[];
  capacity?: number;
  bedrooms?: number;
  tags: string[];
  equipment: Record<string, string[]>;
}

export interface Region {
  slug: string;
  name: string;
  count: number;
}

export interface Feature {
  slug: string;
  name: string;
  count: number;
}

// Cache with TTL support
interface CacheEntry<T> {
  data: T[];
  timestamp: number;
}

class Cache<T> {
  private entry: CacheEntry<T> | null = null;

  get(): T[] | null {
    if (!this.entry) return null;
    if (Date.now() - this.entry.timestamp > CACHE_TTL_MS) {
      this.entry = null;
      return null;
    }
    return this.entry.data;
  }

  set(data: T[]): void {
    this.entry = { data, timestamp: Date.now() };
  }

  clear(): void {
    this.entry = null;
  }
}

const regionsCache = new Cache<Region>();
const featuresCache = new Cache<Feature>();

// Valid slug pattern: lowercase letters, numbers, and hyphens only
const VALID_SLUG_PATTERN = /^[a-z0-9-]+$/;

/**
 * Validates that a URL belongs to the allowed domain (prevents SSRF)
 */
function validateUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Neplatná URL adresa");
  }

  if (parsed.hostname !== ALLOWED_HOSTNAME) {
    throw new Error(`URL musí být z domény ${ALLOWED_HOSTNAME}`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error("URL musí používat HTTPS protokol");
  }

  return parsed;
}

/**
 * Validates a slug parameter (region or feature)
 */
function validateSlug(slug: string, type: string): void {
  if (!VALID_SLUG_PATTERN.test(slug)) {
    throw new Error(`Neplatný ${type}: ${slug}`);
  }
  if (slug.length > 50) {
    throw new Error(`${type} je příliš dlouhý`);
  }
}

/**
 * Validates date format (YYYY-MM-DD)
 */
function validateDate(date: string): void {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(date)) {
    throw new Error(`Neplatný formát data: ${date}. Použijte formát YYYY-MM-DD`);
  }
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Neplatné datum: ${date}`);
  }
}

/**
 * Validates numeric parameters
 */
function validatePositiveNumber(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} musí být kladné číslo`);
  }
}

// Random delay to avoid rate limiting
async function randomDelay(min: number = 500, max: number = 1500): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Rotate user agents to appear more natural
function getRandomUserAgent(): string {
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Fetch with retry logic and timeout
async function fetchWithRetry(url: string, retries: number = 2): Promise<FetchResponse> {
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      if (i > 0) {
        await randomDelay(1000, 3000); // Longer delay on retry
      }
      
      const response = await fetch(url, {
        headers: {
          "User-Agent": getRandomUserAgent(),
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "cs,en-US;q=0.7,en;q=0.3",
          "Accept-Encoding": "gzip, deflate, br",
          "DNT": "1",
          "Connection": "keep-alive",
          "Upgrade-Insecure-Requests": "1",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 500 && i < retries) {
          console.error(`Server returned 500, retrying... (attempt ${i + 1}/${retries})`);
          continue;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Požadavek vypršel - server neodpověděl včas");
      }
      if (i === retries) throw error;
      console.error(`Request failed, retrying... (attempt ${i + 1}/${retries})`);
    }
  }
  throw new Error("Nepodařilo se načíst data po opakovaných pokusech");
}

export async function listRegions(): Promise<Region[]> {
  const cached = regionsCache.get();
  if (cached) {
    return cached;
  }

  try {
    const response = await fetchWithRetry(`${BASE_URL}/chaty-chalupy`);

    const html = await response.text();
    const $ = cheerio.load(html);

    const czechRegions = [
      "beskydy", "ceske-stredohori", "ceske-svycarsko", "cesky-raj", "jeseniky",
      "jizerske-hory", "jizni-cechy", "jizni-morava", "kokorinsko", "krkonose",
      "krusne-hory", "luzicke-hory", "okoli-prahy", "orlicke-hory",
      "severni-morava-a-slezsko", "stredni-cechy", "sumava", "vychodni-cechy",
      "vysocina", "zapadni-cechy"
    ];

    const regions: Region[] = [];

    $('a[href^="/"]').each((_, el) => {
      const href = $(el).attr("href");
      const name = $(el).find(".t").text().trim();
      const countText = $(el).find(".c").text().trim();
      const count = parseInt(countText) || 0;

      if (href && name && count > 0 && czechRegions.includes(href.substring(1))) {
        const slug = href.substring(1);
        if (!regions.find(r => r.slug === slug)) {
          regions.push({ slug, name, count });
        }
      }
    });

    regionsCache.set(regions);
    return regions;
  } catch (error) {
    throw new Error(`Chyba při načítání regionů: ${error instanceof Error ? error.message : "Neznámá chyba"}`);
  }
}

export async function listFeatures(): Promise<Feature[]> {
  const cached = featuresCache.get();
  if (cached) {
    return cached;
  }

  try {
    const response = await fetchWithRetry(`${BASE_URL}/chaty-chalupy`);

    const html = await response.text();
    const $ = cheerio.load(html);

    const featureSlugs = [
      "bazen-venkovni", "bazen-vnitrni", "se-saunou", "s-virivkou", "s-krbem",
      "krb-venkovni", "s-koupacim-sudem", "s-koupacim-jezirkem", "detska-postylka",
      "ohniste", "terasa", "internet", "spolecenska-mistnost", "pro-rodiny-s-detmi",
      "oploceny-pozemek", "na-samote", "zahrada", "u-lesa", "se-psem", "u-vody",
      "pro-rybare", "nekuracky", "bezbarierovy", "pro-cyklisty", "u-sjezdovky"
    ];

    const features: Feature[] = [];

    $('a[href^="/"]').each((_, el) => {
      const href = $(el).attr("href");
      const name = $(el).find(".t").text().trim();
      const countText = $(el).find(".c").text().trim();
      const count = parseInt(countText) || 0;

      if (href && name && count > 0 && featureSlugs.includes(href.substring(1))) {
        const slug = href.substring(1);
        if (!features.find(f => f.slug === slug)) {
          features.push({ slug, name, count });
        }
      }
    });

    featuresCache.set(features);
    return features;
  } catch (error) {
    throw new Error(`Chyba při načítání vlastností: ${error instanceof Error ? error.message : "Neznámá chyba"}`);
  }
}

export async function searchChalupy(params: SearchParams): Promise<PropertyListing[]> {
  // Validate input parameters
  if (params.region) {
    validateSlug(params.region, "region");
  }
  if (params.features) {
    for (const feature of params.features) {
      validateSlug(feature, "feature");
    }
  }
  if (params.dateFrom) {
    validateDate(params.dateFrom);
  }
  if (params.dateTo) {
    validateDate(params.dateTo);
  }
  if (params.persons !== undefined) {
    validatePositiveNumber(params.persons, "persons");
  }
  if (params.priceMin !== undefined) {
    validatePositiveNumber(params.priceMin, "priceMin");
  }
  if (params.priceMax !== undefined) {
    validatePositiveNumber(params.priceMax, "priceMax");
  }
  if (params.maxResults !== undefined) {
    validatePositiveNumber(params.maxResults, "maxResults");
    if (params.maxResults > 100) {
      throw new Error("maxResults nemůže být větší než 100");
    }
  }

  // Build URL path
  let searchPath = "/chaty-chalupy";
  
  if (params.region) {
    searchPath = `/${encodeURIComponent(params.region)}`;
    if (params.features && params.features.length > 0) {
      searchPath += `/${encodeURIComponent(params.features[0])}`;
    }
  } else if (params.features && params.features.length > 0) {
    searchPath = `/${encodeURIComponent(params.features[0])}`;
  }

  let searchUrl = `${BASE_URL}${searchPath}`;

  // Build query parameters
  const queryParams: string[] = [];
  if (params.persons) {
    queryParams.push(`osoby=${encodeURIComponent(params.persons)}`);
  }
  if (params.dateFrom) {
    queryParams.push(`od=${encodeURIComponent(params.dateFrom)}`);
  }
  if (params.dateTo) {
    queryParams.push(`do=${encodeURIComponent(params.dateTo)}`);
  }
  if (params.priceMin) {
    queryParams.push(`cenaMin=${encodeURIComponent(params.priceMin)}`);
  }
  if (params.priceMax) {
    queryParams.push(`cenaMax=${encodeURIComponent(params.priceMax)}`);
  }

  if (queryParams.length > 0) {
    searchUrl += `?${queryParams.join("&")}`;
  }

  try {
    await randomDelay(); // Add delay before search request
    const response = await fetchWithRetry(searchUrl);

    const html = await response.text();
    const $ = cheerio.load(html);

    const listings: PropertyListing[] = [];
    const maxResults = params.maxResults || 10;

    $(".item.c-property").each((i, element) => {
      if (i >= maxResults) return false;

      const $el = $(element);
      const title = $el.find("h3").first().text().trim();
      const price = $el.find(".price").first().text().trim();
      const location = $el.find(".location").first().text().trim();
      const region = $el.find(".location2").first().text().trim();
      const description = $el.find(".desc").first().text().trim();
      const link = $el.find("a.images-link").first().attr("href");
      const imageUrl = $el.find("img").first().attr("src");
      const rating = $el.find(".simple-rating").first().text().trim();

      if (title && link) {
        listings.push({
          title,
          price: price || "Cena není uvedena",
          location: location ? `${location}${region ? ' - ' + region : ''}` : "Lokalita není uvedena",
          description: description || "",
          url: link.startsWith("http") ? link : `${BASE_URL}${link}`,
          imageUrl: imageUrl ? (imageUrl.startsWith("http") ? imageUrl : `${BASE_URL}${imageUrl}`) : undefined,
          rating: rating || undefined,
        });
      }
    });

    if (params.query && listings.length > 0) {
      const queryLower = params.query.toLowerCase();
      return listings.filter(
        (listing) =>
          listing.title.toLowerCase().includes(queryLower) ||
          listing.description.toLowerCase().includes(queryLower) ||
          listing.location.toLowerCase().includes(queryLower)
      );
    }

    return listings;
  } catch (error) {
    throw new Error(`Chyba při vyhledávání: ${error instanceof Error ? error.message : "Neznámá chyba"}`);
  }
}

export async function getPropertyDetails(url: string): Promise<PropertyDetails> {
  // Validate URL to prevent SSRF attacks
  validateUrl(url);

  try {
    await randomDelay(); // Add delay before detail request
    const response = await fetchWithRetry(url);

    const html = await response.text();
    const $ = cheerio.load(html);

    // Title and number
    const titleEl = $("h1.title");
    const title = titleEl.clone().children().remove().end().text().trim();
    const number = titleEl.find(".number").text().trim();

    // Price
    const priceValue = $(".price .t2").first().text().trim();
    const priceUnit = $(".price .t1").first().text().trim();
    const price = priceValue ? `${priceValue} ${priceUnit}`.trim() : "Cena není uvedena";

    // Location
    const locationParts: string[] = [];
    $("meta[property='og:description']").each((_, el) => {
      const content = $(el).attr("content");
      if (content) {
        const match = content.match(/ubytování ([^⭐]*)/);
        if (match) locationParts.push(match[1].trim());
      }
    });
    const location = locationParts.join(", ") || "Lokalita není uvedena";

    // Rating
    const rating = $(".simple-rating").first().text().trim();

    // Tags (includes capacity and bedrooms)
    const tags: string[] = [];
    let capacity: number | undefined;
    let bedrooms: number | undefined;

    $(".tag.tag-sm").each((_, el) => {
      const tag = $(el).text().trim();
      tags.push(tag);

      // Parse capacity
      const capacityMatch = tag.match(/(\d+)\s+osob/);
      if (capacityMatch) {
        capacity = parseInt(capacityMatch[1]);
      }

      // Parse bedrooms
      const bedroomsMatch = tag.match(/(\d+)\s+ložnic/);
      if (bedroomsMatch) {
        bedrooms = parseInt(bedroomsMatch[1]);
      }
    });

    // Equipment grouped by category
    const equipment: Record<string, string[]> = {};
    $(".equipment-group").each((_, el) => {
      const $group = $(el);
      const category = $group.find("h3.title").text().trim();
      const items: string[] = [];
      
      $group.find("li").each((_, li) => {
        const item = $(li).text().trim();
        if (item) items.push(item);
      });

      if (category && items.length > 0) {
        equipment[category] = items;
      }
    });

    // Description from equipment section
    const fullDescription = $("#vybaveni .desc").text().trim() || 
                           $(".desc.default-style").first().text().trim() ||
                           "";

    // All features combined
    const features = tags.concat(
      ...Object.values(equipment).flat()
    );

    // Image
    const imageUrl = $(".images img").first().attr("src");

    return {
      title: `${title} ${number}`.trim(),
      price,
      location,
      description: fullDescription.substring(0, 200) + (fullDescription.length > 200 ? "..." : ""),
      fullDescription,
      url,
      imageUrl: imageUrl ? (imageUrl.startsWith("http") ? imageUrl : `${BASE_URL}${imageUrl}`) : undefined,
      rating: rating || undefined,
      features,
      capacity,
      bedrooms,
      tags,
      equipment,
    };
  } catch (error) {
    throw new Error(`Chyba při načítání detailu: ${error instanceof Error ? error.message : "Neznámá chyba"}`);
  }
}
