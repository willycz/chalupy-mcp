# E-Chalupy MCP Server

MCP server pro vyhledávání chalup a rekreačních objektů na webu e-chalupy.cz.

## 🚀 Funkce

- **search_chalupy** - Vyhledávání chalup podle kritérií (kraj, cena, klíčová slova)
- **get_property_details** - Získání detailních informací o konkrétní chalupě

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

**Varianta 1: NPX (doporučeno - automatická instalace)**
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

**Varianta 2: Globální instalace**
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

**Varianta 3: Lokální cesta**
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

### Restartujte Claude Desktop

Po přidání konfigurace restartujte aplikaci Claude Desktop, aby se server načetl.

## 💡 Použití

### Příklady dotazů v Claude Desktop

**Vyhledávání chalup:**
```
Vyhledej chalupy v Jihomoravském kraji do 3 milionů Kč
```

**Vyhledávání s klíčovými slovy:**
```
Najdi chalupu s bazénem v Orlických horách
```

**Detail nemovitosti:**
```
Zobraz mi detaily chalupy z URL: https://www.e-chalupy.cz/inzerat/12345
```

**Pokročilé vyhledávání:**
```
Vyhledej rekreační objekty v ceně 2-4 miliony Kč v Královéhradeckém kraji
```

## 🛠️ Dostupné nástroje

### `search_chalupy`

Parametry:
- `query` (string, optional) - Vyhledávací dotaz
- `region` (string, optional) - Název kraje
- `priceMin` (number, optional) - Minimální cena v Kč
- `priceMax` (number, optional) - Maximální cena v Kč
- `maxResults` (number, optional) - Max. počet výsledků (výchozí: 10)

### `get_property_details`

Parametry:
- `url` (string, required) - URL adresa nemovitosti na e-chalupy.cz

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
