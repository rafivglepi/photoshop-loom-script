import {
	getBoundsHeight,
	getBoundsWidth,
	getChildren,
	getLayerBounds,
	isAdjustmentLayer,
	isLayerGroup,
	isLayerVisible,
} from "./measure"
import { parseLayoutName } from "./parser"
import { applyMaxRoundness } from "./rounded"
import { Bounds, ComputedSize, LayoutChild } from "./types"

// Declare ExtendScript globals
declare function charIDToTypeID(id: string): number
declare function stringIDToTypeID(id: string): number
declare function executeAction(id: number, desc: any, mode: any): void
declare var ActionDescriptor: any
declare var ActionReference: any
declare var DialogModes: any
declare var AnchorPosition: any
declare var LayerKind: any
declare var ElementPlacement: any
declare var SaveOptions: any

/**
 * Apply computed positions to layout children
 * Moves layers to their calculated positions using translate
 */
export function applyPositions(children: LayoutChild[]): void {
  for (var i = 0; i < children.length; i++) {
    var child = children[i]

    if (!child.computedPosition) continue

    // Skip adjustment layers (they cannot be transformed or moved)
    if (isAdjustmentLayer(child.layer)) continue

    var currentBounds = child.bounds
    var targetX = child.computedPosition.x
    var targetY = child.computedPosition.y

    // Calculate delta from current position to target
    var deltaX = targetX - currentBounds.left
    var deltaY = targetY - currentBounds.top

    // Only translate if there's a meaningful difference
    if (Math.abs(deltaX) > 0.001 || Math.abs(deltaY) > 0.001) {
      child.layer.translate(deltaX, deltaY)
    }
  }
}

/**
 * Apply computed sizes to content layers
 * Resizes layers to fill their container
 */
export function applyContentSizes(children: LayoutChild[]): void {
  for (var i = 0; i < children.length; i++) {
    var child = children[i]

    if (!child.computedSize || !child.config.isContent) continue

    // Skip adjustment layers (they cannot be transformed or resized)
    if (isAdjustmentLayer(child.layer)) continue

    resizeLayerTo(child.layer, child.computedSize)
  }
}

/**
 * Resize a layer to a specific width and height
 * Uses scale transform relative to current size
 */
function resizeLayerTo(layer: any, targetSize: ComputedSize): void {
  var bounds = getLayerBounds(layer)
  var currentWidth = getBoundsWidth(bounds)
  var currentHeight = getBoundsHeight(bounds)

  // Avoid division by zero
  if (currentWidth < 0.001 || currentHeight < 0.001) return

  var scaleX = (targetSize.width / currentWidth) * 100
  var scaleY = (targetSize.height / currentHeight) * 100

  // Use resize with anchor at top-left
  try {
    layer.resize(scaleX, scaleY, AnchorPosition.TOPLEFT)
  } catch (e) {
    // Some layer types may not support resize
    // Fall back to transform if available
    try {
      resizeWithTransform(layer, targetSize, bounds)
    } catch (e2) {
      // Layer cannot be resized
    }
  }
}

/**
 * Alternative resize using free transform
 * Used as fallback when layer.resize() doesn't work
 */
function resizeWithTransform(
  layer: any,
  targetSize: ComputedSize,
  currentBounds: Bounds
): void {
  var currentWidth = getBoundsWidth(currentBounds)
  var currentHeight = getBoundsHeight(currentBounds)

  if (currentWidth < 0.001 || currentHeight < 0.001) return

  var scaleX = (targetSize.width / currentWidth) * 100
  var scaleY = (targetSize.height / currentHeight) * 100

  // Select the layer and apply free transform
  var doc = app.activeDocument
  doc.activeLayer = layer

  // Use action descriptor for transform
  var idTrnf = charIDToTypeID("Trnf")
  var desc = new ActionDescriptor()

  var idnull = charIDToTypeID("null")
  var ref = new ActionReference()
  ref.putEnumerated(
    charIDToTypeID("Lyr "),
    charIDToTypeID("Ordn"),
    charIDToTypeID("Trgt")
  )
  desc.putReference(idnull, ref)

  var idFTcs = charIDToTypeID("FTcs")
  var idQCSt = charIDToTypeID("QCSt")
  var idQcsa = charIDToTypeID("Qcsa")
  desc.putEnumerated(idFTcs, idQCSt, idQcsa)

  // Width
  var idWdth = charIDToTypeID("Wdth")
  var idPrc = charIDToTypeID("#Prc")
  desc.putUnitDouble(idWdth, idPrc, scaleX)

  // Height
  var idHght = charIDToTypeID("Hght")
  desc.putUnitDouble(idHght, idPrc, scaleY)

  executeAction(idTrnf, desc, DialogModes.NO)
}

/**
 * Transform a layer from its center point
 * This is used to resize layers while keeping them centered
 */
function transformLayerFromCenter(
  layer: any,
  scaleX: number,
  scaleY: number
): void {
  // Select the layer
  var doc = app.activeDocument
  doc.activeLayer = layer

  try {
    // Try using resize with center anchor first
    layer.resize(scaleX, scaleY, AnchorPosition.MIDDLECENTER)
  } catch (e) {
    // If resize fails, use transform action
    var idTrnf = charIDToTypeID("Trnf")
    var desc = new ActionDescriptor()

    var idnull = charIDToTypeID("null")
    var ref = new ActionReference()
    ref.putEnumerated(
      charIDToTypeID("Lyr "),
      charIDToTypeID("Ordn"),
      charIDToTypeID("Trgt")
    )
    desc.putReference(idnull, ref)

    // Set free transform corner scale mode
    var idFTcs = charIDToTypeID("FTcs")
    var idQCSt = charIDToTypeID("QCSt")
    var idQcsa = charIDToTypeID("Qcsa")
    desc.putEnumerated(idFTcs, idQCSt, idQcsa)

    // Width and Height (scale percentages)
    var idWdth = charIDToTypeID("Wdth")
    var idPrc = charIDToTypeID("#Prc")
    desc.putUnitDouble(idWdth, idPrc, scaleX)

    var idHght = charIDToTypeID("Hght")
    desc.putUnitDouble(idHght, idPrc, scaleY)

    executeAction(idTrnf, desc, DialogModes.NO)
  }
}

/**
 * Move a layer to an absolute position
 */
export function moveLayerTo(layer: any, x: number, y: number): void {
  // Skip adjustment layers (they cannot be transformed or moved)
  if (isAdjustmentLayer(layer)) return

  var bounds = getLayerBounds(layer)
  var deltaX = x - bounds.left
  var deltaY = y - bounds.top

  if (Math.abs(deltaX) > 0.001 || Math.abs(deltaY) > 0.001) {
    layer.translate(deltaX, deltaY)
  }
}

/**
 * Resize a layer to exactly match target bounds
 * Handles both position and size in one operation
 */
export function fitLayerToBounds(layer: any, targetBounds: Bounds): void {
  // Skip adjustment layers (they cannot be transformed or moved)
  if (isAdjustmentLayer(layer)) return

  var targetWidth = getBoundsWidth(targetBounds)
  var targetHeight = getBoundsHeight(targetBounds)

  // First resize to target size
  resizeLayerTo(layer, { width: targetWidth, height: targetHeight })

  // Then move to target position
  moveLayerTo(layer, targetBounds.left, targetBounds.top)
}

/**
 * Apply maximum roundness to layers with .rounded class
 * Sets corner radius to the maximum possible value (half the smaller dimension)
 */
export function applyRoundness(children: LayoutChild[]): void {
  for (var i = 0; i < children.length; i++) {
    var child = children[i]

    // Skip adjustment layers (they cannot be transformed)
    if (isAdjustmentLayer(child.layer)) continue

    // Check if this layer should have max roundness applied
    if (child.config.isRounded) {
      applyMaxRoundness(child.layer)
    }

    // Recursively check children of this layer (especially for .content layers)
    applyRoundnessRecursive(child.layer)
  }
}

/**
 * Recursively apply roundness to nested layers
 */
function applyRoundnessRecursive(layer: any): void {
  // Check if this layer is a group
  if (!isLayerGroup(layer)) {
    return
  }

  // Get all children of this group
  var children = getChildren(layer)

  for (var i = 0; i < children.length; i++) {
    var child = children[i]

    // Skip adjustment layers (they cannot be transformed)
    if (isAdjustmentLayer(child)) continue

    var config = parseLayoutName(child.name)

    // Apply roundness if this child has .rounded
    if (config.isRounded) {
      applyMaxRoundness(child)
    }

    // Recursively check this child's children
    if (isLayerGroup(child)) {
      applyRoundnessRecursive(child)
    }
  }
}

/**
 * Process backdrop layers in a group
 * Merges all visible layers below each backdrop into a smart object
 */
export function processBackdropsInGroup(layerSet: any, doc: any): void {
  var children = getChildren(layerSet)

  // Find all backdrop layers
  for (var i = 0; i < children.length; i++) {
    var child = children[i]
    var config = parseLayoutName(child.name)

    // Process backdrop if visible
    if (config.isBackdrop && isLayerVisible(child)) {
      processBackdropLayer(child, doc)
    }
  }
}

/**
 * Get all layers in the document in visual stacking order (top to bottom)
 */
function getAllLayersInOrder(doc: any): any[] {
  var allLayers: any[] = []

  function collectLayers(container: any): void {
    var children = getChildren(container)
    for (var i = 0; i < children.length; i++) {
      var child = children[i]
      allLayers.push(child)

      // Recursively collect from groups
      if (isLayerGroup(child)) {
        collectLayers(child)
      }
    }
  }

  collectLayers(doc)
  return allLayers
}

/**
 * Process a single backdrop layer
 * Opens the backdrop smart object and replaces its contents with merged layers
 * Merges ALL visible layers below the backdrop in the entire document
 */
function processBackdropLayer(backdropLayer: any, doc: any): void {
  // Verify the backdrop layer is a smart object
  if (backdropLayer.kind !== LayerKind.SMARTOBJECT) {
    // Skip if not a smart object
    return
  }

  // Get all layers in the document in stacking order
  var allLayers = getAllLayersInOrder(doc)

  // Find the index of the backdrop layer
  var backdropIndex = -1
  for (var i = 0; i < allLayers.length; i++) {
    if (allLayers[i] === backdropLayer) {
      backdropIndex = i
      break
    }
  }

  if (backdropIndex === -1) {
    return
  }

  // Collect layers to merge (all visible layers AFTER the backdrop in the array)
  // Since array is sorted top-to-bottom in panel, layers after are visually BELOW
  var layersToMerge: any[] = []

  // Get all layers below the backdrop (higher index = visually below in layers panel)
  for (var i = backdropIndex + 1; i < allLayers.length; i++) {
    var layer = allLayers[i]
    var layerConfig = parseLayoutName(layer.name)

    // Skip other backdrop layers to avoid conflicts
    // Include all other visible layers
    if (isLayerVisible(layer) && !layerConfig.isBackdrop) {
      layersToMerge.push(layer)
    }
  }

  // If no layers to merge, skip
  if (layersToMerge.length === 0) {
    return
  }

  try {
    var mainDoc = app.activeDocument

    // Select the first layer to merge
    mainDoc.activeLayer = layersToMerge[0]
    selectLayer(layersToMerge[0])

    // Shift+select all other layers to merge
    for (var j = 1; j < layersToMerge.length; j++) {
      addToSelection(layersToMerge[j])
    }

    // Create a merged stamp (doesn't affect original layers)
    var mergedLayer = stampLayers()

    if (!mergedLayer) {
      return
    }

    // Copy the merged layer
    copyLayer()

    // Try to open the smart object for editing
    try {
      mainDoc.activeLayer = backdropLayer
      editSmartObject()
    } catch (editError) {
      // Smart object couldn't be opened (might have effects or other issues)
      // Clean up the merged layer and skip this backdrop
      try {
        mainDoc.activeLayer = mergedLayer
        mergedLayer.remove()
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      return
    }

    // Now in the smart object document
    var soDoc = app.activeDocument

    // Paste the copied layer in place
    pasteInPlace()

    // Delete all other layers in the smart object
    clearSmartObjectContents(soDoc)

    // Save and close the smart object
    soDoc.save()
    soDoc.close(SaveOptions.SAVECHANGES)

    // Back to main document
    app.activeDocument = mainDoc

    // Delete the temporary merged layer
    mainDoc.activeLayer = mergedLayer
    mergedLayer.remove()
  } catch (e) {
    // If anything fails, try to recover
    try {
      // Close any open smart object documents
      while (app.documents.length > 1 && app.activeDocument !== doc) {
        app.activeDocument.close(SaveOptions.DONOTSAVECHANGES)
      }

      // Make sure we're back in the main document
      if (app.activeDocument !== doc) {
        app.activeDocument = doc
      }
    } catch (e2) {
      // Silently fail
    }
  }
}

/**
 * Select a single layer (clear previous selection)
 */
function selectLayer(layer: any): void {
  var desc = new ActionDescriptor()
  var ref = new ActionReference()
  ref.putIdentifier(charIDToTypeID("Lyr "), layer.id)
  desc.putReference(charIDToTypeID("null"), ref)
  desc.putBoolean(charIDToTypeID("MkVs"), false)
  executeAction(charIDToTypeID("slct"), desc, DialogModes.NO)
}

/**
 * Add a layer to the current selection
 */
function addToSelection(layer: any): void {
  var desc = new ActionDescriptor()
  var ref = new ActionReference()
  ref.putIdentifier(charIDToTypeID("Lyr "), layer.id)
  desc.putReference(charIDToTypeID("null"), ref)
  desc.putEnumerated(
    stringIDToTypeID("selectionModifier"),
    stringIDToTypeID("selectionModifierType"),
    stringIDToTypeID("addToSelectionContinuous")
  )
  desc.putBoolean(charIDToTypeID("MkVs"), false)
  executeAction(charIDToTypeID("slct"), desc, DialogModes.NO)
}

/**
 * Create a merged stamp of selected layers (doesn't affect originals)
 * Returns the merged layer
 */
function stampLayers(): any {
  try {
    var doc = app.activeDocument

    // Stamp visible (Ctrl+Alt+Shift+E / Cmd+Opt+Shift+E)
    var desc = new ActionDescriptor()
    desc.putBoolean(charIDToTypeID("Dplc"), true)
    executeAction(charIDToTypeID("Mrg2"), desc, DialogModes.NO)

    // The stamped layer is now the active layer
    return doc.activeLayer
  } catch (e) {
    return null
  }
}

/**
 * Copy the current layer
 */
function copyLayer(): void {
  var desc = new ActionDescriptor()
  desc.putString(stringIDToTypeID("copyHint"), "layers")
  executeAction(charIDToTypeID("copy"), desc, DialogModes.NO)
}

/**
 * Edit/open a smart object for editing
 */
function editSmartObject(): void {
  var desc = new ActionDescriptor()
  executeAction(
    stringIDToTypeID("placedLayerEditContents"),
    desc,
    DialogModes.NO
  )
}

/**
 * Paste in place
 */
function pasteInPlace(): void {
  var desc = new ActionDescriptor()
  desc.putBoolean(stringIDToTypeID("inPlace"), true)
  executeAction(charIDToTypeID("past"), desc, DialogModes.NO)
}

/**
 * Clear all contents from a smart object document except the just-pasted layer
 */
function clearSmartObjectContents(soDoc: any): void {
  try {
    var pastedLayer = soDoc.activeLayer

    // Delete all art layers except the pasted one
    for (var i = soDoc.artLayers.length - 1; i >= 0; i--) {
      if (soDoc.artLayers[i] !== pastedLayer) {
        soDoc.artLayers[i].remove()
      }
    }

    // Delete all layer sets
    for (var j = soDoc.layerSets.length - 1; j >= 0; j--) {
      soDoc.layerSets[j].remove()
    }
  } catch (e) {
    // Silently fail
  }
}

/**
 * Resize a backdrop layer and its smart object contents to fill a specific size
 * Positions it at (0, 0) and sizes it to match the target dimensions
 */
export function resizeBackdropToSize(
  backdropLayer: any,
  targetWidth: number,
  targetHeight: number
): void {
  if (backdropLayer.kind !== LayerKind.SMARTOBJECT) {
    return
  }

  try {
    var mainDoc = app.activeDocument

    // First resize the backdrop layer itself to target size using transform
    var currentBounds = getLayerBounds(backdropLayer)
    var currentWidth = getBoundsWidth(currentBounds)
    var currentHeight = getBoundsHeight(currentBounds)

    if (currentWidth > 0.001 && currentHeight > 0.001) {
      // Select the backdrop layer
      mainDoc.activeLayer = backdropLayer

      // Calculate scale to fit document
      var scaleX = (targetWidth / currentWidth) * 100
      var scaleY = (targetHeight / currentHeight) * 100

      // Use Free Transform to resize from center
      transformLayerFromCenter(backdropLayer, scaleX, scaleY)

      // After resizing, position at (0, 0)
      currentBounds = getLayerBounds(backdropLayer)
      moveLayerTo(backdropLayer, 0, 0)
    }

    // Now resize the contents inside the smart object
    try {
      mainDoc.activeLayer = backdropLayer
      editSmartObject()

      // Now in the smart object document
      var soDoc = app.activeDocument

      // Resize the smart object canvas to match target size
      soDoc.resizeCanvas(targetWidth, targetHeight, AnchorPosition.TOPLEFT)

      // Resize all layers in the smart object to fill the canvas
      for (var i = 0; i < soDoc.artLayers.length; i++) {
        var layer = soDoc.artLayers[i]
        var layerBounds = getLayerBounds(layer)
        var layerWidth = getBoundsWidth(layerBounds)
        var layerHeight = getBoundsHeight(layerBounds)

        if (layerWidth > 0.001 && layerHeight > 0.001) {
          var layerScaleX = (targetWidth / layerWidth) * 100
          var layerScaleY = (targetHeight / layerHeight) * 100

          try {
            layer.resize(layerScaleX, layerScaleY, AnchorPosition.TOPLEFT)
            moveLayerTo(layer, 0, 0)
          } catch (e) {
            // Layer couldn't be resized
          }
        }
      }

      // Save and close the smart object
      soDoc.save()
      soDoc.close(SaveOptions.SAVECHANGES)

      // Back to main document
      app.activeDocument = mainDoc
    } catch (editError) {
      // Couldn't edit smart object, just skip the internal resize
      try {
        if (app.activeDocument !== mainDoc) {
          app.activeDocument.close(SaveOptions.DONOTSAVECHANGES)
          app.activeDocument = mainDoc
        }
      } catch (e) {
        // Ignore
      }
    }
  } catch (e) {
    // Overall failure, just return
  }
}
