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
        description: "Vyhledá pronájmy chalup a chat na e-chalupy.cz podle zadaných kritérií",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Textové vyhledávání v názvech a popisech",
            },
            region: {
              type: "string",
              description: "Slug regionu (např. 'vysocina', 'krkonose', 'sumava'). Použij list_regions pro výpis všech.",
            },
            features: {
              type: "array",
              items: { type: "string" },
              description: "Pole slugů vlastností (např. ['bazen-venkovni', 'se-saunou']). Použij list_features pro výpis všech.",
            },
            persons: {
              type: "number",
              description: "Počet osob (minimální kapacita objektu)",
            },
            dateFrom: {
              type: "string",
              description: "Datum od (YYYY-MM-DD)",
            },
            dateTo: {
              type: "string",
              description: "Datum do (YYYY-MM-DD)",
            },
            priceMin: {
              type: "number",
              description: "Minimální cena v Kč",
            },
            priceMax: {
              type: "number",
              description: "Maximální cena v Kč",
            },
            maxResults: {
              type: "number",
              description: "Maximální počet výsledků (výchozí 10)",
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
