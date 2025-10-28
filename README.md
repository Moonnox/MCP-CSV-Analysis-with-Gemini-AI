# MCP CSV Analysis with Gemini AI

A powerful Model Context Protocol (MCP) server that provides advanced CSV analysis and thinking generation capabilities using Google's Gemini AI. This tool integrates seamlessly with Claude Desktop and offers sophisticated data analysis, visualization, and natural language processing features. Supports both local CSV files and remote files accessible via HTTP/HTTPS URLs, enabling seamless analysis of data from web sources.

## 🌟 Features

### 1. CSV Analysis Tool (`analyze-csv`)
- **Comprehensive Data Analysis**: Performs detailed Exploratory Data Analysis (EDA) on CSV files
- **Flexible File Sources**: Analyze CSV files from local file system or remote URLs (HTTP/HTTPS)
- **Two Analysis Modes**:
  - `basic`: Quick overview and essential statistics
  - `detailed`: In-depth analysis with advanced insights
- **Analysis Components**:
  - Statistical analysis of all columns
  - Data quality assessment
  - Pattern recognition
  - Correlation analysis
  - Feature importance evaluation
  - Preprocessing recommendations
  - Business insights
  - Visualization suggestions

### 2. Data Visualization Tool (`visualize-data`)
- **Interactive Visualizations**: Creates beautiful and informative charts using Plotly Python
- **Flexible File Sources**: Visualize CSV data from local file system or remote URLs (HTTP/HTTPS)
- **Chart Types**:
  - Bar charts
  - Line charts
  - Scatter plots
  - Pie charts
- **Features**:
  - Automatic chart rendering from JSON configuration
  - High-resolution PNG exports
  - Automatic upload to Supabase storage
  - Signed URLs for easy sharing (1-year validity)
  - Returns both raw JSON config and rendered image URL
  - Customizable titles and labels

### 3. Thinking Generation Tool (`generate-thinking`)
- Generates detailed thinking process text using Gemini's experimental model
- Supports complex reasoning and analysis
- Saves responses with timestamps
- Customizable output directory

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- Python 3.x (for chart rendering)
- TypeScript
- Claude Desktop
- Google Gemini API Key
- Supabase Account (for image storage and hosting)

### Installation

1. Clone and setup:
```bash
git clone [your-repo-url]
cd mcp-csv-analysis-gemini
npm install
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Create `.env` file:
```env
GEMINI_API_KEY=your_api_key_here
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
```

**Setting up Supabase:**
- Create a free account at [supabase.com](https://supabase.com)
- Create a new project
- Go to Settings → API to find your URL and anon key
- Create a storage bucket named `exports` (Settings → Storage → New Bucket)
- Make the bucket public for signed URLs to work

4. Build the project:
```bash
npm run build
```

### Claude Desktop Configuration

1. Create/Edit `%AppData%/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "CSV Analysis": {
      "command": "node",
      "args": ["path/to/mcp-csv-analysis-gemini/dist/index.js"],
      "cwd": "path/to/mcp-csv-analysis-gemini",
      "env": {
        "GEMINI_API_KEY": "your_api_key_here",
        "SUPABASE_URL": "your_supabase_project_url",
        "SUPABASE_KEY": "your_supabase_anon_key"
      }
    }
  }
}
```

2. Restart Claude Desktop

## 📊 Using the Tools

### CSV Analysis
```json
{
  "name": "analyze-csv",
  "arguments": {
    "csvPath": "./data/your_file.csv",
    "analysisType": "detailed",
    "outputDir": "./custom_output"
  }
}
```

#### Using Remote CSV Files
```json
{
  "name": "analyze-csv",
  "arguments": {
    "csvPath": "https://example.com/data/sales_data.csv",
    "analysisType": "detailed",
    "outputDir": "./custom_output"
  }
}
```

The `csvPath` parameter accepts both local file paths and HTTP/HTTPS URLs. When using URLs, ensure the CSV file is publicly accessible or properly authenticated.

### Data Visualization
```json
{
  "name": "visualize-data",
  "arguments": {
    "csvPath": "./data/your_file.csv",
    "visualizationType": "bar",
    "columns": ["column1", "column2"],
    "title": "My Chart Title",
    "outputDir": "./custom_output"
  }
}
```

The tool will return:
- **chartConfig**: Path to the JSON configuration file
- **renderedImage**: Local path and Supabase signed URL to the rendered PNG image

#### Using Remote CSV Files
```json
{
  "name": "visualize-data",
  "arguments": {
    "csvPath": "https://example.com/data/metrics.csv",
    "visualizationType": "line",
    "columns": ["date", "revenue"],
    "title": "Revenue Over Time",
    "outputDir": "./custom_output"
  }
}
```

### Thinking Generation
```json
{
  "name": "generate-thinking",
  "arguments": {
    "prompt": "Your complex analysis prompt here",
    "outputDir": "./custom_output"
  }
}
```

## 📁 Output Structure
```
output/
├── analysis/
│   ├── csv_analysis_[timestamp]_part1.txt
│   ├── csv_analysis_[timestamp]_part2.txt
│   └── csv_analysis_[timestamp]_summary.txt
├── visualizations/
│   ├── chart_config_bar_[timestamp].json
│   ├── chart_bar_[timestamp].png
│   ├── chart_config_line_[timestamp].json
│   └── chart_line_[timestamp].png
└── thinking/
    └── gemini_thinking_[timestamp].txt
```

**Note**: Chart images are automatically uploaded to your Supabase `exports` bucket and accessible via signed URLs.

## 📊 Visualization Types

The `visualize-data` tool supports the following chart types:

### Bar Charts (`visualizationType: "bar"`)
- Best for comparing categories or discrete values
- Shows vertical bars for each data point

### Line Charts (`visualizationType: "line"`)
- Ideal for time-series data and trends
- Displays connected data points

### Scatter Plots (`visualizationType: "scatter"`)
- Shows relationships between two variables
- Each data point as a marker

### Pie Charts (`visualizationType: "pie"`)
- Represents parts of a whole
- Shows proportional data

### Output Format
Each visualization generates:
1. **JSON Configuration**: Chart.js compatible config file
2. **PNG Image**: High-resolution rendered chart (1200x800px)
3. **Signed URL**: Public URL to access the image (valid for 1 year)

## 🌐 Remote File Support

### Network Requirements
- Active internet connection for accessing remote CSV files
- Firewall/proxy configurations must allow outbound HTTPS connections
- DNS resolution for remote hostnames
- No special network configuration needed for local files

### URL Support Details
- **Supported Protocols**: HTTP and HTTPS
- **Authentication**: Currently supports publicly accessible URLs only
- **File Types**: Remote files must be valid CSV format
- **Redirects**: Follows standard HTTP redirects automatically

### Performance Considerations
- **Download Time**: Large remote files may take longer to download before analysis begins
- **Network Latency**: Analysis start time depends on network speed and file size
- **Bandwidth**: Consider bandwidth usage for large CSV files
- **Timeouts**: Very large files or slow connections may timeout (default Node.js fetch timeout applies)

### Best Practices
- Use HTTPS URLs for secure data transmission
- Verify URL accessibility before running analysis
- For frequently analyzed files, consider caching locally
- Monitor network usage when processing large remote datasets
- Test with smaller files first to verify URL accessibility

### Common URL Format Issues

**⚠️ Important: You must use direct CSV download URLs, not web page URLs**

The server expects a URL that returns **raw CSV data**, not an HTML page. If you get an error like "Server returned HTML instead of CSV", you need to use the correct URL format:

#### Google Sheets
- ❌ **Wrong**: `https://docs.google.com/spreadsheets/d/SHEET_ID/edit`
- ✅ **Correct**: `https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv`
- 📝 For specific sheets: Add `&gid=SHEET_GID` to the URL

#### GitHub
- ❌ **Wrong**: `https://github.com/user/repo/blob/main/data.csv`
- ✅ **Correct**: `https://raw.githubusercontent.com/user/repo/main/data.csv`
- 📝 Click the "Raw" button on GitHub to get the correct URL

#### Dropbox
- ❌ **Wrong**: `https://www.dropbox.com/s/FILE_ID/data.csv?dl=0`
- ✅ **Correct**: `https://www.dropbox.com/s/FILE_ID/data.csv?dl=1`
- 📝 Change `dl=0` to `dl=1` for direct download

#### Other Services
- Ensure you're using the **"Download"** or **"Export"** link, not the **"View"** or **"Share"** link
- The URL should directly return CSV content, not redirect to a login or preview page
- Test the URL in a browser or `curl` - it should download the CSV file, not show a web page

### Limitations
- **File Size**: Remote files are loaded into memory; extremely large files (>1GB) may cause memory issues
- **Authentication**: Password-protected or authentication-required URLs are not currently supported
- **Network Errors**: Connection failures, timeouts, or DNS errors will cause the analysis to fail
- **CORS**: Not applicable as this is a server-side tool, not browser-based
- **Rate Limiting**: Some data sources may have rate limits on file downloads

## 🛠️ Development

### Available Scripts
- `npm run build`: Compile TypeScript to JavaScript
- `npm run start`: Start the MCP server
- `npm run dev`: Run in development mode with ts-node

### Environment Variables
- `GEMINI_API_KEY`: Your Google Gemini API key (required)
- `SUPABASE_URL`: Your Supabase project URL (optional, required for image uploads)
- `SUPABASE_KEY`: Your Supabase anon/service key (optional, required for image uploads)

**Note**: If Supabase credentials are not provided, the tool will still generate chart JSON configs and local PNG files, but won't upload to cloud storage.

## 📝 Analysis Details

### Basic Analysis Includes
1. Basic statistical summary for each column
2. Data quality assessment
3. Key insights and patterns
4. Potential correlations
5. Recommendations for further analysis

### Detailed Analysis Includes
1. Comprehensive statistical analysis
   - Distribution analysis
   - Central tendency measures
   - Dispersion measures
   - Outlier detection
2. Advanced data quality assessment
3. Pattern recognition
4. Correlation analysis
5. Feature importance analysis
6. Preprocessing recommendations
7. Visualization suggestions
8. Business insights

## ⚠️ Limitations

- Maximum file size: Dependent on system memory
- Network limitations: See "Remote File Support" section for URL-specific constraints
- Rate limits: Based on Gemini API and Plotly quotas
- Output token limit: 65,536 tokens per response
- CSV format: Standard CSV files only
- Analysis time: Varies with data size and complexity
- Visualization limits: Based on Plotly free tier restrictions

## 🔒 Security Notes

- Store your API keys securely
- Don't share your `.env` file
- Review CSV data for sensitive information
- Use custom output directories for sensitive analyses
- Secure your Plotly credentials

## 🐛 Troubleshooting

### Common Issues
1. **API Key Error**
   - Verify `.env` file exists
   - Check API key validity
   - Ensure proper environment loading

2. **CSV Parsing Error**
   - Verify CSV file format
   - Check file permissions
   - Ensure file is not empty

3. **URL Fetch Error**
   - Verify URL is accessible and publicly available
   - Check internet connection
   - Ensure URL returns valid CSV content
   - Verify firewall/proxy settings allow outbound connections
   - Check for HTTP error responses (404, 403, 500, etc.)

4. **Python/Visualization Error**
   - Ensure Python 3.x is installed and in PATH
   - Install required packages: `pip install -r requirements.txt`
   - Check Python script exists in `scripts/render_chart.py`

5. **Supabase Upload Error**
   - Verify Supabase credentials in `.env`
   - Ensure `exports` bucket exists and is configured
   - Check bucket permissions (should allow public access for signed URLs)

6. **Claude Desktop Connection**
   - Verify config.json syntax
   - Check file paths in config
   - Restart Claude Desktop

### Debug Mode
Add `DEBUG=true` to your `.env` file for verbose logging:
```env
GEMINI_API_KEY=your_key_here
DEBUG=true
```

## 📚 API Reference

### CSV Analysis Tool
```typescript
interface AnalyzeCSVParams {
  csvPath: string;          // Local file path or HTTP/HTTPS URL to CSV file
  outputDir?: string;       // Optional output directory
  analysisType?: 'basic' | 'detailed';  // Analysis type
}
```

### Data Visualization Tool
```typescript
interface VisualizeDataParams {
  csvPath: string;          // Local file path or HTTP/HTTPS URL to CSV file
  outputDir?: string;       // Optional output directory
  visualizationType?: 'bar' | 'line' | 'scatter' | 'pie';  // Chart type (default: 'bar')
  columns?: string[];       // Array of 2+ column names [x-axis, y-axis]
  title?: string;          // Chart title (optional)
}

interface VisualizeDataResult {
  message: string;
  visualizationType: string;
  chartConfig: {
    path: string;          // Local path to JSON config
    filename: string;      // Config filename
  };
  renderedImage: {
    path: string;          // Local path to PNG image
    filename: string;      // Image filename
    url: string | null;    // Supabase signed URL (null if upload disabled)
  } | null;                // null if rendering failed
}
```

### Thinking Generation Tool
```typescript
interface GenerateThinkingParams {
  prompt: string;           // Analysis prompt
  outputDir?: string;       // Optional output directory
}
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT License - See LICENSE file for details
