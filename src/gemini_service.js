/**
 * Legal Sentinel - AI Service Layer
 * Interfaces with the Mistral API (Gemini 3.1 Pro Proxy) for high-fidelity legal analysis.
 */

const MISTRAL_API_KEY = import.meta.env.VITE_MISTRAL_API_KEY || 'a7qYpNeLXhxp7MQ9NcTPwAAz5yzxVnFz';
const API_URL = 'https://api.mistral.ai/v1/chat/completions';

/**
 * Sanitizes Markdown artifacts to keep output professional and clean.
 */
function cleanMarkdown(text) {
  return text
    .replace(/\*\*/g, '')   // Remove Bold
    .replace(/\* /g, '• ') // Convert bullet points to dots
    .replace(/#/g, '')      // Remove Headers
    .replace(/__/g, '')     // Remove Underscores
    .replace(/`/g, '')      // Remove Backticks
    .trim();
}

/**
 * Standard chat completion with Gemini 3.1 Pro (via Mistral)
 */
export async function invokeGemini31Pro(prompt, userLanguage = 'eng') {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // Increased to 30s

  try {
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

    const langMap = {
      'eng': 'English',
      'eng+hin': 'Hindi',
      'eng+kan': 'Kannada',
      'eng+tam': 'Tamil',
      'eng+tel': 'Telugu',
      'eng+ben': 'Bengali'
    };
    const langName = langMap[userLanguage] || 'English';

    // TRIPLE-LOCK PROMPT: Force the language instruction into the USER's view
    const anchoredPrompt = `[SYSTEM MANDATE: RESPOND ONLY IN ${langName.toUpperCase()} USING NATIVE SCRIPT. DO NOT USE ANY OTHER LANGUAGE OR SCRIPT. ERROR IF TRANSGRESSION.]\n\n${prompt}`;

    const systemPrompt = `You are the Legal Sentinel Scout (Indian Law Expert).
    Current Date: ${today}.
    STRICT JURISDICTION: You only provide advice based on INDIAN LAW. 
    You are a professional legal auditor. Respond with authority and precision.`;

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_API_KEY}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: anchoredPrompt }
        ],
        temperature: 0.0 // Set to 0 for absolute adherence to instructions
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`SENTINEL ERROR ${response.status}: ${err.message || 'Connection Interrupted'}`);
    }

    const data = await response.json();
    return cleanMarkdown(data.choices[0].message.content);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') throw new Error("SENTINEL TIMEOUT: The AI took too long to respond. Please try a shorter question.");
    console.error("Scout Fail:", error);
    throw error;
  }
}

/**
 * Performs a deep audit of a legal document.
 * Returns an Executive Summary, Red-Flag Heatmap, and Actionable Suggestions.
 */
export async function auditContractWithGemini31(documentText, userLanguage = 'eng') {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000); // Increased to 45s for Deep Audits

  try {
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const safeText = documentText.substring(0, 25000);

    const langMap = {
      'eng': 'English',
      'eng+hin': 'Hindi',
      'eng+kan': 'Kannada',
      'eng+tam': 'Tamil',
      'eng+tel': 'Telugu',
      'eng+ben': 'Bengali'
    };
    const langName = langMap[userLanguage] || 'English';

    // ANCHORED AUDIT: Force language and script into the primary message
    const anchoredAuditText = `[SYSTEM MANDATE: AUDIT ONLY IN ${langName.toUpperCase()} USING NATIVE SCRIPT. DO NOT USE ANY OTHER LANGUAGE.]\n\nDocument for Audit:\n${safeText}`;

    const systemPrompt = `You are the Legal Sentinel Audit Engine (3.1-PRO - INDIAN LAW CENTRIC).
    Current Date: ${today}.
    STRICT JURISDICTION: AUDIT ONLY BASED ON INDIAN STATUTES.
    You must identify risks and provide Indian legal standing for each.`;

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_API_KEY}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: anchoredAuditText }
        ],
        temperature: 0.0
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`AUDIT ERROR ${response.status}: ${err.message || 'Logic Failure'}`);
    }

    const data = await response.json();
    console.log("SENTINEL AUDIT COMPLETE");
    return cleanMarkdown(data.choices[0].message.content);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') throw new Error("AUDIT TIMEOUT: Complex document. Auditing first 5000 words.");
    console.error("Audit Fail:", error);
    throw error;
  }
}

/**
 * Generates a legal draft (e.g. eviction notice, refund dispute).
 */
export async function generateLegalDraft(type, details, userLanguage = 'eng') {
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  const langMap = {
    'eng': 'English',
    'eng+hin': 'Hindi',
    'eng+kan': 'Kannada',
    'eng+tam': 'Tamil',
    'eng+tel': 'Telugu',
    'eng+ben': 'Bengali'
  };
  const langName = langMap[userLanguage] || 'English';

  const anchoredDraftDetails = `[SYSTEM MANDATE: DRAFT ONLY IN ${langName.toUpperCase()} USING NATIVE SCRIPT. DO NOT USE ANY OTHER LANGUAGE.]\n\nDraft Type: ${type}\nDetails: ${details}`;

  const systemPrompt = `You are a Senior Indian Legal Draftsman.
  Today's Date: ${today}.
  STRICT JURISDICTION: DRAFT ONLY BASED ON INDIAN LEGAL FORMATS.
  
  Generate a professional Indian legal document in regional script.
  STRICT RULES: NO MARKDOWN. FORMATTED PLAINTEXT.`;

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MISTRAL_API_KEY}`
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: anchoredDraftDetails }
      ],
      temperature: 0.0
    })
  });

  const data = await response.json();
  return cleanMarkdown(data.choices[0].message.content);
}
