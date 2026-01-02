// Declare ExtendScript globals
declare function charIDToTypeID(id: string): number
declare function stringIDToTypeID(id: string): number
declare function executeAction(id: number, desc: any, mode: any): void
declare var ActionDescriptor: any
declare var ActionReference: any
declare var DialogModes: any
declare var app: any

/**
 * Apply maximum corner radius to a rounded rectangle layer
 * Uses Action Descriptors to set all corners to the maximum radius
 */
export function applyMaxRoundness(layer: any): void {
  try {
    var maxRadius = 999999

    // Make sure the layer is active
    var savedActiveLayer = app.activeDocument.activeLayer
    app.activeDocument.activeLayer = layer

    try {
      // Helper functions for type IDs
      const cTID = (s: string) => {
        return charIDToTypeID(s)
      }
      const sTID = (s: string) => {
        return stringIDToTypeID(s)
      }

      // Create the main descriptor
      var desc = new ActionDescriptor()
      desc.putInteger(sTID("keyOriginType"), 1)
      desc.putDouble(sTID("keyOriginResolution"), 72)

      // Create the radii descriptor with all corners set to max
      var radiiDesc = new ActionDescriptor()
      radiiDesc.putInteger(sTID("unitValueQuadVersion"), 1)
      radiiDesc.putUnitDouble(sTID("topRight"), cTID("#Pxl"), maxRadius)
      radiiDesc.putUnitDouble(sTID("topLeft"), cTID("#Pxl"), maxRadius)
      radiiDesc.putUnitDouble(sTID("bottomLeft"), cTID("#Pxl"), maxRadius)
      radiiDesc.putUnitDouble(sTID("bottomRight"), cTID("#Pxl"), maxRadius)

      desc.putObject(sTID("keyOriginRRectRadii"), sTID("radii"), radiiDesc)
      desc.putInteger(sTID("keyActionRadiiSource"), 1)
      desc.putBoolean(sTID("keyActionChangeAllCorners"), true)

      // Execute the action to change path details
      executeAction(sTID("changePathDetails"), desc, DialogModes.NO)
    } finally {
      // Restore the previously active layer
      app.activeDocument.activeLayer = savedActiveLayer
    }
  } catch (e) {
    // Silently fail if the layer doesn't support this operation
  }
}
