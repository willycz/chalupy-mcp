#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { searchChalupy, getPropertyDetails } from "./scraper.js";

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
        name: "search_chalupy",
        description: "Vyhledá chalupy na e-chalupy.cz podle zadaných kritérií",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Vyhledávací dotaz (např. 'chalupa jihomoravský kraj', 'rekreační objekt orlické hory')",
            },
            region: {
              type: "string",
              description: "Kraj (např. 'jihomoravský', 'královéhradecký')",
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
        description: "Získá detailní informace o konkrétní chalupě podle URL",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "URL adresa chalupy na e-chalupy.cz",
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
    if (name === "search_chalupy") {
      const results = await searchChalupy({
        query: args.query as string,
        region: args.region as string,
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
