import {
	getBoundsHeight,
	getBoundsWidth,
	getChildren,
	getLayerBounds,
	isLayerVisible,
} from "./measure"
import { isContentLayer, parseLayoutName } from "./parser"
import {
	Bounds,
	ComputedPosition,
	ComputedSize,
	LayoutChild,
	LayoutConfig,
	Spacing,
} from "./types"

/**
 * Represents the result of layout calculation
 */
export interface LayoutResult {
  children: LayoutChild[]
  contentSize: { width: number; height: number }
  containerSize: { width: number; height: number }
}

/**
 * Calculate the layout for a group with layout configuration
 */
export function calculateLayout(
  layerSet: any,
  config: LayoutConfig
): LayoutResult {
  var allChildren = getChildren(layerSet)

  // Separate content layers from normal layers
  var contentLayers: any[] = []
  var normalLayers: any[] = []

  for (var i = 0; i < allChildren.length; i++) {
    var child = allChildren[i]
    if (!isLayerVisible(child)) continue

    if (isContentLayer(child.name)) {
      contentLayers.push(child)
    } else {
      normalLayers.push(child)
    }
  }

  // Get bounds of normal layers
  var normalBounds: Bounds[] = []
  for (var j = 0; j < normalLayers.length; j++) {
    normalBounds.push(getLayerBounds(normalLayers[j]))
  }

  // Calculate content size from normal layers
  var contentSize = calculateContentSize(normalBounds, config)

  // Get group bounds for reference
  var groupBounds = getLayerBounds(layerSet)

  // Calculate available space and container size
  var availableSpace: { width: number; height: number }
  var containerSize: { width: number; height: number }

  // Fixed-size only makes sense if there's a .content layer to define the container bounds
  // Without a .content layer, groups are always auto-sized to fit their children
  var hasContentLayer = contentLayers.length > 0

  // Check if content layer has .resize (auto-size behavior)
  var contentShouldResize = false
  if (hasContentLayer) {
    var contentLayerConfig = parseLayoutName(contentLayers[0].name)
    contentShouldResize = contentLayerConfig.resizeContent
  }

  var useFixedSize = hasContentLayer && !contentShouldResize

  if (useFixedSize) {
    // Fixed-size: use .content layer's existing bounds as available space
    var contentLayerBounds = getLayerBounds(contentLayers[0])
    availableSpace = {
      width:
        getBoundsWidth(contentLayerBounds) -
        config.padding.left -
        config.padding.right,
      height:
        getBoundsHeight(contentLayerBounds) -
        config.padding.top -
        config.padding.bottom,
    }
    containerSize = {
      width: getBoundsWidth(contentLayerBounds),
      height: getBoundsHeight(contentLayerBounds),
    }
  } else {
    // Auto-size: container fits content + padding
    containerSize = {
      width: contentSize.width + config.padding.left + config.padding.right,
      height: contentSize.height + config.padding.top + config.padding.bottom,
    }
    availableSpace = contentSize
  }

  // Calculate positions for normal layers
  var layoutChildren: LayoutChild[] = []

  // Find the current top-left of existing children to maintain their reference point
  // This prevents padding from being applied cumulatively on each run
  var contentStartX: number
  var contentStartY: number

  if (normalBounds.length > 0 && !useFixedSize) {
    // Auto-size mode: use existing children position
    var minX = normalBounds[0].left
    var minY = normalBounds[0].top
    for (var idx = 1; idx < normalBounds.length; idx++) {
      if (normalBounds[idx].left < minX) minX = normalBounds[idx].left
      if (normalBounds[idx].top < minY) minY = normalBounds[idx].top
    }
    contentStartX = minX
    contentStartY = minY
  } else if (useFixedSize) {
    // Fixed-size mode: use .content layer bounds + padding
    var contentLayerBounds = getLayerBounds(contentLayers[0])
    contentStartX = contentLayerBounds.left + config.padding.left
    contentStartY = contentLayerBounds.top + config.padding.top
  } else {
    // Fallback: use group bounds
    contentStartX = groupBounds.left
    contentStartY = groupBounds.top
  }

  // Calculate positions for each normal layer
  var positions = calculatePositions(
    normalLayers,
    normalBounds,
    config,
    availableSpace,
    contentStartX,
    contentStartY
  )

  for (var k = 0; k < normalLayers.length; k++) {
    layoutChildren.push({
      layer: normalLayers[k],
      bounds: normalBounds[k],
      config: parseLayoutName(normalLayers[k].name),
      computedPosition: positions[k],
      computedSize: null,
    })
  }

  // Add content layers with computed size to fill container
  // Content layers are positioned to fill the area around the content (including padding)
  for (var m = 0; m < contentLayers.length; m++) {
    var contentLayerBounds = getLayerBounds(contentLayers[m])
    layoutChildren.push({
      layer: contentLayers[m],
      bounds: contentLayerBounds,
      config: parseLayoutName(contentLayers[m].name),
      computedPosition: {
        x: contentStartX - config.padding.left,
        y: contentStartY - config.padding.top,
      },
      computedSize: {
        width: containerSize.width,
        height: containerSize.height,
      },
    })
  }

  return {
    children: layoutChildren,
    contentSize: contentSize,
    containerSize: containerSize,
  }
}

/**
 * Calculate the total content size based on children bounds and layout direction
 */
function calculateContentSize(
  bounds: Bounds[],
  config: LayoutConfig
): { width: number; height: number } {
  if (bounds.length === 0) {
    return { width: 0, height: 0 }
  }

  var width = 0
  var height = 0

  if (config.direction === "horizontal") {
    // Horizontal: sum widths, max height
    var maxHeight = 0
    for (var i = 0; i < bounds.length; i++) {
      width += getBoundsWidth(bounds[i])
      var h = getBoundsHeight(bounds[i])
      if (h > maxHeight) maxHeight = h
    }
    // Add gaps
    width += config.gap * (bounds.length - 1)
    height = maxHeight
  } else if (config.direction === "vertical") {
    // Vertical: max width, sum heights
    var maxWidth = 0
    for (var j = 0; j < bounds.length; j++) {
      height += getBoundsHeight(bounds[j])
      var w = getBoundsWidth(bounds[j])
      if (w > maxWidth) maxWidth = w
    }
    // Add gaps
    height += config.gap * (bounds.length - 1)
    width = maxWidth
  } else {
    // No direction specified, just use union bounds
    for (var k = 0; k < bounds.length; k++) {
      var bw = getBoundsWidth(bounds[k])
      var bh = getBoundsHeight(bounds[k])
      if (bw > width) width = bw
      if (bh > height) height = bh
    }
  }

  return { width: width, height: height }
}

/**
 * Calculate positions for each child based on layout config
 */
function calculatePositions(
  layers: any[],
  bounds: Bounds[],
  config: LayoutConfig,
  availableSpace: { width: number; height: number },
  startX: number,
  startY: number
): ComputedPosition[] {
  var positions: ComputedPosition[] = []

  if (layers.length === 0) {
    return positions
  }

  // Calculate total content size (without considering available space)
  var totalContentWidth = 0
  var totalContentHeight = 0
  for (var idx = 0; idx < bounds.length; idx++) {
    totalContentWidth += getBoundsWidth(bounds[idx])
    totalContentHeight += getBoundsHeight(bounds[idx])
  }
  totalContentWidth += config.gap * (bounds.length - 1)
  totalContentHeight += config.gap * (bounds.length - 1)

  // Calculate starting offset based on justify alignment
  var mainAxisOffset = 0
  var dynamicGap = config.gap

  if (config.direction === "horizontal") {
    if (config.justify === "center") {
      mainAxisOffset = (availableSpace.width - totalContentWidth) / 2
    } else if (config.justify === "end") {
      mainAxisOffset = availableSpace.width - totalContentWidth
    } else if (config.justify === "between" && layers.length > 1) {
      // Calculate total size without gaps
      var totalChildWidth = 0
      for (var i = 0; i < bounds.length; i++) {
        totalChildWidth += getBoundsWidth(bounds[i])
      }
      var remainingWidth = availableSpace.width - totalChildWidth
      if (remainingWidth > 0) {
        dynamicGap = remainingWidth / (layers.length - 1)
      }
    }
  } else if (config.direction === "vertical") {
    if (config.justify === "center") {
      mainAxisOffset = (availableSpace.height - totalContentHeight) / 2
    } else if (config.justify === "end") {
      mainAxisOffset = availableSpace.height - totalContentHeight
    } else if (config.justify === "between" && layers.length > 1) {
      // Calculate total size without gaps
      var totalChildHeight = 0
      for (var j = 0; j < bounds.length; j++) {
        totalChildHeight += getBoundsHeight(bounds[j])
      }
      var remainingHeight = availableSpace.height - totalChildHeight
      if (remainingHeight > 0) {
        dynamicGap = remainingHeight / (layers.length - 1)
      }
    }
  }

  var currentX =
    startX + (config.direction === "horizontal" ? mainAxisOffset : 0)
  var currentY = startY + (config.direction === "vertical" ? mainAxisOffset : 0)

  for (var i = 0; i < layers.length; i++) {
    var b = bounds[i]
    var childWidth = getBoundsWidth(b)
    var childHeight = getBoundsHeight(b)

    var pos: ComputedPosition

    if (config.direction === "horizontal") {
      // Cross-axis (Y) alignment
      var yOffset = calculateCrossAxisOffset(
        childHeight,
        availableSpace.height,
        config.items
      )

      pos = {
        x: currentX,
        y: startY + yOffset,
      }

      currentX += childWidth + dynamicGap
    } else if (config.direction === "vertical") {
      // Cross-axis (X) alignment
      var xOffset = calculateCrossAxisOffset(
        childWidth,
        availableSpace.width,
        config.items
      )

      pos = {
        x: startX + xOffset,
        y: currentY,
      }

      currentY += childHeight + dynamicGap
    } else {
      // No direction, just center or align based on items
      var xOff = calculateCrossAxisOffset(
        childWidth,
        availableSpace.width,
        config.items
      )
      var yOff = calculateCrossAxisOffset(
        childHeight,
        availableSpace.height,
        config.items
      )

      pos = {
        x: startX + xOff,
        y: startY + yOff,
      }
    }

    positions.push(pos)
  }

  return positions
}

/**
 * Calculate cross-axis offset based on alignment
 */
function calculateCrossAxisOffset(
  childSize: number,
  containerSize: number,
  alignment: string
): number {
  if (alignment === "center") {
    return (containerSize - childSize) / 2
  } else if (alignment === "end") {
    return containerSize - childSize
  }
  // 'start' or default
  return 0
}

// Note: justify-center and justify-end only work when .content layer exists and doesn't have .resize
// Use .content.resize to make the content layer auto-size to fit children
