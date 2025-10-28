#!/usr/bin/env python3
"""
Render Chart.js configuration as Plotly image
Converts Chart.js JSON config to Plotly and exports as PNG
"""

import json
import sys
import os
from pathlib import Path

try:
    import plotly.graph_objects as go
    import plotly.express as px
except ImportError:
    print("Error: plotly is not installed. Run: pip install plotly kaleido", file=sys.stderr)
    sys.exit(1)


def chartjs_to_plotly(config):
    """
    Convert Chart.js configuration to Plotly figure
    
    Args:
        config: Dictionary containing Chart.js configuration
        
    Returns:
        plotly.graph_objects.Figure object
    """
    chart_type = config.get('type', 'bar')
    data = config.get('data', {})
    options = config.get('options', {})
    
    labels = data.get('labels', [])
    datasets = data.get('datasets', [])
    
    # Extract title from options
    title = ''
    if 'plugins' in options and 'title' in options['plugins']:
        title = options['plugins']['title'].get('text', '')
    
    # Create Plotly figure based on chart type
    fig = go.Figure()
    
    for dataset in datasets:
        dataset_label = dataset.get('label', 'Data')
        dataset_data = dataset.get('data', [])
        
        if chart_type == 'bar':
            fig.add_trace(go.Bar(
                x=labels,
                y=dataset_data,
                name=dataset_label,
                marker=dict(
                    color=dataset.get('backgroundColor', 'rgba(54, 162, 235, 0.5)'),
                    line=dict(
                        color=dataset.get('borderColor', 'rgba(54, 162, 235, 1)'),
                        width=dataset.get('borderWidth', 1)
                    )
                )
            ))
        elif chart_type == 'line':
            fig.add_trace(go.Scatter(
                x=labels,
                y=dataset_data,
                name=dataset_label,
                mode='lines+markers',
                line=dict(
                    color=dataset.get('borderColor', 'rgba(54, 162, 235, 1)'),
                    width=dataset.get('borderWidth', 2)
                ),
                marker=dict(
                    color=dataset.get('backgroundColor', 'rgba(54, 162, 235, 0.5)')
                )
            ))
        elif chart_type == 'scatter':
            fig.add_trace(go.Scatter(
                x=labels,
                y=dataset_data,
                name=dataset_label,
                mode='markers',
                marker=dict(
                    color=dataset.get('backgroundColor', 'rgba(54, 162, 235, 0.5)'),
                    size=10,
                    line=dict(
                        color=dataset.get('borderColor', 'rgba(54, 162, 235, 1)'),
                        width=dataset.get('borderWidth', 1)
                    )
                )
            ))
        elif chart_type == 'pie':
            fig.add_trace(go.Pie(
                labels=labels,
                values=dataset_data,
                name=dataset_label
            ))
    
    # Update layout
    fig.update_layout(
        title=title,
        xaxis_title=labels[0] if labels else '',
        yaxis_title=datasets[0].get('label', '') if datasets else '',
        template='plotly_white',
        width=1200,
        height=800,
        font=dict(size=14),
        showlegend=True
    )
    
    return fig


def render_chart(config_path, output_path):
    """
    Read Chart.js config and render as Plotly PNG
    
    Args:
        config_path: Path to Chart.js JSON configuration file
        output_path: Path to save the rendered PNG image
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Read configuration
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        # Convert to Plotly
        fig = chartjs_to_plotly(config)
        
        # Export as PNG
        fig.write_image(output_path, format='png', engine='kaleido')
        
        print(f"Successfully rendered chart to: {output_path}")
        return True
        
    except FileNotFoundError:
        print(f"Error: Configuration file not found: {config_path}", file=sys.stderr)
        return False
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in configuration file: {e}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"Error rendering chart: {e}", file=sys.stderr)
        return False


def main():
    if len(sys.argv) != 3:
        print("Usage: python render_chart.py <config_path> <output_path>", file=sys.stderr)
        sys.exit(1)
    
    config_path = sys.argv[1]
    output_path = sys.argv[2]
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    success = render_chart(config_path, output_path)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()

