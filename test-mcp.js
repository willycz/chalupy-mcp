#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class MCPClient {
  constructor() {
    this.messageId = 0;
    this.pendingRequests = new Map();
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.process = spawn('node', [join(__dirname, 'dist', 'index.js')], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.process.stderr.on('data', (data) => {
        const message = data.toString();
        if (message.includes('běží')) {
          console.log('✓ MCP server started successfully');
          resolve();
        }
      });

      this.process.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        lines.forEach(line => {
          try {
            const response = JSON.parse(line);
            if (response.id && this.pendingRequests.has(response.id)) {
              const { resolve, reject } = this.pendingRequests.get(response.id);
              this.pendingRequests.delete(response.id);
              
              if (response.error) {
                reject(new Error(response.error.message || JSON.stringify(response.error)));
              } else {
                resolve(response.result);
              }
            }
          } catch (e) {
            // Ignore non-JSON lines
          }
        });
      });

      this.process.on('error', reject);
      
      setTimeout(() => reject(new Error('Timeout waiting for server to start')), 5000);
    });
  }

  async initialize() {
    const id = ++this.messageId;
    const request = {
      jsonrpc: '2.0',
      id,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      }
    };

    return this.sendRequest(request);
  }

  async callTool(name, args = {}) {
    const id = ++this.messageId;
    const request = {
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name,
        arguments: args
      }
    };

    return this.sendRequest(request);
  }

  sendRequest(request) {
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(request.id, { resolve, reject });
      this.process.stdin.write(JSON.stringify(request) + '\n');
      
      setTimeout(() => {
        if (this.pendingRequests.has(request.id)) {
          this.pendingRequests.delete(request.id);
          reject(new Error(`Timeout waiting for response to request ${request.id}`));
        }
      }, 30000); // 30 second timeout for each request
    });
  }

  stop() {
    if (this.process) {
      this.process.kill();
    }
  }
}

async function runTests() {
  console.log('🧪 Starting Chalupy MCP Tests\n');
  console.log('=' .repeat(60));
  
  const client = new MCPClient();
  let passedTests = 0;
  let failedTests = 0;

  try {
    await client.start();
    await client.initialize();
    console.log('✓ MCP initialized\n');

    // Test 1: Search for accommodation in Krkonoše for 8 people with price limit
    console.log('Test 1: Chalupy v Krkonoších pro 8 osob, max 5000 Kč/noc');
    console.log('-'.repeat(60));
    try {
      const result = await client.callTool('search_chalupy', {
        region: 'krkonose',
        persons: 8,
        priceMax: 5000,
        maxResults: 5
      });
      
      const accommodations = JSON.parse(result.content[0].text);
      console.log(`✓ Found ${accommodations.length} accommodations`);
      
      if (accommodations.length > 0) {
        console.log(`  Example: ${accommodations[0].title}`);
        console.log(`  Location: ${accommodations[0].location}`);
        console.log(`  Price: ${accommodations[0].price}`);
        console.log(`  URL: ${accommodations[0].url}`);
        passedTests++;
      } else {
        console.log('✗ No accommodations found');
        failedTests++;
      }
    } catch (error) {
      console.log(`✗ Error: ${error.message}`);
      failedTests++;
    }
    console.log();

    // Test 2: Search with pool and sauna on Vysočina with price range
    console.log('Test 2: Chalupy na Vysočině s bazénem a saunou (2000-8000 Kč)');
    console.log('-'.repeat(60));
    try {
      const result = await client.callTool('search_chalupy', {
        region: 'vysocina',
        features: ['bazen-venkovni', 'se-saunou'],
        priceMin: 2000,
        priceMax: 8000,
        maxResults: 5
      });
      
      const accommodations = JSON.parse(result.content[0].text);
      console.log(`✓ Found ${accommodations.length} accommodations with pool and sauna`);
      
      if (accommodations.length > 0) {
        console.log(`  Example: ${accommodations[0].title}`);
        console.log(`  Location: ${accommodations[0].location}`);
        console.log(`  Price: ${accommodations[0].price}`);
        passedTests++;
      } else {
        console.log('✗ No accommodations found');
        failedTests++;
      }
    } catch (error) {
      console.log(`✗ Error: ${error.message}`);
      failedTests++;
    }
    console.log();

    // Test 3: Search in Šumava for 10 people in summer with dates
    console.log('Test 3: Chalupy v Šumavě pro 10 osob (15.7 - 22.7.2026), max 6000 Kč');
    console.log('-'.repeat(60));
    try {
      const result = await client.callTool('search_chalupy', {
        region: 'sumava',
        persons: 10,
        dateFrom: '2026-07-15',
        dateTo: '2026-07-22',
        priceMax: 6000,
        maxResults: 5
      });
      
      const accommodations = JSON.parse(result.content[0].text);
      console.log(`✓ Found ${accommodations.length} accommodations`);
      
      if (accommodations.length > 0) {
        console.log(`  Example: ${accommodations[0].title}`);
        console.log(`  Location: ${accommodations[0].location}`);
        console.log(`  Price: ${accommodations[0].price}`);
        passedTests++;
      } else {
        console.log('✗ No accommodations found');
        failedTests++;
      }
    } catch (error) {
      console.log(`✗ Error: ${error.message}`);
      failedTests++;
    }
    console.log();

    // Test 4: Search in Jeseníky with hot tub and winter dates
    console.log('Test 4: Chalupy v Jeseníkách s vířivkou (15.1 - 22.1.2027), min 300 Kč');
    console.log('-'.repeat(60));
    try {
      const result = await client.callTool('search_chalupy', {
        region: 'jeseniky',
        features: ['s-virivkou'],
        dateFrom: '2027-01-15',
        dateTo: '2027-01-22',
        priceMin: 300,
        maxResults: 5
      });
      
      const accommodations = JSON.parse(result.content[0].text);
      console.log(`✓ Found ${accommodations.length} accommodations with hot tub`);
      
      if (accommodations.length > 0) {
        console.log(`  Example: ${accommodations[0].title}`);
        console.log(`  Location: ${accommodations[0].location}`);
        console.log(`  Price: ${accommodations[0].price}`);
        
        // Test 4b: Get details of the first property
        console.log('\n  Testing property details...');
        try {
          const detailsResult = await client.callTool('get_property_details', {
            url: accommodations[0].url
          });
          
          const details = JSON.parse(detailsResult.content[0].text);
          console.log(`  ✓ Property details retrieved`);
          console.log(`    Title: ${details.title}`);
          console.log(`    Capacity: ${details.capacity} persons`);
          console.log(`    Bedrooms: ${details.bedrooms}`);
          console.log(`    Rating: ${details.rating}`);
          console.log(`    Tags: ${details.tags?.slice(0, 3).join(', ')}`);
          passedTests++;
        } catch (error) {
          console.log(`  ✗ Error getting details: ${error.message}`);
          failedTests++;
        }
      } else {
        console.log('✗ No accommodations found');
        failedTests++;
      }
    } catch (error) {
      console.log(`✗ Error: ${error.message}`);
      failedTests++;
    }
    console.log();

    // Test 5: Budget search with price limit
    console.log('Test 5: Levné chalupy do 2500 Kč/noc v jakémkoliv regionu');
    console.log('-'.repeat(60));
    try {
      const result = await client.callTool('search_chalupy', {
        priceMax: 2500,
        maxResults: 5
      });
      
      const accommodations = JSON.parse(result.content[0].text);
      console.log(`✓ Found ${accommodations.length} budget accommodations`);
      
      if (accommodations.length > 0) {
        console.log(`  Example: ${accommodations[0].title}`);
        console.log(`  Location: ${accommodations[0].location}`);
        console.log(`  Price: ${accommodations[0].price}`);
        passedTests++;
      } else {
        console.log('✗ No accommodations found');
        failedTests++;
      }
    } catch (error) {
      console.log(`✗ Error: ${error.message}`);
      failedTests++;
    }
    console.log();

    // Test 6: List available regions
    console.log('Test 6: Seznam dostupných regionů');
    console.log('-'.repeat(60));
    try {
      const result = await client.callTool('list_regions');
      const regions = JSON.parse(result.content[0].text);
      console.log(`✓ Found ${regions.length} regions`);
      console.log(`  Examples: ${regions.slice(0, 5).map(r => r.name).join(', ')}`);
      passedTests++;
    } catch (error) {
      console.log(`✗ Error: ${error.message}`);
      failedTests++;
    }
    console.log();

    // Summary
    console.log('=' .repeat(60));
    console.log('\n📊 Test Summary:');
    console.log(`   ✓ Passed: ${passedTests}`);
    console.log(`   ✗ Failed: ${failedTests}`);
    console.log(`   Total: ${passedTests + failedTests}`);
    
    if (failedTests === 0) {
      console.log('\n🎉 All tests passed!');
    } else {
      console.log(`\n⚠️  ${failedTests} test(s) failed`);
    }

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    client.stop();
  }
}

runTests();
