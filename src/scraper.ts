import fetch from "node-fetch";
import * as cheerio from "cheerio";

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

const REGIONS_CACHE: Region[] = [];
const FEATURES_CACHE: Feature[] = [];

export async function listRegions(): Promise<Region[]> {
  if (REGIONS_CACHE.length > 0) {
    return REGIONS_CACHE;
  }

  try {
    const response = await fetch("https://www.e-chalupy.cz/chaty-chalupy", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const czechRegions = [
      "beskydy", "ceske-stredohori", "ceske-svycarsko", "cesky-raj", "jeseniky",
      "jizerske-hory", "jizni-cechy", "jizni-morava", "kokorinsko", "krkonose",
      "krusne-hory", "luzicke-hory", "okoli-prahy", "orlicke-hory",
      "severni-morava-a-slezsko", "stredni-cechy", "sumava", "vychodni-cechy",
      "vysocina", "zapadni-cechy"
    ];

    $('a[href^="/"]').each((_, el) => {
      const href = $(el).attr("href");
      const name = $(el).find(".t").text().trim();
      const countText = $(el).find(".c").text().trim();
      const count = parseInt(countText) || 0;

      if (href && name && count > 0 && czechRegions.includes(href.substring(1))) {
        const slug = href.substring(1);
        if (!REGIONS_CACHE.find(r => r.slug === slug)) {
          REGIONS_CACHE.push({ slug, name, count });
        }
      }
    });

    return REGIONS_CACHE;
  } catch (error) {
    throw new Error(`Chyba při načítání regionů: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function listFeatures(): Promise<Feature[]> {
  if (FEATURES_CACHE.length > 0) {
    return FEATURES_CACHE;
  }

  try {
    const response = await fetch("https://www.e-chalupy.cz/chaty-chalupy", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const featureSlugs = [
      "bazen-venkovni", "bazen-vnitrni", "se-saunou", "s-virivkou", "s-krbem",
      "krb-venkovni", "s-koupacim-sudem", "s-koupacim-jezirkem", "detska-postylka",
      "ohniste", "terasa", "internet", "spolecenska-mistnost", "pro-rodiny-s-detmi",
      "oploceny-pozemek", "na-samote", "zahrada", "u-lesa", "se-psem", "u-vody",
      "pro-rybare", "nekuracky", "bezbarierovy", "pro-cyklisty", "u-sjezdovky"
    ];

    $('a[href^="/"]').each((_, el) => {
      const href = $(el).attr("href");
      const name = $(el).find(".t").text().trim();
      const countText = $(el).find(".c").text().trim();
      const count = parseInt(countText) || 0;

      if (href && name && count > 0 && featureSlugs.includes(href.substring(1))) {
        const slug = href.substring(1);
        if (!FEATURES_CACHE.find(f => f.slug === slug)) {
          FEATURES_CACHE.push({ slug, name, count });
        }
      }
    });

    return FEATURES_CACHE;
  } catch (error) {
    throw new Error(`Chyba při načítání vlastností: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function searchChalupy(params: SearchParams): Promise<PropertyListing[]> {
  const baseUrl = "https://www.e-chalupy.cz";
  
  // Build URL path
  let searchPath = "/chaty-chalupy";
  
  if (params.region) {
    searchPath = `/${params.region}`;
    if (params.features && params.features.length > 0) {
      searchPath += `/${params.features[0]}`;
    }
  } else if (params.features && params.features.length > 0) {
    searchPath = `/${params.features[0]}`;
  }

  let searchUrl = `${baseUrl}${searchPath}`;

  // Build query parameters
  const queryParams: string[] = [];
  if (params.persons) {
    queryParams.push(`osoby=${params.persons}`);
  }
  if (params.dateFrom) {
    queryParams.push(`od=${params.dateFrom}`);
  }
  if (params.dateTo) {
    queryParams.push(`do=${params.dateTo}`);
  }
  if (params.priceMin) {
    queryParams.push(`cenaMin=${params.priceMin}`);
  }
  if (params.priceMax) {
    queryParams.push(`cenaMax=${params.priceMax}`);
  }

  if (queryParams.length > 0) {
    searchUrl += `?${queryParams.join("&")}`;
  }

  try {
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

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
          url: link.startsWith("http") ? link : `${baseUrl}${link}`,
          imageUrl: imageUrl ? (imageUrl.startsWith("http") ? imageUrl : `${baseUrl}${imageUrl}`) : undefined,
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
    throw new Error(`Chyba při vyhledávání: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function getPropertyDetails(url: string): Promise<PropertyDetails> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

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
      imageUrl: imageUrl ? (imageUrl.startsWith("http") ? imageUrl : `https://www.e-chalupy.cz${imageUrl}`) : undefined,
      rating: rating || undefined,
      features,
      capacity,
      bedrooms,
      tags,
      equipment,
    };
  } catch (error) {
    throw new Error(`Chyba při načítání detailu: ${error instanceof Error ? error.message : String(error)}`);
  }
}
