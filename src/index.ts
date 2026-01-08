#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { searchChalupy, getPropertyDetails, listRegions, listFeatures } from "./scraper.js";

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
        query: args.query as string,
        region: args.region as string,
        features: args.features as string[],
        persons: args.persons as number,
        dateFrom: args.dateFrom as string,
        dateTo: args.dateTo as string,
        priceMin: args.priceMin as number,
        priceMax: args.priceMax as number,
        maxResults: (args.maxResults as number) || 10,
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
      const details = await getPropertyDetails(args.url as string);

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
          text: `Chyba: ${error instanceof Error ? error.message : String(error)}`,
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
