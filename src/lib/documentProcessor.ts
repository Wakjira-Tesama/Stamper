import { parsePageRanges } from './pageRangeParser';
import { PDFDocument, BlendMode } from 'pdf-lib';
import mammoth from 'mammoth';
import { saveAs } from 'file-saver';
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker
// Using CDN is the most robust way to avoid bundler issues with the web worker in Vite without extra config
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;

async function rasterizePdfBytes(pdfBytes: Uint8Array): Promise<Uint8Array> {
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  
  const flatDoc = await PDFDocument.create();
  
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    // Use scale 2.5 for very high quality rendering
    const scale = 2.5; 
    const viewport = page.getViewport({ scale });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    // Set white background
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    // SECURITY: Add subtle noise/grit to further discourage OCR
    // and make it look like a physical scan
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let j = 0; j < data.length; j += 4) {
      if (Math.random() < 0.01) { // 1% noise
        const noise = (Math.random() - 0.5) * 10;
        data[j] = Math.max(0, Math.min(255, data[j] + noise));     // R
        data[j+1] = Math.max(0, Math.min(255, data[j+1] + noise)); // G
        data[j+2] = Math.max(0, Math.min(255, data[j+2] + noise)); // B
      }
    }
    context.putImageData(imageData, 0, 0);

    // Convert canvas to base64 JPEG
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85); // High quality but slightly compressed to look like a scan
    const base64Data = dataUrl.split(',')[1];
    const imgBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const jpgImg = await flatDoc.embedJpg(imgBytes);
    
    // Add page with original dimensions (unscaled)
    const newPage = flatDoc.addPage([viewport.width / scale, viewport.height / scale]);
    
    // Add a tiny random rotation (0.1 degrees) to simulate a physical scanner feed
    // This makes it much harder for software to reverse-engineer as a digital file
    const tinyRotation = (Math.random() - 0.5) * 0.2;
    
    newPage.drawImage(jpgImg, {
      x: 0,
      y: 0,
      width: viewport.width / scale,
      height: viewport.height / scale,
      rotate: { type: 'degrees' as any, angle: tinyRotation },
    });
  }
  
  // Remove all metadata that could reveal internal info
  flatDoc.setTitle('');
  flatDoc.setAuthor('');
  flatDoc.setSubject('');
  flatDoc.setKeywords([]);
  flatDoc.setProducer('Rabuma Secure Processing');
  flatDoc.setCreator('Rabuma Secure Processing');
  
  return await flatDoc.save();
}

export async function convertWordToPdf(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = result.value;

  // Create a PDF from the HTML using a hidden iframe + print
  // For better results we use pdf-lib to create a basic PDF
  const pdfDoc = await PDFDocument.create();
  
  // Parse the HTML and add pages
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const text = tempDiv.textContent || '';
  
  // Split text into pages (~3000 chars per page)
  const charsPerPage = 3000;
  const chunks = [];
  for (let i = 0; i < text.length; i += charsPerPage) {
    chunks.push(text.substring(i, i + charsPerPage));
  }
  if (chunks.length === 0) chunks.push(' ');

  for (const chunk of chunks) {
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const lines = chunk.split('\n');
    let y = 800;
    for (const line of lines) {
      if (y < 50) {
        break;
      }
      page.drawText(line.substring(0, 80), {
        x: 50,
        y,
        size: 11,
      });
      y -= 16;
    }
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

export async function convertPdfToWord(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();
  
  // Extract basic text content from PDF
  // pdf-lib doesn't support text extraction, so we create a basic docx
  const { Document, Packer, Paragraph, TextRun } = await import('docx');

  const paragraphs = [
    new Paragraph({
      children: [
        new TextRun({
          text: `Converted from PDF (${pages.length} pages)`,
          bold: true,
          size: 28,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'Note: Text extraction from PDF is limited in browser-only mode. For best results, use the original document.',
          italics: true,
          size: 20,
        }),
      ],
    }),
  ];

  const doc = new Document({
    sections: [{ children: paragraphs }],
  });

  const blob = await Packer.toBlob(doc);
  return blob;
}

export async function applyStampToPdf(
  pdfFile: File,
  stampImage: File,
  options: {
    pages: string;
    position: string;
    opacity: number;
    rotation: number;
    size: number;
    customX?: number;
    customY?: number;
    signatureFile?: File;
    signaturePosition?: string;
    signatureOpacity?: number;
    signatureRotation?: number;
    signatureSize?: number;
    signaturePages?: string;
  }
): Promise<Blob> {
  const pdfBytes = await pdfFile.arrayBuffer();
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const stampBytes = await stampImage.arrayBuffer();

  let stampImg;
  if (stampImage.type === 'application/pdf') {
    // Handle PDF stamp: extract first page as an embedded page, then render
    const stampPdfDoc = await PDFDocument.load(stampBytes);
    const [embeddedPage] = await pdfDoc.embedPages(stampPdfDoc.getPages().slice(0, 1));
    // Use embeddedPage instead of image
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    let pageIndices: number[];
    if (options.pages.toLowerCase() === 'all') {
      pageIndices = Array.from({ length: totalPages }, (_, i) => i);
    } else {
      pageIndices = parsePageRanges(options.pages, totalPages).map(p => p - 1);
    }

    const stampWidth = options.size;
    const stampHeight = (embeddedPage.height / embeddedPage.width) * stampWidth;

    for (const idx of pageIndices) {
      if (idx < 0 || idx >= totalPages) continue;
      const page = pages[idx];
      const { width, height } = page.getSize();

      let x = 0, y = 0;
      switch (options.position) {
        case 'top-left': x = 30; y = height - stampHeight - 30; break;
        case 'top-right': x = width - stampWidth - 30; y = height - stampHeight - 30; break;
        case 'bottom-left': x = 30; y = 30; break;
        case 'bottom-right': x = width - stampWidth - 30; y = 30; break;
        case 'bottom-center': x = (width - stampWidth) / 2; y = 30; break;
        case 'center': x = (width - stampWidth) / 2; y = (height - stampHeight) / 2; break;
        case 'custom': x = options.customX ?? 0; y = options.customY ?? 0; break;
        default: x = width - stampWidth - 30; y = 30;
      }

      page.drawPage(embeddedPage, {
        x, y,
        width: stampWidth,
        height: stampHeight,
        opacity: options.opacity,
        blendMode: BlendMode.Multiply,
      });
    }

    // For PDF stamps, we don't return early anymore. 
    // We let it fall through to the final rasterization.
  } else if (stampImage.type === 'image/png') {
    stampImg = await pdfDoc.embedPng(stampBytes);
  } else {
    stampImg = await pdfDoc.embedJpg(stampBytes);
  }

  const pages = pdfDoc.getPages();
  const totalPages = pages.length;

  // Parse which pages to stamp
  let pageIndices: number[];
  if (options.pages.toLowerCase() === 'all') {
    pageIndices = Array.from({ length: totalPages }, (_, i) => i);
  } else {
    pageIndices = parsePageRanges(options.pages, totalPages).map(p => p - 1);
  }

  const stampWidth = options.size;
  const stampHeight = (stampImg.height / stampImg.width) * stampWidth;

  for (const idx of pageIndices) {
    if (idx < 0 || idx >= totalPages) continue;
    const page = pages[idx];
    const { width, height } = page.getSize();

    let x = 0, y = 0;
    switch (options.position) {
      case 'top-left': x = 30; y = height - stampHeight - 30; break;
      case 'top-right': x = width - stampWidth - 30; y = height - stampHeight - 30; break;
      case 'bottom-left': x = 30; y = 30; break;
      case 'bottom-right': x = width - stampWidth - 30; y = 30; break;
      case 'bottom-center': x = (width - stampWidth) / 2; y = 30; break;
      case 'center': x = (width - stampWidth) / 2; y = (height - stampHeight) / 2; break;
      case 'custom':
        x = options.customX ?? 0;
        y = options.customY ?? 0;
        break;
      default: x = width - stampWidth - 30; y = 30;
    }

    page.drawImage(stampImg, {
      x,
      y,
      width: stampWidth,
      height: stampHeight,
      opacity: options.opacity,
      blendMode: BlendMode.Multiply,
      rotate: { type: 'degrees' as any, angle: options.rotation },
    });
  }

  // Embed optional signature with its own position/size/opacity/rotation settings
  if (options.signatureFile) {
    const sigBytes = await options.signatureFile.arrayBuffer();
    const sigPosition = options.signaturePosition || 'bottom-right';
    const sigOpacity = options.signatureOpacity ?? 0.9;
    const sigRotation = options.signatureRotation ?? 0;
    const sigWidth = options.signatureSize || 120;

    const drawSigOnPages = (sigDrawable: any, isPage: boolean, aspectRatio: number) => {
      const sigHeight = aspectRatio * sigWidth;
      const margin = 30;
      
      // Parse signature-specific pages
      let sigPageIndices: number[];
      const sigPagesStr = options.signaturePages || 'all';
      if (sigPagesStr.toLowerCase() === 'all') {
        sigPageIndices = Array.from({ length: totalPages }, (_, i) => i);
      } else {
        sigPageIndices = parsePageRanges(sigPagesStr, totalPages).map(p => p - 1);
      }
      
      for (const idx of sigPageIndices) {
        if (idx < 0 || idx >= totalPages) continue;
        const page = pages[idx];
        const { width, height } = page.getSize();

        let x = 0, y = 0;
        switch (sigPosition) {
          case 'top-left': x = margin; y = height - sigHeight - margin; break;
          case 'top-right': x = width - sigWidth - margin; y = height - sigHeight - margin; break;
          case 'bottom-left': x = margin; y = margin; break;
          case 'bottom-right': x = width - sigWidth - margin; y = margin; break;
          case 'bottom-center': x = (width - sigWidth) / 2; y = margin; break;
          case 'center': x = (width - sigWidth) / 2; y = (height - sigHeight) / 2; break;
          default: x = width - sigWidth - margin; y = margin;
        }

        if (isPage) {
          page.drawPage(sigDrawable, { x, y, width: sigWidth, height: sigHeight, opacity: sigOpacity, blendMode: BlendMode.Multiply });
        } else {
          page.drawImage(sigDrawable, {
            x, y, width: sigWidth, height: sigHeight,
            opacity: sigOpacity,
            blendMode: BlendMode.Multiply,
            rotate: { type: 'degrees' as any, angle: sigRotation },
          });
        }
      }
    };

    if (options.signatureFile.type === 'application/pdf') {
      const sigPdf = await PDFDocument.load(sigBytes);
      const [embPage] = await pdfDoc.embedPages(sigPdf.getPages().slice(0, 1));
      drawSigOnPages(embPage, true, embPage.height / embPage.width);
    } else if (options.signatureFile.type === 'image/png') {
      const sigImg = await pdfDoc.embedPng(sigBytes);
      drawSigOnPages(sigImg, false, sigImg.height / sigImg.width);
    } else {
      const sigImg = await pdfDoc.embedJpg(sigBytes);
      drawSigOnPages(sigImg, false, sigImg.height / sigImg.width);
    }
  }

  // SECURITY: True rasterization (Deep flatten)
  // This physically renders each page + stamp into a single raster image using pdfjs-dist
  // ensuring that the stamp image and original text cannot be extracted or parsed out of the PDF.
  const intermediateBytes = await pdfDoc.save();
  const secureBytes = await rasterizePdfBytes(intermediateBytes);

  return new Blob([secureBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

export function downloadBlob(blob: Blob, filename: string) {
  saveAs(blob, filename);
}
