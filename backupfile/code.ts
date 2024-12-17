figma.showUI(__html__, { width: 300, height: 400 });

// Function to gather the selected frames and send them to the UI
async function updateSelectedFrames() {
  const selectedFrames = figma.currentPage.selection.filter(node => node.type === 'FRAME');
  
  const frameData = await Promise.all(selectedFrames.map(async frame => {
    const imageBytes = await frame.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: 0.25 } });
    const thumbnail = `data:image/png;base64,${figma.base64Encode(imageBytes)}`;

    const aspectRatio = frame.width / frame.height;
    const aspectRatioWarning = Math.abs(aspectRatio - (16 / 9)) > 0.01;

    return {
      name: frame.name,
      width: frame.width,
      height: frame.height,
      textCount: frame.findAll(node => node.type === 'TEXT').length,
      imageCount: frame.findAll(node => node.type !== 'TEXT').length,
      aspectRatioWarning,
      thumbnail
    };
  }));
  
  figma.ui.postMessage({ type: 'update-frames', frames: frameData });
}

// Initial call when the plugin is run
updateSelectedFrames();

// Update frames data on selection change
figma.on('selectionchange', updateSelectedFrames);

// Handle messages from the UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'request-frame-data') {
    const selectedNodes = figma.currentPage.selection;

    if (selectedNodes.length === 0) {
      figma.notify("Please select one or more frames to convert.");
      return;
    }

    const frameDataArray = [];

    for (const selectedNode of selectedNodes) {
      if (selectedNode.type !== "FRAME") {
        figma.notify("All selected items must be frames.");
        return;
      }

      const frameData = [];

      for (const child of selectedNode.children) {
        if (child.type === "TEXT") {
          let fontName = "Unknown";
          let fontColor = "#000";
          let fontWeight = 400;

          if (typeof child.fontName !== "symbol" && child.fontName) {
            fontName = child.fontName.family;
          }

          if (typeof child.fills !== "symbol" && child.fills.length > 0 && child.fills[0].type === "SOLID") {
            const fill = child.fills[0];
            fontColor = rgbToHex(fill.color.r, fill.color.g, fill.color.b);
          }

          let fontSize = 12;
          if (typeof child.fontSize === "number") {
            fontSize = child.fontSize;
          }

          if (typeof child.fontWeight !== "symbol" && child.fontWeight > 600) {
            fontWeight = 700;
          }

          frameData.push({
            type: "TEXT",
            text: child.characters,
            fontSize: fontSize,
            fontName: fontName,
            fontColor: fontColor,
            fontWeight: fontWeight,
            x: child.x,
            y: child.y,
            width: child.width,
            height: child.height
          });
        } else {
          if (child.exportAsync) {
            const exportOptions: ExportSettingsImage = {
              format: "PNG",
              constraint: { type: "SCALE", value: 2 }
            };

            try {
              const imageBytes = await child.exportAsync(exportOptions);
              frameData.push({
                type: "IMAGE",
                imageBytes: Array.from(imageBytes),
                x: child.x,
                y: child.y,
                width: child.width,
                height: child.height
              });
            } catch (error) {
              figma.notify("Error exporting image: " + (error instanceof Error ? error.message : "unknown error"));
            }
          }
        }
      }

      frameDataArray.push(frameData);
    }

    figma.ui.postMessage({ type: 'frame-data-array', frameDataArray });
  }
};

function rgbToHex(r: number, g: number, b: number): string {
  r = Math.round(r * 255);
  g = Math.round(g * 255);
  b = Math.round(b * 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
