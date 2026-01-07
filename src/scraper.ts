import fetch from "node-fetch";
import * as cheerio from "cheerio";

export interface SearchParams {
  query?: string;
  region?: string;
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
  area?: string;
}

export interface PropertyDetails extends PropertyListing {
  fullDescription: string;
  features: string[];
  contact?: string;
  specifications?: Record<string, string>;
}

export async function searchChalupy(params: SearchParams): Promise<PropertyListing[]> {
  const baseUrl = "https://www.e-chalupy.cz";
  let searchUrl = `${baseUrl}/chalupy`;

  const queryParams: string[] = [];
  if (params.region) {
    queryParams.push(`kraj=${encodeURIComponent(params.region)}`);
  }
  if (params.priceMin) {
    queryParams.push(`cena_od=${params.priceMin}`);
  }
  if (params.priceMax) {
    queryParams.push(`cena_do=${params.priceMax}`);
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

    $(".inzerat, .property-item, .listing-item, article").each((i, element) => {
      if (i >= maxResults) return false;

      const $el = $(element);
      const title = $el.find("h2, h3, .title, .property-title").first().text().trim();
      const price = $el.find(".price, .cena, .property-price").first().text().trim();
      const location = $el.find(".location, .locality, .lokace").first().text().trim();
      const description = $el.find(".description, .popis, p").first().text().trim();
      const link = $el.find("a").first().attr("href");
      const imageUrl = $el.find("img").first().attr("src");

      if (title && link) {
        listings.push({
          title,
          price: price || "Cena není uvedena",
          location: location || "Lokalita není uvedena",
          description: description || "",
          url: link.startsWith("http") ? link : `${baseUrl}${link}`,
          imageUrl: imageUrl ? (imageUrl.startsWith("http") ? imageUrl : `${baseUrl}${imageUrl}`) : undefined,
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

    const title = $("h1, .detail-title").first().text().trim();
    const price = $(".price, .cena, .detail-price").first().text().trim();
    const location = $(".location, .locality, .lokace").first().text().trim();
    const fullDescription = $(".description, .popis, .detail-description").text().trim();
    const imageUrl = $("img.main-image, .gallery img").first().attr("src");

    const features: string[] = [];
    $(".features li, .parametry li, .vybaveni li").each((_, el) => {
      const feature = $(el).text().trim();
      if (feature) features.push(feature);
    });

    const specifications: Record<string, string> = {};
    $(".specifications tr, .parametry-table tr").each((_, el) => {
      const key = $(el).find("th, td:first-child").text().trim();
      const value = $(el).find("td:last-child").text().trim();
      if (key && value) specifications[key] = value;
    });

    const contact = $(".contact, .kontakt").first().text().trim();

    return {
      title,
      price: price || "Cena není uvedena",
      location: location || "Lokalita není uvedena",
      description: fullDescription.substring(0, 200) + "...",
      fullDescription,
      url,
      imageUrl: imageUrl ? (imageUrl.startsWith("http") ? imageUrl : `https://www.e-chalupy.cz${imageUrl}`) : undefined,
      features,
      specifications,
      contact: contact || undefined,
    };
  } catch (error) {
    throw new Error(`Chyba při načítání detailu: ${error instanceof Error ? error.message : String(error)}`);
  }
}
