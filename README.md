# Photoshop Loom

A powerful layout and styling system for Adobe Photoshop that brings CSS Flexbox-inspired auto-layout to your designs via ExtendScript.

Stop manually nudging layers pixel by pixel. Loom weaves your layers together with declarative layout rules.

## Features

### Layout System

- **Stack layouts**: Arrange layers horizontally (`.hstack`) or vertically (`.vstack`)
- **Gap control**: Add consistent spacing between items (`.gap(8)`)
- **Padding**: Add padding around content (`.padding(16)` or `.padding(8,16,8,16)`)
- **Alignment**: Control cross-axis alignment (`.items-center`, `.items-start`, `.items-end`)
- **Justify**: Control main-axis distribution (`.justify-center`, `.justify-end`, `.justify-between`)
- **Content layers**: Background layers that define container bounds or auto-resize (`.content`, `.content.resize`)

## Installation

1. Build the script:

   ```bash
   npm install
   npm run build
   ```

2. Copy `dist/loom.jsx` to your Photoshop Scripts folder:

   - **Windows**: `C:\Program Files\Adobe\Adobe Photoshop [version]\Presets\Scripts\`
   - **macOS**: `/Applications/Adobe Photoshop [version]/Presets/Scripts/`

3. Restart Photoshop

4. Access via **File → Scripts → loom**

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

### Justify Between (Equal Spacing)

```
.hstack.justify-between
├── Item 1
├── Item 2
└── Item 3
```

Distributes children with equal spacing between them, perfect for toolbars and navigation.

### Fixed-Size Container with Centering

```
.hstack.justify-center
├── .content          ← Rectangle defining container bounds
├── Button 1
├── Button 2
└── Button 3
```

The `.content` layer defines the container size. Buttons center within that space. Add `.resize` to the `.content` layer to make it auto-size instead.

### Pill Button with Auto-sizing Background

```
.vstack.padding(12,24,12,24)
├── .content.resize       ← Rounded rectangle, auto-sizes to fit
└── Button Label          ← Text layer
```

The `.content.resize` layer resizes to fill the text + padding, perfect for button backgrounds.

## Syntax Reference

| Class               | Description                                   | Example                |
| ------------------- | --------------------------------------------- | ---------------------- |
| `.hstack`           | Horizontal layout (row)                       | `.hstack.gap(8)`       |
| `.vstack`           | Vertical layout (column)                      | `.vstack.items-center` |
| `.gap(n)`           | Space between children (px)                   | `.gap(16)`             |
| `.padding(n)`       | Equal padding all sides                       | `.padding(8)`          |
| `.padding(v,h)`     | Vertical, horizontal padding                  | `.padding(8,16)`       |
| `.padding(t,r,b,l)` | Individual padding (top, right, bottom, left) | `.padding(8,16,8,16)`  |
| `.items-start`      | Align children to cross-axis start            |                        |
| `.items-center`     | Align children to cross-axis center           |                        |
| `.items-end`        | Align children to cross-axis end              |                        |
| `.justify-start`    | Align children to main-axis start (default)   |                        |
| `.justify-center`   | Center children on main-axis                  | Requires `.content`    |
| `.justify-end`      | Align children to main-axis end               | Requires `.content`    |
| `.justify-between`  | Distribute children with equal spacing        |                        |
| `.content`          | Layer defines container size                  | Background/container   |
| `.resize`           | Make `.content` resize to fit children        | Use with `.content`    |

\* Note: `justify-center` and `justify-end` only work when there's a `.content` layer defining the container bounds.

## How Loom Works

1. **Parse**: Scans all groups in the document for class names (starting with `.`)
2. **Calculate**: Computes positions based on layout rules and child sizes
3. **Apply**: Moves layers using `translate()` and resizes `.content` layers

### Two-Layer System

- **Normal children**: Define the intrinsic content size and get positioned by layout rules
- **`.content` children**: Ignored for size calculation, then stretched to fill the container (including padding)

**Important**: Padding only affects `.content` layer sizing. Normal children maintain their relative positions to prevent cumulative shifting when running the script multiple times. This means you can run the script repeatedly without layers "drifting" away.

### Container Sizing

Groups in Photoshop don't have independent sizes - they're always the union of their children. Fixed-size behavior only works when you have a `.content` layer:

**With `.content` layer (default)**: The `.content` layer defines the container size. Children are positioned within that space using alignment rules. This enables `justify-center` and `justify-end` to work.

**With `.content.resize`**: The `.content` layer resizes to fit the children (plus padding). Use this for dynamic layouts where the background should wrap its content.

**Without `.content` layer**: Container always auto-sizes to fit children.

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
4. Run the script: File → Scripts → loom
5. The children should arrange vertically with 16px gaps and 24px padding

### Pill Button Test

1. Create a group named `.vstack.padding(12,24,12,24)`
2. Inside, add a rounded rectangle and name it `.content`
3. Add a text layer with "Button"
4. Run the script
5. The rounded rectangle should resize to wrap the text with the specified padding

## Roadmap

- [x] Flexbox-inspired layout system
- [x] Auto-sizing containers with `.content.resize`
- [x] Justify alignment for distributing space
- [ ] Absolute positioning (`.absolute`)
- [ ] Backdrop effects (`.backdrop`)
- [ ] More coming soon!

## Limitations

- ExtendScript runs synchronously
- Layer order in Photoshop is reversed (bottom = index 0), handled automatically
- Some layer types may not support resize operations
- Shape layers resize via transform which may affect stroke weights

## Contributing

Loom is open source! Contributions are welcome. Check out the issues or propose new features.

## License

MIT
