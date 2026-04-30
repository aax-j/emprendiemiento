import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { isTauri } from '@tauri-apps/api/core';

export const generateAndSavePDF = async (
  elementId: string, 
  defaultFilename: string
): Promise<boolean> => {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with id ${elementId} not found`);
    }

    // Determine if we are in Tauri
    const isTauriEnv = isTauri();

    // 1. We make the element briefly visible but completely out of the viewport
    // so html2canvas can read it properly without messing up the screen.
    const originalDisplay = element.style.display;
    const originalPosition = element.style.position;
    const originalLeft = element.style.left;
    const originalTop = element.style.top;
    const originalVisibility = element.style.visibility;
    
    element.style.display = 'block';
    element.style.position = 'absolute';
    element.style.left = '-9999px';
    element.style.top = '-9999px';
    element.style.visibility = 'visible';

    // 2. Generate canvas
    const canvas = await html2canvas(element, {
      scale: 2, // better quality
      useCORS: true,
      logging: false,
    });

    // Restore original styles
    element.style.display = originalDisplay;
    element.style.position = originalPosition;
    element.style.left = originalLeft;
    element.style.top = originalTop;
    element.style.visibility = originalVisibility;

    const imgData = canvas.toDataURL('image/png');
    
    // Calculate PDF dimensions (A4 size: 210 x 297 mm)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

    if (isTauriEnv) {
      try {
        // 1. Ask user where to save the file using Tauri dialog
        const filePath = await save({
          defaultPath: defaultFilename,
          filters: [{
            name: 'PDF',
            extensions: ['pdf']
          }]
        });

        if (!filePath) {
          // User cancelled the dialog
          return false;
        }

        // Get ArrayBuffer from PDF and save it via Tauri FS
        const arrayBuffer = pdf.output('arraybuffer');
        const uint8Array = new Uint8Array(arrayBuffer);
        await writeFile(filePath, uint8Array);
        return true;
      } catch (tauriError) {
        console.warn('Tauri save failed, falling back to browser download', tauriError);
        pdf.save(defaultFilename);
        return true;
      }
    } else {
      // Standard browser download
      pdf.save(defaultFilename);
      return true;
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};
