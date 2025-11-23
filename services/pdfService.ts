import { jsPDF } from "jspdf";

export const generatePDF = (images: string[]): Blob => {
  // A4 size in mm: 210 x 297
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;

  images.forEach((imgData, index) => {
    if (index > 0) {
      doc.addPage();
    }
    // Add image fitting the page
    doc.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight);
  });

  return doc.output("blob");
};
