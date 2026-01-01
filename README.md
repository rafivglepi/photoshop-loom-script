# PS Auto-Layout

CSS Flexbox-inspired auto-layout for Adobe Photoshop via ExtendScript.

## Features

- **Stack layouts**: Arrange layers horizontally (`.hstack`) or vertically (`.vstack`)
- **Gap control**: Add consistent spacing between items (`.gap(8)`)
- **Padding**: Add padding around content (`.padding(16)` or `.padding(8,16,8,16)`)
- **Alignment**: Control cross-axis alignment (`.items-center`, `.items-start`, `.items-end`)
- **Content layers**: Background layers that auto-resize to fill their container (`.content`)

## Installation

1. Build the script:
   ```bash
   npm install
   npm run build
   ```

2. Copy `dist/autolayout.jsx` to your Photoshop Scripts folder:
   - **Windows**: `C:\Program Files\Adobe\Adobe Photoshop [version]\Presets\Scripts\`
   - **macOS**: `/Applications/Adobe Photoshop [version]/Presets/Scripts/`

3. Restart Photoshop

4. Access via **File → Scripts → autolayout**

## Usage

Name your layer groups using the CSS-like class syntax:

### Basic Stack Layout

```
.vstack.gap(8)
├── Header Text
├── Body Text
└── Footer Text
```

Arranges children vertically with 8px gap between each.

### Horizontal Layout with Centering

```
.hstack.gap(16).items-center
├── Icon
└── Label
```

Arranges children horizontally with vertical centering.

### Pill Button with Auto-sizing Background

```
.vstack.padding(12,24,12,24)
├── .content              ← Rounded rectangle, auto-sizes to fit
└── Button Label          ← Text layer
```

The `.content` layer stretches to fill the container (text + padding), perfect for button backgrounds.

## Syntax Reference

| Class | Description | Example |
|-------|-------------|---------|
| `.hstack` | Horizontal layout (row) | `.hstack.gap(8)` |
| `.vstack` | Vertical layout (column) | `.vstack.items-center` |
| `.gap(n)` | Space between children (px) | `.gap(16)` |
| `.padding(n)` | Equal padding all sides | `.padding(8)` |
| `.padding(v,h)` | Vertical, horizontal padding | `.padding(8,16)` |
| `.padding(t,r,b,l)` | Individual padding (top, right, bottom, left) | `.padding(8,16,8,16)` |
| `.items-start` | Align children to cross-axis start | |
| `.items-center` | Align children to cross-axis center | |
| `.items-end` | Align children to cross-axis end | |
| `.content` | Layer stretches to fill parent container | Background layers |

## How It Works

1. **Parse**: Scans all groups in the document for layout class names
2. **Calculate**: Computes positions based on layout rules and child sizes
3. **Apply**: Moves layers using `translate()` and resizes `.content` layers

### Two-Layer System

- **Normal children**: Define the intrinsic content size and get positioned by layout rules
- **`.content` children**: Ignored for size calculation, then stretched to fill the container

This allows you to create buttons, cards, and other components where a background shape automatically resizes to fit the content.

## Nested Layouts

Layouts can be nested! The script processes from deepest groups first:

```
.vstack.gap(16).padding(24)
├── .hstack.gap(8).items-center
│   ├── Avatar
│   └── Username
├── Post Content
└── .hstack.gap(12)
    ├── Like Button
    ├── Comment Button
    └── Share Button
```

## Tips

- Use descriptive names after the classes: `.vstack.gap(8) - Card Layout` (the script parses the class portion)
- The script wraps changes in a single undo state
- Works with any layer type: text, shapes, smart objects, groups

## Development

```bash
# Install dependencies
npm install

# Build once
npm run build

# Watch for changes
npm run watch
```

## Testing

To test the script:

1. Create a new PSD document
2. Create a group and name it `.vstack.gap(16).padding(24)`
3. Add some text layers or shape layers inside the group
4. Run the script: File → Scripts → autolayout
5. The children should arrange vertically with 16px gaps and 24px padding

### Pill Button Test

1. Create a group named `.vstack.padding(12,24,12,24)`
2. Inside, add a rounded rectangle and name it `.content`
3. Add a text layer with "Button"
4. Run the script
5. The rounded rectangle should resize to wrap the text with the specified padding

## Limitations

- ExtendScript runs synchronously
- Layer order in Photoshop is reversed (bottom = index 0), handled automatically
- Some layer types may not support resize operations
- Shape layers resize via transform which may affect stroke weights

