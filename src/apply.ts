import { LayoutChild, Bounds, ComputedSize } from './types';
import { getLayerBounds, getBoundsWidth, getBoundsHeight } from './measure';

// Declare ExtendScript globals
declare function charIDToTypeID(id: string): number;
declare function executeAction(id: number, desc: any, mode: any): void;
declare var ActionDescriptor: any;
declare var ActionReference: any;
declare var DialogModes: any;
declare var AnchorPosition: any;

/**
 * Apply computed positions to layout children
 * Moves layers to their calculated positions using translate
 */
export function applyPositions(children: LayoutChild[]): void {
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    
    if (!child.computedPosition) continue;
    
    var currentBounds = child.bounds;
    var targetX = child.computedPosition.x;
    var targetY = child.computedPosition.y;
    
    // Calculate delta from current position to target
    var deltaX = targetX - currentBounds.left;
    var deltaY = targetY - currentBounds.top;
    
    // Only translate if there's a meaningful difference
    if (Math.abs(deltaX) > 0.001 || Math.abs(deltaY) > 0.001) {
      child.layer.translate(deltaX, deltaY);
    }
  }
}

/**
 * Apply computed sizes to content layers
 * Resizes layers to fill their container
 */
export function applyContentSizes(children: LayoutChild[]): void {
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    
    if (!child.computedSize || !child.config.isContent) continue;
    
    resizeLayerTo(child.layer, child.computedSize);
  }
}

/**
 * Resize a layer to a specific width and height
 * Uses scale transform relative to current size
 */
function resizeLayerTo(layer: any, targetSize: ComputedSize): void {
  var bounds = getLayerBounds(layer);
  var currentWidth = getBoundsWidth(bounds);
  var currentHeight = getBoundsHeight(bounds);
  
  // Avoid division by zero
  if (currentWidth < 0.001 || currentHeight < 0.001) return;
  
  var scaleX = (targetSize.width / currentWidth) * 100;
  var scaleY = (targetSize.height / currentHeight) * 100;
  
  // Use resize with anchor at top-left
  try {
    layer.resize(scaleX, scaleY, AnchorPosition.TOPLEFT);
  } catch (e) {
    // Some layer types may not support resize
    // Fall back to transform if available
    try {
      resizeWithTransform(layer, targetSize, bounds);
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
  var currentWidth = getBoundsWidth(currentBounds);
  var currentHeight = getBoundsHeight(currentBounds);
  
  if (currentWidth < 0.001 || currentHeight < 0.001) return;
  
  var scaleX = (targetSize.width / currentWidth) * 100;
  var scaleY = (targetSize.height / currentHeight) * 100;
  
  // Select the layer and apply free transform
  var doc = app.activeDocument;
  doc.activeLayer = layer;
  
  // Use action descriptor for transform
  var idTrnf = charIDToTypeID('Trnf');
  var desc = new ActionDescriptor();
  
  var idnull = charIDToTypeID('null');
  var ref = new ActionReference();
  ref.putEnumerated(charIDToTypeID('Lyr '), charIDToTypeID('Ordn'), charIDToTypeID('Trgt'));
  desc.putReference(idnull, ref);
  
  var idFTcs = charIDToTypeID('FTcs');
  var idQCSt = charIDToTypeID('QCSt');
  var idQcsa = charIDToTypeID('Qcsa');
  desc.putEnumerated(idFTcs, idQCSt, idQcsa);
  
  // Width
  var idWdth = charIDToTypeID('Wdth');
  var idPrc = charIDToTypeID('#Prc');
  desc.putUnitDouble(idWdth, idPrc, scaleX);
  
  // Height
  var idHght = charIDToTypeID('Hght');
  desc.putUnitDouble(idHght, idPrc, scaleY);
  
  executeAction(idTrnf, desc, DialogModes.NO);
}

/**
 * Move a layer to an absolute position
 */
export function moveLayerTo(layer: any, x: number, y: number): void {
  var bounds = getLayerBounds(layer);
  var deltaX = x - bounds.left;
  var deltaY = y - bounds.top;
  
  if (Math.abs(deltaX) > 0.001 || Math.abs(deltaY) > 0.001) {
    layer.translate(deltaX, deltaY);
  }
}

/**
 * Resize a layer to exactly match target bounds
 * Handles both position and size in one operation
 */
export function fitLayerToBounds(layer: any, targetBounds: Bounds): void {
  var targetWidth = getBoundsWidth(targetBounds);
  var targetHeight = getBoundsHeight(targetBounds);
  
  // First resize to target size
  resizeLayerTo(layer, { width: targetWidth, height: targetHeight });
  
  // Then move to target position
  moveLayerTo(layer, targetBounds.left, targetBounds.top);
}

