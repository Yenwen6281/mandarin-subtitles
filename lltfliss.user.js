// ==UserScript==
// @name         lltfliss
// @namespace    https://github.com/Yenwen6281/mandarin-subtitles
// @version      6.1
// @description  Dual-subtitle sidebar, interactive popups, TTS, persistent vocabulary, sticky notes, Bean's notes, custom Woodstock jump, searchable/sortable/filterable saved vocab, interactive flashcards, tactile subtitle tokens, and full interactive button feedback on notes.
// @match        *://*.netflix.com/*
// @match        *://*.youtube.com/*
// @require      https://cdn.jsdelivr.net/npm/pinyin-pro@3.19.7/dist/index.js
// @grant        GM_xmlhttpRequest
// @connect      *
// @connect      translate.googleapis.com
// @connect      api.mymemory.translated.net
// @connect      raw.githubusercontent.com
// @connect      script.google.com
// @connect      script.googleusercontent.com
// ==/UserScript==

(function() {
    'use strict';

    // --- 0. CONSTANTS & SAFE STORAGE HELPER ---
    const STORAGE_KEY = 'eggy_saved_vocab';
    const ASKED_STORAGE_KEY = 'eggy_asked_words';
    const GOOGLE_APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzEkOXPBJgpXoxALL2Qmx1LWoJc4Q1yHySGV_clcSJmuS6_ue7nZUrx5HEM-tOMpVSGrQ/exec';
    const WOODSTOCK_IMG_URL = 'https://raw.githubusercontent.com/Yenwen6281/mandarin-subtitles/dafd9d8981693cfc1ceb84a26c85442dcb9716da/woodstock.png';
    const MENU_ICON_A1_URL = 'https://raw.githubusercontent.com/Yenwen6281/mandarin-subtitles/eb913ed5aad5b8f43a3d28c2a8f6cf93aa590ba6/a1.png';
    const MENU_ICON_A2_URL = 'https://raw.githubusercontent.com/Yenwen6281/mandarin-subtitles/b483be75f7704eac8f74c9f14b489539cdf6bcdf/a2.png';
    const MENU_ICON_A3_URL = 'https://raw.githubusercontent.com/Yenwen6281/mandarin-subtitles/b483be75f7704eac8f74c9f14b489539cdf6bcdf/a3.png';
    const EMPTY_DECK_IMG_URL = 'https://raw.githubusercontent.com/Yenwen6281/mandarin-subtitles/854cab3f7b910a95391b99dfa7d881b22543524f/c1.png';
    const COMPLETE_DECK_IMG_URL = 'https://raw.githubusercontent.com/Yenwen6281/mandarin-subtitles/45c35941f24aabe020891bdc3d9df53ec0aff55f/c2.png';
    const B1_BG_URL = 'https://raw.githubusercontent.com/Yenwen6281/mandarin-subtitles/0e228accc04a786e15a9f8aa271166eee7a5f2b6/b1.png';

    const FLASHCARD_BG_IMAGES_HANZI = [
        'https://raw.githubusercontent.com/Yenwen6281/mandarin-subtitles/98ab0023e1c510c6ee108fe5098afbfe1adbc8f6/d1.png',
        'https://raw.githubusercontent.com/Yenwen6281/mandarin-subtitles/98ab0023e1c510c6ee108fe5098afbfe1adbc8f6/d2.png',
        'https://raw.githubusercontent.com/Yenwen6281/mandarin-subtitles/98ab0023e1c510c6ee108fe5098afbfe1adbc8f6/d3.png',
        'https://raw.githubusercontent.com/Yenwen6281/mandarin-subtitles/98ab0023e1c510c6ee108fe5098afbfe1adbc8f6/d4.png',
        'https://raw.githubusercontent.com/Yenwen6281/mandarin-subtitles/98ab0023e1c510c6ee108fe5098afbfe1adbc8f6/d5.png'
    ];

    const FLASHCARD_BG_IMAGES_ENGLISH = [
        'https://raw.githubusercontent.com/Yenwen6281/mandarin-subtitles/83f32298468c63d9f2368dc328702ed6f301eb60/e1.jpg',
        'https://raw.githubusercontent.com/Yenwen6281/mandarin-subtitles/83f32298468c63d9f2368dc328702ed6f301eb60/e2.jpg',
        'https://raw.githubusercontent.com/Yenwen6281/mandarin-subtitles/83f32298468c63d9f2368dc328702ed6f301eb60/e3.jpg',
        'https://raw.githubusercontent.com/Yenwen6281/mandarin-subtitles/83f32298468c63d9f2368dc328702ed6f301eb60/e4.jpg',
        'https://raw.githubusercontent.com/Yenwen6281/mandarin-subtitles/83f32298468c63d9f2368dc328702ed6f301eb60/e5.jpg'
    ];

    let flashcardSessionCardCount = 0;
    const MYMEMORY_EMAIL = 'yenwen6281plus@gmail.com';

    let beanRepliesList = [];
    let currentPopupWord = null;

    // Flashcard State variables
    let flashcardQueue = [];
    let currentFlashcardMode = 'hanzi';
    let currentSessionDeck = [];

    // --- UTILITIES ---
    function decodeHtmlEntities(str) {
        if (!str) return '';
        const txt = document.createElement('textarea');
        txt.innerHTML = str;
        return txt.value;
    }

    function stripPinyinTones(str) {
        if (!str) return '';
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '');
    }

    function getPlatformText() {
        const host = window.location.hostname.toLowerCase();
        if (host.includes('netflix.com')) return 'netflix';
        if (host.includes('youtube.com')) return 'youtube';
        return host.split('.')[1] || 'video';
    }

    function getSavedVocab() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error("Storage read error:", e);
            return [];
        }
    }

    function saveVocabToStorage(vocab) {
        try {
            let saved = getSavedVocab();
            const existingIndex = saved.findIndex(v => v.hanzi === vocab.hanzi);
            if (existingIndex === -1) {
                saved.push({ ...vocab, note: vocab.note || '', inDeck: false });
                localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
                return true;
            }
            return false;
        } catch (e) {
            console.error("Storage write error:", e);
            return false;
        }
    }

    function removeVocabFromStorage(hanzi) {
        try {
            let saved = getSavedVocab();
            saved = saved.filter(v => v.hanzi !== hanzi);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
        } catch (e) {
            console.error("Storage delete error:", e);
        }
    }

    function updateVocabNote(vocab, noteText) {
        try {
            let saved = getSavedVocab();
            const existingIndex = saved.findIndex(v => v.hanzi === vocab.hanzi);
            if (existingIndex !== -1) {
                saved[existingIndex].note = noteText;
            } else {
                saved.push({ ...vocab, note: noteText, inDeck: false });
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
        } catch (e) {
            console.error("Note save error:", e);
        }
    }

    function toggleVocabInDeck(hanzi) {
        try {
            let saved = getSavedVocab();
            const existingIndex = saved.findIndex(v => v.hanzi === hanzi);
            let newState = false;
            if (existingIndex !== -1) {
                saved[existingIndex].inDeck = !saved[existingIndex].inDeck;
                newState = saved[existingIndex].inDeck;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
            }
            return newState;
        } catch (e) {
            console.error("Deck toggle error:", e);
            return false;
        }
    }

    function clearFlashcardDeck() {
        try {
            let saved = getSavedVocab();
            saved.forEach(v => v.inDeck = false);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
        } catch (e) {}
    }

    function getVocabEntry(hanzi) {
        const saved = getSavedVocab();
        return saved.find(v => v.hanzi === hanzi);
    }

    function isVocabSaved(hanzi) {
        return getSavedVocab().some(v => v.hanzi === hanzi);
    }

    function getAskedWords() {
        try {
            const data = localStorage.getItem(ASKED_STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    function markWordAsAsked(hanzi) {
        try {
            let asked = getAskedWords();
            if (!asked.includes(hanzi)) {
                asked.push(hanzi);
                localStorage.setItem(ASKED_STORAGE_KEY, JSON.stringify(asked));
            }
        } catch (e) {
            console.error("Error saving asked word:", e);
        }
    }

    function getAllBeanRepliesFor(hanzi) {
        return beanRepliesList.filter(r => r.hanzi === hanzi && r.reply);
    }

    function getReportIconStatus(hanzi) {
        const answers = getAllBeanRepliesFor(hanzi);
        if (answers.length > 0) {
            return { color: '#e08b9b', title: "Bean answered! 💌 (Click to view or ask again)" };
        }
        const asked = getAskedWords();
        if (asked.includes(hanzi)) {
            return { color: '#e6a23c', title: "Question sent to Bean 💌 (Waiting for reply)" };
        }
        return { color: '#b89c9e', title: "Ask Bean / Report Word" };
    }

    // --- FETCH BEAN'S REPLIES FROM GOOGLE APPS SCRIPT ---
    function fetchBeanReplies(onComplete) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: GOOGLE_APP_SCRIPT_URL,
            onload: function(response) {
                try {
                    const data = JSON.parse(response.responseText);
                    if (Array.isArray(data)) {
                        beanRepliesList = data;
                        console.log(`💌 Synced ${beanRepliesList.length} explanations from Bean!`);
                        if (typeof onComplete === 'function') onComplete();
                    }
                } catch (err) {
                    console.error("Error reading Bean replies:", err);
                    if (typeof onComplete === 'function') onComplete();
                }
            },
            onerror: function() {
                if (typeof onComplete === 'function') onComplete();
            }
        });
    }
    fetchBeanReplies();

    // --- 1. LOAD HSK VOCABULARY DYNAMICALLY ---
    let vocabMap = new Map();
    let sortedVocabWords = [];

    GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://raw.githubusercontent.com/Yenwen6281/mandarin-subtitles/refs/heads/main/cleaned_hsk.json',
        onload: function(response) {
            try {
                const hskVocabList = JSON.parse(response.responseText);
                hskVocabList.forEach(item => vocabMap.set(item.hanzi, item));
                sortedVocabWords = Array.from(vocabMap.keys()).sort((a, b) => b.length - a.length);
                console.log(`Loaded ${hskVocabList.length} HSK vocabulary words successfully!`);
            } catch (err) {
                console.error("Error parsing HSK JSON:", err);
            }
        }
    });

    // --- 2. TOGGLE BUTTON SETUP ---
    const toggleBtn = document.createElement('button');
    toggleBtn.innerHTML = '🥚'; 
    toggleBtn.id = 'mandarin-toggle-btn';

    toggleBtn.style.cssText = `
        position: fixed;
        bottom: 120px;
        right: 20px;
        z-index: 999999;
        background: linear-gradient(145deg, #eaf8f8, #cde4f6);
        color: white;
        border: none;
        border-radius: 50%;
        width: 55px; 
        height: 55px;
        cursor: pointer;
        font-size: 26px;
        backdrop-filter: blur(5px);
        transform-origin: center bottom;
        box-shadow: 
            inset 0 0 0 2px rgba(255, 255, 255, 0.85),
            inset 2px 2px 5px rgba(255, 255, 255, 0.95), 
            inset -3px -3px 5px rgba(150, 180, 200, 0.3), 
            0 6px 0 #b0d4e3, 
            0 12px 16px rgba(150, 180, 200, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        user-select: none; 
        touch-action: none;
        outline: none;
    `;

    const toggleBtnStyle = document.createElement('style');
    toggleBtnStyle.innerHTML = `
        @keyframes squishBaoDown {
            0% {
                transform: translateY(0) scale(1, 1);
                border-radius: 50%;
                box-shadow: 
                    inset 0 0 0 2px rgba(255, 255, 255, 0.85),
                    inset 2px 2px 5px rgba(255, 255, 255, 0.95), 
                    inset -3px -3px 5px rgba(150, 180, 200, 0.25), 
                    0 6px 0 var(--egg-shadow-color, #b0d4e3), 
                    0 12px 16px rgba(150, 180, 200, 0.4);
            }
            45% {
                transform: translateY(3px) scale(1.15, 0.85);
                border-radius: 48% 48% 44% 44% / 44% 44% 54% 54%;
                box-shadow: 
                    inset 0 0 0 1.5px rgba(255, 255, 255, 0.65),
                    inset 0 3px 5px rgba(130, 165, 185, 0.35),
                    0 3.5px 0 var(--egg-shadow-color, #b0d4e3), 
                    0 6px 12px rgba(150, 180, 200, 0.45);
            }
            80% {
                transform: translateY(6px) scale(1.28, 0.68);
                border-radius: 46% 46% 40% 40% / 34% 34% 62% 62%;
                box-shadow: 
                    inset 0 0 0 1px rgba(255, 255, 255, 0.5),
                    inset 0 4px 7px rgba(130, 165, 185, 0.5),
                    0 1px 0 var(--egg-shadow-color, #b0d4e3), 
                    0 2px 6px rgba(150, 180, 200, 0.55);
            }
            100% {
                transform: translateY(5px) scale(1.26, 0.72);
                border-radius: 47% 47% 41% 41% / 36% 36% 60% 60%;
                box-shadow: 
                    inset 0 0 0 1.2px rgba(255, 255, 255, 0.55),
                    inset 0 3px 6px rgba(130, 165, 185, 0.45),
                    0 1.5px 0 var(--egg-shadow-color, #b0d4e3), 
                    0 3px 8px rgba(150, 180, 200, 0.5);
            }
        }

        @keyframes baoElasticRebound {
            0% {
                transform: translateY(5px) scale(1.26, 0.72);
                border-radius: 47% 47% 41% 41% / 36% 36% 60% 60%;
                box-shadow: 
                    inset 0 0 0 1.2px rgba(255, 255, 255, 0.55),
                    0 1.5px 0 var(--egg-shadow-color, #b0d4e3);
            }
            28% {
                transform: translateY(-8px) scale(0.84, 1.18);
                border-radius: 54% 54% 48% 48% / 58% 58% 44% 44%;
                box-shadow: 
                    inset 0 0 0 2px rgba(255, 255, 255, 0.9),
                    0 11px 0 var(--egg-shadow-color, #b0d4e3), 
                    0 20px 24px rgba(150, 180, 200, 0.5);
            }
            52% {
                transform: translateY(1.5px) scale(1.12, 0.92);
                border-radius: 49% 49% 46% 46% / 46% 46% 52% 52%;
                box-shadow: 
                    inset 0 0 0 1.8px rgba(255, 255, 255, 0.8),
                    0 5px 0 var(--egg-shadow-color, #b0d4e3), 
                    0 10px 14px rgba(150, 180, 200, 0.38);
            }
            74% {
                transform: translateY(-2px) scale(0.96, 1.05);
                border-radius: 51% 51% 50% 50% / 52% 52% 48% 48%;
                box-shadow: 
                    inset 0 0 0 2px rgba(255, 255, 255, 0.85),
                    0 7.5px 0 var(--egg-shadow-color, #b0d4e3), 
                    0 14px 18px rgba(150, 180, 200, 0.42);
            }
            88% {
                transform: translateY(0.5px) scale(1.02, 0.99);
                border-radius: 50%;
                box-shadow: 
                    inset 0 0 0 2px rgba(255, 255, 255, 0.85),
                    0 6px 0 var(--egg-shadow-color, #b0d4e3), 
                    0 12px 16px rgba(150, 180, 200, 0.4);
            }
            100% {
                transform: translateY(0) scale(1, 1);
                border-radius: 50%;
                box-shadow: 
                    inset 0 0 0 2px rgba(255, 255, 255, 0.85),
                    inset 2px 2px 5px rgba(255, 255, 255, 0.95), 
                    inset -3px -3px 5px rgba(150, 180, 200, 0.3), 
                    0 6px 0 #b0d4e3, 
                    0 12px 16px rgba(150, 180, 200, 0.4);
            }
        }

        #mandarin-toggle-btn:hover {
            transform: translateY(-4px) scale(1.06, 1.04);
            box-shadow: 
                inset 0 0 0 2px rgba(255, 255, 255, 0.95),
                inset 2px 2px 5px rgba(255, 255, 255, 0.95), 
                inset -3px -3px 5px rgba(150, 180, 200, 0.25), 
                0 9px 0 var(--egg-shadow-color, #b0d4e3), 
                0 16px 22px rgba(150, 180, 200, 0.48);
            transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
        }

        #mandarin-toggle-btn.egg-squishing {
            animation: squishBaoDown 0.38s cubic-bezier(0.2, 0.85, 0.25, 1) forwards !important;
        }

        #mandarin-toggle-btn.egg-rebounding {
            animation: baoElasticRebound 0.72s cubic-bezier(0.36, 0.07, 0.19, 0.97) forwards !important;
        }
    `;
    document.head.appendChild(toggleBtnStyle);
    document.body.appendChild(toggleBtn);

    // --- 3. VOCABULARY POPUP & REPORT MODAL SETUP ---
    const popupModal = document.createElement('div');
    popupModal.id = 'mandarin-vocab-popup';
    popupModal.style.cssText = `
        position: fixed;
        display: none;
        z-index: 9999999;
        background: rgba(255, 255, 255, 0.96);
        backdrop-filter: blur(8px);
        border: 2px solid #f5cde2;
        padding: 16px;
        border-radius: 16px;
        box-shadow: 0 10px 25px rgba(200, 150, 160, 0.3);
        font-family: 'Quicksand', -apple-system, BlinkMacSystemFont, sans-serif;
        width: 285px;
        max-width: calc(100vw - 30px);
        box-sizing: border-box;
        color: #5c4a4d;
        animation: popIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;
    document.body.appendChild(popupModal);

    const popupStyles = document.createElement('style');
    popupStyles.innerHTML = `
        #mandarin-vocab-popup .sticky-note-box {
            margin-top: 8px;
            background: #fff9e6;
            border: 1px solid #fbe7b2;
            border-radius: 8px;
            padding: 7px 9px;
            box-shadow: 0 2px 6px rgba(220, 190, 140, 0.2);
            animation: popIn 0.2s ease-out;
        }
        #mandarin-vocab-popup .sticky-note-input {
            width: 100%;
            border: none;
            background: transparent;
            resize: none;
            font-size: 12px;
            color: #5c4a4d;
            font-family: 'Quicksand', -apple-system, BlinkMacSystemFont, sans-serif;
            outline: none;
            box-sizing: border-box;
            line-height: 1.35;
            margin-bottom: 3px;
        }
        #mandarin-vocab-popup .sticky-note-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px dashed rgba(220, 190, 140, 0.4);
            padding-top: 4px;
        }

        /* Popup Note Save & Close Tactile Button Feedback */
        #mandarin-vocab-popup #popup-note-save-btn {
            background: linear-gradient(180deg, #f09cb0 0%, #e08b9b 100%);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.7);
            border-radius: 6px;
            padding: 3.5px 9px;
            font-size: 10.5px;
            cursor: pointer;
            font-weight: bold;
            outline: none;
            user-select: none;
            box-shadow: 0 2.5px 0 #ba6273, 0 3px 6px rgba(224, 139, 155, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.7);
            transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease;
        }
        #mandarin-vocab-popup #popup-note-save-btn:hover {
            transform: translateY(-1.5px);
            box-shadow: 0 4px 0 #ba6273, 0 5px 9px rgba(224, 139, 155, 0.35), inset 0 1px 1px #ffffff;
        }
        #mandarin-vocab-popup #popup-note-save-btn:active {
            transform: translateY(2px) scale(0.93);
            box-shadow: 0 0.5px 0 #ba6273, inset 0 1.5px 2px rgba(140, 50, 65, 0.35);
        }
        
        #mandarin-vocab-popup #vocab-close-btn {
            cursor: pointer;
            color: #9c8085;
            font-size: 14px;
            font-weight: 800;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 26px;
            height: 26px;
            border-radius: 8px;
            background: linear-gradient(180deg, #ffffff 0%, #faeef3 100%);
            border: 1px solid #f5cde2;
            box-shadow: 0 2.5px 0 #e2becb, 0 3px 6px rgba(200, 150, 160, 0.15), inset 0 1px 1px #ffffff;
            user-select: none;
            outline: none;
            transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease, color 0.15s ease;
        }
        #mandarin-vocab-popup #vocab-close-btn:hover {
            color: #e08b9b;
            transform: translateY(-1.5px);
            box-shadow: 0 4px 0 #e2becb, 0 5px 9px rgba(200, 150, 160, 0.25), inset 0 1px 1px #ffffff;
        }
        #mandarin-vocab-popup #vocab-close-btn:active {
            transform: translateY(2px) scale(0.92);
            box-shadow: 0 0.5px 0 #e2becb, 0 1px 2px rgba(200, 150, 160, 0.2), inset 0 1.5px 2px rgba(180, 120, 130, 0.2);
        }

        #mandarin-vocab-popup .deck-toggle-btn {
            font-size: 11.5px;
            font-weight: 700;
            padding: 5px 12px;
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.85);
            color: #7b6267;
            background: linear-gradient(180deg, #ffffff 0%, #fae6ed 100%);
            box-shadow: 
                0 3.5px 0 #d9a8b6,
                0 4px 8px rgba(224, 139, 155, 0.2),
                inset 0 1px 1px rgba(255, 255, 255, 0.9);
            cursor: pointer;
            user-select: none;
            outline: none;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease, background 0.2s ease, color 0.2s ease;
            font-family: inherit;
        }
        #mandarin-vocab-popup .deck-toggle-btn:hover {
            transform: translateY(-2px);
            box-shadow: 
                0 5.5px 0 #d9a8b6,
                0 6px 12px rgba(224, 139, 155, 0.3),
                inset 0 1px 1px #ffffff;
        }
        #mandarin-vocab-popup .deck-toggle-btn:active {
            transform: translateY(2.5px) scale(0.94);
            box-shadow: 
                0 1px 0 #d9a8b6,
                0 2px 4px rgba(224, 139, 155, 0.2),
                inset 0 2px 3px rgba(180, 110, 125, 0.25);
        }
        #mandarin-vocab-popup .deck-toggle-btn.in-deck {
            background: linear-gradient(180deg, #ffc7d5 0%, #e08b9b 100%);
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.6);
            box-shadow: 
                0 3.5px 0 #ba6273,
                0 4px 8px rgba(224, 139, 155, 0.35),
                inset 0 1px 1px rgba(255, 255, 255, 0.6);
        }
        #mandarin-vocab-popup .deck-toggle-btn.in-deck:hover {
            box-shadow: 
                0 5.5px 0 #ba6273,
                0 6px 12px rgba(224, 139, 155, 0.45),
                inset 0 1px 1px rgba(255, 255, 255, 0.7);
        }
        #mandarin-vocab-popup .deck-toggle-btn.in-deck:active {
            box-shadow: 
                0 1px 0 #ba6273,
                0 2px 4px rgba(160, 65, 80, 0.3),
                inset 0 2px 3px rgba(140, 50, 65, 0.35);
        }

        #mandarin-vocab-popup .popup-icon-btn {
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: rgba(245, 205, 226, 0.22);
            box-shadow: 0 2px 0 rgba(200, 150, 160, 0.22), inset 0 1px 1px rgba(255, 255, 255, 0.8);
            user-select: none;
            outline: none;
            transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease, background 0.2s ease;
        }
        #mandarin-vocab-popup .popup-icon-btn:hover {
            transform: translateY(-2px) scale(1.12);
            background: rgba(245, 205, 226, 0.45);
            box-shadow: 0 4px 0 rgba(200, 150, 160, 0.3), 0 4px 8px rgba(224, 139, 155, 0.25), inset 0 1px 1px #ffffff;
        }
        #mandarin-vocab-popup .popup-icon-btn:active {
            transform: translateY(2px) scale(0.88);
            background: rgba(245, 205, 226, 0.6);
            box-shadow: 0 0.5px 0 rgba(200, 150, 160, 0.2), inset 0 1.5px 2px rgba(180, 120, 130, 0.25);
        }

        #mandarin-vocab-popup #mandarin-speak-btn {
            background: none;
            border: none;
            cursor: pointer;
            padding: 0;
            outline: none;
            display: flex;
            align-items: center;
            user-select: none;
            transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        #mandarin-vocab-popup #mandarin-speak-btn:hover {
            transform: translateY(-2px) scale(1.08);
        }
        #mandarin-vocab-popup #mandarin-speak-btn:active {
            transform: translateY(2px) scale(0.9, 0.85);
        }

        #mandarin-vocab-popup #popup-jump-btn {
            background: none;
            border: none;
            padding: 0;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            outline: none;
            user-select: none;
            transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        #mandarin-vocab-popup #popup-jump-btn:hover {
            transform: translateY(-2px) scale(1.15) rotate(-8deg);
        }
        #mandarin-vocab-popup #popup-jump-btn:active {
            transform: translateY(2px) scale(0.85) rotate(4deg);
        }

        /* Report Modal Tactile Buttons */
        #mandarin-report-modal #send-report-btn {
            width: 100%;
            background: linear-gradient(180deg, #f09cb0 0%, #e08b9b 100%);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.7);
            border-radius: 12px;
            padding: 10px;
            font-weight: 800;
            font-size: 13.5px;
            cursor: pointer;
            user-select: none;
            outline: none;
            box-shadow: 0 4px 0 #ba6273, 0 6px 12px rgba(224, 139, 155, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.7);
            transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease, background 0.2s ease;
        }
        #mandarin-report-modal #send-report-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 0 #ba6273, 0 8px 16px rgba(224, 139, 155, 0.45), inset 0 1px 1px #ffffff;
        }
        #mandarin-report-modal #send-report-btn:active {
            transform: translateY(3px) scale(0.96);
            box-shadow: 0 1px 0 #ba6273, 0 2px 4px rgba(224, 139, 155, 0.2), inset 0 2px 3px rgba(140, 50, 65, 0.35);
        }
        #mandarin-report-modal #close-report-btn {
            cursor: pointer;
            color: #9c8085;
            font-weight: 800;
            font-size: 13px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border-radius: 8px;
            background: linear-gradient(180deg, #ffffff 0%, #faeef3 100%);
            border: 1px solid #f5cde2;
            box-shadow: 0 2.5px 0 #e2becb, 0 3px 6px rgba(200, 150, 160, 0.15), inset 0 1px 1px #ffffff;
            user-select: none;
            outline: none;
            transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease, color 0.15s ease;
        }
        #mandarin-report-modal #close-report-btn:hover {
            color: #e08b9b;
            transform: translateY(-1.5px);
            box-shadow: 0 4px 0 #e2becb, 0 5px 9px rgba(200, 150, 160, 0.25), inset 0 1px 1px #ffffff;
        }
        #mandarin-report-modal #close-report-btn:active {
            transform: translateY(2px) scale(0.92);
            box-shadow: 0 0.5px 0 #e2becb, 0 1px 2px rgba(200, 150, 160, 0.2), inset 0 1.5px 2px rgba(180, 120, 130, 0.2);
        }
    `;
    document.head.appendChild(popupStyles);

    const reportModal = document.createElement('div');
    reportModal.id = 'mandarin-report-modal';
    reportModal.style.cssText = `
        position: fixed;
        display: none;
        z-index: 10000000;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 255, 255, 0.98);
        backdrop-filter: blur(12px);
        border: 2px solid #f5cde2;
        padding: 20px;
        border-radius: 18px;
        box-shadow: 0 12px 32px rgba(200, 150, 160, 0.35);
        font-family: 'Quicksand', -apple-system, BlinkMacSystemFont, sans-serif;
        width: 310px;
        color: #5c4a4d;
        box-sizing: border-box;
    `;
    document.body.appendChild(reportModal);

    let isSidebarActive = false;
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    function onDragStart(e) {
        isDragging = false;
        toggleBtn.classList.remove('egg-rebounding');
        toggleBtn.classList.add('egg-squishing');

        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        startX = clientX;
        startY = clientY;
        const rect = toggleBtn.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        document.addEventListener('mousemove', onDragMove, { passive: false });
        document.addEventListener('touchmove', onDragMove, { passive: false });
        document.addEventListener('mouseup', onDragEnd);
        document.addEventListener('touchend', onDragEnd);
    }

    function onDragMove(e) {
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        const dx = clientX - startX;
        const dy = clientY - startY;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            isDragging = true;
            e.preventDefault(); 
        }

        if (isDragging) {
            toggleBtn.style.left = `${initialLeft + dx}px`;
            toggleBtn.style.top = `${initialTop + dy}px`;
            toggleBtn.style.bottom = 'auto'; 
            toggleBtn.style.right = 'auto';
        }
    }

    function onDragEnd() {
        toggleBtn.classList.remove('egg-squishing');
        void toggleBtn.offsetWidth;
        toggleBtn.classList.add('egg-rebounding');

        setTimeout(() => {
            toggleBtn.classList.remove('egg-rebounding');
        }, 750);

        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('touchmove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);
        document.removeEventListener('touchend', onDragEnd);

        if (!isDragging) {
            handleToggle();
        }
    }

    function handleToggle() {
        isSidebarActive = !isSidebarActive;
        if (isSidebarActive) {
            toggleBtn.style.setProperty('--egg-shadow-color', '#e8b4c8');
            toggleBtn.style.background = 'linear-gradient(145deg, #ffe6e6, #f5cde2)';
            toggleBtn.style.boxShadow = `
                inset 0 0 0 2px rgba(255, 255, 255, 0.85),
                inset 2px 2px 5px rgba(255, 255, 255, 0.9), 
                inset -3px -3px 5px rgba(220, 160, 180, 0.3), 
                0 6px 0 #e8b4c8, 
                0 12px 16px rgba(200, 150, 160, 0.4)
            `;
            injectSidebarUI();
            startObservingVideo();
        } else {
            toggleBtn.style.setProperty('--egg-shadow-color', '#b0d4e3');
            toggleBtn.style.background = 'linear-gradient(145deg, #eaf8f8, #cde4f6)';
            toggleBtn.style.boxShadow = `
                inset 0 0 0 2px rgba(255, 255, 255, 0.85),
                inset 2px 2px 5px rgba(255, 255, 255, 0.9), 
                inset -3px -3px 5px rgba(150, 180, 200, 0.3), 
                0 6px 0 #b0d4e3, 
                0 12px 16px rgba(150, 180, 200, 0.4)
            `;
            removeSidebarUI();
        }
    }

    toggleBtn.addEventListener('mousedown', onDragStart);
    toggleBtn.addEventListener('touchstart', onDragStart, { passive: false });

    // --- 4. SIDEBAR INJECTION & SETUP ---
    function injectSidebarUI() {
        if (document.getElementById('mandarin-sidebar-host')) return;

        const sidebarHost = document.createElement('div');
        sidebarHost.id = 'mandarin-sidebar-host';
        const imageUrl = 'https://i.pinimg.com/736x/be/ab/dd/beabddfba3f997d5ee1f880c04a869b8.jpg';
        
        sidebarHost.style.cssText = `
            width: 350px; 
            height: 100vh; 
            position: fixed; 
            right: 0; 
            top: 0; 
            z-index: 99998; 
            background: linear-gradient(rgba(252, 248, 245, 0.85), rgba(252, 248, 245, 0.88)), url('${imageUrl}');
            background-size: cover;
            background-position: center bottom;
            background-repeat: no-repeat;
            border-left: 3px solid #f5cde2; 
            box-shadow: -5px 0 15px rgba(200, 150, 160, 0.2);
            overflow: hidden;
            font-family: 'Quicksand', -apple-system, BlinkMacSystemFont, sans-serif;
        `;
        
        const shadowRoot = sidebarHost.attachShadow({ mode: 'open' });
        
        shadowRoot.innerHTML = `
            <style>
                #mandarin-platform-text {
                    position: absolute;
                    top: -19px;
                    left: -19px;
                    font-size: 9px;
                    font-weight: 700;
                    letter-spacing: 0.6px;
                    text-transform: uppercase;
                    color: #8ba6b6;
                    background: rgba(255, 255, 255, 0.9);
                    padding: 2px 6px;
                    border-radius: 6px;
                    border: 1px solid rgba(245, 205, 226, 0.7);
                    backdrop-filter: blur(4px);
                    user-select: none;
                    box-shadow: 0 1px 3px rgba(200, 150, 160, 0.12);
                    z-index: 10;
                }

                #mandarin-menu-btn {
                    position: absolute; 
                    top: 10px; 
                    right: 12px; 
                    cursor: pointer; 
                    padding: 8px; 
                    border-radius: 12px;
                    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease, box-shadow 0.2s ease;
                }
                #mandarin-menu-btn:hover {
                    transform: scale(1.15);
                    background: rgba(139, 166, 182, 0.15);
                }
                #mandarin-menu-btn:active {
                    transform: scale(0.8) translateY(2px);
                    background: rgba(139, 166, 182, 0.25);
                    box-shadow: inset 0 3px 6px rgba(139, 166, 182, 0.4);
                }

                #back-to-subs-btn {
                    display: none;
                    margin-top: 12px;
                    cursor: pointer;
                    color: #5c7482;
                    font-size: 13px;
                    font-weight: 800;
                    letter-spacing: 0.3px;
                    background: linear-gradient(180deg, #ffffff 0%, #eaf3f8 100%);
                    padding: 7px 16px;
                    border-radius: 20px;
                    border: 1.5px solid rgba(255, 255, 255, 0.9);
                    user-select: none;
                    outline: none;
                    box-shadow: 0 3.5px 0 #b3cddb, 0 5px 9px rgba(139, 166, 182, 0.24), inset 0 1px 1px #ffffff;
                    transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease, color 0.15s ease, background 0.2s ease;
                }
                #back-to-subs-btn:hover {
                    color: #e08b9b;
                    transform: translateY(-2px);
                    box-shadow: 0 5.5px 0 #b3cddb, 0 8px 14px rgba(139, 166, 182, 0.32), inset 0 1px 1px #ffffff;
                }
                #back-to-subs-btn:active {
                    transform: translateY(2.5px);
                    box-shadow: 0 1px 0 #b3cddb, 0 2px 4px rgba(139, 166, 182, 0.2), inset 0 2px 3px rgba(139, 166, 182, 0.3);
                }

                /* Subtitle Transcript Vocabulary Token Tactile Feedback */
                .hsk-vocab-token {
                    display: inline-block;
                    background: #ffe6e6;
                    border-bottom: 2px solid #e08b9b;
                    border-radius: 5px;
                    padding: 1px 4px;
                    margin: 0 1.5px;
                    cursor: pointer;
                    user-select: none;
                    box-shadow: 0 1.5px 0 #e8b4c8;
                    transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), 
                                box-shadow 0.15s ease, 
                                background 0.2s ease, 
                                border-color 0.2s ease;
                }
                .hsk-vocab-token:hover {
                    background: #ffd9e2;
                    transform: translateY(-1.5px);
                    box-shadow: 0 2.5px 6px rgba(224, 139, 155, 0.35);
                    border-bottom-color: #d86d81;
                }
                .hsk-vocab-token:active {
                    transform: translateY(1.5px) scale(0.95);
                    box-shadow: 0 0.5px 1px rgba(200, 150, 160, 0.3);
                    background: #ffcbd8;
                }
                
                @keyframes menuPop {
                    from { opacity: 0; transform: translateY(-5px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }

                @keyframes popIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }

                @keyframes jellyShakeOnce {
                    0%   { transform: scale(1, 1); }
                    15%  { transform: scale(1.13, 0.87) rotate(-3deg); }
                    30%  { transform: scale(0.89, 1.11) rotate(2.5deg); }
                    45%  { transform: scale(1.06, 0.95) rotate(-1.5deg); }
                    60%  { transform: scale(0.97, 1.03) rotate(1deg); }
                    75%  { transform: scale(1.02, 0.98) rotate(-0.5deg); }
                    90%  { transform: scale(0.99, 1.01) rotate(0.2deg); }
                    100% { transform: scale(1, 1) rotate(0deg); }
                }

                .jelly-shake-once {
                    animation: jellyShakeOnce 1.05s cubic-bezier(0.36, 0.07, 0.19, 0.97) 1 forwards !important;
                }

                .card-highlight-persistent {
                    border: 2.5px solid #e08b9b !important;
                    background: rgba(255, 240, 245, 0.96) !important;
                    box-shadow: 0 6px 20px rgba(224, 139, 155, 0.32) !important;
                }

                .menu-item {
                    padding: 8px 10px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    color: #5c4a4d;
                    font-weight: 600;
                    transition: background 0.2s;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .menu-item:hover { background: #f5cde2; }
                .menu-item-icon {
                    width: 22px;
                    height: 22px;
                    object-fit: contain;
                    pointer-events: none;
                    filter: drop-shadow(0 1px 2px rgba(200, 150, 160, 0.3));
                }
                
                .vocab-card {
                    background: rgba(255, 255, 255, 0.92);
                    border: 1px solid rgba(250, 227, 239, 0.8);
                    border-radius: 14px;
                    padding: 14px;
                    margin-bottom: 12px;
                    box-shadow: 0 4px 10px rgba(200, 150, 160, 0.12);
                    position: relative;
                    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease;
                }
                .vocab-card-title { font-size: 22px; font-weight: bold; color: #e08b9b; }
                .vocab-card-pinyin { font-size: 14px; color: #d09b9f; font-style: italic; margin-bottom: 8px; }
                
                .deck-toggle-btn {
                    font-size: 11.5px;
                    font-weight: 700;
                    padding: 5px 12px;
                    border-radius: 20px;
                    border: 1px solid rgba(255, 255, 255, 0.85);
                    color: #7b6267;
                    background: linear-gradient(180deg, #ffffff 0%, #fae6ed 100%);
                    box-shadow: 
                        0 3.5px 0 #d9a8b6,
                        0 4px 8px rgba(224, 139, 155, 0.2),
                        inset 0 1px 1px rgba(255, 255, 255, 0.9);
                    cursor: pointer;
                    user-select: none;
                    outline: none;
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease, background 0.2s ease, color 0.2s ease;
                    font-family: inherit;
                }
                .deck-toggle-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 
                        0 5.5px 0 #d9a8b6,
                        0 6px 12px rgba(224, 139, 155, 0.3),
                        inset 0 1px 1px #ffffff;
                }
                .deck-toggle-btn:active {
                    transform: translateY(2.5px) scale(0.94);
                    box-shadow: 
                        0 1px 0 #d9a8b6,
                        0 2px 4px rgba(224, 139, 155, 0.2),
                        inset 0 2px 3px rgba(180, 110, 125, 0.25);
                }
                .deck-toggle-btn.in-deck {
                    background: linear-gradient(180deg, #ffc7d5 0%, #e08b9b 100%);
                    color: #ffffff;
                    border: 1px solid rgba(255, 255, 255, 0.6);
                    box-shadow: 
                        0 3.5px 0 #ba6273,
                        0 4px 8px rgba(224, 139, 155, 0.35),
                        inset 0 1px 1px rgba(255, 255, 255, 0.6);
                }
                .deck-toggle-btn.in-deck:hover {
                    box-shadow: 
                        0 5.5px 0 #ba6273,
                        0 6px 12px rgba(224, 139, 155, 0.45),
                        inset 0 1px 1px rgba(255, 255, 255, 0.7);
                }
                .deck-toggle-btn.in-deck:active {
                    box-shadow: 
                        0 1px 0 #ba6273,
                        0 2px 4px rgba(160, 65, 80, 0.3),
                        inset 0 2px 3px rgba(140, 50, 65, 0.35);
                }

                .saved-icon-btn {
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    background: rgba(245, 205, 226, 0.22);
                    box-shadow: 0 2px 0 rgba(200, 150, 160, 0.22), inset 0 1px 1px rgba(255, 255, 255, 0.8);
                    user-select: none;
                    outline: none;
                    transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease, background 0.2s ease;
                }
                .saved-icon-btn:hover {
                    transform: translateY(-2px) scale(1.12);
                    background: rgba(245, 205, 226, 0.45);
                    box-shadow: 0 4px 0 rgba(200, 150, 160, 0.3), 0 4px 8px rgba(224, 139, 155, 0.25), inset 0 1px 1px #ffffff;
                }
                .saved-icon-btn:active {
                    transform: translateY(2px) scale(0.88);
                    background: rgba(245, 205, 226, 0.6);
                    box-shadow: 0 0.5px 0 rgba(200, 150, 160, 0.2), inset 0 1.5px 2px rgba(180, 120, 130, 0.25);
                }

                .card-speak-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 0;
                    outline: none;
                    display: flex;
                    align-items: center;
                    user-select: none;
                    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .card-speak-btn:hover {
                    transform: translateY(-2px) scale(1.08);
                }
                .card-speak-btn:active {
                    transform: translateY(2px) scale(0.9, 0.85);
                }

                .card-note-save-btn {
                    background: linear-gradient(180deg, #f09cb0 0%, #e08b9b 100%);
                    color: white;
                    border: 1px solid rgba(255, 255, 255, 0.7);
                    border-radius: 6px;
                    padding: 4px 10px;
                    font-size: 11px;
                    cursor: pointer;
                    font-weight: bold;
                    outline: none;
                    user-select: none;
                    box-shadow: 0 2.5px 0 #ba6273, 0 3px 6px rgba(224, 139, 155, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.7);
                    transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease;
                }
                .card-note-save-btn:hover {
                    transform: translateY(-1.5px);
                    box-shadow: 0 4px 0 #ba6273, 0 5px 9px rgba(224, 139, 155, 0.35), inset 0 1px 1px #ffffff;
                }
                .card-note-save-btn:active {
                    transform: translateY(2px) scale(0.93);
                    box-shadow: 0 0.5px 0 #ba6273, inset 0 1.5px 2px rgba(140, 50, 65, 0.35);
                }

                .sticky-note-box {
                    margin-top: 8px;
                    background: #fff9e6;
                    border: 1px solid #fbe7b2;
                    border-radius: 8px;
                    padding: 7px 9px;
                    box-shadow: 0 2px 6px rgba(220, 190, 140, 0.2);
                    animation: popIn 0.2s ease-out;
                }
                .sticky-note-input {
                    width: 100%;
                    border: none;
                    background: transparent;
                    resize: none;
                    font-size: 12px;
                    color: #5c4a4d;
                    font-family: inherit;
                    outline: none;
                    box-sizing: border-box;
                    line-height: 1.35;
                    margin-bottom: 3px;
                }
                .sticky-note-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-top: 1px dashed rgba(220, 190, 140, 0.4);
                    padding-top: 4px;
                }

                .bean-reply-box {
                    margin-top: 10px;
                    background: #eef7fc;
                    border: 1.5px solid #c9e4f5;
                    border-radius: 10px;
                    padding: 8px 10px;
                    font-size: 12.5px;
                    color: #406277;
                    line-height: 1.4;
                    position: relative;
                }

                .bean-nav-btn {
                    cursor: pointer;
                    background: rgba(139, 166, 182, 0.2);
                    border: none;
                    border-radius: 4px;
                    color: #406277;
                    font-size: 10px;
                    padding: 2px 6px;
                    font-weight: bold;
                    transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease, color 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    user-select: none;
                }
                .bean-nav-btn:hover {
                    background: #e08b9b;
                    color: white;
                    transform: scale(1.15);
                }
                .bean-nav-btn:active {
                    transform: scale(0.9) translateY(1px);
                }

                .bean-jump-btn {
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: none;
                    border: none;
                    padding: 2px;
                    user-select: none;
                    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.2s ease;
                }
                .bean-jump-btn img {
                    width: 42px;
                    height: auto;
                    filter: drop-shadow(1px 2px 4px rgba(200, 150, 160, 0.4));
                }
                .bean-jump-btn:hover {
                    transform: translateY(-2px) scale(1.18) rotate(-6deg);
                }
                .bean-jump-btn:active {
                    transform: translateY(2px) scale(0.85) rotate(4deg);
                }

                .jump-back-btn {
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 11.5px;
                    font-weight: 700;
                    color: #8ba6b6;
                    background: rgba(139, 166, 182, 0.15);
                    padding: 4px 9px;
                    border-radius: 8px;
                    user-select: none;
                    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease, color 0.2s ease;
                }
                .jump-back-btn:hover {
                    color: #e08b9b;
                    background: rgba(224, 139, 155, 0.18);
                    transform: scale(1.08) translateY(-1px);
                }
                .jump-back-btn:active {
                    transform: scale(0.82) translateY(2px);
                }

                .vocab-controls {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-bottom: 12px;
                    padding-bottom: 12px;
                    border-bottom: 2px dashed rgba(245, 205, 226, 0.6);
                }
                .vocab-search-bar {
                    width: 100%;
                    padding: 8px 12px;
                    border-radius: 8px;
                    border: 1px solid #f5cde2;
                    background: rgba(255, 255, 255, 0.9);
                    font-family: inherit;
                    font-size: 13px;
                    color: #5c4a4d;
                    box-sizing: border-box;
                    outline: none;
                    transition: box-shadow 0.2s;
                }
                .vocab-search-bar:focus {
                    box-shadow: 0 0 0 2px rgba(224, 139, 155, 0.3);
                }
                .vocab-select-row {
                    display: flex;
                    gap: 8px;
                    width: 100%;
                }
                .vocab-control-select {
                    flex: 1;
                    padding: 7px 10px;
                    border-radius: 8px;
                    border: 1px solid #f5cde2;
                    background: rgba(255, 255, 255, 0.9);
                    font-family: inherit;
                    font-size: 11.5px;
                    color: #5c4a4d;
                    outline: none;
                    cursor: pointer;
                    transition: box-shadow 0.2s;
                }
                .vocab-control-select:focus {
                    box-shadow: 0 0 0 2px rgba(224, 139, 155, 0.3);
                }

                .mode-picker-card {
                    position: relative;
                    border-radius: 16px;
                    padding: 20px 16px;
                    margin-bottom: 15px;
                    cursor: pointer;
                    overflow: hidden;
                    box-shadow: 0 4px 14px rgba(200, 150, 160, 0.18);
                    border: 1px solid rgba(245, 205, 226, 0.7);
                    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
                    text-align: center;
                    background-color: #fff;
                }
                .mode-picker-card:hover {
                    transform: translateY(-3px) scale(1.02);
                    box-shadow: 0 8px 20px rgba(200, 150, 160, 0.28);
                }
                .mode-picker-card.card-b1 {
                    background-color: #ffffff;
                    background-image: url('https://raw.githubusercontent.com/Yenwen6281/mandarin-subtitles/0e228accc04a786e15a9f8aa271166eee7a5f2b6/b1.png');
                    background-size: 100% 100%;
                    background-position: center;
                    background-repeat: no-repeat;
                    min-height: 145px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    box-sizing: border-box;
                    padding: 24px 20px;
                }
                .mode-picker-card.card-b2 {
                    background-color: #ffffff;
                    background-image: url('https://raw.githubusercontent.com/Yenwen6281/mandarin-subtitles/8651c6a44f1b8e7f87d4654e96e8bdc7c4ef52ae/b2.png');
                    background-size: 100% 100%;
                    background-position: center;
                    background-repeat: no-repeat;
                    min-height: 145px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    box-sizing: border-box;
                    padding: 24px 20px;
                }
                .mode-picker-card .fc-start-pill {
                    background: linear-gradient(180deg, #ffffff 0%, #fae6ed 100%);
                    color: #e08b9b;
                    border: 1px solid rgba(255, 255, 255, 0.9);
                    border-radius: 20px;
                    padding: 6px 20px;
                    font-weight: 700;
                    font-size: 13px;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    box-shadow: 0 3px 6px rgba(224, 139, 155, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.9);
                    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s;
                }
                
                .mode-picker-card:hover .fc-start-pill {
                    transform: scale(1.05);
                    box-shadow: 0 5px 10px rgba(224, 139, 155, 0.3);
                }
                .mode-picker-card:active .fc-start-pill {
                    transform: scale(0.92);
                }

                .flashcard-container { 
                    perspective: 1200px; 
                    width: 100%; 
                    height: 280px; 
                    margin-bottom: 20px; 
                }
                .flashcard-inner { 
                    position: relative; 
                    width: 100%; 
                    height: 100%; 
                    text-align: center; 
                    transition: transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1); 
                    transform-style: preserve-3d; 
                    cursor: pointer; 
                }
                .flashcard-inner.is-flipped { 
                    transform: rotateY(180deg); 
                }
                .flashcard-face { 
                    position: absolute; 
                    width: 100%; 
                    height: 100%; 
                    backface-visibility: hidden; 
                    border-radius: 18px; 
                    box-shadow: 0 8px 25px rgba(200, 150, 160, 0.2); 
                    border: 2px solid #f5cde2; 
                    display: flex; 
                    flex-direction: column; 
                    justify-content: center; 
                    align-items: center; 
                    padding: 20px; 
                    box-sizing: border-box; 
                    overflow-y: auto; 
                }
                .flashcard-back { 
                    transform: rotateY(180deg); 
                    align-items: flex-start;
                    justify-content: flex-start;
                    text-align: left;
                }

                /* Flashcard Ponyo Speak Button Tactile Feedback */
                .fc-speak-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 0;
                    outline: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    user-select: none;
                    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.2s ease;
                }
                .fc-speak-btn:hover {
                    transform: translateY(-2px) scale(1.12);
                }
                .fc-speak-btn:hover img {
                    filter: drop-shadow(1px 4px 6px rgba(150, 180, 200, 0.55));
                }
                .fc-speak-btn:active {
                    transform: translateY(2px) scale(0.9, 0.85);
                }

                .fc-btn {
                    flex: 1;
                    padding: 12px;
                    border-radius: 14px;
                    border: 1.5px solid rgba(255, 255, 255, 0.85);
                    font-weight: 800;
                    font-size: 13.5px;
                    letter-spacing: 0.3px;
                    cursor: pointer;
                    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease, opacity 0.2s;
                    color: #5c4a4d;
                    background-size: cover;
                    background-position: center;
                    background-repeat: no-repeat;
                    text-shadow: 0 1px 2px rgba(255, 255, 255, 0.9);
                    box-shadow: 0 4px 10px rgba(180, 140, 150, 0.25);
                }
                .fc-btn:hover {
                    transform: translateY(-1.5px) scale(1.02);
                    box-shadow: 0 6px 14px rgba(180, 140, 150, 0.35);
                }
                .fc-btn:active {
                    transform: scale(0.92) translateY(2px);
                    box-shadow: 0 2px 4px rgba(180, 140, 150, 0.2);
                }
                .fc-btn-learn {
                    background-image: linear-gradient(rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.45)), url('https://raw.githubusercontent.com/Yenwen6281/mandarin-subtitles/332fb8d639e5fc8f7fffc7bb2e1993fa67727681/f1.jpeg');
                }
                .fc-btn-gotit {
                    background-image: linear-gradient(rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.45)), url('https://raw.githubusercontent.com/Yenwen6281/mandarin-subtitles/332fb8d639e5fc8f7fffc7bb2e1993fa67727681/f2.jpg');
                }
                #fc-clear-deck-btn {
                    background: linear-gradient(180deg, #ffffff 0%, #fae6ed 100%);
                    color: #b89c9e;
                    border: 1px solid rgba(255, 255, 255, 0.9);
                    border-radius: 14px;
                    padding: 7px 16px;
                    font-weight: 700;
                    font-size: 11.5px;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    box-shadow: 0 3px 6px rgba(224, 139, 155, 0.18), inset 0 1px 1px rgba(255, 255, 255, 0.95);
                    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease, background 0.2s ease, color 0.2s ease;
                    user-select: none;
                }
                #fc-clear-deck-btn:hover {
                    color: #e08b9b;
                    transform: translateY(-1.5px) scale(1.05);
                    box-shadow: 0 5px 12px rgba(224, 139, 155, 0.28);
                }
                #fc-clear-deck-btn:active {
                    transform: translateY(2px) scale(0.90, 0.86);
                    box-shadow: 0 1px 2px rgba(224, 139, 155, 0.2), inset 0 2px 4px rgba(180, 110, 125, 0.25);
                }

                #fc-restart-btn {
                    background: linear-gradient(180deg, #f09cb0 0%, #e08b9b 100%);
                    color: white;
                    border: 1px solid rgba(255, 255, 255, 0.65);
                    border-radius: 12px;
                    padding: 8px 14px;
                    font-weight: 800;
                    font-size: 12.5px;
                    cursor: pointer;
                    user-select: none;
                    outline: none;
                    box-shadow: 0 4px 0 #c46b7d, 0 6px 10px rgba(224, 139, 155, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.7);
                    transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease;
                }
                #fc-restart-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 0 #c46b7d, 0 8px 14px rgba(224, 139, 155, 0.42), inset 0 1px 1px rgba(255, 255, 255, 0.9);
                }
                #fc-restart-btn:active {
                    transform: translateY(3px);
                    box-shadow: 0 1px 0 #c46b7d, 0 2px 4px rgba(224, 139, 155, 0.25), inset 0 2px 4px rgba(150, 60, 75, 0.3);
                }

                #fc-exit-btn {
                    background: linear-gradient(180deg, #ffffff 0%, #faeef3 100%);
                    color: #7b6267;
                    border: 1px solid #f0c5d6;
                    border-radius: 12px;
                    padding: 7px 14px;
                    font-weight: 700;
                    font-size: 12px;
                    cursor: pointer;
                    user-select: none;
                    outline: none;
                    box-shadow: 0 3.5px 0 #d8b2c2, 0 5px 8px rgba(200, 160, 175, 0.2), inset 0 1px 1px #ffffff;
                    transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease, color 0.15s ease;
                }
                #fc-exit-btn:hover {
                    color: #e08b9b;
                    transform: translateY(-2px);
                    box-shadow: 0 5.5px 0 #d8b2c2, 0 7px 12px rgba(200, 160, 175, 0.28), inset 0 1px 1px #ffffff;
                }
                #fc-exit-btn:active {
                    transform: translateY(2.5px);
                    box-shadow: 0 1px 0 #d8b2c2, 0 2px 4px rgba(200, 160, 175, 0.2), inset 0 2px 3px rgba(180, 130, 145, 0.25);
                }
            </style>

            <div style="display: flex; flex-direction: column; height: 100%; box-sizing: border-box; padding: 25px; color: #5c4a4d;">
                <!-- HEADER AREA -->
                <div style="position: relative; flex-shrink: 0; text-align: center; padding-bottom: 15px; border-bottom: 2px dashed rgba(245, 205, 226, 0.8); margin-bottom: 15px; background: rgba(252, 248, 245, 0.6); backdrop-filter: blur(4px); border-radius: 12px; padding-top: 10px;">
                    <div id="mandarin-platform-text">
                        ${getPlatformText()}
                    </div>

                    <div id="mandarin-menu-btn" title="Tools & Settings">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 6H20M4 12H20M4 18H20" stroke="#8ba6b6" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>

                    <h2 id="sidebar-main-title" style="margin: 0; color: #e08b9b; font-size: 22px; letter-spacing: 1px; text-shadow: 1px 1px 2px white;">Eggy's Mandarin</h2>
                    <p id="sidebar-sub-title" style="margin: 6px 0 0; font-size: 13px; color: #a38c90; font-weight: 500;">from Bean :)</p>
                    
                    <button id="back-to-subs-btn">
                        ⬅ Back to Subtitles
                    </button>

                    <!-- DROPDOWN MENU -->
                    <div id="mandarin-tools-menu" style="display: none; position: absolute; top: 52px; right: 8px; background: rgba(255, 255, 255, 0.96); border: 2px solid #f5cde2; border-radius: 14px; box-shadow: 0 6px 20px rgba(139, 166, 182, 0.25); width: 185px; text-align: left; padding: 10px; z-index: 100; animation: menuPop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);">
                        <div class="menu-item" id="menu-opt-saved">
                            <span>Saved Words</span>
                            <img class="menu-item-icon" src="${MENU_ICON_A1_URL}" alt="Saved Words Icon" />
                        </div>
                        <div class="menu-item" id="menu-opt-replies">
                            <span>Bean's Notes</span>
                            <img class="menu-item-icon" src="${MENU_ICON_A2_URL}" alt="Bean's Notes Icon" />
                        </div>
                        <div class="menu-item" id="menu-opt-flash">
                            <span>Flashcards</span>
                            <img class="menu-item-icon" src="${MENU_ICON_A3_URL}" alt="Flashcards Icon" />
                        </div>
                    </div>
                </div>

                <!-- SUBTITLE FEED AREA (Default) -->
                <div id="transcript-scroll-area" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; padding-right: 4px; padding-bottom: 20px;">
                    <div id="transcript-feed" style="display: flex; flex-direction: column; gap: 15px;">
                        <div id="waiting-msg" style="text-align: center; color: #a38c90; font-size: 14px; font-style: italic; margin-top: 20px; text-shadow: 1px 1px 2px white;">
                            Well... I'm just waiting for the next line 🤓👆
                        </div>
                    </div>
                </div>

                <!-- SAVED VOCABULARY AREA -->
                <div id="saved-vocab-area" style="display: none; flex: 1; overflow-y: auto; flex-direction: column; padding-right: 4px; padding-bottom: 20px;">
                    <div class="vocab-controls" id="vocab-controls-container">
                        <input type="text" id="vocab-search-input" class="vocab-search-bar" placeholder="🔍 Search word, pinyin, or meaning...">
                        <div class="vocab-select-row">
                            <select id="vocab-filter-select" class="vocab-control-select" title="Filter vocabulary list">
                                <option value="all">All Words</option>
                                <option value="deck">In Flashcard</option>
                                <option value="notes">Has Note</option>
                                <option value="asked">Sent to Bean</option>
                            </select>
                            <select id="vocab-sort-select" class="vocab-control-select" title="Sort vocabulary list">
                                <option value="time_desc">Newest First</option>
                                <option value="time_asc">Oldest First</option>
                                <option value="pinyin_asc">Pinyin: A-Z</option>
                                <option value="pinyin_desc">Pinyin: Z-A</option>
                                <option value="hsk_asc">HSK: 1 ➔ 6</option>
                                <option value="hsk_desc">HSK: 6 ➔ 1</option>
                            </select>
                        </div>
                    </div>
                    <div id="saved-vocab-list" style="display: flex; flex-direction: column;"></div>
                </div>

                <!-- BEAN'S EXPLANATIONS AREA -->
                <div id="bean-replies-area" style="display: none; flex: 1; overflow-y: auto; flex-direction: column; padding-right: 4px; padding-bottom: 20px;"></div>

                <!-- FLASHCARDS AREA -->
                <div id="flash-card-area" style="display: none; flex: 1; overflow-y: auto; flex-direction: column; padding-right: 4px; padding-bottom: 20px;"></div>
            </div>
        `;
        
        document.body.appendChild(sidebarHost);
        compressVideoPlayer();

        const menuBtn = shadowRoot.getElementById('mandarin-menu-btn');
        const toolsMenu = shadowRoot.getElementById('mandarin-tools-menu');
        const savedOpt = shadowRoot.getElementById('menu-opt-saved');
        const repliesOpt = shadowRoot.getElementById('menu-opt-replies');
        const flashOpt = shadowRoot.getElementById('menu-opt-flash');
        
        const scrollArea = shadowRoot.getElementById('transcript-scroll-area');
        const vocabArea = shadowRoot.getElementById('saved-vocab-area');
        const repliesArea = shadowRoot.getElementById('bean-replies-area');
        const flashArea = shadowRoot.getElementById('flash-card-area');
        const backBtn = shadowRoot.getElementById('back-to-subs-btn');
        
        const vocabSearch = shadowRoot.getElementById('vocab-search-input');
        const vocabSort = shadowRoot.getElementById('vocab-sort-select');
        const vocabFilter = shadowRoot.getElementById('vocab-filter-select');

        if (vocabSearch && vocabSort && vocabFilter) {
            ['keydown', 'keyup', 'keypress'].forEach(evt => {
                vocabSearch.addEventListener(evt, (e) => e.stopPropagation(), { capture: true });
            });
            vocabSearch.addEventListener('input', () => renderSavedVocab(shadowRoot));
            vocabSort.addEventListener('change', () => renderSavedVocab(shadowRoot));
            vocabFilter.addEventListener('change', () => renderSavedVocab(shadowRoot));
        }

        function hideAllPopups() {
            const popup = document.getElementById('mandarin-vocab-popup');
            if (popup) popup.style.display = 'none';
            currentPopupWord = null;
            closeReportModal();
        }

        if (menuBtn && toolsMenu) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const willOpen = toolsMenu.style.display === 'none';
                toolsMenu.style.display = willOpen ? 'block' : 'none';
                if (willOpen) hideAllPopups();
            });
            
            toolsMenu.addEventListener('click', (e) => e.stopPropagation());
            
            shadowRoot.addEventListener('click', () => {
                if (toolsMenu.style.display === 'block') {
                    toolsMenu.style.display = 'none';
                }
            });
        }

        savedOpt.addEventListener('click', () => {
            hideAllPopups();
            toolsMenu.style.display = 'none';
            scrollArea.style.display = 'none';
            repliesArea.style.display = 'none';
            flashArea.style.display = 'none';
            vocabArea.style.display = 'flex';
            backBtn.style.display = 'inline-block';
            fetchBeanReplies(() => renderSavedVocab(shadowRoot));
            renderSavedVocab(shadowRoot);
        });

        repliesOpt.addEventListener('click', () => {
            hideAllPopups();
            toolsMenu.style.display = 'none';
            scrollArea.style.display = 'none';
            vocabArea.style.display = 'none';
            flashArea.style.display = 'none';
            repliesArea.style.display = 'flex';
            backBtn.style.display = 'inline-block';
            fetchBeanReplies(() => renderBeanReplies(shadowRoot));
            renderBeanReplies(shadowRoot);
        });

        flashOpt.addEventListener('click', () => {
            hideAllPopups();
            toolsMenu.style.display = 'none';
            scrollArea.style.display = 'none';
            vocabArea.style.display = 'none';
            repliesArea.style.display = 'none';
            flashArea.style.display = 'flex';
            backBtn.style.display = 'inline-block';
            
            renderFlashcardSetup(shadowRoot);
            fetchBeanReplies();
        });

        backBtn.addEventListener('click', () => {
            hideAllPopups();
            vocabArea.style.display = 'none';
            repliesArea.style.display = 'none';
            flashArea.style.display = 'none';
            backBtn.style.display = 'none';
            scrollArea.style.display = 'flex';
            scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: 'smooth' });
        });
    }

    // --- FUNCTION TO JUMP DIRECTLY TO BEAN'S NOTE ---
    function jumpToBeanReply(shadowRoot, targetHanzi) {
        const popup = document.getElementById('mandarin-vocab-popup');
        if (popup) popup.style.display = 'none';
        currentPopupWord = null;
        closeReportModal();

        const scrollArea = shadowRoot.getElementById('transcript-scroll-area');
        const vocabArea = shadowRoot.getElementById('saved-vocab-area');
        const repliesArea = shadowRoot.getElementById('bean-replies-area');
        const flashArea = shadowRoot.getElementById('flash-card-area');
        const backBtn = shadowRoot.getElementById('back-to-subs-btn');
        const toolsMenu = shadowRoot.getElementById('mandarin-tools-menu');

        if (toolsMenu) toolsMenu.style.display = 'none';
        if (scrollArea) scrollArea.style.display = 'none';
        if (vocabArea) vocabArea.style.display = 'none';
        if (flashArea) flashArea.style.display = 'none';
        if (repliesArea) repliesArea.style.display = 'flex';
        if (backBtn) backBtn.style.display = 'inline-block';

        renderBeanReplies(shadowRoot);

        setTimeout(() => {
            repliesArea.querySelectorAll('.card-highlight-persistent').forEach(el => {
                el.classList.remove('card-highlight-persistent');
            });

            const targetCard = repliesArea.querySelector(`[data-reply-hanzi="${targetHanzi}"]`);
            if (targetCard) {
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetCard.classList.remove('jelly-shake-once');
                void targetCard.offsetWidth;
                targetCard.classList.add('jelly-shake-once');
                targetCard.classList.add('card-highlight-persistent');
            }
        }, 80);
    }

    // --- FUNCTION TO JUMP BACK TO SAVED VOCAB CARD ---
    function jumpBackToSavedWord(shadowRoot, targetHanzi) {
        const scrollArea = shadowRoot.getElementById('transcript-scroll-area');
        const vocabArea = shadowRoot.getElementById('saved-vocab-area');
        const repliesArea = shadowRoot.getElementById('bean-replies-area');
        const flashArea = shadowRoot.getElementById('flash-card-area');
        const backBtn = shadowRoot.getElementById('back-to-subs-btn');
        const toolsMenu = shadowRoot.getElementById('mandarin-tools-menu');
        const searchInput = shadowRoot.getElementById('vocab-search-input');

        if (searchInput) searchInput.value = '';

        if (toolsMenu) toolsMenu.style.display = 'none';
        if (scrollArea) scrollArea.style.display = 'none';
        if (repliesArea) repliesArea.style.display = 'none';
        if (flashArea) flashArea.style.display = 'none';
        if (vocabArea) vocabArea.style.display = 'flex';
        if (backBtn) backBtn.style.display = 'inline-block';

        renderSavedVocab(shadowRoot);

        setTimeout(() => {
            vocabArea.querySelectorAll('.card-highlight-persistent').forEach(el => {
                el.classList.remove('card-highlight-persistent');
            });

            const targetCard = vocabArea.querySelector(`[data-vocab-hanzi="${targetHanzi}"]`);
            if (targetCard) {
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 80);
    }

    // --- RENDER SAVED VOCAB (WITH SEARCH, FILTER, AND SORT) ---
    function renderSavedVocab(shadowRoot) {
        const listContainer = shadowRoot.getElementById('saved-vocab-list');
        const controlsContainer = shadowRoot.getElementById('vocab-controls-container');
        const searchInput = shadowRoot.getElementById('vocab-search-input');
        const sortSelect = shadowRoot.getElementById('vocab-sort-select');
        const filterSelect = shadowRoot.getElementById('vocab-filter-select');
        const ponyoImgUrl = "https://raw.githubusercontent.com/Yenwen6281/mandarin-subtitles/2d078edf50412736a35f4427cde45c533d310fa3/ponyo-removebg-preview.png";

        let currentData = getSavedVocab().slice();

        if (currentData.length === 0) {
            controlsContainer.style.display = 'none';
            listContainer.innerHTML = `<div style="text-align: center; color: #a38c90; margin-top: 30px; font-style: italic;">No saved words yet! Click the heart or note icon to save words. 🌸</div>`;
            return;
        }

        controlsContainer.style.display = 'flex';
        listContainer.innerHTML = '';

        const filterVal = filterSelect ? filterSelect.value : 'all';
        if (filterVal === 'deck') {
            currentData = currentData.filter(v => !!v.inDeck);
        } else if (filterVal === 'notes') {
            currentData = currentData.filter(v => (v.note || '').trim().length > 0);
        } else if (filterVal === 'asked') {
            const askedList = getAskedWords();
            currentData = currentData.filter(v => askedList.includes(v.hanzi) || getAllBeanRepliesFor(v.hanzi).length > 0);
        }

        const rawQuery = (searchInput.value || '').toLowerCase().trim();
        const cleanQuery = stripPinyinTones(rawQuery);

        if (rawQuery) {
            currentData = currentData.filter(vocab => {
                const matchHanzi = (vocab.hanzi || '').includes(rawQuery);
                const matchDef = (vocab.translations || []).some(t => t.toLowerCase().includes(rawQuery));
                const rawPinyin = (vocab.pinyin || '').toLowerCase();
                const cleanPinyin = stripPinyinTones(vocab.pinyin || '');
                const matchPinyin = rawPinyin.includes(rawQuery) || (cleanQuery && cleanPinyin.includes(cleanQuery));
                return matchHanzi || matchDef || matchPinyin;
            });
        }

        const sortMethod = sortSelect.value;
        if (sortMethod === 'time_desc') {
            currentData.reverse();
        } else if (sortMethod === 'pinyin_asc') {
            currentData.sort((a, b) => (a.pinyin || '').localeCompare(b.pinyin || ''));
        } else if (sortMethod === 'pinyin_desc') {
            currentData.sort((a, b) => (b.pinyin || '').localeCompare(a.pinyin || ''));
        } else if (sortMethod === 'hsk_asc') {
            currentData.sort((a, b) => (a.level || 99) - (b.level || 99));
        } else if (sortMethod === 'hsk_desc') {
            currentData.sort((a, b) => (b.level || 99) - (a.level || 99));
        }

        if (currentData.length === 0) {
            listContainer.innerHTML = `<div style="text-align: center; color: #a38c90; margin-top: 30px; font-style: italic;">No words match your selected filter or search. 🐣</div>`;
            return;
        }

        currentData.forEach(vocab => {
            const card = document.createElement('div');
            card.className = 'vocab-card';
            card.setAttribute('data-vocab-hanzi', vocab.hanzi);
            
            const defs = (vocab.translations || []).map(t => `<li style="margin-bottom: 3px;">${t}</li>`).join('');
            const currentNote = vocab.note || '';
            const hasNote = currentNote.trim().length > 0;
            const inDeck = !!vocab.inDeck;

            const allReplies = getAllBeanRepliesFor(vocab.hanzi);
            const reportStatus = getReportIconStatus(vocab.hanzi);
            let replyIdx = allReplies.length - 1;

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 2px;">
                        <span class="vocab-card-title">${vocab.hanzi}</span>
                        <button class="card-speak-btn" title="Listen">
                            <img src="${ponyoImgUrl}" style="width: 65px; height: auto; filter: drop-shadow(1px 2px 3px rgba(150, 180, 200, 0.4));" alt="Speak">
                        </button>
                    </div>
                    <span style="font-size: 11px; background: #f5cde2; color: #5c4a4d; padding: 4px 10px; border-radius: 12px; font-weight: bold; letter-spacing: 0.5px;">HSK ${vocab.level}</span>
                </div>
                
                <div class="vocab-card-pinyin">${vocab.pinyin}</div>
                
                <ul style="margin: 0; padding-left: 18px; font-size: 14px; color: #5c4a4d; line-height: 1.5;">
                    ${defs}
                </ul>

                ${allReplies.length > 0 ? `
                    <div class="bean-reply-box">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                            <div style="font-weight: bold; color: #2e5973; display: flex; align-items: center; gap: 4px;">
                                💬 Bean's Note:
                            </div>
                            <button class="bean-jump-btn card-jump-btn" title="Ask Woodstock to jump to Bean's explanation! 🐣">
                                <img src="${WOODSTOCK_IMG_URL}" alt="Woodstock Jump" />
                            </button>
                        </div>
                        <div class="card-reply-text" style="word-break: break-word;">${allReplies[replyIdx].reply}</div>
                        ${allReplies.length > 1 ? `
                            <div style="display: flex; justify-content: flex-end; align-items: center; gap: 6px; margin-top: 6px; border-top: 1px dashed #c9e4f5; padding-top: 4px;">
                                <button class="bean-nav-btn card-prev-reply">◀</button>
                                <span class="card-reply-counter" style="font-size: 11px; font-weight: bold; color: #6b8ea2;">${replyIdx + 1}/${allReplies.length}</span>
                                <button class="bean-nav-btn card-next-reply">▶</button>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                <div class="card-sticky-container sticky-note-box" style="display: ${hasNote ? 'block' : 'none'};">
                    <textarea class="sticky-note-input card-note-textarea" maxlength="50" rows="2" placeholder="Write up to 50 characters...">${currentNote}</textarea>
                    <div class="sticky-note-footer">
                        <span class="card-char-counter" style="font-size: 10.5px; color: #cf9664; font-weight: bold;">${currentNote.length}/50</span>
                        <button class="card-note-save-btn">Save & Close</button>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 10px; border-top: 1px dashed rgba(245, 205, 226, 0.6); gap: 10px;">
                    <button class="deck-toggle-btn ${inDeck ? 'in-deck' : ''}" title="Toggle Flashcard Deck">
                        <span>${inDeck ? '✓' : '+'}</span> Flashcard
                    </button>

                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div class="saved-icon-btn card-save-btn" title="Unsave Word" style="color: #e08b9b;">
                            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                        </div>
                        <div class="saved-icon-btn card-note-toggle-btn" title="Add / View Note" style="position: relative; color: ${hasNote ? '#e08b9b' : '#b89c9e'};">
                            <svg viewBox="0 0 24 24" width="17" height="17"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                            <div class="card-note-indicator" style="display: ${hasNote ? 'block' : 'none'}; position: absolute; top: 1px; right: 1px; width: 6px; height: 6px; background: #e08b9b; border: 1.5px solid white; border-radius: 50%;"></div>
                        </div>
                        <div class="saved-icon-btn card-report-btn" title="${reportStatus.title}" style="color: ${reportStatus.color};">
                            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
                        </div>
                    </div>
                </div>
            `;

            if (allReplies.length > 1) {
                const replyText = card.querySelector('.card-reply-text');
                const counter = card.querySelector('.card-reply-counter');
                const prevBtn = card.querySelector('.card-prev-reply');
                const nextBtn = card.querySelector('.card-next-reply');

                const updateCardSlide = () => {
                    replyText.textContent = allReplies[replyIdx].reply;
                    counter.textContent = `${replyIdx + 1}/${allReplies.length}`;
                };

                prevBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    replyIdx = (replyIdx - 1 + allReplies.length) % allReplies.length;
                    updateCardSlide();
                });

                nextBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    replyIdx = (replyIdx + 1) % allReplies.length;
                    updateCardSlide();
                });
            }

            const speakBtn = card.querySelector('.card-speak-btn');
            if (speakBtn) {
                speakBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); 
                    playTTS(vocab.hanzi);
                });
            }

            const jumpBtn = card.querySelector('.card-jump-btn');
            if (jumpBtn) {
                jumpBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    jumpToBeanReply(shadowRoot, vocab.hanzi);
                });
            }

            const noteBox = card.querySelector('.card-sticky-container');
            const noteBtn = card.querySelector('.card-note-toggle-btn');
            const noteTextarea = card.querySelector('.card-note-textarea');
            const charCounter = card.querySelector('.card-char-counter');
            const indicator = card.querySelector('.card-note-indicator');
            const saveCloseBtn = card.querySelector('.card-note-save-btn');
            const saveBtn = card.querySelector('.card-save-btn');
            const reportBtn = card.querySelector('.card-report-btn');
            const deckToggleBtn = card.querySelector('.deck-toggle-btn');

            ['keydown', 'keyup', 'keypress'].forEach(evt => {
                noteTextarea.addEventListener(evt, (e) => {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }, { capture: true });
            });

            noteBtn.addEventListener('click', () => {
                const isHidden = noteBox.style.display === 'none';
                noteBox.style.display = isHidden ? 'block' : 'none';
                if (isHidden) noteTextarea.focus();
            });

            noteTextarea.addEventListener('input', (e) => {
                const text = e.target.value;
                const hasText = text.trim().length > 0;
                charCounter.textContent = `${text.length}/50`;
                updateVocabNote(vocab, text);
                noteBtn.style.color = hasText ? '#e08b9b' : '#b89c9e';
                indicator.style.display = hasText ? 'block' : 'none';
            });

            saveCloseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                noteBox.style.display = 'none';
            });

            deckToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isNowInDeck = toggleVocabInDeck(vocab.hanzi);
                if (isNowInDeck) {
                    deckToggleBtn.classList.add('in-deck');
                    deckToggleBtn.innerHTML = '<span>✓</span> Flashcard';
                } else {
                    deckToggleBtn.classList.remove('in-deck');
                    deckToggleBtn.innerHTML = '<span>+</span> Flashcard';
                }
            });

            saveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                setTimeout(() => {
                    removeVocabFromStorage(vocab.hanzi);
                    renderSavedVocab(shadowRoot);
                }, 150);
            });

            reportBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleReportModal(vocab.hanzi, () => {
                    renderSavedVocab(shadowRoot);
                });
            });

            listContainer.appendChild(card);
        });
    }

    // --- RENDER BEAN'S EXPLANATIONS FEED ---
    function renderBeanReplies(shadowRoot) {
        const repliesArea = shadowRoot.getElementById('bean-replies-area');
        if (beanRepliesList.length === 0) {
            repliesArea.innerHTML = `<div style="text-align: center; color: #a38c90; margin-top: 30px; font-style: italic;">No explanations from Bean yet! Ask about any word anytime. 💌</div>`;
            return;
        }

        repliesArea.innerHTML = '';

        const groupedMap = new Map();
        beanRepliesList.forEach(item => {
            if (!item.hanzi || !item.reply) return;
            if (!groupedMap.has(item.hanzi)) {
                groupedMap.set(item.hanzi, []);
            }
            groupedMap.get(item.hanzi).push(item);
        });

        const uniqueWords = Array.from(groupedMap.keys()).reverse();

        uniqueWords.forEach(hanzi => {
            const replies = groupedMap.get(hanzi);
            let currentIdx = replies.length - 1;

            const card = document.createElement('div');
            card.className = 'vocab-card';
            card.setAttribute('data-reply-hanzi', hanzi);

            const renderCardContent = () => {
                const item = replies[currentIdx];
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span class="vocab-card-title">${hanzi}</span>
                        <div class="jump-back-btn" title="Jump back to Saved Word">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="9 14 4 9 9 4"></polyline>
                                <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
                            </svg>
                            <span>Back</span>
                        </div>
                    </div>
                    <div class="tab-user-query" style="font-size: 12.5px; color: #d09b9f; margin-bottom: 8px; min-height: 16px;">
                        ${item.user_query ? `<b>Question:</b> ${item.user_query}` : ''}
                    </div>
                    <div class="bean-reply-box" style="margin-top: 6px;">
                        <div style="font-weight: bold; color: #2e5973; margin-bottom: 2px;">💬 Bean's Note:</div>
                        <div class="tab-reply-body" style="word-break: break-word;">${item.reply}</div>
                        ${replies.length > 1 ? `
                            <div style="display: flex; justify-content: flex-end; align-items: center; gap: 6px; margin-top: 6px; border-top: 1px dashed #c9e4f5; padding-top: 4px;">
                                <button class="bean-nav-btn tab-prev-reply">◀</button>
                                <span class="tab-reply-counter" style="font-size: 11px; font-weight: bold; color: #6b8ea2;">${currentIdx + 1}/${replies.length}</span>
                                <button class="bean-nav-btn tab-next-reply">▶</button>
                            </div>
                        ` : ''}
                    </div>
                `;

                const jumpBackBtn = card.querySelector('.jump-back-btn');
                if (jumpBackBtn) {
                    jumpBackBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        jumpBackToSavedWord(shadowRoot, hanzi);
                    });
                }

                if (replies.length > 1) {
                    const prevBtn = card.querySelector('.tab-prev-reply');
                    const nextBtn = card.querySelector('.tab-next-reply');

                    prevBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        currentIdx = (currentIdx - 1 + replies.length) % replies.length;
                        renderCardContent();
                    });

                    nextBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        currentIdx = (currentIdx + 1) % replies.length;
                        renderCardContent();
                    });
                }
            };

            renderCardContent();
            repliesArea.appendChild(card);
        });
    }

    // --- RENDER FLASHCARD SETUP / MODES ---
    function renderFlashcardSetup(shadowRoot) {
        const flashArea = shadowRoot.getElementById('flash-card-area');
        const saved = getSavedVocab();
        const deckWords = saved.filter(v => v.inDeck);

        if (deckWords.length === 0) {
            flashArea.innerHTML = `
                <div style="text-align: center; margin-top: 30px;">
                    <img src="${EMPTY_DECK_IMG_URL}" alt="Empty Deck" style="width: 120px; height: auto; margin-bottom: 16px; filter: drop-shadow(0 4px 10px rgba(200, 150, 160, 0.28)); pointer-events: none;">
                    
                    <div style="color: #a38c90; font-style: italic; line-height: 1.6; font-size: 13.5px;">
                        Your study deck is empty!<br><br>
                        Go to <b>Saved Words</b> and tap<br>
                        <span style="display: inline-block; margin-top: 5px; padding: 3px 10px; border-radius: 14px; background: rgba(245, 205, 226, 0.4); color: #7b6267; font-weight: bold; font-style: normal; font-size: 11.5px;">+ Flashcard</span>
                    </div>
                </div>
                <button id="fc-go-saved-btn" style="margin: 24px auto 0; display: block; background: linear-gradient(180deg, #ffffff 0%, #fae6ed 100%); color: #e08b9b; border: 1px solid rgba(255, 255, 255, 0.9); border-radius: 20px; padding: 9px 24px; font-weight: 700; font-size: 13px; cursor: pointer; box-shadow: 0 3px 8px rgba(224, 139, 155, 0.22); transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);">
                    Visiting Saved Words 🌷
                </button>
            `;
            shadowRoot.getElementById('fc-go-saved-btn').addEventListener('click', () => {
                shadowRoot.getElementById('menu-opt-saved').click();
            });
            return;
        }

        flashArea.innerHTML = `
            <div style="text-align: center; margin-bottom: 18px;">
                <span style="font-size: 12.5px; font-weight: 700; color: #e08b9b; background: rgba(255, 240, 245, 0.9); border: 1px solid rgba(245, 205, 226, 0.7); padding: 4px 14px; border-radius: 14px; box-shadow: 0 2px 6px rgba(224, 139, 155, 0.12);">
                    ${deckWords.length} Words
                </span>
            </div>

            <div id="fc-mode-hanzi" class="mode-picker-card card-b1">
                <div style="font-size: 21px; font-weight: 800; color: #5c4a4d; letter-spacing: 0.6px; margin-bottom: 12px; text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);">
                    Hanzi First
                </div>
                <div>
                    <span class="fc-start-pill">Start ▶</span>
                </div>
            </div>

            <div id="fc-mode-english" class="mode-picker-card card-b2">
                <div style="font-size: 21px; font-weight: 800; color: #5c4a4d; letter-spacing: 0.6px; margin-bottom: 12px; text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);">
                    English First
                </div>
                <div>
                    <span class="fc-start-pill">Start ▶</span>
                </div>
            </div>
            
            <div style="display: flex; justify-content: center; margin-top: 20px;">
                <button id="fc-clear-deck-btn">
                    <span>Clear Deck</span> 🧹
                </button>
            </div>
        `;

        shadowRoot.getElementById('fc-mode-hanzi').addEventListener('click', (e) => {
            e.stopPropagation();
            startFlashcardSession(shadowRoot, deckWords, 'hanzi');
        });
        shadowRoot.getElementById('fc-mode-english').addEventListener('click', (e) => {
            e.stopPropagation();
            startFlashcardSession(shadowRoot, deckWords, 'english');
        });
        shadowRoot.getElementById('fc-clear-deck-btn').addEventListener('click', () => {
            clearFlashcardDeck();
            renderFlashcardSetup(shadowRoot);
        });
    }

    // --- START FLASHCARD SESSION ---
    function startFlashcardSession(shadowRoot, words, mode) {
        currentSessionDeck = [...words];
        flashcardQueue = [...words].sort(() => Math.random() - 0.5);
        currentFlashcardMode = mode;
        flashcardSessionCardCount = 0;
        renderCurrentFlashcard(shadowRoot);
    }

    // --- RENDER CURRENT FLASHCARD IN SESSION ---
    function renderCurrentFlashcard(shadowRoot) {
        const flashArea = shadowRoot.getElementById('flash-card-area');

        if (flashcardQueue.length === 0) {
            flashArea.innerHTML = `
                <div style="text-align: center; color: #a38c90; margin-top: 28px;">
                    <img src="${COMPLETE_DECK_IMG_URL}" alt="Deck Complete" style="width: 54px; height: auto; border-radius: 8px; margin-bottom: 8px; filter: drop-shadow(0 2px 5px rgba(200, 150, 160, 0.25)); pointer-events: none;">
                    <h3 style="color: #e08b9b; margin: 0 0 4px 0; font-size: 16px; font-weight: 700; letter-spacing: 0.3px;">Deck Complete!</h3>
                    <div style="font-size: 12.5px; color: #7b6267; font-weight: 600;">Well done bub!</div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px; margin: 20px auto 0; max-width: 200px; width: 100%;">
                    <button id="fc-restart-btn">
                        Practice Again :)
                    </button>
                    <button id="fc-exit-btn">
                        Exit
                    </button>
                </div>
            `;

            shadowRoot.getElementById('fc-restart-btn').addEventListener('click', () => {
                startFlashcardSession(shadowRoot, currentSessionDeck, currentFlashcardMode);
            });

            shadowRoot.getElementById('fc-exit-btn').addEventListener('click', () => {
                renderFlashcardSetup(shadowRoot);
            });

            return;
        }

        const vocab = flashcardQueue[0];
        const activeBgSet = currentFlashcardMode === 'english' ? FLASHCARD_BG_IMAGES_ENGLISH : FLASHCARD_BG_IMAGES_HANZI;
        const bgImg = activeBgSet[flashcardSessionCardCount % activeBgSet.length];
        const bgPosition = bgImg.includes('d5.png') ? 'left center' : 'center center';
        const faceBgStyle = `background: linear-gradient(rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.78)), url('${bgImg}'); background-size: cover; background-position: ${bgPosition}; background-repeat: no-repeat;`;

        const allReplies = getAllBeanRepliesFor(vocab.hanzi);
        let fcReplyIdx = allReplies.length - 1;
        const ponyoImgUrl = "https://raw.githubusercontent.com/Yenwen6281/mandarin-subtitles/2d078edf50412736a35f4427cde45c533d310fa3/ponyo-removebg-preview.png";

        let frontHtml = '';
        if (currentFlashcardMode === 'hanzi') {
            frontHtml = `
                <div style="position: absolute; top: 15px; right: 15px; font-size: 10px; font-weight: bold; background: #f5cde2; color: #5c4a4d; padding: 3px 8px; border-radius: 8px;">HSK ${vocab.level}</div>
                <button class="fc-speak-btn" style="position: absolute; top: 10px; left: 10px;" title="Listen">
                    <img src="${ponyoImgUrl}" style="width: 50px; height: auto; filter: drop-shadow(1px 2px 3px rgba(150, 180, 200, 0.4)); pointer-events: none;" alt="Listen">
                </button>
                <div style="font-size: 42px; font-weight: bold; color: #e08b9b; margin-top: 10px;">${vocab.hanzi}</div>
                <div style="position: absolute; bottom: 20px; font-size: 12px; color: #b89c9e; font-style: italic;">(Tap to flip)</div>
            `;
        } else {
            const defs = (vocab.translations || []).map(t => `<li style="margin-bottom: 4px;">${t}</li>`).join('');
            frontHtml = `
                <div style="position: absolute; top: 15px; right: 15px; font-size: 10px; font-weight: bold; background: #f5cde2; color: #5c4a4d; padding: 3px 8px; border-radius: 8px;">HSK ${vocab.level}</div>
                <ul style="margin: 0; padding-left: 20px; font-size: 15px; color: #5c4a4d; font-weight: 600; text-align: left; width: 100%;">
                    ${defs}
                </ul>
                <div style="position: absolute; bottom: 20px; font-size: 12px; color: #b89c9e; font-style: italic;">(Tap to flip)</div>
            `;
        }

        const defsBack = (vocab.translations || []).map(t => `<li style="margin-bottom: 2px;">${t}</li>`).join('');
        const backHtml = `
            <div style="width: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px;">
                    <div>
                        <div style="font-size: 28px; font-weight: bold; color: #e08b9b;">${vocab.hanzi}</div>
                        <div style="font-size: 14px; color: #d09b9f; font-style: italic;">${vocab.pinyin}</div>
                    </div>
                    <button class="fc-speak-btn" style="margin-top: 4px;" title="Listen">
                        <img src="${ponyoImgUrl}" style="width: 50px; height: auto; filter: drop-shadow(1px 2px 3px rgba(150, 180, 200, 0.4)); pointer-events: none;" alt="Listen">
                    </button>
                </div>
                <ul style="margin: 0 0 10px 0; padding-left: 18px; font-size: 13px; color: #5c4a4d;">
                    ${defsBack}
                </ul>
                ${vocab.note ? `
                    <div style="background: #fff9e6; border: 1px solid #fbe7b2; border-radius: 6px; padding: 6px; font-size: 11px; color: #cf9664; margin-bottom: 8px;">
                        📌 ${vocab.note}
                    </div>
                ` : ''}
                ${allReplies.length > 0 ? `
                    <div class="bean-reply-box" style="margin-top: 8px; background: #eef7fc; border: 1.5px solid #c9e4f5; border-radius: 8px; padding: 6px 8px; font-size: 11px; color: #406277;">
                        <div style="font-weight: bold; color: #2e5973; margin-bottom: 2px;">💬 Bean's Note:</div>
                        <div id="fc-reply-text" style="word-break: break-word; line-height: 1.35;">${allReplies[fcReplyIdx].reply}</div>
                        ${allReplies.length > 1 ? `
                            <div style="display: flex; justify-content: flex-end; align-items: center; gap: 6px; margin-top: 5px; border-top: 1px dashed #c9e4f5; padding-top: 3px;">
                                <button id="fc-prev-reply" class="bean-nav-btn" style="padding: 1px 5px; font-size: 9px;">◀</button>
                                <span id="fc-reply-counter" style="font-size: 10px; font-weight: bold; color: #6b8ea2;">${fcReplyIdx + 1}/${allReplies.length}</span>
                                <button id="fc-next-reply" class="bean-nav-btn" style="padding: 1px 5px; font-size: 9px;">▶</button>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `;

        flashArea.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <div style="font-size: 12px; font-weight: bold; color: #a38c90; background: rgba(245, 205, 226, 0.3); padding: 4px 10px; border-radius: 10px;">
                    Cards Left: ${flashcardQueue.length}
                </div>
                <div id="fc-exit-link" style="font-size: 12px; font-weight: bold; color: #8ba6b6; cursor: pointer; border-bottom: 1px dashed #8ba6b6;">Exit Deck</div>
            </div>

            <div class="flashcard-container" id="current-flashcard">
                <div class="flashcard-inner" id="flashcard-inner">
                    <div class="flashcard-face" style="${faceBgStyle}">${frontHtml}</div>
                    <div class="flashcard-face flashcard-back" style="${faceBgStyle}">${backHtml}</div>
                </div>
            </div>

            <div id="fc-actions" style="display: flex; gap: 10px; opacity: 0.5; pointer-events: none; transition: opacity 0.3s;">
                <button id="fc-btn-learn" class="fc-btn fc-btn-learn">Still Learning</button>
                <button id="fc-btn-gotit" class="fc-btn fc-btn-gotit">Got It !</button>
            </div>
        `;

        shadowRoot.getElementById('fc-exit-link').addEventListener('click', (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
            renderFlashcardSetup(shadowRoot);
        });

        const flashcardContainer = shadowRoot.getElementById('current-flashcard');
        const flashcardInner = shadowRoot.getElementById('flashcard-inner');
        const actionsDiv = shadowRoot.getElementById('fc-actions');

        let isFlipped = false;

        flashcardContainer.addEventListener('click', (e) => {
            if (
                e.target.closest('.fc-speak-btn') || 
                e.target.closest('.bean-nav-btn') || 
                e.target.closest('#fc-exit-link') || 
                e.target.closest('#fc-actions')
            ) {
                return;
            }

            if (!isFlipped) {
                isFlipped = true;
                flashcardInner.classList.add('is-flipped');
                actionsDiv.style.opacity = '1';
                actionsDiv.style.pointerEvents = 'auto';

                if (currentFlashcardMode === 'english') {
                    playTTS(vocab.hanzi);
                }
            }
        });

        const speakBtns = shadowRoot.querySelectorAll('.fc-speak-btn');
        speakBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                playTTS(vocab.hanzi);
            });
        });

        if (allReplies.length > 1) {
            const replyText = shadowRoot.getElementById('fc-reply-text');
            const counter = shadowRoot.getElementById('fc-reply-counter');
            const prevBtn = shadowRoot.getElementById('fc-prev-reply');
            const nextBtn = shadowRoot.getElementById('fc-next-reply');

            const updateFcSlide = () => {
                replyText.textContent = allReplies[fcReplyIdx].reply;
                counter.textContent = `${fcReplyIdx + 1}/${allReplies.length}`;
            };

            if (prevBtn) {
                prevBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); 
                    fcReplyIdx = (fcReplyIdx - 1 + allReplies.length) % allReplies.length;
                    updateFcSlide();
                });
            }

            if (nextBtn) {
                nextBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); 
                    fcReplyIdx = (fcReplyIdx + 1) % allReplies.length;
                    updateFcSlide();
                });
            }
        }

        shadowRoot.getElementById('fc-btn-learn').addEventListener('click', () => {
            const card = flashcardQueue.shift();
            flashcardQueue.push(card);
            flashcardSessionCardCount++;
            renderCurrentFlashcard(shadowRoot);
        });

        shadowRoot.getElementById('fc-btn-gotit').addEventListener('click', () => {
            flashcardQueue.shift();
            flashcardSessionCardCount++;
            renderCurrentFlashcard(shadowRoot);
        });
    }

    function playTTS(text) {
        try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'zh-CN'; 
            utterance.rate = 0.85; 
            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.warn("TTS error:", e);
        }
    }

    function removeSidebarUI() {
        const sidebarHost = document.getElementById('mandarin-sidebar-host');
        if (sidebarHost) {
            sidebarHost.remove();
            expandVideoPlayer();
        }
        popupModal.style.display = 'none';
        currentPopupWord = null;
        closeReportModal();
    }

    function compressVideoPlayer() {
        const selectors = [
            '.watch-video--player-view',
            '#netflix-player',
            '.nfp-container',
            '#movie_player',
            '.html5-video-player'
        ];
        for (let sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
                el.style.width = 'calc(100% - 350px)';
                break;
            }
        }
    }

    function expandVideoPlayer() {
        const selectors = [
            '.watch-video--player-view',
            '#netflix-player',
            '.nfp-container',
            '#movie_player',
            '.html5-video-player'
        ];
        for (let sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
                el.style.width = '100%';
            }
        }
    }

    function parseTextWithVocab(text) {
        if (sortedVocabWords.length === 0) return text;
        let resultHTML = "";
        let i = 0;
        while (i < text.length) {
            let matchedWord = null;
            for (let word of sortedVocabWords) {
                if (text.startsWith(word, i)) {
                    matchedWord = word;
                    break;
                }
            }

            if (matchedWord) {
                const vocabData = vocabMap.get(matchedWord);
                const encodedData = encodeURIComponent(JSON.stringify(vocabData));
                resultHTML += `<span class="hsk-vocab-token" data-vocab="${encodedData}" title="Click for definition">${matchedWord}</span>`;
                i += matchedWord.length;
            } else {
                resultHTML += text[i];
                i++;
            }
        }
        return resultHTML;
    }

    let lastSubtitle = "";
    let observerInterval = null;

    function startObservingVideo() {
        if (observerInterval) clearInterval(observerInterval);

        observerInterval = setInterval(() => {
            const videoEl = document.querySelector('video');
            if (videoEl && !videoEl.dataset.seekListenerAdded) {
                videoEl.dataset.seekListenerAdded = 'true';
                videoEl.addEventListener('seeking', () => {
                    lastSubtitle = "";
                    const sidebarHost = document.getElementById('mandarin-sidebar-host');
                    if (sidebarHost && sidebarHost.shadowRoot) {
                        const feed = sidebarHost.shadowRoot.getElementById('transcript-feed');
                        if (feed) {
                            feed.innerHTML = `<div id="waiting-msg" style="text-align: center; color: #a38c90; font-size: 14px; font-style: italic; margin-top: 20px; text-shadow: 1px 1px 2px white;">Well... I'm just waiting for the next line 🤓👆</div>`;
                        }
                    }
                    popupModal.style.display = 'none';
                    currentPopupWord = null;
                    closeReportModal();
                });
            }

            const containerSelectors = [
                '.player-timedtext', '.timedtext-container', '[class*="timedtext"]',
                '.ytp-caption-window-container', '[class*="caption-window"]'
            ];

            let currentText = "";
            const chineseRegex = /[\u4e00-\u9fa5]/;

            for (let selector of containerSelectors) {
                const containers = document.querySelectorAll(selector);
                for (let container of containers) {
                    const text = (container.innerText || container.textContent || "").trim();
                    if (text && chineseRegex.test(text)) {
                        const cleanedText = text.split('\n')
                            .map(line => line.trim())
                            .filter(line => line.length > 0 && chineseRegex.test(line))
                            .join('\n');
                        if (cleanedText) {
                            currentText = cleanedText;
                            break;
                        }
                    }
                }
                if (currentText) break;
            }

            if (currentText && currentText !== lastSubtitle) {
                lastSubtitle = currentText;
                appendSubtitleToSidebar(currentText);
            }
        }, 200);
    }

    async function appendSubtitleToSidebar(text) {
        const sidebarHost = document.getElementById('mandarin-sidebar-host');
        if (!sidebarHost) return;
        
        const feed = sidebarHost.shadowRoot.getElementById('transcript-feed');
        const waitingMsg = sidebarHost.shadowRoot.getElementById('waiting-msg');
        if (waitingMsg) waitingMsg.remove();

        const uniqueId = 'bubble-' + Date.now();
        const parsedChineseHTML = parseTextWithVocab(text);

        let pinyinStr = "";
        try {
            const pinyinFn = (typeof pinyinPro !== 'undefined' && pinyinPro.pinyin) || window.pinyin;
            if (typeof pinyinFn === 'function') {
                pinyinStr = pinyinFn(text, { toneType: 'symbol', type: 'string' });
                pinyinStr = pinyinStr.replace(/\n/g, '<br>');
            }
        } catch (err) { console.log("Pinyin error:", err); }

        const bubble = document.createElement('div');
        bubble.style.cssText = `
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(4px);
            padding: 16px;
            border-radius: 16px;
            box-shadow: 0 4px 10px rgba(200, 150, 160, 0.15);
            border: 1px solid rgba(250, 227, 239, 0.8);
        `;
        
        bubble.innerHTML = `
            <div style="font-size: 17px; font-weight: 600; color: #5c4a4d; margin-bottom: 4px; line-height: 1.4;">
                ${parsedChineseHTML}
            </div>
            ${pinyinStr ? `<div style="font-size: 13px; color: #d09b9f; margin-bottom: 10px; font-style: italic; letter-spacing: 0.5px; line-height: 1.4;">${pinyinStr}</div>` : ''}
            <div id="trans-${uniqueId}" style="font-size: 15px; color: #a38c90; border-top: 1px dashed #fae3ef; padding-top: 10px; line-height: 1.4;">
                <span style="opacity: 0.7;">Translating... 🎀</span>
            </div>
        `;

        bubble.querySelectorAll('.hsk-vocab-token').forEach(token => {
            token.addEventListener('click', (e) => {
                e.stopPropagation();
                const vocabData = JSON.parse(decodeURIComponent(token.getAttribute('data-vocab')));
                
                if (popupModal.style.display === 'block' && currentPopupWord === vocabData.hanzi) {
                    popupModal.style.display = 'none';
                    currentPopupWord = null;
                } else {
                    showVocabPopup(e, vocabData);
                }
            });
        });
        
        feed.appendChild(bubble);
        
        const scrollContainer = sidebarHost.shadowRoot.getElementById('transcript-scroll-area');
        if (scrollContainer && scrollContainer.style.display !== 'none') {
            scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
        }

        const englishTranslation = await translateMandarinToEnglish(text);
        const translationContainer = sidebarHost.shadowRoot.getElementById(`trans-${uniqueId}`);
        if (translationContainer) {
            translationContainer.innerHTML = englishTranslation.replace(/\n/g, '<br>');
        }
    }

    // --- 5. POPUP WITH MULTI-REPLY SLIDER & TACTILE ICON BUTTONS ---
    function showVocabPopup(event, vocab) {
        const sidebarHost = document.getElementById('mandarin-sidebar-host');
        if (sidebarHost && sidebarHost.shadowRoot) {
            const toolsMenu = sidebarHost.shadowRoot.getElementById('mandarin-tools-menu');
            if (toolsMenu) toolsMenu.style.display = 'none';
        }

        const videoEl = document.querySelector('video');
        if (videoEl && !videoEl.paused) {
            videoEl.pause();
        }

        currentPopupWord = vocab.hanzi;
        const ponyoImgUrl = "https://raw.githubusercontent.com/Yenwen6281/mandarin-subtitles/2d078edf50412736a35f4427cde45c533d310fa3/ponyo-removebg-preview.png";

        const savedEntry = getVocabEntry(vocab.hanzi);
        const alreadySaved = !!savedEntry;
        const currentNote = (savedEntry && savedEntry.note) ? savedEntry.note : (vocab.note || "");
        const hasNote = currentNote.trim().length > 0;
        const inDeck = !!(savedEntry && savedEntry.inDeck);

        const heartColor = alreadySaved ? "#e08b9b" : "#b89c9e";
        const noteIconColor = hasNote ? "#e08b9b" : "#b89c9e";

        const allReplies = getAllBeanRepliesFor(vocab.hanzi);
        const reportStatus = getReportIconStatus(vocab.hanzi);
        let replyIdx = allReplies.length - 1;

        popupModal.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 2px;">
                    <span style="font-size: 22px; font-weight: bold; color: #e08b9b;">${vocab.hanzi}</span>
                    <button id="mandarin-speak-btn" title="Listen">
                        <img src="${ponyoImgUrl}" style="width: 65px; height: auto; filter: drop-shadow(1px 2px 3px rgba(150, 180, 200, 0.4));" alt="Speak">
                    </button>
                </div>
                <span style="background: #f5cde2; color: #5c4a4d; font-size: 11px; padding: 4px 10px; border-radius: 12px; font-weight: bold; letter-spacing: 0.5px;">HSK ${vocab.level}</span>
            </div>
            
            <div style="font-size: 14px; color: #d09b9f; font-style: italic; margin-bottom: 8px;">${vocab.pinyin}</div>
            
            <ul style="margin: 0; padding-left: 18px; font-size: 14px; color: #5c4a4d; line-height: 1.5;">
                ${(vocab.translations || []).map(t => `<li style="margin-bottom: 3px;">${t}</li>`).join('')}
            </ul>

            ${allReplies.length > 0 ? `
                <div class="bean-reply-box" style="margin-top: 8px; background: #eef7fc; border: 1.5px solid #c9e4f5; border-radius: 10px; padding: 8px 10px; font-size: 12px; color: #406277; box-sizing: border-box;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                        <div style="font-weight: bold; color: #2e5973; display: flex; align-items: center; gap: 4px;">
                            💬 Bean's Note:
                        </div>
                        <button id="popup-jump-btn" title="Ask Woodstock to jump to Bean's explanation! 🐣">
                            <img src="${WOODSTOCK_IMG_URL}" style="width: 36px; height: auto; display: block; filter: drop-shadow(1px 2px 3px rgba(200, 150, 160, 0.4));" alt="Woodstock Jump" />
                        </button>
                    </div>
                    <div id="popup-reply-text" style="word-break: break-word; line-height: 1.4;">${allReplies[replyIdx].reply}</div>${allReplies.length > 1 ? `
                        <div style="display: flex; justify-content: flex-end; align-items: center; gap: 6px; margin-top: 6px; border-top: 1px dashed #c9e4f5; padding-top: 4px;">
                            <button id="popup-prev-reply" class="bean-nav-btn">◀</button>
                            <span id="popup-reply-counter" style="font-size: 11px; font-weight: bold; color: #6b8ea2;">${replyIdx + 1}/${allReplies.length}</span>
                            <button id="popup-next-reply" class="bean-nav-btn">▶</button>
                        </div>
                    ` : ''}
                </div>
            ` : ''}

            <div id="popup-sticky-container" class="sticky-note-box" style="display: ${hasNote ? 'block' : 'none'};">
                <textarea id="popup-note-input" class="sticky-note-input" maxlength="50" rows="2" placeholder="Write up to 50 characters...">${currentNote}</textarea>
                <div class="sticky-note-footer">
                    <span id="popup-char-counter" style="font-size: 10.5px; color: #cf9664; font-weight: bold;">${currentNote.length}/50</span>
                    <button id="popup-note-save-btn">Save & Close</button>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 10px; border-top: 1px dashed rgba(245, 205, 226, 0.6); gap: 10px;">
                <button id="vocab-close-btn" title="Close">
                    ✕
                </button>
                
                <button id="popup-deck-btn" class="deck-toggle-btn ${inDeck ? 'in-deck' : ''}" style="display: ${alreadySaved ? 'inline-flex' : 'none'};" title="Toggle Flashcard Deck">
                    <span>${inDeck ? '✓' : '+'}</span> Flashcard
                </button>

                <div style="display: flex; align-items: center; gap: 8px; margin-left: auto;">
                    <div id="vocab-save-btn" class="popup-icon-btn" title="Save Word" style="color: ${heartColor};">
                        <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    </div>
                    <div id="vocab-note-btn" class="popup-icon-btn" title="Add / View Note" style="position: relative; color: ${noteIconColor};">
                        <svg viewBox="0 0 24 24" width="17" height="17"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                        <div id="popup-note-indicator" style="display: ${hasNote ? 'block' : 'none'}; position: absolute; top: 1px; right: 1px; width: 6px; height: 6px; background: #e08b9b; border: 1.5px solid white; border-radius: 50%;"></div>
                    </div>
                    <div id="vocab-report-btn" class="popup-icon-btn" title="${reportStatus.title}" style="color: ${reportStatus.color};">
                        <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
                    </div>
                </div>
            </div>
        `;
        
        function updatePosition() {
            const rect = event.target.getBoundingClientRect();
            const popupHeight = popupModal.offsetHeight;
            let topPos = rect.bottom + 8;
            if (topPos + popupHeight > window.innerHeight) {
                topPos = rect.top - popupHeight - 8;
                if (topPos < 10) topPos = 10;
            }
            popupModal.style.left = `${Math.min(rect.left, window.innerWidth - 305)}px`;
            popupModal.style.top = `${topPos}px`;
        }

        popupModal.style.visibility = 'hidden';
        popupModal.style.display = 'block';
        updatePosition();
        popupModal.style.visibility = 'visible';

        if (allReplies.length > 1) {
            const replyText = document.getElementById('popup-reply-text');
            const counter = document.getElementById('popup-reply-counter');
            const prevBtn = document.getElementById('popup-prev-reply');
            const nextBtn = document.getElementById('popup-next-reply');

            const updateSlide = () => {
                replyText.textContent = allReplies[replyIdx].reply;
                counter.textContent = `${replyIdx + 1}/${allReplies.length}`;
                updatePosition();
            };

            prevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                replyIdx = (replyIdx - 1 + allReplies.length) % allReplies.length;
                updateSlide();
            });

            nextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                replyIdx = (replyIdx + 1) % allReplies.length;
                updateSlide();
            });
        }

        const popupJumpBtn = document.getElementById('popup-jump-btn');
        if (popupJumpBtn) {
            popupJumpBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (sidebarHost && sidebarHost.shadowRoot) {
                    jumpToBeanReply(sidebarHost.shadowRoot, vocab.hanzi);
                }
            });
        }

        const noteBtn = document.getElementById('vocab-note-btn');
        const stickyContainer = document.getElementById('popup-sticky-container');
        const noteInput = document.getElementById('popup-note-input');
        const charCounter = document.getElementById('popup-char-counter');
        const saveBtn = document.getElementById('vocab-save-btn');
        const indicator = document.getElementById('popup-note-indicator');
        const saveCloseBtn = document.getElementById('popup-note-save-btn');
        const reportBtn = document.getElementById('vocab-report-btn');
        const deckBtn = document.getElementById('popup-deck-btn');

        ['keydown', 'keyup', 'keypress'].forEach(evt => {
            noteInput.addEventListener(evt, (e) => {
                e.stopPropagation();
                e.stopImmediatePropagation();
            }, { capture: true });
        });

        noteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = stickyContainer.style.display === 'none';
            stickyContainer.style.display = isHidden ? 'block' : 'none';
            if (isHidden) noteInput.focus();
            updatePosition();
        });

        noteInput.addEventListener('input', (e) => {
            const text = e.target.value;
            const hasText = text.trim().length > 0;
            charCounter.textContent = `${text.length}/50`;
            updateVocabNote(vocab, text);
            noteBtn.style.color = hasText ? '#e08b9b' : '#b89c9e';
            indicator.style.display = hasText ? 'block' : 'none';
            saveBtn.style.color = '#e08b9b'; 
            deckBtn.style.display = 'inline-flex'; 
        });

        saveCloseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            stickyContainer.style.display = 'none';
            updatePosition();
        });

        const closeBtn = document.getElementById('vocab-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                popupModal.style.display = 'none';
                currentPopupWord = null;
            });
        }

        if (deckBtn) {
            deckBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isNowInDeck = toggleVocabInDeck(vocab.hanzi);
                if (isNowInDeck) {
                    deckBtn.classList.add('in-deck');
                    deckBtn.innerHTML = '<span>✓</span> Flashcard';
                } else {
                    deckBtn.classList.remove('in-deck');
                    deckBtn.innerHTML = '<span>+</span> Flashcard';
                }
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isVocabSaved(vocab.hanzi)) {
                    removeVocabFromStorage(vocab.hanzi);
                    saveBtn.style.color = '#b89c9e';
                    noteBtn.style.color = '#b89c9e';
                    indicator.style.display = 'none';
                    stickyContainer.style.display = 'none';
                    noteInput.value = '';
                    deckBtn.style.display = 'none';
                    deckBtn.classList.remove('in-deck');
                    deckBtn.innerHTML = '<span>+</span> Flashcard';
                } else {
                    saveVocabToStorage(vocab);
                    saveBtn.style.color = '#e08b9b';
                    deckBtn.style.display = 'inline-flex';
                }
                updatePosition();
            });
        }

        const speakBtn = document.getElementById('mandarin-speak-btn');
        if (speakBtn) {
            speakBtn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                playTTS(vocab.hanzi);
            });
        }

        if (reportBtn) {
            reportBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                popupModal.style.display = 'none';
                currentPopupWord = null;
                toggleReportModal(vocab.hanzi, () => {
                    const status = getReportIconStatus(vocab.hanzi);
                    reportBtn.style.color = status.color;
                    reportBtn.title = status.title;
                });
            });
        }

        const closeHandler = (e) => {
            if (!popupModal.contains(e.target)) {
                popupModal.style.display = 'none';
                currentPopupWord = null;
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 10);
    }

    // --- 6. GLOBAL KEYBOARD LOCK & REPORT MODAL LOGIC ---
    let currentReportingHanzi = null;
    let focusLockInterval = null;

    function keyboardLockHandler(e) {
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        const isEditing = activeTag === 'textarea' || activeTag === 'input';
        
        if (isEditing) {
            e.stopPropagation();
            e.stopImmediatePropagation();
            return;
        }

        const blockedKeys = [' ', 'Spacebar', 'KeyF', 'KeyM', 'KeyK', 'KeyJ', 'KeyL', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
        if (blockedKeys.includes(e.code) || blockedKeys.includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
    }

    function enableKeyboardAndFocusLock(inputEl) {
        window.addEventListener('keydown', keyboardLockHandler, true);
        window.addEventListener('keypress', keyboardLockHandler, true);
        window.addEventListener('keyup', keyboardLockHandler, true);

        if (focusLockInterval) clearInterval(focusLockInterval);
        focusLockInterval = setInterval(() => {
            if (reportModal.style.display === 'block' && inputEl) {
                if (!reportModal.contains(document.activeElement)) {
                    inputEl.focus();
                }
            }
        }, 120);
    }

    function disableKeyboardAndFocusLock() {
        window.removeEventListener('keydown', keyboardLockHandler, true);
        window.removeEventListener('keypress', keyboardLockHandler, true);
        window.removeEventListener('keyup', keyboardLockHandler, true);
        if (focusLockInterval) {
            clearInterval(focusLockInterval);
            focusLockInterval = null;
        }
    }

    function closeReportModal() {
        reportModal.style.display = 'none';
        currentReportingHanzi = null;
        disableKeyboardAndFocusLock();
    }

    function toggleReportModal(hanzi, onSentCallback) {
        if (reportModal.style.display === 'block' && currentReportingHanzi === hanzi) {
            closeReportModal();
            return;
        }

        currentReportingHanzi = hanzi;

        reportModal.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1.5px dashed #f5cde2; padding-bottom: 8px;">
                <span style="font-weight: bold; font-size: 16px; color: #e08b9b;">Ask Bean about this! 💌</span>
                <span id="close-report-btn" title="Cancel">✕</span>
            </div>
            
            <div style="margin-bottom: 12px; font-size: 14px;">
                <span style="color: #a38c90;">Word: </span>
                <b style="color: #e08b9b; font-size: 20px;">${hanzi}</b>
            </div>

            <textarea id="report-input-msg" rows="3" placeholder="What feels confusing or needs a better explanation? (optional)" style="width: 100%; border: 1px solid #f5cde2; border-radius: 8px; padding: 8px; font-family: inherit; font-size: 12.5px; color: #5c4a4d; outline: none; box-sizing: border-box; resize: none; margin-bottom: 14px; line-height: 1.4;"></textarea>

            <button id="send-report-btn">
                Send to Bean 🧸
            </button>
        `;

        reportModal.style.display = 'block';

        const closeBtn = document.getElementById('close-report-btn');
        const sendBtn = document.getElementById('send-report-btn');
        const inputMsg = document.getElementById('report-input-msg');

        ['keydown', 'keyup', 'keypress'].forEach(evt => {
            inputMsg.addEventListener(evt, (e) => {
                e.stopPropagation();
                e.stopImmediatePropagation();
            }, { capture: true });
        });

        enableKeyboardAndFocusLock(inputMsg);
        setTimeout(() => inputMsg.focus(), 60);

        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeReportModal();
        });

        sendBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sendBtn.disabled = true;
            sendBtn.textContent = 'Sending... 💌';
            sendBtn.style.background = '#d09b9f';

            const payload = {
                id: 'rep_' + Date.now(),
                hanzi: hanzi,
                sentence: '',
                user_query: inputMsg.value.trim()
            };

            GM_xmlhttpRequest({
                method: 'POST',
                url: GOOGLE_APP_SCRIPT_URL,
                data: JSON.stringify(payload),
                headers: { 'Content-Type': 'application/json' },
                onload: function(response) {
                    markWordAsAsked(hanzi);
                    if (typeof onSentCallback === 'function') onSentCallback();

                    sendBtn.textContent = 'Sent to Bean! 🧸';
                    sendBtn.style.background = '#a6cbb5';
                    setTimeout(() => {
                        closeReportModal();
                    }, 1200);
                },
                onerror: function(err) {
                    console.error("Report dispatch error:", err);
                    sendBtn.textContent = 'Oops, error! Try again.';
                    sendBtn.disabled = false;
                }
            });
        });
    }

    // --- 7. TRANSLATION ENGINE ---
    const TRANS_CACHE_STORAGE_KEY = 'mandarin_persistent_trans_cache_v1';
    let googleCoolDownUntil = 0;

    function getCachedTranslation(text) {
        try {
            const cache = JSON.parse(localStorage.getItem(TRANS_CACHE_STORAGE_KEY) || '{}');
            return cache[text] || null;
        } catch (e) {
            return null;
        }
    }

    function setCachedTranslation(text, translation) {
        try {
            const cache = JSON.parse(localStorage.getItem(TRANS_CACHE_STORAGE_KEY) || '{}');
            const keys = Object.keys(cache);
            if (keys.length > 2000) {
                delete cache[keys[0]];
            }
            cache[text] = translation;
            localStorage.setItem(TRANS_CACHE_STORAGE_KEY, JSON.stringify(cache));
        } catch (e) {}
    }

    async function translateMandarinToEnglish(text) {
        const trimmed = text.trim();
        if (!trimmed) return text;

        const cached = getCachedTranslation(trimmed);
        if (cached) return cached;

        if (Date.now() > googleCoolDownUntil) {
            const googleRes = await fetchGoogleTranslate(trimmed);
            if (googleRes) {
                setCachedTranslation(trimmed, googleRes);
                return googleRes;
            }
        }

        const myMemoryRes = await fetchMyMemoryTranslate(trimmed);
        setCachedTranslation(trimmed, myMemoryRes);
        return myMemoryRes;
    }

    function fetchGoogleTranslate(text) {
        return new Promise((resolve) => {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=t&q=${encodeURIComponent(text)}`;
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                timeout: 3000,
                onload: function(res) {
                    if (res.status === 200) {
                        try {
                            const data = JSON.parse(res.responseText);
                            if (data && data[0]) {
                                const translated = data[0].map(item => item[0]).filter(Boolean).join('');
                                return resolve(decodeHtmlEntities(translated));
                            }
                        } catch (e) {}
                    } else if (res.status === 429) {
                        console.warn("Google Translate rate limit hit. Pausing Google tier for 5 minutes.");
                        googleCoolDownUntil = Date.now() + (5 * 60 * 1000);
                    }
                    resolve(null);
                },
                onerror: function() { resolve(null); },
                ontimeout: function() { resolve(null); }
            });
        });
    }

    function fetchMyMemoryTranslate(text) {
        return new Promise((resolve) => {
            let url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}`;
            if (MYMEMORY_EMAIL && MYMEMORY_EMAIL.trim()) {
                url += `&de=${encodeURIComponent(MYMEMORY_EMAIL.trim())}`;
            }

            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                timeout: 4500,
                headers: { 'Accept': 'application/json' },
                onload: function(res) {
                    try {
                        const data = JSON.parse(res.responseText);
                        const translatedText = data?.responseData?.translatedText || text;
                        resolve(decodeHtmlEntities(translatedText));
                    } catch (e) {
                        resolve(text);
                    }
                },
                onerror: function(resolve) { resolve(text); },
                ontimeout: function(resolve) { resolve(text); }
            });
        });
    }
})();
