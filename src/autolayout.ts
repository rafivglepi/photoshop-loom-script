/// <reference types="types-for-adobe/Photoshop/2015.5"/>

import { applyContentSizes, applyPositions, applyRoundness } from "./apply"
import { calculateLayout } from "./layout"
import {
	getAllLayerSets,
	getChildren,
	getLayerBounds,
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

  // PHASE 1: Extract ALL fixed layers from ALL groups first
  var allFixedLayers: FixedLayerInfo[] = []
  for (var i = 0; i < layoutGroups.length; i++) {
    var fixedLayers = extractFixedLayers(layoutGroups[i], doc)
    for (var j = 0; j < fixedLayers.length; j++) {
      allFixedLayers.push(fixedLayers[j])
    }
  }

  // PHASE 2: Process all layout groups (without fixed layers interfering)
  for (var k = 0; k < layoutGroups.length; k++) {
    processLayoutGroup(layoutGroups[k], doc)
  }

  // PHASE 3: Restore ALL fixed layers at the very end
  restoreFixedLayers(allFixedLayers)
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
 * Store information about a fixed layer that was temporarily moved
 */
interface FixedLayerInfo {
  layer: any
  originalParent: any
  siblingAfter: any | null // The layer that came right after this one (to restore position)
  absoluteX: number
  absoluteY: number
}

/**
 * Extract fixed layers from a group and move them to document root
 * Returns info needed to restore them later
 */
function extractFixedLayers(layerSet: any, doc: any): FixedLayerInfo[] {
  var fixedLayers: FixedLayerInfo[] = []
  var children = getChildren(layerSet)

  // Find fixed layers and their siblings for restoration
  for (var i = 0; i < children.length; i++) {
    var child = children[i]
    var childConfig = parseLayoutName(child.name)

    if (childConfig.isFixed && isLayerVisible(child)) {
      var bounds = getLayerBounds(child)

      // Find the next non-fixed sibling (if any) to place before it later
      var siblingAfter = null
      for (var j = i + 1; j < children.length; j++) {
        var nextChild = children[j]
        var nextConfig = parseLayoutName(nextChild.name)
        if (!nextConfig.isFixed) {
          siblingAfter = nextChild
          break
        }
      }

      // Store all the info we need to restore this layer
      fixedLayers.push({
        layer: child,
        originalParent: layerSet,
        siblingAfter: siblingAfter,
        absoluteX: bounds.left,
        absoluteY: bounds.top,
      })
    }
  }

  // Now extract them (do this after finding all siblings)
  for (var k = 0; k < fixedLayers.length; k++) {
    fixedLayers[k].layer.move(doc, ElementPlacement.PLACEATBEGINNING)
  }

  return fixedLayers
}

/**
 * Restore fixed layers back to their original parent groups
 */
function restoreFixedLayers(fixedLayers: FixedLayerInfo[]): void {
  for (var i = 0; i < fixedLayers.length; i++) {
    var info = fixedLayers[i]

    // Move layer back to its original parent at its original position
    if (info.siblingAfter) {
      // Place before the sibling that came after it
      info.layer.move(info.siblingAfter, ElementPlacement.PLACEBEFORE)
    } else {
      // No sibling after means it was the last layer (or all siblings after were also fixed)
      var parentChildren = getChildren(info.originalParent)

      if (parentChildren.length > 0) {
        // Place before the last child, then place the last child before the fixed layer
        var lastChild = parentChildren[parentChildren.length - 1]
        info.layer.move(lastChild, ElementPlacement.PLACEBEFORE)
        lastChild.move(info.layer, ElementPlacement.PLACEBEFORE)
      } else {
        // No children, just place inside the empty group
        info.layer.move(info.originalParent, ElementPlacement.INSIDE)
      }
    }

    // Restore absolute position
    var currentBounds = getLayerBounds(info.layer)
    var deltaX = info.absoluteX - currentBounds.left
    var deltaY = info.absoluteY - currentBounds.top

    if (Math.abs(deltaX) > 0.001 || Math.abs(deltaY) > 0.001) {
      info.layer.translate(deltaX, deltaY)
    }
  }
}

/**
 * Process a single layout group
 * Note: Fixed layers are extracted before this is called and restored after all layouts
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
