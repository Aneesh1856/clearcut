import './style.css'
import { invokeGemini31Pro, auditContractWithGemini31, generateLegalDraft } from './gemini_service.js'
import { parseDocument } from './parser.js'
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { Capacitor } from '@capacitor/core';

// State Management
const state = {
  activeView: 'home',
  isScanning: false,
  activeDocumentText: null,
  activeDocumentName: null,
  pendingChatDoc: null,
  history: JSON.parse(localStorage.getItem('legal_sentinel_history') || '[]'),
  lensStream: null,
  scoutStream: null,
  scoutBuffer: new Set(),
  scoutInterval: null,
  isOCRPending: false,
  selectedLang: 'eng',
  isVoiceActive: false,
  isTTSActive: false,
  isVoiceModeActive: false,
  voiceRate: 0.95,
  isCurrentlySpeaking: false, // Track active speech
  utteranceQueue: [] // Prevent garbage collection
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  initRouter();
  initAudit();
  initChat();
  initDraft();
  initHistory();
  initLens();
  initScout();
  initLangSelector();
  initVoiceInput();
  initTTS();
  initVoiceMode();
  initSpeedControl();
  initVoiceDiagnostic();
  // Robust Platform Diagnostic
  const checkBridge = () => {
    const cap = window.Capacitor;
    if (cap && cap.isNativePlatform()) {
      console.log("SENTINEL NATIVE BRIDGE ACTIVE: " + cap.getPlatform());
      // Optional: alert("BRIDGE READY");
    }
  };
  setTimeout(checkBridge, 1000);

  lucide.createIcons();
});

// Pre-load voices for better humanization
window.speechSynthesis.onvoiceschanged = () => {
  window.speechSynthesis.getVoices();
};

// 1. Simple Hash-based Router
function initRouter() {
  const handleRoute = () => {
    const hash = window.location.hash.replace('#', '') || 'home';
    state.activeView = hash;

    document.querySelectorAll('.view').forEach(view => {
      view.classList.toggle('active', view.id === hash);
    });

    document.querySelectorAll('.nav-item').forEach(nav => {
      nav.classList.toggle('active', nav.getAttribute('href') === `#${hash}`);
    });

    lucide.createIcons();
  };

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

// 2. Audit View Logic
function initAudit() {
  const runBtn = document.querySelector('#run-audit');
  const resultsArea = document.querySelector('#audit-results');
  const textArea = document.querySelector('#audit textarea');
  const fileTrigger = document.querySelector('#file-trigger');
  const cameraTrigger = document.querySelector('#camera-trigger');
  const scoutTrigger = document.querySelector('#scout-trigger');
  const fileInput = document.querySelector('#audit-file-input');
  const scanOverlay = document.querySelector('#scanning-overlay');
  const ocrProgress = document.querySelector('#ocr-progress');

  if (!fileTrigger || !cameraTrigger || !scoutTrigger) return;

  fileTrigger.addEventListener('click', () => fileInput.click());
  cameraTrigger.addEventListener('click', () => {
    document.querySelector('#lens-overlay').classList.add('active');
    startLens();
  });

  scoutTrigger.addEventListener('click', startScout);

  window.handleFile = async (file) => {
    state.activeDocumentName = file.name || `Scan_${Date.now()}.png`;
    const isImage = file.type?.startsWith('image/') || file instanceof Blob;

    if (isImage) {
      scanOverlay.style.display = 'flex';
      ocrProgress.textContent = "initializing...";
    }

    try {
      const text = await parseDocument(file, state.selectedLang, (progress) => {
        ocrProgress.textContent = `Reading pixels... ${progress}%`;
      });
      state.activeDocumentText = text;

      scanOverlay.style.display = 'none';

      const preview = document.querySelector('#audit-file-preview');
      if (preview) {
        preview.style.display = 'block';
        preview.innerHTML = `
          <div class="glass-card" style="display: flex; align-items: center; gap: 12px; border: 1px solid var(--safe-glow); padding: 0.75rem 1rem; border-radius: var(--radius-sm);">
            <i data-lucide="file-check" style="color: var(--safe); width: 20px;"></i>
            <div style="flex: 1;">
              <div style="font-size: 0.75rem; font-weight: 900; color: var(--safe); letter-spacing: 1px;">DOCUMENT READY</div>
              <div style="font-size: 0.8rem; color: var(--text-secondary); width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${state.activeDocumentName}</div>
            </div>
          </div>
        `;
        lucide.createIcons();
      }
    } catch (err) {
      scanOverlay.style.display = 'none';
      alert(err.message);
    }
  };

  fileInput.addEventListener('change', (e) => e.target.files[0] && window.handleFile(e.target.files[0]));

  runBtn.addEventListener('click', async () => {
    const text = textArea.value.trim() || state.activeDocumentText;
    if (!text || state.isScanning) return;

    runBtn.disabled = true;
    runBtn.innerHTML = `<i class="pulse" data-lucide="loader-2"></i> <span class="typing-dots">Sentinel is auditing risk</span>`;
    lucide.createIcons();
    state.isScanning = true;

    try {
      const result = await auditContractWithGemini31(text, state.selectedLang);
      renderAuditResults(resultsArea, result);
      saveToHistory('Audit', state.activeDocumentName || 'Pasted Text');
    } catch (e) {
      renderAuditResults(resultsArea, e.message);
    } finally {
      state.isScanning = false;
      runBtn.disabled = false;
      runBtn.innerHTML = `<i data-lucide="scan-search"></i> Run Legal Audit`;
      lucide.createIcons();
    }
  });
}

function renderAuditResults(container, rawResult) {
  container.style.display = 'block';
  const formattedMsg = rawResult
    .replace(/\[?(HIGH|CRITICAL)\]?/gi, '<span class="heatmap-tag h-high">HIGH RISK</span>')
    .replace(/\[?(MEDIUM|WARNING)\]?/gi, '<span class="heatmap-tag h-med">MEDIUM RISK</span>')
    .replace(/\[?(LOW|SAFE|CLEAN)\]?/gi, '<span class="heatmap-tag h-low">LOW RISK</span>');

  container.innerHTML = `
    <div class="glass-card insight-card danger">
      <div class="tag tag-danger">3.1-PRO AUDIT REPORT</div>
      <p class="text-secondary" style="font-size: 0.9rem; white-space: pre-wrap;">${formattedMsg}</p>
    </div>
  `;
  container.scrollIntoView({ behavior: 'smooth' });
}

// 3. Live Sentinel Lens
function initLens() {
  const closeBtn = document.querySelector('#close-lens');
  const captureBtn = document.querySelector('#capture-snapshot');
  if (closeBtn) closeBtn.onclick = stopLens;
  if (captureBtn) captureBtn.onclick = captureSnapshot;
}

async function startLens() {
  const video = document.querySelector('#lens-video');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    });
    state.lensStream = stream;
    video.srcObject = stream;
  } catch (err) {
    alert("Could not access camera.");
    stopLens();
  }
}

function stopLens() {
  if (state.lensStream) {
    state.lensStream.getTracks().forEach(track => track.stop());
    state.lensStream = null;
  }
  document.querySelector('#lens-overlay').classList.remove('active');
}

async function captureSnapshot() {
  const video = document.querySelector('#lens-video');
  const scanOverlay = document.querySelector('#scanning-overlay');
  const ocrProgress = document.querySelector('#ocr-progress');

  const canvas = document.createElement('canvas');
  // High-res capture for OCR accuracy
  const scale = 1.5;
  canvas.width = video.videoWidth * scale;
  canvas.height = video.videoHeight * scale;

  const ctx = canvas.getContext('2d');
  // Legal-Grade OCR Preprocessing
  ctx.filter = 'contrast(1.6) grayscale(1) brightness(1.05) sharpness(1.2)';
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  if (scanOverlay) {
    scanOverlay.style.display = 'flex';
    ocrProgress.textContent = "Analyzing document...";
  }

  canvas.toBlob((blob) => {
    stopLens();
    window.handleFile(blob).then(() => {
      if (scanOverlay) scanOverlay.style.display = 'none';
      // AUTO-AUDIT TRIGGER
      const runBtn = document.querySelector('#run-audit');
      if (runBtn) runBtn.click();
    }).catch(err => {
      if (scanOverlay) scanOverlay.style.display = 'none';
      alert("Scan Failed: " + err.message);
    });
  }, 'image/png');
}

// 4. Sentinel Chrome Extension (Real-Time Capture)
function initScout() {
  const stopBtn = document.querySelector('#stop-scout');
  const manualBtn = document.querySelector('#scout-capture-now');
  const doneBtn = document.querySelector('#scout-done');

  if (stopBtn) stopBtn.onclick = finishScout;
  if (manualBtn) manualBtn.onclick = () => scoutSamplingLoop(true);
  if (doneBtn) doneBtn.onclick = finishScout;
}

async function startScout() {
  const video = document.querySelector('#scout-video');
  const overlay = document.querySelector('#scout-overlay');
  const feed = document.querySelector('#scout-text-stream');

  try {
    // NATIVE BRIDGE CHECK (For APK build)
    if (window.SentinelBridge) {
      window.SentinelBridge.postMessage('startScout');
      overlay.classList.add('active');
      state.scoutBuffer.clear();
      feed.innerHTML = `<p class="text-dim">Sentinel Native Vision Active. Scouring other apps...</p>`;
      return;
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: 'always' }
    });
    state.scoutStream = stream;
    video.srcObject = stream;
    overlay.classList.add('active');
    state.scoutBuffer.clear();
    feed.innerHTML = `<p class="text-dim">Sentinel Vision Active. Start scrolling...</p>`;

    // End stream listener
    stream.getVideoTracks()[0].onended = finishScout;

    // Start Sampling Loop (Every 2 seconds)
    state.scoutInterval = setInterval(scoutSamplingLoop, 2000);

  } catch (err) {
    alert("Screen capture refused.");
  }
}

async function scoutSamplingLoop(isManual = false) {
  const video = document.querySelector('#scout-video');
  const feed = document.querySelector('#scout-text-stream');

  if (!video || video.videoWidth < 100) return;
  if (state.isOCRPending && !isManual) return;

  const canvas = document.createElement('canvas');
  // Scale UP for better accuracy on small screen text
  const scale = 1.2;
  canvas.width = video.videoWidth * scale;
  canvas.height = video.videoHeight * scale;

  const ctx = canvas.getContext('2d');
  ctx.filter = 'contrast(1.4) grayscale(1) brightness(1.1)';
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(async (blob) => {
    state.isOCRPending = true;
    try {
      const text = await parseDocument(blob, state.selectedLang);
      const cleanedText = text.trim();

      if (cleanedText.length > 25 && !state.scoutBuffer.has(cleanedText)) {
        state.scoutBuffer.add(cleanedText);
        const item = document.createElement('div');
        item.className = 'feed-item';
        item.innerHTML = `<span style="color:var(--safe)">[SCANNED]</span> ${cleanedText.substring(0, 150)}...`;
        feed.prepend(item);
        if (feed.children.length > 20) feed.lastChild.remove();

        // Visual ping
        feed.parentElement.style.borderColor = "var(--primary)";
        setTimeout(() => feed.parentElement.style.borderColor = "transparent", 300);
      }
    } catch (e) {
      console.warn("Retrying scan...");
    } finally {
      state.isOCRPending = false;
    }
  });
}

function finishScout() {
  const manualBtn = document.querySelector('#scout-capture-now');
  clearInterval(state.scoutInterval);

  if (state.scoutStream) {
    state.scoutStream.getTracks().forEach(track => track.stop());
    state.scoutStream = null;
  }
  document.querySelector('#scout-overlay').classList.remove('active');

  const fullText = Array.from(state.scoutBuffer).join('\n\n');
  if (fullText.length > 50) {
    state.activeDocumentText = fullText;
    state.activeDocumentName = "Chrome Extension Capture";
    const scoutLabel = document.querySelector('#scout-trigger .media-label');
    if (scoutLabel) scoutLabel.innerHTML = `<i data-lucide="check" style="width:14px; color:var(--safe);"></i> Scout Ready`;
    lucide.createIcons();

    // Switch view and trigger audit automatically
    window.location.hash = '#audit';
    setTimeout(() => {
      const runBtn = document.querySelector('#run-audit');
      if (runBtn) {
        runBtn.click();
        // Clear the preview to show the audit progress
        const preview = document.querySelector('#audit-file-preview');
        if (preview) preview.style.display = 'none';
      }
    }, 300);

  } else {
    alert("Sentinel Vision failed: No legal text captured. Try scrolling slower or using 'Harvest Now'.");
  }
}

// 5. Language Selector Logic (Sync across Audit/Chat)
function initLangSelector() {
  const auditTrigger = document.querySelector('#lang-menu-trigger');
  const chatTrigger = document.querySelector('#chat-lang-trigger');
  const voiceTrigger = document.querySelector('#voice-lang-trigger');
  const labelTexts = document.querySelectorAll('.active-lang-text, #active-lang');
  const allOptions = document.querySelectorAll('.lang-option');

  const updateGlobalLang = (lang, display) => {
    state.selectedLang = (lang === 'eng') ? 'eng' : `eng+${lang}`;
    labelTexts.forEach(label => label.textContent = display);

    allOptions.forEach(opt => {
      opt.classList.toggle('active', opt.dataset.lang === lang);
    });
  };

  [auditTrigger, chatTrigger, voiceTrigger].forEach(trigger => {
    if (!trigger) return;
    trigger.onclick = (e) => {
      e.stopPropagation();
      document.querySelectorAll('.lang-selector-pill').forEach(t => {
        if (t !== trigger) t.classList.remove('active');
      });
      trigger.classList.toggle('active');
    };
  });

  document.onclick = () => document.querySelectorAll('.lang-selector-pill').forEach(t => t.classList.remove('active'));

  allOptions.forEach(opt => {
    opt.onclick = (e) => {
      e.stopPropagation();
      const lang = opt.dataset.lang;
      const display = opt.textContent.split(' (')[0];
      updateGlobalLang(lang, display);
      document.querySelectorAll('.lang-selector-pill').forEach(t => t.classList.remove('active'));
    };
  });
}

// 6. Voice Input (Sentinel Ear)
function initVoiceInput() {
  const trigger = document.querySelector('#voice-trigger');
  const chatInput = document.querySelector('.chat-input');

  if (!trigger) return;

  const BrowserSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!BrowserSpeechRecognition && !Capacitor.isNativePlatform()) {
    trigger.onclick = () => alert("Voice input is not supported in this browser or over insecure connections (HTTPS required).");
    return;
  }

  const recognition = BrowserSpeechRecognition ? new BrowserSpeechRecognition() : null;
  if (recognition) {
    recognition.continuous = false;
    recognition.interimResults = true;
  }

  const langMap = {
    'eng': 'en-IN',
    'eng+hin': 'hi-IN',
    'eng+kan': 'kn-IN',
    'eng+tam': 'ta-IN',
    'eng+tel': 'te-IN',
    'eng+ben': 'bn-IN'
  };

  trigger.onclick = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        // Use the imported SpeechRecognition from @capacitor-community/speech-recognition
        const perm = await SpeechRecognition.requestPermissions();
        if (perm.speechRecognition !== 'granted') {
          alert("Microphone permission denied.");
          return;
        }

        const { available } = await SpeechRecognition.available();
        if (!available) {
          alert("Speech Recognition engine not available on this device.");
          return;
        }

        if (state.isVoiceActive) {
          await SpeechRecognition.stop();
          stopVoice();
          return;
        }

        state.isVoiceActive = true;
        trigger.classList.add('recording');
        chatInput.placeholder = "Listening...";

        // Clear existing listeners to prevent duplicates
        await SpeechRecognition.removeAllListeners();

        SpeechRecognition.addListener('partialResults', (data) => {
          if (data.matches && data.matches.length > 0) {
            chatInput.value = data.matches[0];
          }
        });

        SpeechRecognition.addListener('listeningState', (data) => {
          if (data.status === 'stopped') {
            stopVoice();
          }
        });

        await SpeechRecognition.start({
          language: langMap[state.selectedLang] || 'en-IN',
          partialResults: true,
          popup: false,
        });

      } catch (err) {
        console.error("Native Speech Error:", err);
        alert("Speech error: " + err.message);
        stopVoice();
      }
    } else {
      if (!recognition) return;
      if (state.isVoiceActive) {
        recognition.stop();
      } else {
        recognition.lang = langMap[state.selectedLang] || 'en-IN';
        recognition.start();
      }
    }
  };

  if (recognition) {
    recognition.onstart = () => {
      state.isVoiceActive = true;
      trigger.classList.add('recording');
      chatInput.classList.add('listening');
      chatInput.placeholder = "Listening to you...";
    };

    recognition.onresult = (e) => {
      let transcript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      chatInput.value = transcript;
    };

    recognition.onerror = () => {
      stopVoice();
    };

    recognition.onend = () => {
      stopVoice();
    };
  }

  const stopVoice = () => {
    state.isVoiceActive = false;
    trigger.classList.remove('recording');
    chatInput.classList.remove('listening');
    chatInput.placeholder = "Ask your legal scout...";
  };
}

// 7. Text-to-Speech (Sentinel Voice)
function initTTS() {
  const trigger = document.querySelector('#tts-trigger');
  if (!trigger) return;

  trigger.onclick = () => {
    state.isTTSActive = !state.isTTSActive;
    trigger.classList.toggle('active', state.isTTSActive);
    trigger.querySelector('i').setAttribute('data-lucide', state.isTTSActive ? 'volume-2' : 'volume-x');
    lucide.createIcons();

    if (Capacitor.isNativePlatform()) {
      SpeechRecognition.requestPermissions();
    }
  };
}

function cleanTextForSpeech(text) {
  return text
    .replace(/[#*`_~]/g, '') // Remove markdown characters
    .replace(/[-]{2,}/g, '. ') // Replace multi-dashes with periods for natural pausing
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

async function stopSpeaking() {
  if (Capacitor.isNativePlatform()) {
    await TextToSpeech.stop();
  } else if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  state.isCurrentlySpeaking = false;
  // Reset all speaker icons in the UI
  document.querySelectorAll('.replay-btn i').forEach(icon => {
    icon.setAttribute('data-lucide', 'volume-2');
  });
  lucide.createIcons();
}

function speak(text, force = false) {
  return new Promise(async (resolve) => {
    if (!force && (!state.isTTSActive || (!window.speechSynthesis && !Capacitor.isNativePlatform()))) {
      resolve();
      return;
    }

    if (state.isCurrentlySpeaking) {
      await stopSpeaking();
    }

    state.isCurrentlySpeaking = true;

    if (Capacitor.isNativePlatform()) {
      try {
        const langMap = {
          'eng': 'en-IN', 'eng+hin': 'hi-IN', 'eng+kan': 'kn-IN',
          'eng+tam': 'ta-IN', 'eng+tel': 'te-IN', 'eng+ben': 'bn-IN'
        };
        await TextToSpeech.speak({
          text: cleanTextForSpeech(text),
          lang: langMap[state.selectedLang] || 'en-IN',
          rate: state.voiceRate,
          pitch: 1.0,
          volume: 1.0,
          category: 'ambient'
        });
      } catch (e) {
        console.error("Native TTS Error:", e);
      } finally {
        state.isCurrentlySpeaking = false;
        resolve();
      }
      return;
    }

    window.speechSynthesis.cancel();

    setTimeout(() => {
      const cleanedText = cleanTextForSpeech(text);
      const langMap = {
        'eng': 'en-IN', 'eng+hin': 'hi-IN', 'eng+kan': 'kn-IN',
        'eng+tam': 'ta-IN', 'eng+tel': 'te-IN', 'eng+ben': 'bn-IN'
      };
      const targetLang = langMap[state.selectedLang] || 'en-IN';

      const chunks = cleanedText.match(/[^.!?]{1,200}[.!?]|[^.!?]{1,200}/g) || [cleanedText];
      state.utteranceQueue = [];

      chunks.forEach((chunk, index) => {
        const utterance = new SpeechSynthesisUtterance(chunk.trim());
        utterance.lang = targetLang;
        utterance.rate = state.voiceRate;
        utterance.pitch = 1.05;

        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.startsWith(targetLang.split('-')[0]) && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium')));
        if (preferredVoice) utterance.voice = preferredVoice;

        if (index === chunks.length - 1) {
          utterance.onend = () => {
            state.isCurrentlySpeaking = false;
            resolve();
          };
          utterance.onerror = () => {
            state.isCurrentlySpeaking = false;
            resolve();
          };
        }

        state.utteranceQueue.push(utterance);
        window.speechSynthesis.speak(utterance);
      });

      // Safety timeout if chunks is empty or speech fails to start
      if (chunks.length === 0) {
        state.isCurrentlySpeaking = false;
        resolve();
      }
    }, 50);
  });
}

// 8. Voice Mode (Call Experience)
function initVoiceMode() {
  const trigger = document.querySelector('#start-voice-assist');
  const closeBtn = document.querySelector('#close-voice-mode');
  const endCallBtn = document.querySelector('#end-call-btn');
  const overlay = document.querySelector('#voice-mode-overlay');
  const statusText = document.querySelector('#voice-status-text');
  const transcriptPreview = document.querySelector('#voice-transcript-preview');

  if (!trigger) return;

  const BrowserSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = BrowserSpeechRecognition ? new BrowserSpeechRecognition() : null;

  if (recognition) {
    recognition.continuous = false;
    recognition.interimResults = true;
  }

  const langMap = {
    'eng': 'en-IN',
    'eng+hin': 'hi-IN',
    'eng+kan': 'kn-IN',
    'eng+tam': 'ta-IN',
    'eng+tel': 'te-IN',
    'eng+ben': 'bn-IN'
  };

  const startVoiceMode = () => {
    if (!recognition && !Capacitor.isNativePlatform()) {
      alert("Voice features not supported in this browser.");
      return;
    }
    state.isVoiceModeActive = true;
    overlay.classList.add('active');
    statusText.textContent = "Listening...";

    // Unlock Speech Synthesis (Browser Requirement)
    const unlock = new SpeechSynthesisUtterance('');
    window.speechSynthesis.speak(unlock);

    // Reset visual state
    transcriptPreview.textContent = "";
    transcriptPreview.placeholder = "Listening...";

    startListening();
  };

  const stopVoiceMode = () => {
    state.isVoiceModeActive = false;
    overlay.classList.remove('active');
    recognition.stop();
    window.speechSynthesis.cancel();
  };

  const startListening = async () => {
    if (!state.isVoiceModeActive) return;

    if (Capacitor.isNativePlatform()) {
      const perm = await SpeechRecognition.requestPermissions();
      if (perm.speechRecognition !== 'granted') {
        alert("Microphone permission is required for Voice Scout.");
        return;
      }

      const { available } = await SpeechRecognition.available();
      if (!available) return;

      // Clear existing listeners
      await SpeechRecognition.removeAllListeners();

      SpeechRecognition.addListener('partialResults', (data) => {
        if (data.matches && data.matches.length > 0) {
          transcriptPreview.textContent = data.matches[0];
        }
      });

      // Handle the final result when speech recognition stops
      SpeechRecognition.addListener('listeningState', (data) => {
        if (data.status === 'stopped') {
          document.querySelector('.voice-avatar').classList.remove('speaking');
          if (state.isVoiceModeActive) {
            const finalTranscript = transcriptPreview.textContent.trim();

            // If we heard something, process it
            if (finalTranscript && finalTranscript !== "..." && finalTranscript.length > 1) {
              processVoiceInput(finalTranscript);
            } else {
              // Restart if nothing was heard
              statusText.textContent = "I'm listening...";
              setTimeout(() => { if (state.isVoiceModeActive) startListening(); }, 1000);
            }
          }
        }
      });

      document.querySelector('.voice-avatar').classList.add('speaking');
      // Add manual trigger
      document.querySelector('.voice-avatar').onclick = () => {
        if (transcriptPreview.textContent.length > 1) processVoiceInput(transcriptPreview.textContent);
      };

      statusText.textContent = "I'm listening...";
      statusText.style.color = "var(--primary)";
      transcriptPreview.textContent = "";

      try {
        await SpeechRecognition.start({
          language: langMap[state.selectedLang] || 'en-IN',
          partialResults: true,
          popup: false,
        });
      } catch (e) {
        console.error("Speech Start Error:", e);
        statusText.textContent = "Speech engine error.";
        setTimeout(startListening, 2000);
      }

      // Since the community plugin doesn't have a clear 'isFinal' event in partialResults, 
      // we might need to handle the 'result' elsewhere or just use stop.
      // Better approach for Voice Mode:
      setTimeout(async () => {
        // This is tricky for continuous mode. 
        // Let's assume the plugin's start() will trigger partialResults and we can have a 'stop' button.
      }, 5000);

    } else {
      recognition.lang = langMap[state.selectedLang] || 'en-IN';
      try {
        recognition.start();
      } catch (e) { }
    }
  };

  trigger.onclick = startVoiceMode;
  closeBtn.onclick = stopVoiceMode;
  endCallBtn.onclick = stopVoiceMode;

  if (recognition) {
    recognition.onstart = () => {
      statusText.textContent = "I'm listening...";
      statusText.style.color = "var(--primary)";
      document.querySelector('.voice-avatar').classList.add('speaking');
    };

    recognition.onresult = (e) => {
      let transcript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      transcriptPreview.textContent = transcript;

      if (e.results[e.results.length - 1].isFinal) {
        processVoiceInput(transcript);
      }
    };

    recognition.onend = () => {
      document.querySelector('.voice-avatar').classList.remove('speaking');
      if (state.isVoiceModeActive && statusText.textContent !== "Thinking..." && statusText.textContent !== "Responding...") {
        startListening();
      }
    };
  }

  async function processVoiceInput(text) {
    if (!text.trim()) return;

    if (Capacitor.isNativePlatform()) {
      await SpeechRecognition.stop();
    } else if (recognition) {
      recognition.stop();
    }

    statusText.textContent = "Thinking...";
    statusText.style.color = "var(--warning)";
    document.querySelector('.voice-avatar').classList.remove('speaking');

    try {
      const response = await invokeGemini31Pro(text, state.selectedLang);
      respondWithVoice(response);
    } catch (e) {
      statusText.textContent = "Error occurred.";
      setTimeout(startListening, 2000);
    }
  }

  async function respondWithVoice(text) {
    statusText.textContent = "Responding...";
    statusText.style.color = "var(--safe)";
    transcriptPreview.textContent = text;

    if (Capacitor.isNativePlatform()) {
      document.querySelector('.voice-avatar').classList.add('speaking');
      await speak(text, true);
      document.querySelector('.voice-avatar').classList.remove('speaking');

      if (state.isVoiceModeActive) {
        statusText.textContent = "I'm listening...";
        transcriptPreview.textContent = "Your turn...";
        startListening();
      }
      return;
    }

    window.speechSynthesis.cancel();

    setTimeout(() => {
      const cleanedText = cleanTextForSpeech(text);
      const targetLang = langMap[state.selectedLang] || 'en-IN';
      const chunks = cleanedText.match(/[^.!?]{1,200}[.!?]|[^.!?]{1,200}/g) || [cleanedText];

      state.utteranceQueue = [];

      chunks.forEach((chunk, index) => {
        const utterance = new SpeechSynthesisUtterance(chunk.trim());
        utterance.lang = targetLang;
        utterance.rate = state.voiceRate;
        utterance.pitch = 1.05;

        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.startsWith(targetLang.split('-')[0]) && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium')));
        if (preferredVoice) utterance.voice = preferredVoice;

        if (index === 0) {
          utterance.onstart = () => document.querySelector('.voice-avatar').classList.add('speaking');
        }

        if (index === chunks.length - 1) {
          utterance.onend = () => {
            document.querySelector('.voice-avatar').classList.remove('speaking');
            if (state.isVoiceModeActive) {
              statusText.textContent = "I'm listening...";
              transcriptPreview.textContent = "Your turn...";
              startListening();
            }
          };
        }

        state.utteranceQueue.push(utterance);
        window.speechSynthesis.speak(utterance);
      });
    }, 50);

    // Also add to chat history for record
    addMessage('bot', text);
  }
}

// 9. Voice Speed Control
function initSpeedControl() {
  const trigger = document.querySelector('#voice-speed-trigger');
  const speedText = document.querySelector('#speed-text');
  if (!trigger) return;

  const speeds = [
    { label: 'Slow', rate: 0.7 },
    { label: 'Normal', rate: 0.95 },
    { label: 'Fast', rate: 1.25 }
  ];

  let currentIdx = 1; // Start at Normal

  trigger.onclick = () => {
    currentIdx = (currentIdx + 1) % speeds.length;
    const selected = speeds[currentIdx];
    state.voiceRate = selected.rate;
    speedText.textContent = selected.label;

    // Visual feedback
    trigger.style.background = currentIdx === 1 ? 'transparent' : 'rgba(56, 189, 248, 0.1)';
  };
}

function initVoiceDiagnostic() {
  const btn = document.querySelector('#voice-diagnostic-btn');
  if (!btn) return;

  btn.onclick = () => {
    if (!window.speechSynthesis) {
      alert("Your browser does not support Speech Synthesis.");
      return;
    }

    // Un-mute/Unlock
    window.speechSynthesis.cancel();

    const test = new SpeechSynthesisUtterance("Testing Legal Sentinel audio. Can you hear me?");
    test.lang = 'en-IN';
    test.rate = 1.0;

    test.onstart = () => {
      btn.innerHTML = '<i data-lucide="loader" class="spin" style="width: 12px;"></i> Playing...';
      lucide.createIcons();
    };

    test.onend = () => {
      btn.innerHTML = '<i data-lucide="check" style="width: 12px;"></i> Works!';
      lucide.createIcons();
      setTimeout(() => {
        btn.innerHTML = '<i data-lucide="volume-2" style="width: 12px;"></i> Test Audio';
        lucide.createIcons();
      }, 2000);
    };

    test.onerror = (e) => {
      console.error("Speech Error:", e);
      btn.innerHTML = '<i data-lucide="x-circle" style="width: 12px;"></i> Failed';
      lucide.createIcons();
    };

    window.speechSynthesis.speak(test);
  };
}

// 6. Chat Logic
function initChat() {
  const chatInput = document.querySelector('.chat-input');
  const chatBtn = document.querySelector('.chat-send-trigger');
  const uploadBtn = document.querySelector('#chat-upload-trigger');
  const fileInput = document.querySelector('#chat-file-input');
  const attachmentPreview = document.querySelector('#pending-attachment');
  const initialReplayBtn = document.querySelector('.msg-bot .replay-btn');

  if (initialReplayBtn) {
    initialReplayBtn.onclick = async (e) => {
      e.stopPropagation();
      const icon = initialReplayBtn.querySelector('[data-lucide]');
      if (state.isCurrentlySpeaking) {
        await stopSpeaking();
        if (icon) icon.setAttribute('data-lucide', 'volume-2');
        lucide.createIcons();
      } else {
        const text = initialReplayBtn.parentElement.querySelector('.msg-content').textContent;
        if (icon) icon.setAttribute('data-lucide', 'square');
        lucide.createIcons();
        await speak(text, true);
        const iconAfter = initialReplayBtn.querySelector('[data-lucide]');
        if (iconAfter) iconAfter.setAttribute('data-lucide', 'volume-2');
        lucide.createIcons();
      }
    };
  }

  if (!chatBtn) return;

  uploadBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      attachmentPreview.style.display = 'block';
      attachmentPreview.innerHTML = `<i data-lucide="file-text" style="width:12px;"></i> ${file.name} 
        <i data-lucide="x" style="width:12px; cursor:pointer;" id="remove-attachment"></i>`;
      lucide.createIcons();

      document.querySelector('#remove-attachment').onclick = () => {
        state.pendingChatDoc = null;
        attachmentPreview.style.display = 'none';
      };

      const text = await parseDocument(file, state.selectedLang);
      state.pendingChatDoc = { name: file.name, text: text };
    }
  });

  const sendMessage = async () => {
    const text = chatInput.value.trim();
    if (!text && !state.pendingChatDoc) return;

    if (state.pendingChatDoc) addFileMessage(state.pendingChatDoc.name);
    if (text) addMessage('user', text);

    const userTextCopy = text;
    const pendingDocCopy = state.pendingChatDoc;

    chatInput.value = '';
    attachmentPreview.style.display = 'none';
    state.pendingChatDoc = null;

    const botMsg = addMessage('bot', '');
    const contentDiv = botMsg.querySelector('.msg-content');
    if (contentDiv) contentDiv.innerHTML = `<span class="typing-dots">Sentinel is typing</span>`;

    try {
      let prompt = userTextCopy;
      if (pendingDocCopy) {
        prompt = `[FILE: ${pendingDocCopy.name}]\nContent: ${pendingDocCopy.text.substring(0, 3000)}\n\nQuestion: ${userTextCopy}`;
      }
      const response = await invokeGemini31Pro(prompt, state.selectedLang);

      const contentDiv = botMsg.querySelector('.msg-content');
      if (contentDiv) {
        contentDiv.textContent = response;
      } else {
        botMsg.textContent = response;
      }

      speak(response);
      saveToHistory('Chat', userTextCopy || (pendingDocCopy ? pendingDocCopy.name : "Chat Message"));
    } catch (e) {
      const contentDiv = botMsg.querySelector('.msg-content');
      if (contentDiv) contentDiv.textContent = e.message;
      else botMsg.textContent = e.message;
    }
  };

  chatBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
}

function addMessage(sender, text) {
  const container = document.querySelector('#chat-messages');
  const msg = document.createElement('div');
  msg.className = `msg msg-${sender}`;

  if (sender === 'bot') {
    msg.innerHTML = `
      <div class="msg-content">${text}</div>
      <button class="replay-btn" title="Speak message"><i data-lucide="volume-2"></i></button>
    `;
    const replayBtn = msg.querySelector('.replay-btn');
    replayBtn.onclick = async (e) => {
      e.stopPropagation();
      const icon = replayBtn.querySelector('[data-lucide]');
      if (state.isCurrentlySpeaking) {
        await stopSpeaking();
        if (icon) icon.setAttribute('data-lucide', 'volume-2');
        lucide.createIcons();
      } else {
        const currentText = msg.querySelector('.msg-content').textContent;
        if (icon) icon.setAttribute('data-lucide', 'square');
        lucide.createIcons();
        await speak(currentText, true);
        const iconAfter = replayBtn.querySelector('[data-lucide]');
        if (iconAfter) iconAfter.setAttribute('data-lucide', 'volume-2');
        lucide.createIcons();
      }
    };
  } else {
    msg.textContent = text;
  }

  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
  lucide.createIcons();
  return msg;
}

function addFileMessage(filename) {
  const container = document.querySelector('#chat-messages');
  const msg = document.createElement('div');
  msg.className = `msg msg-file`;
  msg.innerHTML = `
    <div class="file-icon-box"><i data-lucide="file-text"></i></div>
    <div style="flex: 1; overflow: hidden;">
      <div style="font-weight: 600; font-size: 0.8rem;">${filename}</div>
      <div style="font-size: 0.65rem; color: var(--text-dim);">Document Sent</div>
    </div>
  `;
  container.appendChild(msg);
  lucide.createIcons();
}

// 7. Draft Logic
function initDraft() {
  const draftBtn = document.querySelector('#run-draft');
  const resultsArea = document.querySelector('#draft-results');
  const docType = document.querySelector('#draft select');
  const docDetails = document.querySelector('#draft textarea');

  if (!draftBtn) return;

  draftBtn.addEventListener('click', async () => {
    if (state.isScanning) return;

    const type = docType.value;
    const details = docDetails.value.trim();
    if (!details) {
      alert("Please provide some details for the draft.");
      return;
    }

    draftBtn.disabled = true;
    draftBtn.innerHTML = `<i class="pulse" data-lucide="loader-2"></i> <span class="typing-dots">Sentinel is drafting</span>`;
    lucide.createIcons();
    state.isScanning = true;

    try {
      const result = await generateLegalDraft(type, details, state.selectedLang);
      renderDraftResults(resultsArea, result);
      saveToHistory('Draft', `${type}: ${details.substring(0, 20)}...`);
    } catch (e) {
      alert(`Sentinel Error: ${e.message}`);
    } finally {
      state.isScanning = false;
      draftBtn.disabled = false;
      draftBtn.innerHTML = `<i data-lucide="pen-tool"></i> Draft Document`;
      lucide.createIcons();
    }
  });
}

function renderDraftResults(container, rawResult) {
  container.style.display = 'block';
  container.innerHTML = `
    <div class="glass-card" style="border: 1px solid var(--primary-glow); position: relative;">
      <div class="tag tag-primary" style="margin-bottom: 1rem;">GENERATED DRAFT</div>
      <p id="draft-text" class="text-secondary" style="font-size: 0.9rem; white-space: pre-wrap; font-family: monospace; background: rgba(0,0,0,0.2); padding: 1rem; border-radius: var(--radius-sm); border: 1px solid rgba(255,255,255,0.05);">${rawResult}</p>
      <button class="btn-primary" id="copy-draft-btn" style="margin-top: 1rem; width: auto; font-size: 0.8rem; padding: 0.5rem 1rem;">
        <i data-lucide="copy"></i> <span class="btn-text">Copy Draft</span>
      </button>
    </div>
  `;
  lucide.createIcons();
  const copyBtn = container.querySelector('#copy-draft-btn');
  const btnText = copyBtn.querySelector('.btn-text');
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(rawResult).then(() => {
      btnText.textContent = "Copied!";
      copyBtn.style.background = "var(--safe)";
      setTimeout(() => { btnText.textContent = "Copy Draft"; copyBtn.style.background = ""; }, 2000);
    });
  };
  container.scrollIntoView({ behavior: 'smooth' });
}

// 8. History System
function initHistory() {
  const overlay = document.querySelector('#history-overlay');
  const openBtn = document.querySelector('#view-history');
  const closeBtn = document.querySelector('#close-history');
  const list = document.querySelector('#history-list');
  if (!openBtn) return;
  openBtn.onclick = () => { overlay.classList.add('active'); renderHistoryList(list); };
  closeBtn.onclick = () => overlay.classList.remove('active');
}

function saveToHistory(type, summary) {
  state.history.unshift({ type, summary, date: new Date().toLocaleString() });
  if (state.history.length > 10) state.history.pop();
  localStorage.setItem('legal_sentinel_history', JSON.stringify(state.history));
}

function renderHistoryList(container) {
  if (state.history.length === 0) {
    container.innerHTML = `<p class="text-dim" style="text-align: center; margin-top: 2rem;">No history yet.</p>`;
    return;
  }
  container.innerHTML = state.history.map(item => `
    <div class="history-item">
      <div>
        <div style="font-size: 0.6rem; color: var(--primary); text-transform: uppercase; font-weight: 800;">${item.type}</div>
        <div style="font-weight: 600; font-size: 0.9rem;">${item.summary}</div>
        <div style="font-size: 0.7rem; color: var(--text-dim);">${item.date}</div>
      </div>
      <i data-lucide="chevron-right" style="color: var(--text-dim);"></i>
    </div>
  `).join('');
  lucide.createIcons();
}

// 10. Native APK Bridge Receiver
window.receiveScoutFrame = async (base64Data) => {
  const feed = document.querySelector('#scout-text-stream');
  if (!feed) return;

  try {
    state.isOCRPending = true;
    // Convert base64 to File for existing parser
    const res = await fetch(`data:image/png;base64,${base64Data}`);
    const blob = await res.blob();
    const file = new File([blob], "scout_frame.png", { type: "image/png" });

    const text = await parseDocument(file, state.selectedLang);

    if (text && text.trim().length > 10) {
      const cleanText = text.trim();
      if (!state.scoutBuffer.has(cleanText)) {
        state.scoutBuffer.add(cleanText);
        const item = document.createElement('div');
        item.className = 'feed-item';
        item.textContent = cleanText.substring(0, 150) + "...";
        feed.prepend(item);
      }
    }
  } catch (err) {
    console.error("Native Frame Error:", err);
  } finally {
    state.isOCRPending = false;
  }
};
