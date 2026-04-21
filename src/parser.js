/**
 * Legal Sentinel - Document Parsing Engine
 * Handles client-side extraction of text from PDF, Word documents, and Images (OCR).
 */

// Set up PDF.js worker
if (typeof window !== 'undefined' && window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
}

// Singleton Tesseract Workers for different language packs
const tesseractWorkers = {};

export async function getTesseractWorker(langs = 'eng') {
  if (tesseractWorkers[langs]) return tesseractWorkers[langs];
  
  console.log(`[Legal Sentinel] Initializing OCR Worker for: ${langs}...`);
  const worker = await window.Tesseract.createWorker(langs, 1, {
    logger: m => console.debug(m)
  });
  tesseractWorkers[langs] = worker;
  return worker;
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
 * Performs REAL-TIME OCR on images using a singleton worker.
 * Supports multiple languages (e.g., 'eng+hin').
 */
export async function extractTextFromImage(file, langs = 'eng', onProgress) {
  const worker = await getTesseractWorker(langs);
  const { data: { text } } = await worker.recognize(file);
  
  if (onProgress) onProgress(100);
  return text;
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
