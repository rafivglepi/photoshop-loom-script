import { Bounds } from './types';

// Declare ExtendScript globals
declare var LayerKind: any

/**
 * Adjustment layer kinds that cannot be transformed or moved.
 * These should be ignored during layout operations.
 */
const ADJUSTMENT_LAYER_KINDS = [
  "BLACKANDWHITE",
  "BRIGHTNESSCONTRAST",
  "CHANNELMIXER",
  "COLORBALANCE",
  "COLORLOOKUP",
  "CURVES",
  "EXPOSURE",
  "GRADIENTFILL",
  "GRADIENTMAP",
  "HUESATURATION",
  "INVERSION",
  "LEVELS",
  // "NORMAL",
  "PATTERNFILL",
  "PHOTOFILTER",
  "POSTERIZE",
  "SELECTIVECOLOR",
  // "SMARTOBJECT",
  "SOLIDFILL",
  // "TEXT",
  "THRESHOLD",
  "VIBRANCE",
  "VIDEO",
]

/**
 * Check if a layer is an adjustment layer
 * Adjustment layers cannot be transformed or moved
 */
export function isAdjustmentLayer(layer: any): boolean {
  if (!layer || layer.kind === undefined) {
    return false
  }

  // Check if the layer's kind matches any adjustment layer kind
  for (var i = 0; i < ADJUSTMENT_LAYER_KINDS.length; i++) {
    var kindName = ADJUSTMENT_LAYER_KINDS[i]
    if (
      LayerKind[kindName] !== undefined &&
      layer.kind === LayerKind[kindName]
    ) {
      return true
    }
  }

  return false
}

/**
 * Get the bounds of a layer as a simple object
 * layer.bounds returns [left, top, right, bottom] as UnitValue objects
 */
export function getLayerBounds(layer: any): Bounds {
  var bounds = layer.bounds
  return {
    left: toPixels(bounds[0]),
    top: toPixels(bounds[1]),
    right: toPixels(bounds[2]),
    bottom: toPixels(bounds[3]),
  }
}

/**
 * Convert a UnitValue to pixels
 */
function toPixels(value: any): number {
  if (typeof value === "number") {
    return value
  }
  // UnitValue has a .value property or can be coerced
  if (value && typeof value.as === "function") {
    return value.as("px")
  }
  if (value && typeof value.value !== "undefined") {
    return value.value
  }
  return parseFloat(String(value)) || 0
}

/**
 * Get width from bounds
 */
export function getBoundsWidth(bounds: Bounds): number {
  return bounds.right - bounds.left
}

/**
 * Get height from bounds
 */
export function getBoundsHeight(bounds: Bounds): number {
  return bounds.bottom - bounds.top
}

/**
 * Get the combined bounds of multiple bounds objects
 */
export function getUnionBounds(boundsList: Bounds[]): Bounds {
  if (boundsList.length === 0) {
    return { left: 0, top: 0, right: 0, bottom: 0 }
  }

  var result: Bounds = {
    left: boundsList[0].left,
    top: boundsList[0].top,
    right: boundsList[0].right,
    bottom: boundsList[0].bottom,
  }

  for (var i = 1; i < boundsList.length; i++) {
    var b = boundsList[i]
    if (b.left < result.left) result.left = b.left
    if (b.top < result.top) result.top = b.top
    if (b.right > result.right) result.right = b.right
    if (b.bottom > result.bottom) result.bottom = b.bottom
  }

  return result
}

/**
 * Check if a layer is visible
 */
export function isLayerVisible(layer: any): boolean {
  return layer.visible === true
}

/**
 * Check if a layer is a group (LayerSet)
 */
export function isLayerGroup(layer: any): boolean {
  return layer.typename === "LayerSet"
}

/**
 * Get all direct children of a layer set (group)
 * Returns combined artLayers and layerSets
 */
export function getChildren(layerSet: any): any[] {
  var children: any[] = []

  // Add artLayers (regular layers)
  if (layerSet.artLayers) {
    for (var i = 0; i < layerSet.artLayers.length; i++) {
      children.push(layerSet.artLayers[i])
    }
  }

  // Add layerSets (groups)
  if (layerSet.layerSets) {
    for (var j = 0; j < layerSet.layerSets.length; j++) {
      children.push(layerSet.layerSets[j])
    }
  }

  // Sort by itemIndex to maintain visual order (top to bottom)
  children.sort(function (a, b) {
    return b.itemIndex - a.itemIndex
  })

  return children
}

/**
 * Get all layer sets recursively from a document or layer set
 */
export function getAllLayerSets(container: any): any[] {
  var result: any[] = []

  function collectLayerSets(parent: any) {
    if (parent.layerSets) {
      for (var i = 0; i < parent.layerSets.length; i++) {
        var ls = parent.layerSets[i]
        result.push(ls)
        collectLayerSets(ls)
      }
    }
  }

  collectLayerSets(container)
  return result
}
