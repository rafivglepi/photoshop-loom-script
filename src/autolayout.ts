/// <reference types="types-for-adobe/Photoshop/2015.5"/>

import {
	applyContentSizes,
	applyPositions,
	applyRoundness,
	processBackdropsInGroup,
	resizeBackdropToSize,
} from "./apply"
import { calculateLayout } from "./layout"
import {
	getAllLayerSets,
	getChildren,
	getLayerBounds,
	isAdjustmentLayer,
	isLayerGroup,
	isLayerVisible,
} from "./measure"
import { isLayoutGroup, parseLayoutName } from "./parser"

// Photoshop API declarations
declare var ElementPlacement: any

/**
 * Main entry point - processes all layout groups in the active document
 */
function main(): void {
  // Check if a document is open
  if (app.documents.length === 0) {
    alert("Please open a document first.")
    return
  }

  var doc = app.activeDocument

  // Set units to pixels for consistency
  var originalRulerUnits = app.preferences.rulerUnits
  app.preferences.rulerUnits = Units.PIXELS

  // Process layout
  processDocument(doc)

  // Restore original units
  app.preferences.rulerUnits = originalRulerUnits
}

/**
 * Process all layout groups in the document
 * Processes from deepest nested groups first (bottom-up)
 */
function processDocument(doc: any): void {
  // Get all layer sets
  var allLayerSets = getAllLayerSets(doc)

  // Filter to only layout groups (names starting with .)
  var layoutGroups: any[] = []
  for (var i = 0; i < allLayerSets.length; i++) {
    if (isLayoutGroup(allLayerSets[i].name)) {
      layoutGroups.push(allLayerSets[i])
    }
  }

  if (layoutGroups.length === 0) {
    alert(
      "No layout groups found.\n\nName groups with layout syntax like:\n.vstack.gap(8).padding(16)\n.hstack.items-center"
    )
    return
  }

  // Sort by depth (deepest first) so children are processed before parents
  layoutGroups.sort(function (a, b) {
    return getDepth(b) - getDepth(a)
  })

  // PHASE 0: Save which layers are clipped in ALL layout groups
  // Moving layers can affect .grouped property, so we need to restore clipping masks later
  var allClippedLayers: ClippedLayersInfo[] = []
  for (var idx = 0; idx < layoutGroups.length; idx++) {
    allClippedLayers.push(saveClippedLayers(layoutGroups[idx]))
  }

  // PHASE 1: Extract ALL fixed/relative/backdrop/adjustment layers from ALL groups first
  var allExtractedLayers: ExtractedLayerInfo[] = []
  var extractionOrderCounter = 0
  for (var i = 0; i < layoutGroups.length; i++) {
    var extractedLayers = extractSpecialLayers(
      layoutGroups[i],
      doc,
      extractionOrderCounter
    )
    for (var j = 0; j < extractedLayers.length; j++) {
      allExtractedLayers.push(extractedLayers[j])
      extractionOrderCounter++
    }
  }

  // Separate into categories
  var allRelativeLayers: ExtractedLayerInfo[] = []
  var allNonRelativeLayers: ExtractedLayerInfo[] = []
  var allBackdropLayers: ExtractedLayerInfo[] = []

  for (var idx = 0; idx < allExtractedLayers.length; idx++) {
    var extracted = allExtractedLayers[idx]
    if (extracted.isRelative) {
      allRelativeLayers.push(extracted)
    } else {
      allNonRelativeLayers.push(extracted)
      if (extracted.isBackdrop) {
        allBackdropLayers.push(extracted)
      }
    }
  }

  // PHASE 2: Restore relative layers back to groups (before layout)
  // They'll naturally move with the group when layout positions are applied
  restoreLayersToGroup(allRelativeLayers)

  // PHASE 3: Process all layout groups (without fixed/relative/backdrop/adjustment layers interfering)
  for (var k = 0; k < layoutGroups.length; k++) {
    processLayoutGroup(layoutGroups[k], doc)
  }

  // PHASE 4: Restore all non-relative layers (fixed, backdrop, adjustment) in their original order
  // Sort by extraction order to maintain stacking
  allNonRelativeLayers.sort(function (a, b) {
    return a.extractionOrder - b.extractionOrder
  })
  restoreLayersToGroup(allNonRelativeLayers)

  // PHASE 5: Restore clipping masks for layers that were originally clipped
  // This must happen BEFORE backdrop processing so backdrops see the correct clipping state
  for (var n = 0; n < allClippedLayers.length; n++) {
    restoreClippedLayers(allClippedLayers[n])
  }

  // PHASE 6: Resize backdrop layers to document bounds (after clipping is restored)
  resizeBackdropsToDocument(allBackdropLayers, doc)

  // PHASE 7: Process backdrop layers (merge layers in their FINAL positions)
  // This happens after layout AND after all layers are restored (including clipping)
  // So backdrops capture the absolute final rendered state with everything in place
  for (var m = 0; m < layoutGroups.length; m++) {
    processBackdropsInGroup(layoutGroups[m], doc)
  }
}

/**
 * Get the nesting depth of a layer
 */
function getDepth(layer: any): number {
  var depth = 0
  var current = layer.parent
  while (current && current.typename !== "Document") {
    depth++
    current = current.parent
  }
  return depth
}

/**
 * Store information about a fixed/relative/backdrop/adjustment layer that was temporarily moved
 */
interface ExtractedLayerInfo {
  layer: any
  originalParent: any
  siblingAfter: any | null // The layer that came right after this one (to restore position)
  absoluteX: number
  absoluteY: number
  isRelative: boolean // If true, this layer moves with layout; if false, stays in original position
  isBackdrop: boolean // If true, this is a backdrop layer that should fill document
  isAdjustment: boolean // If true, this is an adjustment layer that affects group bounds
  extractionOrder: number // Order in which layers were extracted (to maintain stacking order)
}

/**
 * Store clipped layers in a group
 */
interface ClippedLayersInfo {
  layerSet: any
  clippedLayers: any[] // Only layers that had .grouped = true
}

/**
 * Save which layers are clipped in a group before extraction (recursively)
 * Moving layers can affect the .grouped state, so we need to know which ones to re-clip
 */
function saveClippedLayers(layerSet: any): ClippedLayersInfo {
  var children = getChildren(layerSet)
  var clipped: any[] = []

  for (var i = 0; i < children.length; i++) {
    var child = children[i]

    // Only save layers that are actually clipped
    if (child.grouped === true) {
      clipped.push(child)
    }

    // Also check inside .relative and .fixed groups (they get extracted too)
    if (isLayerGroup(child)) {
      var childConfig = parseLayoutName(child.name)
      if (childConfig.isRelative || childConfig.isFixed) {
        var innerChildren = getChildren(child)
        for (var j = 0; j < innerChildren.length; j++) {
          if (innerChildren[j].grouped === true) {
            clipped.push(innerChildren[j])
          }
        }
      }
    }
  }

  return {
    layerSet: layerSet,
    clippedLayers: clipped,
  }
}

/**
 * Restore clipping masks for layers that were originally clipped
 * Apply in reverse order (bottom to top) for proper clipping chain
 */
function restoreClippedLayers(info: ClippedLayersInfo): void {
  // Apply in reverse order to ensure bottom layers are clipped before top layers
  for (var i = info.clippedLayers.length - 1; i >= 0; i--) {
    try {
      info.clippedLayers[i].grouped = true
    } catch (e) {
      // Silently ignore if layer doesn't support grouped property
    }
  }
}

/**
 * Extract adjustment layers from inside a relative/fixed group before moving the group
 * This prevents adjustment layers from affecting the parent's bounds calculation
 */
function extractAdjustmentLayersFromGroup(
  group: any,
  doc: any,
  startOrder: number
): ExtractedLayerInfo[] {
  var extractedLayers: ExtractedLayerInfo[] = []
  var children = getChildren(group)
  var currentOrder = startOrder

  for (var i = 0; i < children.length; i++) {
    var child = children[i]
    if (isAdjustmentLayer(child)) {
      var bounds = getLayerBounds(child)

      // Find the next non-adjustment sibling for restoration
      var siblingAfter = null
      for (var j = i + 1; j < children.length; j++) {
        var nextChild = children[j]
        if (!isAdjustmentLayer(nextChild)) {
          siblingAfter = nextChild
          break
        }
      }

      extractedLayers.push({
        layer: child,
        originalParent: group,
        siblingAfter: siblingAfter,
        absoluteX: bounds.left,
        absoluteY: bounds.top,
        isRelative: false,
        isBackdrop: false,
        isAdjustment: true,
        extractionOrder: currentOrder,
      })
      currentOrder++
    }
  }

  // Extract them
  for (var k = 0; k < extractedLayers.length; k++) {
    extractedLayers[k].layer.move(doc, ElementPlacement.PLACEATBEGINNING)
  }

  return extractedLayers
}

/**
 * Extract fixed, relative, backdrop, and adjustment layers from a group and move them to document root
 * Returns info needed to restore them later
 */
function extractSpecialLayers(
  layerSet: any,
  doc: any,
  startOrder: number
): ExtractedLayerInfo[] {
  var extractedLayers: ExtractedLayerInfo[] = []
  var children = getChildren(layerSet)
  var currentOrder = startOrder

  // Find fixed/relative/backdrop/adjustment layers and their siblings for restoration
  for (var i = 0; i < children.length; i++) {
    var child = children[i]
    var childConfig = parseLayoutName(child.name)
    var isAdjustment = isAdjustmentLayer(child)

    // If this is a relative or fixed group, extract adjustment layers from inside it first
    if (
      (childConfig.isRelative || childConfig.isFixed) &&
      isLayerGroup(child) &&
      isLayerVisible(child)
    ) {
      var innerAdjustments = extractAdjustmentLayersFromGroup(
        child,
        doc,
        currentOrder
      )
      for (var k = 0; k < innerAdjustments.length; k++) {
        extractedLayers.push(innerAdjustments[k])
        currentOrder++
      }
    }

    // Check if this layer should be extracted
    var shouldExtract =
      isAdjustment || // Adjustment layers affect group bounds
      ((childConfig.isFixed ||
        childConfig.isRelative ||
        childConfig.isBackdrop) &&
        isLayerVisible(child))

    if (shouldExtract) {
      var bounds = getLayerBounds(child)

      // Find the next sibling that won't be extracted (to restore position later)
      var siblingAfter = null
      for (var j = i + 1; j < children.length; j++) {
        var nextChild = children[j]
        var nextConfig = parseLayoutName(nextChild.name)
        var nextIsAdjustment = isAdjustmentLayer(nextChild)
        if (
          !nextIsAdjustment &&
          !nextConfig.isFixed &&
          !nextConfig.isRelative &&
          !nextConfig.isBackdrop
        ) {
          siblingAfter = nextChild
          break
        }
      }

      // Store all the info we need to restore this layer
      extractedLayers.push({
        layer: child,
        originalParent: layerSet,
        siblingAfter: siblingAfter,
        absoluteX: bounds.left,
        absoluteY: bounds.top,
        isRelative: childConfig.isRelative,
        isBackdrop: childConfig.isBackdrop,
        isAdjustment: isAdjustment,
        extractionOrder: currentOrder,
      })
      currentOrder++
    }
  }

  // Now extract them (do this after finding all siblings)
  for (var k = 0; k < extractedLayers.length; k++) {
    extractedLayers[k].layer.move(doc, ElementPlacement.PLACEATBEGINNING)
  }

  return extractedLayers
}

/**
 * Restore layers back to their original parent groups
 * For relative layers, they naturally move with the group
 * For backdrop layers, they move naturally with the group (will be resized separately)
 * For adjustment layers, they just go back (cannot be moved)
 * For fixed layers, restore to original absolute position
 * Note: .grouped (clipping masks) are restored separately by restoreClippedLayers()
 */
function restoreLayersToGroup(layers: ExtractedLayerInfo[]): void {
  for (var i = 0; i < layers.length; i++) {
    var info = layers[i]

    // Move layer back to its original parent at its original position
    if (info.siblingAfter) {
      // Place before the sibling that came after it
      info.layer.move(info.siblingAfter, ElementPlacement.PLACEBEFORE)
    } else {
      // No sibling after means it was the last layer (or all siblings after were also extracted)
      var parentChildren = getChildren(info.originalParent)

      if (parentChildren.length > 0) {
        // Place before the last child, then place the last child before this layer
        var lastChild = parentChildren[parentChildren.length - 1]
        info.layer.move(lastChild, ElementPlacement.PLACEBEFORE)
        lastChild.move(info.layer, ElementPlacement.PLACEBEFORE)
      } else {
        // No children, just place inside the empty group
        info.layer.move(info.originalParent, ElementPlacement.INSIDE)
      }
    }

    // For fixed layers only, restore to original absolute position
    // For relative, backdrop, and adjustment layers, they cannot or should not be moved
    if (!info.isRelative && !info.isBackdrop && !info.isAdjustment) {
      var currentBounds = getLayerBounds(info.layer)
      var deltaX = info.absoluteX - currentBounds.left
      var deltaY = info.absoluteY - currentBounds.top

      if (Math.abs(deltaX) > 0.001 || Math.abs(deltaY) > 0.001) {
        info.layer.translate(deltaX, deltaY)
      }
    }
  }
}

/**
 * Resize backdrop layers to fill the entire document
 */
function resizeBackdropsToDocument(
  backdrops: ExtractedLayerInfo[],
  doc: any
): void {
  if (backdrops.length === 0) return

  var docWidth = doc.width.as("px")
  var docHeight = doc.height.as("px")

  for (var i = 0; i < backdrops.length; i++) {
    var backdrop = backdrops[i].layer
    resizeBackdropToSize(backdrop, docWidth, docHeight)
  }
}

/**
 * Process a single layout group
 * Note: Fixed and relative layers are extracted before this is called and restored after all layouts
 */
function processLayoutGroup(layerSet: any, doc: any): void {
  var config = parseLayoutName(layerSet.name)

  // Skip if no layout direction and no padding (nothing to do)
  if (
    !config.direction &&
    config.padding.top === 0 &&
    config.padding.right === 0 &&
    config.padding.bottom === 0 &&
    config.padding.left === 0
  ) {
    return
  }

  // Calculate layout (fixed layers are already out of the group)
  var result = calculateLayout(layerSet, config)

  if (result.children.length === 0) {
    return
  }

  // Apply sizes to content layers
  applyContentSizes(result.children)

  // Apply maximum roundness to .rounded layers (after resizing)
  applyRoundness(result.children)

  // Apply positions to all children
  applyPositions(result.children)
}

// Run the script
main()
