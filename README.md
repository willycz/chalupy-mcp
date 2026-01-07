# E-Chalupy MCP Server

MCP server pro vyhledávání pronájmů chalup a chat na e-chalupy.cz (pronájem rekreačních objektů na týdny, víkendy).

## 🚀 Funkce

- **search_chalupy** - Vyhledávání pronájmů chalup podle kritérií (kraj, cena, klíčová slova)
- **get_property_details** - Získání detailních informací o konkrétním objektu

## 📦 Instalace

### 1. Naklonujte repozitář
```bash
git clone <repository-url>
cd chalupy-mcp
```

### 2. Nainstalujte závislosti
```bash
npm install
```

### 3. Sestavte projekt
```bash
npm run build
```

Tím se vytvoří složka `dist/` s JavaScript soubory.

## 🔧 Konfigurace s Claude Desktop

### Umístění konfiguračního souboru

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

### Přidejte do `claude_desktop_config.json`:

**Varianta 1: Lokální cesta (funguje hned)**

⚠️ **Nejdříve musíte spustit `npm run build`**, který vytvoří složku `dist/` s JavaScript soubory.

```json
{
  "mcpServers": {
    "chalupy": {
      "command": "node",
      "args": ["/absolutní/cesta/k/chalupy-mcp/dist/index.js"]
    }
  }
}
```

⚠️ **Důležité:** 
- Nahraďte `/absolutní/cesta/k/` skutečnou cestou k projektu
- Soubor `dist/index.js` vznikne až po `npm run build`

**Varianta 2: NPX (vyžaduje publikování na npm)**

Nejdřív publikujte balíček:
```bash
npm login
npm publish
```

Pak použijte v konfiguraci:
```json
{
  "mcpServers": {
    "chalupy": {
      "command": "npx",
      "args": ["-y", "chalupy-mcp"]
    }
  }
}
```

**Varianta 3: Globální instalace (vyžaduje publikování na npm)**
```bash
npm install -g chalupy-mcp
```

```json
{
  "mcpServers": {
    "chalupy": {
      "command": "chalupy-mcp"
    }
  }
}
```

### Restartujte Claude Desktop

Po přidání konfigurace restartujte aplikaci Claude Desktop, aby se server načetl.

## 💡 Použití

### Příklady dotazů v Claude Desktop

**Seznam regionů:**
```
Jaké regiony jsou dostupné pro vyhledávání chalup?
```

**Vyhledávání s filtry:**
```
Vyhledej chalupy na Vysočině s bazénem pro 10 osob
```

**Vyhledávání s termínem:**
```
Najdi chalupu v Krkonoších pro 8 osob od 15.7. do 22.7.2026
```

**Kombinace filtrů:**
```
Chci chalupu v Jeseníkách se saunou a vířivkou pro 12 lidí
```

**Detail objektu:**
```
Zobraz mi detaily této chalupy: https://www.e-chalupy.cz/pronajem-chalupa-milana-velke-losiny-ubytovani-o11240
```

## 🛠️ Dostupné nástroje

### `list_regions`

Vrátí seznam všech českých regionů pro vyhledávání.

**Výstup:**
```json
[
  { "slug": "vysocina", "name": "Vysočina", "count": 1434 },
  { "slug": "krkonose", "name": "Krkonoše", "count": 1445 },
  ...
]
```

### `list_features`

Vrátí seznam všech dostupných vlastností a vybavení pro filtrování.

**Výstup:**
```json
[
  { "slug": "bazen-venkovni", "name": "Bazén - venkovní", "count": 3338 },
  { "slug": "se-saunou", "name": "Sauna", "count": 3033 },
  ...
]
```

### `search_chalupy`

Parametry:
- `query` (string, optional) - Textové vyhledávání v názvech a popisech
- `region` (string, optional) - Slug regionu (např. "vysocina", "krkonose")
- `features` (array, optional) - Pole slugů vlastností (např. ["bazen-venkovni", "se-saunou"])
- `persons` (number, optional) - Minimální počet osob (kapacita objektu)
- `dateFrom` (string, optional) - Datum od (YYYY-MM-DD)
- `dateTo` (string, optional) - Datum do (YYYY-MM-DD)
- `maxResults` (number, optional) - Max. počet výsledků (výchozí: 10)

**Příklad výstupu:**
```json
[
  {
    "title": "Chalupa Milana",
    "price": "od 3 572 Kč objekt za noc",
    "location": "Velké Losiny - Jeseníky",
    "description": "Kompletně zrekonstruovaná chalupa...",
    "url": "https://www.e-chalupy.cz/...",
    "imageUrl": "https://www.e-chalupy.cz/foto/...",
    "rating": "4.7"
  }
]
```

### `get_property_details`

Parametry:
- `url` (string, required) - URL adresa objektu na e-chalupy.cz

**Příklad výstupu:**
```json
{
  "title": "Chalupa Milana (11240)",
  "price": "od 3 572 Kč objekt za noc",
  "location": "Velké Losiny, Olomoucký kraj",
  "capacity": 14,
  "bedrooms": 4,
  "rating": "4.8",
  "tags": ["chalupa 14 osob", "4 ložnice", "sauna", "krb"],
  "equipment": {
    "Obecně": ["wifi, internet", "nekuřácký objekt"],
    "Wellness": ["sauna nebo infrasauna"],
    "Lokalita": ["u lesa", "u potoku"]
  },
  "fullDescription": "V kuchyni kompletně nové vybavení..."
}
```

## 📝 Vývoj

### Spuštění v režimu sledování
```bash
npm run dev
```

### Testování serveru
```bash
npm start
```

Server poběží a čeká na příkazy přes stdio.

## ⚠️ Poznámky

- Server používá web scraping, takže CSS selektory může být nutné aktualizovat při změnách struktury webu e-chalupy.cz
- Pro spolehlivé fungování doporučujeme pravidelné aktualizace
- Server vyžaduje aktivní internetové připojení

## 🔍 Řešení problémů

### Server se nenačítá v Claude Desktop
1. Zkontrolujte cestu v `claude_desktop_config.json`
2. Ujistěte se, že jste projekt sestavili (`npm run build`)
3. Restartujte Claude Desktop
4. Zkontrolujte logy Claude Desktop

### Prázdné výsledky vyhledávání
- Web e-chalupy.cz mohl změnit strukturu HTML
- Zkontrolujte CSS selektory v `src/scraper.ts`

## 📄 Licence

MIT
