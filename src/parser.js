/**
 * Legal Sentinel - Document Parsing Engine
 * Handles client-side extraction of text from PDF, Word documents, and Images (OCR).
 */

// Set up PDF.js worker
if (typeof window !== 'undefined' && window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
}

/**
 * Extracts raw text from a PDF file.
 */
export async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    fullText += strings.join(' ') + '\n';
  }

  return fullText;
}

/**
 * Extracts raw text from a DOCX file using Mammoth.js.
 */
export async function extractTextFromDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

/**
 * Performs OCR on images using the Tesseract.js v5+ API.
 * Uses a more robust initialization pattern for mobile WebViews.
 */
export async function extractTextFromImage(file, langs = 'eng', onProgress) {
  if (!window.Tesseract) {
    throw new Error("OCR Library (Tesseract) failed to load. Please check your internet connection.");
  }

  try {
    // v5 simplified recognize with better error handling
    const result = await window.Tesseract.recognize(file, langs, {
      workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
      langPath: 'https://tessdata.projectnaptha.com/4.0.0',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js',
      logger: m => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round(m.progress * 100));
        }
      }
    });
    
    return result.data.text;
  } catch (err) {
    console.error("Tesseract OCR Error:", err);
    throw new Error(`OCR Fail: ${err.message || 'Initialization error'}. Try a clearer photo or check internet.`);
  }
}

/**
 * General purpose parser dispatcher.
 */
export async function parseDocument(file, langs = 'eng', onProgress) {
  const extension = file.name?.split('.').pop().toLowerCase() || 'png';
  const imageTypes = ['jpg', 'jpeg', 'png', 'webp', 'bmp'];
  
  try {
    if (extension === 'pdf') {
      return await extractTextFromPDF(file);
    } else if (extension === 'docx' || extension === 'doc') {
      return await extractTextFromDocx(file);
    } else if (imageTypes.includes(extension) || file instanceof Blob) {
      return await extractTextFromImage(file, langs, onProgress);
    } else {
      return await file.text();
    }
  } catch (error) {
    console.error(`Error parsing document:`, error);
    throw new Error(`Failed to read the content. Ensure it's a valid document.`);
  }
}
