figma.showUI(__html__, { width: 300, height: 400 });

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'request-frame-data') {
    const selectedNodes = figma.currentPage.selection;

    if (selectedNodes.length === 0) {
      figma.notify("Please select a frame to convert.");
      return;
    }

    const selectedNode = selectedNodes[0];

    if (selectedNode.type !== "FRAME") {
      figma.notify("Please select a frame.");
      return;
    }

    const frameData = [];

    // Iterate over children of the frame
    for (const child of selectedNode.children) {
      if (child.type === "TEXT") {
        let fontName = "Unknown";
        let fontColor = "#000";
        let fontWeight = 400; // Default to normal weight

        // Safely handle fontName, wrapping in String() if it's a symbol
        if (typeof child.fontName !== "symbol" && child.fontName) {
          fontName = child.fontName.family;
        } else if (typeof child.fontName === "symbol") {
          console.warn("fontName is a symbol, possible mixed fonts");
          fontName = String(child.fontName);
        }

        // Safely handle fills (font color)
        if (typeof child.fills !== "symbol" && child.fills.length > 0 && child.fills[0].type === "SOLID") {
          const fill = child.fills[0];
          fontColor = rgbToHex(fill.color.r, fill.color.g, fill.color.b);
        }

        // Debugging: Log the fontWeight to the console
        if (typeof child.fontWeight === "symbol") {
          console.warn("fontWeight is a symbol, possible mixed weights");
          console.log(`Text: "${child.characters}", Font Weight (as symbol): ${String(child.fontWeight)}`);
        } else {
          console.log(`Text: "${child.characters}", Font Weight: ${child.fontWeight}`);
        }

        // Infer font weight if available and not a symbol
        if (typeof child.fontWeight !== "symbol" && child.fontWeight > 600) {
          fontWeight = 700; // Bold weight
        }

        frameData.push({
          type: "TEXT",
          text: child.characters,
          fontSize: child.fontSize || 12,
          fontName: fontName,
          fontColor: fontColor,
          fontWeight: fontWeight,
          x: child.x,
          y: child.y,
          width: child.width,
          height: child.height
        });
      } else {
        // Only export non-text layers that can be exported as images
        if (child.exportAsync) {
          const exportOptions: ExportSettingsImage = {
            format: "PNG",
            constraint: { type: "SCALE", value: 2 }
          };

          try {
            const imageBytes = await child.exportAsync(exportOptions);
            frameData.push({
              type: "IMAGE",
              imageBytes: Array.from(imageBytes),  // Convert Uint8Array to normal array for sending to UI
              x: child.x,
              y: child.y,
              width: child.width,
              height: child.height
            });
          } catch (error) {
            if (error instanceof Error) {
              figma.notify("Error exporting image: " + error.message);
            } else {
              figma.notify("An unknown error occurred during export.");
            }
          }
        }
      }
    }

    // Send frame data to the UI
    figma.ui.postMessage({ type: 'frame-data', frameData });
  }
};

// Helper function to convert Figma color to Hex
function rgbToHex(r: number, g: number, b: number): string {
  r = Math.round(r * 255);
  g = Math.round(g * 255);
  b = Math.round(b * 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
