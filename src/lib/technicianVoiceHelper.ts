// Vernacular audio speech and translation utilities for workshop labour & technicians

export interface VernacularTaskInfo {
  hindiTitle: string;
  hindiDesc: string;
  icon: string;
  categoryLabelHindi: string;
}

// Quick common workshop automotive dictionary
const HINDI_DICTIONARY: Record<string, { hi: string; icon: string }> = {
  // Common tasks
  'engine oil': { hi: 'इंजन ऑयल बदलना', icon: '🛢️' },
  'oil filter': { hi: 'ऑयल फ़िल्टर बदलना', icon: '🔧' },
  'brake pad': { hi: 'ब्रेक पैड बदलना / सर्विस', icon: '🛑' },
  'brake disc': { hi: 'ब्रेक डिस्क लेथ / रिप्लेस', icon: '⚙️' },
  'front bumper': { hi: 'आगे का बम्पर रिपेयर / पेंट', icon: '🚗' },
  'rear bumper': { hi: 'पीछे का बम्पर रिपेयर / पेंट', icon: '🚗' },
  'denting': { hi: 'डेंटिंग / चद्दर सीधी करना', icon: '🔨' },
  'paint': { hi: 'पेंटिंग / रंगाई', icon: '🎨' },
  'washing': { hi: 'धुलाई / वैक्यूम सफाई', icon: '🧼' },
  'detailing': { hi: 'कार पॉलिश / डीटेलिंग', icon: '✨' },
  'rubbing': { hi: 'रबिंग और बफ़िंग', icon: '🧽' },
  'coolant': { hi: 'कूलेंट बदलना / टॉप-अप', icon: '❄️' },
  'spark plug': { hi: 'स्पार्क प्लग बदलना', icon: '⚡' },
  'clutch': { hi: 'क्लच प्लेट / प्रेशर प्लेट', icon: '⚙️' },
  'suspension': { hi: 'सस्पेंशन / शॉकअप रिपेयर', icon: '🔩' },
  'wheel alignment': { hi: 'व्हील अलाइनमेंट और बैलेंसिंग', icon: '🔄' },
  'ac service': { hi: 'एसी गैस और फ़िल्टर सर्विस', icon: '💨' },
  'battery': { hi: 'बैटरी चेक / रिप्लेस', icon: '🔋' },
  'wiper': { hi: 'वाइपर ब्लेड बदलना', icon: '🌧️' },
  'headlight': { hi: 'हेडलाइट / बल्ब रिपेयर', icon: '💡' },
  'door': { hi: 'दरवाजा डेंटिंग व अलाइनमेंट', icon: '🚪' },
  'fender': { hi: 'फेंडर / मडगार्ड रिपेयर', icon: '🚙' },
  'running board': { hi: 'रनिंग बोर्ड डेंट / पेंट', icon: '🚘' }
};

export const CATEGORY_HINDI_MAP: Record<string, { label: string; sub: string; emoji: string; bg: string; text: string }> = {
  MECHANICAL: {
    label: 'मैकेनिकल (इंजन/ब्रेक/सस्पेंशन)',
    sub: 'Mechanical Work',
    emoji: '🔧',
    bg: 'bg-amber-500/15 border-amber-500/40',
    text: 'text-amber-500 dark:text-amber-400'
  },
  DENTING: {
    label: 'डेंटिंग (चद्दर सीधा करना)',
    sub: 'Body Denting',
    emoji: '🔨',
    bg: 'bg-blue-500/15 border-blue-500/40',
    text: 'text-blue-500 dark:text-blue-400'
  },
  PAINT: {
    label: 'पेंटिंग (कलर / प्राइमर / बफ़िंग)',
    sub: 'Car Painting',
    emoji: '🎨',
    bg: 'bg-purple-500/15 border-purple-500/40',
    text: 'text-purple-500 dark:text-purple-400'
  },
  WASHING: {
    label: 'धुलाई और सफाई (वाशिंग)',
    sub: 'Washing & Interior Clean',
    emoji: '🧼',
    bg: 'bg-teal-500/15 border-teal-500/40',
    text: 'text-teal-500 dark:text-teal-400'
  },
  SUBLET_VENDOR: {
    label: 'बाहरी काम / लेथ (सबलेट)',
    sub: 'Outside Vendor / Lathe',
    emoji: '🏭',
    bg: 'bg-indigo-500/15 border-indigo-500/40',
    text: 'text-indigo-500 dark:text-indigo-400'
  },
  INSPECTION: {
    label: 'जांच / टेस्ट ड्राइव (इंस्पेक्शन)',
    sub: 'QC & Inspection',
    emoji: '🔍',
    bg: 'bg-emerald-500/15 border-emerald-500/40',
    text: 'text-emerald-500 dark:text-emerald-400'
  },
  PARTS: {
    label: 'पार्ट्स फिटिंग',
    sub: 'Spare Parts Fitment',
    emoji: '📦',
    bg: 'bg-orange-500/15 border-orange-500/40',
    text: 'text-orange-500 dark:text-orange-400'
  },
  ACCESSORIES: {
    label: 'एक्सेसरीज फिटिंग',
    sub: 'Accessories & Upgrades',
    emoji: '⚡',
    bg: 'bg-pink-500/15 border-pink-500/40',
    text: 'text-pink-500 dark:text-pink-400'
  }
};

/**
 * Translates or finds phonetic Hindi terms for tasks to help workshop technicians
 */
export function getVernacularTaskInfo(title: string, category: string): VernacularTaskInfo {
  const lower = title.toLowerCase();
  let hindiTitle = title;
  let icon = CATEGORY_HINDI_MAP[category]?.emoji || '🔧';

  for (const [key, val] of Object.entries(HINDI_DICTIONARY)) {
    if (lower.includes(key)) {
      hindiTitle = `${val.hi} (${title})`;
      icon = val.icon;
      break;
    }
  }

  const categoryLabelHindi = CATEGORY_HINDI_MAP[category]?.label || category;

  return {
    hindiTitle,
    hindiDesc: `${categoryLabelHindi} - ${title}`,
    icon,
    categoryLabelHindi
  };
}

/**
 * Text-to-Speech audio reader in Hindi or English
 */
export function speakTechnicianPrompt(text: string, onEnd?: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }

  try {
    window.speechSynthesis.cancel(); // Stop ongoing audio

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Attempt to locate a Hindi voice, or fallback to default
    const voices = window.speechSynthesis.getVoices();
    const hindiVoice = voices.find(v => v.lang.includes('hi') || v.lang.includes('IN'));
    if (hindiVoice) {
      utterance.voice = hindiVoice;
    }

    utterance.lang = 'hi-IN';
    utterance.rate = 0.9; // Clear slower speech for workshop acoustics
    utterance.pitch = 1.0;

    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.error('Speech synthesis error:', err);
    if (onEnd) onEnd();
    return false;
  }
}

export function stopTechnicianSpeech() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
