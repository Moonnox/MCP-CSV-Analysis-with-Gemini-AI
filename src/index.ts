import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import dotenv from 'dotenv';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  isInitializeRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from 'zod';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "node:fs";
import mime from "mime-types";
import path from "path";
import csv from 'csv-parser';
import { createReadStream } from 'fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Chart as ChartJS, ChartConfiguration } from 'chart.js/auto';
import * as d3 from 'd3';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Load environment variables
dotenv.config();

// Gemini API setup
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('GEMINI_API_KEY environment variable is not set');
}

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
let supabaseClient: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseKey) {
  supabaseClient = createClient(supabaseUrl, supabaseKey);
  console.error('Supabase client initialized');
} else {
  console.error('Warning: SUPABASE_URL or SUPABASE_KEY not set. Image upload feature will be disabled.');
}

// Initialize the Google Generative AI client with the beta endpoint
// @ts-ignore - Ignore TypeScript errors for the custom initialization
const genAI = new GoogleGenerativeAI(apiKey, {
  apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta'
});

// Use the thinking model
// @ts-ignore - Ignore TypeScript errors for the beta model
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash"
});

// Configuration with appropriate settings for the thinking model
// @ts-ignore - Ignore TypeScript errors for beta features
const generationConfig = {
  temperature: 0.7,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 65536
};

// Ensure output directory exists
const outputDir = path.join(process.cwd(), 'output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Create server instance
const server = new Server(
  {
    name: "google-thinking",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Schema for generate-thinking tool
const GenerateThinkingSchema = z.object({
  prompt: z.string().describe('Prompt for generating thinking process text'),
  outputDir: z.string().optional().describe('Directory to save output responses'),
});

// Schema for CSV analysis tool
const AnalyzeCSVSchema = z.object({
  csvPath: z.string().describe('Local file path or HTTP/HTTPS URL to the CSV file to analyze'),
  outputDir: z.string().optional().describe('Directory to save analysis results'),
  analysisType: z.enum(['basic', 'detailed']).optional().default('detailed').describe('Type of analysis to perform'),
});

// Schema for visualization tool
const VisualizeDataSchema = z.object({
  csvPath: z.string().describe('Local file path or HTTP/HTTPS URL to the CSV file to visualize'),
  outputDir: z.string().optional().describe('Directory to save visualization results'),
  visualizationType: z.enum(['bar', 'line', 'scatter', 'pie']).default('bar').describe('Type of visualization to generate'),
  columns: z.array(z.string()).optional().describe('Specific columns to visualize'),
  title: z.string().optional().describe('Chart title')
});

// Function to read CSV file and return data
async function readCSVFile(filePath: string): Promise<Record<string, string>[]> {
  // Detect if input is a URL or local file path
  const isURL = filePath.startsWith('http://') || filePath.startsWith('https://');
  
  const results: Record<string, string>[] = [];
  
  if (isURL) {
    // Comment 2: Validate URL format before fetch to fail fast on invalid URLs
    try {
      new URL(filePath);
    } catch (urlError: any) {
      throw new Error(`Invalid URL: ${filePath}`);
    }
    
    // Comment 5: Add fetch timeout to avoid indefinite hangs on slow/unresponsive endpoints
    const controller = new AbortController();
    const timeoutMs = 30000; // 30 seconds
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      // Fetch with timeout signal
      const response = await fetch(filePath, { signal: controller.signal });
      
      // Clear the timeout once response is received
      clearTimeout(timeoutId);
      
      // Check if response is successful (status 200-299)
      if (!response.ok) {
        throw new Error(`Failed to fetch CSV from URL: ${filePath} - HTTP ${response.status} ${response.statusText}`);
      }
      
      // Validate that response body exists
      if (!response.body) {
        throw new Error(`Failed to fetch CSV from URL: ${filePath} - Response body is null`);
      }
      
      // Check Content-Type header to ensure we're getting CSV data
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
        throw new Error(
          `Failed to fetch CSV from URL: ${filePath} - ` +
          `Server returned HTML instead of CSV (Content-Type: ${contentType}). ` +
          `This usually means the URL points to a web page, not a raw CSV file. ` +
          `If using Google Sheets, use the export URL format: https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv. ` +
          `For GitHub, use the 'Raw' button URL. For other services, ensure you're using the direct download/export link.`
        );
      }
      
      // Convert Web ReadableStream to Node.js Readable stream
      const sourceStream = Readable.fromWeb(response.body as any);
      
      // Create CSV parser
      const parser = csv();
      
      // Comment 3: Use async/await with pipeline instead of async executor in Promise
      // Comment 1: Use pipeline() from node:stream/promises to capture all errors
      // Comment 4: pipeline() handles cleanup/abort on errors automatically
      parser.on('data', (data: Record<string, string>) => results.push(data));
      
      await pipeline(sourceStream, parser);
      
      // Additional validation: Check if we received HTML content by examining the parsed data
      if (results.length > 0) {
        const firstRow = results[0];
        const columns = Object.keys(firstRow);
        // Check if any column name contains HTML tags
        const hasHTMLTags = columns.some(col => 
          col.includes('<!DOCTYPE') || 
          col.includes('<html') || 
          col.includes('<HTML') ||
          col.includes('<head') ||
          col.includes('<body')
        );
        
        if (hasHTMLTags) {
          throw new Error(
            `Failed to parse CSV from URL: ${filePath} - ` +
            `Received HTML content instead of CSV data. ` +
            `The URL appears to point to a web page, not a raw CSV file. ` +
            `Please ensure you're using a direct CSV download/export link. ` +
            `Examples: ` +
            `- Google Sheets: https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv ` +
            `- GitHub: Click 'Raw' button to get the raw file URL ` +
            `- Dropbox: Use dl=1 instead of dl=0 in the URL`
          );
        }
      }
      
      return results;
      
    } catch (fetchError: any) {
      // Clear timeout in error case
      clearTimeout(timeoutId);
      
      // Handle abort/timeout errors with clear message
      if (fetchError.name === 'AbortError') {
        throw new Error(`Failed to fetch CSV from URL: ${filePath} - Timeout exceeded (${timeoutMs}ms)`);
      }
      
      // Handle network errors (connection failures, DNS errors, etc.)
      throw new Error(`Failed to fetch CSV from URL: ${filePath} - ${fetchError.message}`);
    }
  } else {
    // Handle local file path case
    const sourceStream = createReadStream(filePath);
    const parser = csv();
    
    // Comment 3: Use async/await with pipeline instead of async executor in Promise
    // Comment 1: Use pipeline() from node:stream/promises to capture all errors
    // Comment 4: pipeline() handles cleanup/abort on errors automatically
    parser.on('data', (data: Record<string, string>) => results.push(data));
    
    try {
      await pipeline(sourceStream, parser);
      return results;
    } catch (error: any) {
      throw new Error(`Error reading local CSV file: ${filePath} - ${error.message}`);
    }
  }
}

// Function to generate EDA prompts based on CSV data
function generateEDAPrompts(data: any[], analysisType: string): string[] {
  const columns = Object.keys(data[0]);
  const sampleSize = Math.min(data.length, 5);
  const sampleData = data.slice(0, sampleSize);
  
  const basicPrompt = `
Analyze this CSV dataset with ${data.length} rows and the following columns: ${columns.join(', ')}.
Here's a sample of the first ${sampleSize} rows:
${JSON.stringify(sampleData, null, 2)}

Please provide:
1. Basic statistical summary for each column
2. Data quality assessment (missing values, duplicates)
3. Key insights and patterns
4. Potential correlations between variables
5. Recommendations for further analysis
`;

  const detailedPrompt = `
Perform a comprehensive Exploratory Data Analysis (EDA) on this CSV dataset with ${data.length} rows and columns: ${columns.join(', ')}.
Sample data (${sampleSize} rows):
${JSON.stringify(sampleData, null, 2)}

Please provide:
1. Detailed statistical analysis for each column including:
   - Distribution analysis
   - Central tendency measures
   - Dispersion measures
   - Outlier detection
2. Comprehensive data quality assessment:
   - Missing values analysis
   - Duplicate records
   - Data consistency
   - Data validation issues
3. Advanced pattern recognition:
   - Temporal patterns (if applicable)
   - Grouping patterns
   - Unusual patterns or anomalies
4. Correlation analysis:
   - Relationships between variables
   - Potential causation indicators
5. Feature importance analysis
6. Recommendations for:
   - Data preprocessing
   - Feature engineering
   - Modeling approaches
   - Further analysis steps
7. Visualization suggestions
8. Business insights and actionable recommendations
`;

  return analysisType === 'basic' ? [basicPrompt] : [basicPrompt, detailedPrompt];
}

// Function to render chart JSON as image using Python/Plotly
async function renderChartImage(configPath: string, outputPath: string): Promise<void> {
  const scriptPath = path.join(process.cwd(), 'scripts', 'render_chart.py');
  
  // Check if Python script exists
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Python render script not found at: ${scriptPath}`);
  }
  
  try {
    const { stdout, stderr } = await execFileAsync('python3', [scriptPath, configPath, outputPath]);
    
    if (stderr && !stderr.includes('Successfully')) {
      console.error(`Python script stderr: ${stderr}`);
    }
    if (stdout) {
      console.error(`Python script stdout: ${stdout}`);
    }
  } catch (error: any) {
    throw new Error(`Failed to render chart image: ${error.message}`);
  }
}

// Function to upload image to Supabase and get signed URL
async function uploadToSupabase(filePath: string, filename: string): Promise<string | null> {
  if (!supabaseClient) {
    console.error('Supabase client not initialized. Skipping upload.');
    return null;
  }

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const bucketName = 'exports';
    
    // Upload to Supabase storage
    const { data, error } = await supabaseClient.storage
      .from(bucketName)
      .upload(filename, fileBuffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (error) {
      console.error(`Error uploading to Supabase: ${error.message}`);
      return null;
    }

    // Generate signed URL (valid for 1 year)
    const { data: signedUrlData, error: urlError } = await supabaseClient.storage
      .from(bucketName)
      .createSignedUrl(filename, 31536000); // 1 year in seconds

    if (urlError) {
      console.error(`Error generating signed URL: ${urlError.message}`);
      return null;
    }

    return signedUrlData.signedUrl;
  } catch (error: any) {
    console.error(`Error in uploadToSupabase: ${error.message}`);
    return null;
  }
}

// Function to create visualizations using Chart.js
async function createVisualization(data: Record<string, string>[], columns: string[], type: string, title: string, outputDir: string): Promise<string[]> {
  const filePaths: string[] = [];
  const timestamp = Date.now();

  // Convert string data to numbers where possible
  const numericData = data.map(row => {
    const newRow: Record<string, any> = {};
    Object.entries(row).forEach(([key, value]) => {
      newRow[key] = isNaN(Number(value)) ? value : Number(value);
    });
    return newRow;
  });

  // Create chart configuration
  const chartConfig: ChartConfiguration = {
    type: type as any,
    data: {
      labels: data.map(row => row[columns[0]]),
      datasets: [{
        label: columns[1],
        data: data.map(row => Number(row[columns[1]])),
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: title || `${columns[1]} by ${columns[0]}`
        }
      }
    }
  };

  // Save chart configuration to JSON file
  const configFilename = `chart_config_${type}_${timestamp}.json`;
  const configPath = path.join(outputDir, configFilename);
  fs.writeFileSync(configPath, JSON.stringify(chartConfig, null, 2));
  filePaths.push(configPath);

  return filePaths;
}

// Enhanced function with image rendering and Supabase upload
async function createVisualizationWithImage(
  data: Record<string, string>[], 
  columns: string[], 
  type: string, 
  title: string, 
  outputDir: string
): Promise<{ configPath: string; imagePath: string | null; imageUrl: string | null }> {
  const timestamp = Date.now();

  // Convert string data to numbers where possible
  const numericData = data.map(row => {
    const newRow: Record<string, any> = {};
    Object.entries(row).forEach(([key, value]) => {
      newRow[key] = isNaN(Number(value)) ? value : Number(value);
    });
    return newRow;
  });

  // Create chart configuration
  const chartConfig: ChartConfiguration = {
    type: type as any,
    data: {
      labels: data.map(row => row[columns[0]]),
      datasets: [{
        label: columns[1],
        data: data.map(row => Number(row[columns[1]])),
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: title || `${columns[1]} by ${columns[0]}`
        }
      }
    }
  };

  // Save chart configuration to JSON file
  const configFilename = `chart_config_${type}_${timestamp}.json`;
  const configPath = path.join(outputDir, configFilename);
  fs.writeFileSync(configPath, JSON.stringify(chartConfig, null, 2));

  // Render chart as image using Python/Plotly
  const imageFilename = `chart_${type}_${timestamp}.png`;
  const imagePath = path.join(outputDir, imageFilename);
  let imageUrl: string | null = null;

  try {
    console.error(`Rendering chart image: ${imageFilename}`);
    await renderChartImage(configPath, imagePath);
    console.error(`Chart image rendered successfully: ${imagePath}`);

    // Upload to Supabase if available
    if (fs.existsSync(imagePath)) {
      console.error(`Uploading image to Supabase...`);
      imageUrl = await uploadToSupabase(imagePath, imageFilename);
      if (imageUrl) {
        console.error(`Image uploaded successfully. URL: ${imageUrl}`);
      }
    }
  } catch (error: any) {
    console.error(`Error rendering/uploading image: ${error.message}`);
    // Continue without image if rendering fails
  }

  return {
    configPath,
    imagePath: fs.existsSync(imagePath) ? imagePath : null,
    imageUrl
  };
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "generate-thinking",
        description: "Generate detailed thinking process text using Gemini's experimental thinking model",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "Prompt for generating thinking process text",
            },
            outputDir: {
              type: "string",
              description: "Directory to save output responses (optional)",
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "analyze-csv",
        description: "Analyze CSV file (local or remote URL) using Gemini's AI capabilities for EDA and data science insights",
        inputSchema: {
          type: "object",
          properties: {
            csvPath: {
              type: "string",
              description: "Local file path or HTTP/HTTPS URL to the CSV file to analyze",
            },
            outputDir: {
              type: "string",
              description: "Directory to save analysis results (optional)",
            },
            analysisType: {
              type: "string",
              enum: ["basic", "detailed"],
              description: "Type of analysis to perform (basic or detailed)",
              default: "detailed",
            },
          },
          required: ["csvPath"],
        },
      },
      {
        name: "visualize-data",
        description: "Generate visualizations from CSV data (local or remote URL) using Chart.js. IMPORTANT: Your CSV file MUST have at least 2 columns. The first column will be used for chart labels (x-axis), and the second column will be used for values (y-axis).",
        inputSchema: {
          type: "object",
          properties: {
            csvPath: {
              type: "string",
              description: "Local file path or HTTP/HTTPS URL to the CSV file to visualize. The CSV MUST contain at least 2 columns."
            },
            outputDir: {
              type: "string",
              description: "Directory to save visualization results (optional)"
            },
            visualizationType: {
              type: "string",
              enum: ["bar", "line", "scatter", "pie"],
              description: "Type of visualization to generate",
              default: "bar"
            },
            columns: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Array of exactly 2 or more column names from your CSV to visualize. First column = labels (x-axis), second column = values (y-axis). If not specified, the first 2 columns from the CSV will be used automatically. REQUIRED: Must specify at least 2 column names if using this parameter.",
              minItems: 2
            },
            title: {
              type: "string",
              description: "Chart title (optional). If not provided, will default to '[Column2] by [Column1]'"
            }
          },
          required: ["csvPath"]
        }
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "generate-thinking": {
        const { prompt, outputDir: customOutputDir } = GenerateThinkingSchema.parse(args);
        const saveDir = customOutputDir ? path.resolve(customOutputDir) : outputDir;
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(saveDir)) {
          fs.mkdirSync(saveDir, { recursive: true });
        }
        
        // Start a chat session with Gemini
        // @ts-ignore - Ignore TypeScript errors for beta features
        const chatSession = model.startChat({
          generationConfig,
          history: [],
        });

        // Send the user's prompt
        console.error(`Sending prompt to Gemini: "${prompt}"`);
        const result = await chatSession.sendMessage(prompt);
        const responseText = result.response.text();
        
        console.error(`Received response from Gemini (${responseText.length} chars)`);
        
        // Save the response to a file
        const timestamp = Date.now();
        const filename = `gemini_thinking_${timestamp}.txt`;
        const filePath = path.join(saveDir, filename);
        fs.writeFileSync(filePath, responseText);
        console.error(`Saved response to: ${filePath}`);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: responseText,
                savedFile: {
                  filename,
                  path: filePath
                }
              }, null, 2),
            },
          ],
        };
      }

      case "analyze-csv": {
        const { csvPath, outputDir: customOutputDir, analysisType } = AnalyzeCSVSchema.parse(args);
        const saveDir = customOutputDir ? path.resolve(customOutputDir) : outputDir;

        // Ensure output directory exists
        if (!fs.existsSync(saveDir)) {
          fs.mkdirSync(saveDir, { recursive: true });
        }

        // Read and parse CSV file
        console.error(`Reading CSV file: ${csvPath}`);
        const csvData = await readCSVFile(csvPath);
        
        if (csvData.length === 0) {
          throw new Error('CSV file is empty or could not be parsed');
        }

        // Generate analysis prompts
        const prompts = generateEDAPrompts(csvData, analysisType || 'detailed');
        
        // Start a chat session with Gemini
        // @ts-ignore - Ignore TypeScript errors for beta features
        const chatSession = model.startChat({
          generationConfig,
          history: [],
        });

        // Process each prompt and collect responses
        const timestamp = Date.now();
        const responses: any[] = [];

        for (let i = 0; i < prompts.length; i++) {
          console.error(`Sending analysis prompt ${i + 1}/${prompts.length} to Gemini`);
          const result = await chatSession.sendMessage(prompts[i]);
          const responseText = result.response.text();
          
          // Save individual response
          const filename = `csv_analysis_${timestamp}_part${i + 1}.txt`;
          const filePath = path.join(saveDir, filename);
          fs.writeFileSync(filePath, responseText);
          
          responses.push({
            part: i + 1,
            content: responseText,
            file: {
              filename,
              path: filePath
            }
          });
        }

        // Create a summary file with all responses
        const summaryFilename = `csv_analysis_${timestamp}_summary.txt`;
        const summaryPath = path.join(saveDir, summaryFilename);
        const summaryContent = responses.map(r => 
          `=== Analysis Part ${r.part} ===\n\n${r.content}\n\n`
        ).join('\n');
        fs.writeFileSync(summaryPath, summaryContent);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: "CSV analysis completed successfully",
                analysisType,
                responses,
                summary: {
                  filename: summaryFilename,
                  path: summaryPath
                }
              }, null, 2),
            },
          ],
        };
      }

      case "visualize-data": {
        const { csvPath, outputDir: customOutputDir, visualizationType, columns, title } = VisualizeDataSchema.parse(args);
        const saveDir = customOutputDir ? path.resolve(customOutputDir) : outputDir;

        // Ensure output directory exists
        if (!fs.existsSync(saveDir)) {
          fs.mkdirSync(saveDir, { recursive: true });
        }

        // Read and parse CSV file
        console.error(`Reading CSV file for visualization: ${csvPath}`);
        const csvData = await readCSVFile(csvPath);
        
        if (csvData.length === 0) {
          throw new Error('CSV file is empty or could not be parsed');
        }

        const availableColumns = Object.keys(csvData[0]);
        const columnsToVisualize = columns || availableColumns.slice(0, 2);

        if (columnsToVisualize.length < 2) {
          throw new Error(
            `At least 2 columns are required for visualization. ` +
            `Available columns in CSV: [${availableColumns.join(', ')}]. ` +
            `Please ensure your CSV has at least 2 columns, or specify at least 2 column names using the 'columns' parameter.`
          );
        }

        // Generate visualizations with image rendering and upload
        const result = await createVisualizationWithImage(
          csvData,
          columnsToVisualize,
          visualizationType,
          title || '',
          saveDir
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: "Visualizations generated successfully",
                visualizationType,
                chartConfig: {
                  path: result.configPath,
                  filename: path.basename(result.configPath)
                },
                renderedImage: result.imagePath ? {
                  path: result.imagePath,
                  filename: path.basename(result.imagePath),
                  url: result.imageUrl
                } : null
              }, null, 2)
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`Error in tool execution:`, error);
    throw error;
  }
});

// Session management for HTTP transport
const transports = new Map<string, StreamableHTTPServerTransport>();

// Start the server
async function main() {
  try {
    // Create Express application
    const app = express();
    app.use(express.json());
    
    // Read port from environment variable, default to 3000
    const portEnv = process.env.PORT;
    const parsedPort = portEnv ? parseInt(portEnv, 10) : 3000;
    const port = Number.isNaN(parsedPort) ? 3000 : parsedPort;

    // Health check endpoint
    app.get('/health', (req: express.Request, res: express.Response) => {
      res.status(200).json({
        status: 'healthy',
        service: 'mcp-csv-analysis-gemini',
        version: '1.0.0'
      });
    });

    // MCP POST endpoint
    app.post('/mcp', async (req: express.Request, res: express.Response) => {
      const sessionId = req.get('mcp-session-id');
      let transport = sessionId ? transports.get(sessionId) : undefined;

      if (!transport) {
        // Check if this is an initialize request
        if (isInitializeRequest(req.body)) {
          // Declare local variable to hold the initialized session ID
          let localSessionId: string | undefined;
          
          // Create new transport with session management
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sessionId: string) => {
              localSessionId = sessionId;
              transports.set(sessionId, transport!);
            }
          });
          
          // Set up cleanup on transport close using captured session ID
          transport.onclose = () => {
            if (localSessionId) {
              transports.delete(localSessionId);
            }
          };
          
          // Connect server to the new transport
          await server.connect(transport);
        } else {
          // Invalid or missing session
          return res.status(404).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Invalid or missing Mcp-Session-Id'
            },
            id: null
          });
        }
      }

      // Handle the MCP request
      await transport.handleRequest(req, res, req.body);
    });

    // Shared handler for GET and DELETE requests
    const handleSession = async (req: express.Request, res: express.Response) => {
      const sessionId = req.get('mcp-session-id');
      const transport = sessionId ? transports.get(sessionId) : undefined;

      if (!transport) {
        return res.status(404).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Unknown Mcp-Session-Id'
          },
          id: null
        });
      }

      await transport.handleRequest(req, res);
    };

    // MCP GET endpoint (for SSE streaming)
    app.get('/mcp', handleSession);

    // MCP DELETE endpoint (for session cleanup)
    app.delete('/mcp', handleSession);

    // Start HTTP server
    const httpServer = app.listen(port, () => {
      const actualPort = port === 0 ? (httpServer.address() as any)?.port : port;
      console.error(`MCP CSV Analysis Server running on http://localhost:${actualPort}`);
      console.error(`MCP endpoint: http://localhost:${actualPort}/mcp`);
      console.error(`Health check: http://localhost:${actualPort}/health`);
    });
  } catch (error) {
    console.error("Fatal error in main():", error);
    process.exit(1);
  }
}

main();