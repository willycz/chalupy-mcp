#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { searchChalupy, getPropertyDetails, listRegions, listFeatures } from "./scraper.js";

// Type guard functions for input validation
function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === "string");
}

function getStringArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (!isString(value)) {
    throw new Error(`Parametr '${key}' musí být řetězec`);
  }
  return value;
}

function getNumberArg(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (!isNumber(value)) {
    throw new Error(`Parametr '${key}' musí být číslo`);
  }
  return value;
}

function getStringArrayArg(args: Record<string, unknown>, key: string): string[] | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (!isStringArray(value)) {
    throw new Error(`Parametr '${key}' musí být pole řetězců`);
  }
  return value;
}

function getRequiredStringArg(args: Record<string, unknown>, key: string): string {
  const value = getStringArg(args, key);
  if (value === undefined) {
    throw new Error(`Parametr '${key}' je povinný`);
  }
  return value;
}

/**
 * Sanitizes error messages to avoid leaking sensitive information
 */
function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Only return known safe error messages
    const safePatterns = [
      /^Neplatná URL/,
      /^URL musí/,
      /^Neplatný/,
      /^Chyba při/,
      /^Parametr/,
      /^HTTP error/,
      /^Požadavek vypršel/,
      /^maxResults/,
    ];
    
    if (safePatterns.some(pattern => pattern.test(error.message))) {
      return error.message;
    }
    
    // For unexpected errors, return a generic message
    console.error("Internal error:", error.message);
    return "Došlo k neočekávané chybě při zpracování požadavku";
  }
  return "Neznámá chyba";
}

const server = new Server(
  {
    name: "chalupy-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_regions",
        description: "Vrátí seznam všech dostupných regionů pro vyhledávání (např. vysocina, krkonose, sumava)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "list_features",
        description: "Vrátí seznam všech dostupných vlastností/vybavení pro filtrování (např. bazen-venkovni, se-saunou, s-virivkou)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "search_chalupy",
        description: "Vyhledá pronájmy chalup a chat na e-chalupy.cz podle zadaných kritérií. Všechny parametry jsou volitelné a lze je libovolně kombinovat.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Volitelné textové vyhledávání v názvech a popisech objektů",
            },
            region: {
              type: "string",
              description: "Volitelný slug regionu pro filtrování podle oblasti (např. 'vysocina', 'krkonose', 'sumava'). Použij list_regions pro výpis všech dostupných regionů.",
            },
            features: {
              type: "array",
              items: { type: "string" },
              description: "Volitelné pole slugů vlastností pro filtrování podle vybavení (např. ['bazen-venkovni', 'se-saunou']). Použij list_features pro výpis všech dostupných vlastností.",
            },
            persons: {
              type: "number",
              description: "Volitelný počet osob - filtruje objekty s minimální kapacitou pro tento počet osob",
            },
            dateFrom: {
              type: "string",
              description: "Volitelné datum začátku pobytu ve formátu YYYY-MM-DD (např. '2026-07-11'). Filtruje dostupnost objektů od tohoto data.",
            },
            dateTo: {
              type: "string",
              description: "Volitelné datum konce pobytu ve formátu YYYY-MM-DD (např. '2026-07-18'). Filtruje dostupnost objektů do tohoto data.",
            },
            priceMin: {
              type: "number",
              description: "Volitelná minimální cena v Kč pro filtrování podle cenového rozmezí",
            },
            priceMax: {
              type: "number",
              description: "Volitelná maximální cena v Kč pro filtrování podle cenového rozmezí",
            },
            maxResults: {
              type: "number",
              description: "Volitelný maximální počet vrácených výsledků (výchozí hodnota je 10)",
              default: 10,
            },
          },
        },
      },
      {
        name: "get_property_details",
        description: "Získá detailní informace o konkrétním objektu k pronájmu včetně kapacity, počtu ložnic a vybavení",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "URL adresa objektu na e-chalupy.cz",
            },
          },
          required: ["url"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new Error("Chybí parametry");
  }

  const typedArgs = args as Record<string, unknown>;

  try {
    if (name === "list_regions") {
      const regions = await listRegions();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(regions, null, 2),
          },
        ],
      };
    } else if (name === "list_features") {
      const features = await listFeatures();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(features, null, 2),
          },
        ],
      };
    } else if (name === "search_chalupy") {
      const results = await searchChalupy({
        query: getStringArg(typedArgs, "query"),
        region: getStringArg(typedArgs, "region"),
        features: getStringArrayArg(typedArgs, "features"),
        persons: getNumberArg(typedArgs, "persons"),
        dateFrom: getStringArg(typedArgs, "dateFrom"),
        dateTo: getStringArg(typedArgs, "dateTo"),
        priceMin: getNumberArg(typedArgs, "priceMin"),
        priceMax: getNumberArg(typedArgs, "priceMax"),
        maxResults: getNumberArg(typedArgs, "maxResults") || 10,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } else if (name === "get_property_details") {
      const url = getRequiredStringArg(typedArgs, "url");
      const details = await getPropertyDetails(url);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(details, null, 2),
          },
        ],
      };
    }

    throw new Error(`Neznámý nástroj: ${name}`);
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Chyba: ${sanitizeErrorMessage(error)}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("E-Chalupy MCP server běží...");
}

main().catch(console.error);
