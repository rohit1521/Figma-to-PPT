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
        frameData.push({
          type: "TEXT",
          text: child.characters,
          fontSize: child.fontSize || 12,
          x: child.x,
          y: child.y,
          width: child.width,
          height: child.height
        });
      } else {
        // Export non-text layers as images and send the raw bytes to the UI
        const exportOptions: ExportSettingsImage = {
          format: "PNG",
          constraint: { type: "SCALE", value: 1 }
        };

        const imageBytes = await child.exportAsync(exportOptions);

        frameData.push({
          type: "IMAGE",
          imageBytes: Array.from(imageBytes),  // Convert Uint8Array to normal array
          x: child.x,
          y: child.y,
          width: child.width,
          height: child.height
        });
      }
    }

    // Send frame data to the UI
    figma.ui.postMessage({ type: 'frame-data', frameData });
  }
};
