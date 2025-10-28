# Chart Visualization Setup Guide

## Overview
The chart visualization tool has been enhanced to:
1. Generate Chart.js JSON configurations
2. Render charts as PNG images using Plotly Python
3. Upload images to Supabase storage
4. Return signed URLs for easy sharing

## Installation Steps

### 1. Install Node.js Dependencies
```bash
npm install
```

This installs the new `@supabase/supabase-js` package along with other dependencies.

### 2. Install Python Dependencies
```bash
pip install -r requirements.txt
```

This installs:
- `plotly` - For rendering charts
- `kaleido` - For image export
- `pandas` - For data manipulation

### 3. Setup Supabase (Required for Image Uploads)

#### Create Supabase Account
1. Go to [supabase.com](https://supabase.com) and sign up
2. Create a new project
3. Wait for the project to be ready (~2 minutes)

#### Get API Credentials
1. Go to **Settings** → **API**
2. Copy your **Project URL** (looks like `https://xxxxx.supabase.co`)
3. Copy your **anon/public** key

#### Create Storage Bucket
1. Go to **Storage** in the left sidebar
2. Click **New Bucket**
3. Name it exactly: `exports`
4. Make it **Public** (toggle the public option)
5. Click **Create bucket**

#### Configure Bucket Permissions
1. Select the `exports` bucket
2. Go to **Policies** tab
3. Click **New Policy**
4. Enable the following operations:
   - **SELECT** (allow public reads)
   - **INSERT** (allow authenticated uploads)
5. Save the policy

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```env
# Required
GEMINI_API_KEY=your_gemini_api_key_here

# Required for image uploads (optional but recommended)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=your_anon_key_here

# Optional
PORT=3000
```

### 5. Build the Project
```bash
npm run build
```

### 6. Test the Setup
```bash
npm start
```

The server should start without errors and display:
```
MCP CSV Analysis Server running on http://localhost:3000
```

## File Structure

```
.
├── scripts/
│   └── render_chart.py          # Python script for rendering charts
├── requirements.txt             # Python dependencies
├── package.json                 # Updated with @supabase/supabase-js
├── src/
│   └── index.ts                # Updated with Supabase integration
└── output/                      # Generated files directory
    ├── chart_config_*.json     # Chart configurations
    └── chart_*.png             # Rendered images
```

## How It Works

### Workflow
1. **User calls `visualize-data` tool** with CSV data
2. **JSON config is generated** in Chart.js format
3. **Python script is invoked** to render the config as a Plotly chart
4. **Image is saved** locally as PNG (1200x800px)
5. **Image is uploaded** to Supabase `exports` bucket
6. **Signed URL is generated** (valid for 1 year)
7. **Response includes**:
   - Local path to JSON config
   - Local path to PNG image
   - Public Supabase URL to the image

### Example Response
```json
{
  "message": "Visualizations generated successfully",
  "visualizationType": "bar",
  "chartConfig": {
    "path": "/output/chart_config_bar_1234567890.json",
    "filename": "chart_config_bar_1234567890.json"
  },
  "renderedImage": {
    "path": "/output/chart_bar_1234567890.png",
    "filename": "chart_bar_1234567890.png",
    "url": "https://xxxxx.supabase.co/storage/v1/object/sign/exports/chart_bar_1234567890.png?token=..."
  }
}
```

## Troubleshooting

### Python not found
- Ensure Python 3.x is installed: `python3 --version`
- On Windows, use `python` instead of `python3`

### Plotly/Kaleido installation fails
```bash
# Try upgrading pip first
pip install --upgrade pip

# Install dependencies one by one
pip install plotly
pip install kaleido
pip install pandas
```

### Supabase upload fails
- Verify credentials in `.env`
- Check that `exports` bucket exists
- Ensure bucket is public
- Check bucket policies allow INSERT

### Chart rendering fails but everything else works
- The tool will continue to work without image rendering
- You'll still get the JSON config file
- Check Python script path: `scripts/render_chart.py`

## Features

### Supported Chart Types
- **bar**: Vertical bar charts
- **line**: Line charts for trends
- **scatter**: Scatter plots
- **pie**: Pie charts for proportions

### Image Specifications
- Format: PNG
- Resolution: 1200x800 pixels
- Template: Plotly white theme
- Font size: 14px

### Signed URL Details
- Validity: 1 year (31,536,000 seconds)
- Public access: Anyone with the URL can view
- No authentication required
- Secure: URLs contain cryptographic tokens

## Optional: Running Without Supabase

If you don't configure Supabase credentials:
- ✅ JSON configs will still be generated
- ✅ PNG images will still be rendered locally
- ❌ Images won't be uploaded to cloud storage
- ❌ No signed URLs will be returned

This is useful for:
- Local development
- Testing
- Air-gapped environments
- When you only need local files

## Next Steps

1. Test with a sample CSV file
2. Verify images are uploaded to Supabase
3. Share a signed URL to confirm public access
4. Integrate with Claude Desktop

## Support

For issues or questions:
- Check the main [README.md](README.md)
- Review error logs in the console
- Ensure all dependencies are installed

