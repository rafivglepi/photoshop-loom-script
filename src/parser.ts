import {
	createDefaultConfig,
	ItemsAlignment,
	JustifyAlignment,
	LayoutConfig,
	Spacing,
	StackDirection,
} from "./types"

/**
 * Parse a group name like ".vstack.gap(8).items-center" into a LayoutConfig
 */
export function parseLayoutName(name: string): LayoutConfig {
  const config = createDefaultConfig()

  // Check if name starts with a dot (layout syntax)
  if (!name || name.charAt(0) !== ".") {
    return config
  }

  // Split by dots, filter empty strings
  const classes = name.split(".")

  for (var i = 0; i < classes.length; i++) {
    var cls = classes[i]
    if (!cls) continue

    // Direction
    if (cls === "hstack") {
      config.direction = "horizontal"
    } else if (cls === "vstack") {
      config.direction = "vertical"
    }
    // Content layer (stretches to fill parent)
    else if (cls === "content") {
      config.isContent = true
    }
    // Resize (for .content layers - auto-size to fit children)
    else if (cls === "resize") {
      config.resizeContent = true
    }
    // Rounded (maximize corner radius for rounded rectangles)
    else if (cls === "rounded") {
      config.isRounded = true
    }
    // Fixed (ignored by layout - decorations/backgrounds)
    else if (cls === "fixed") {
      config.isFixed = true
    }
    // Relative (doesn't affect layout but moves with it)
    else if (cls === "relative") {
      config.isRelative = true
    }
    // Backdrop (merge previous layers into smart object)
    else if (cls === "backdrop") {
      config.isBackdrop = true
    }
    // Items alignment (cross-axis)
    else if (cls === "items-start") {
      config.items = "start"
    } else if (cls === "items-center") {
      config.items = "center"
    } else if (cls === "items-end") {
      config.items = "end"
    }
    // Justify alignment (main-axis)
    else if (cls === "justify-start") {
      config.justify = "start"
    } else if (cls === "justify-center") {
      config.justify = "center"
    } else if (cls === "justify-end") {
      config.justify = "end"
    } else if (cls === "justify-between") {
      config.justify = "between"
    }
    // Gap
    else if (cls.indexOf("gap(") === 0) {
      config.gap = parseGap(cls)
    }
    // Padding
    else if (cls.indexOf("padding(") === 0) {
      config.padding = parsePadding(cls)
    }
  }

  return config
}

/**
 * Parse gap(n) syntax
 */
function parseGap(cls: string): number {
  // Extract number from gap(n)
  var match = cls.match(/gap\((\d+)\)/)
  if (match && match[1]) {
    return parseInt(match[1], 10)
  }
  return 0
}

/**
 * Parse padding(n) or padding(t,r,b,l) syntax
 */
function parsePadding(cls: string): Spacing {
  // Extract values from padding(...)
  var match = cls.match(/padding\(([^)]+)\)/)
  if (!match || !match[1]) {
    return { top: 0, right: 0, bottom: 0, left: 0 }
  }

  var values = match[1].split(",")

  if (values.length === 1) {
    // padding(n) - all sides equal
    var n = parseInt(values[0], 10) || 0
    return { top: n, right: n, bottom: n, left: n }
  } else if (values.length === 2) {
    // padding(v, h) - vertical, horizontal
    var v = parseInt(values[0], 10) || 0
    var h = parseInt(values[1], 10) || 0
    return { top: v, right: h, bottom: v, left: h }
  } else if (values.length === 4) {
    // padding(t, r, b, l) - top, right, bottom, left
    return {
      top: parseInt(values[0], 10) || 0,
      right: parseInt(values[1], 10) || 0,
      bottom: parseInt(values[2], 10) || 0,
      left: parseInt(values[3], 10) || 0,
    }
  }

  return { top: 0, right: 0, bottom: 0, left: 0 }
}

/**
 * Check if a layer name indicates it should be processed for layout
 */
export function isLayoutGroup(name: string): boolean {
  if (!name || name.charAt(0) !== ".") return false

  // Must have at least one layout class
  return (
    name.indexOf(".hstack") !== -1 ||
    name.indexOf(".vstack") !== -1 ||
    name.indexOf(".padding") !== -1
  )
}

/**
 * Check if a layer name indicates it's a content layer
 */
export function isContentLayer(name: string): boolean {
  return !!name && name.indexOf(".content") !== -1
}

/**
 * Check if a layer name indicates it's a fixed layer
 */
export function isFixedLayer(name: string): boolean {
  return !!name && name.indexOf(".fixed") !== -1
}

/**
 * Check if a layer name indicates it's a relative layer
 */
export function isRelativeLayer(name: string): boolean {
  return !!name && name.indexOf(".relative") !== -1
}

/**
 * Check if a layer name indicates it's a backdrop layer
 */
export function isBackdropLayer(name: string): boolean {
  return !!name && name.indexOf(".backdrop") !== -1
}
