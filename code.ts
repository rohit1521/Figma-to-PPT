figma.showUI(__html__, { width: 300, height: 400 });

// Function to extract background color from a frame
function getFrameBackgroundColor(frame: FrameNode): string {
  if (frame.backgrounds && frame.backgrounds.length > 0) {
    const background = frame.backgrounds[0];
    if (background.type === "SOLID") {
      const { r, g, b } = background.color;
      // Convert to hex format without alpha channel
      return convertRGBToHex(r, g, b);
    }
  }
  return "#FFFFFF"; // Default to white if no background color
}

// Renamed function to avoid conflict with backup file
function convertRGBToHex(r: number, g: number, b: number): string {
  const toHex = (n: number): string => {
    const hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Function to gather the selected frames and send them to the UI
async function handleSelectedFramesUpdate() {
  const selectedFrames = figma.currentPage.selection
    .filter(node => node.type === 'FRAME')
    .map((frame, index) => ({ frame: frame as FrameNode, selectionIndex: index }));
  
  const frameData = await Promise.all(selectedFrames.map(async ({ frame, selectionIndex }) => {
    const imageBytes = await frame.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: 0.25 } });
    const thumbnail = `data:image/png;base64,${figma.base64Encode(imageBytes)}`;
    const backgroundColor = getFrameBackgroundColor(frame);

    return {
      selectionIndex,
      name: frame.name,
      width: frame.width,
      height: frame.height,
      textCount: frame.findAll(node => node.type === 'TEXT').length,
      imageCount: frame.findAll(node => node.type !== 'TEXT').length,
      backgroundColor,
      thumbnail
    };
  }));
  
  frameData.sort((a, b) => a.selectionIndex - b.selectionIndex);
  figma.ui.postMessage({ type: 'update-frames', frames: frameData });
}

// Initial call when the plugin is run
handleSelectedFramesUpdate();

// Update frames data on selection change
figma.on('selectionchange', handleSelectedFramesUpdate);

// Handle messages from the UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'request-frame-data') {
    const selectedNodes = figma.currentPage.selection;

    if (selectedNodes.length === 0) {
      figma.notify("Please select one or more frames to convert.");
      return;
    }

    const frameDataArray = [];

    for (let i = 0; i < selectedNodes.length; i++) {
      const selectedNode = selectedNodes[i];
      
      if (selectedNode.type !== "FRAME") {
        figma.notify("All selected items must be frames.");
        return;
      }

      const elements = [];
      const backgroundColor = getFrameBackgroundColor(selectedNode);

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
            fontColor = convertRgbToHex(fill.color.r, fill.color.g, fill.color.b);
          }

          let fontSize = 12;
          if (typeof child.fontSize === "number") {
            fontSize = child.fontSize;
          }

          if (typeof child.fontWeight !== "symbol" && child.fontWeight > 600) {
            fontWeight = 700;
          }

          elements.push({
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
        } else if (child.exportAsync) {
          try {
            const imageBytes = await child.exportAsync({
              format: "PNG",
              constraint: { type: "SCALE", value: 2 }
            });
            elements.push({
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

      frameDataArray.push({
        selectionIndex: i,
        backgroundColor,
        elements
      });
    }

    frameDataArray.sort((a, b) => a.selectionIndex - b.selectionIndex);
    figma.ui.postMessage({ type: 'frame-data-array', frameDataArray });
  }
};

function convertRgbToHex(r: number, g: number, b: number): string {
  r = Math.round(r * 255);
  g = Math.round(g * 255);
  b = Math.round(b * 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
