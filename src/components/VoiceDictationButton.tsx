import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, Globe } from 'lucide-react';

interface VoiceDictationButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
  size?: 'sm' | 'md';
  buttonText?: string;
  placeholderText?: string;
  appendMode?: boolean; // Default true: appends to existing text with a space
  currentValue?: string;
}

export const VoiceDictationButton: React.FC<VoiceDictationButtonProps> = ({
  onTranscript,
  className = '',
  size = 'md',
  buttonText,
  appendMode = true,
  currentValue = '',
}) => {
  const [isListening, setIsListening] = useState(false);
  const [language, setLanguage] = useState<'en-IN' | 'hi-IN' | 'en-US'>('en-IN');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [notSupported, setNotSupported] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setNotSupported(true);
    }
  }, []);

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setStatusMessage('Voice recognition is not supported in this browser. Try Chrome, Edge, or Safari.');
      setTimeout(() => setStatusMessage(null), 4000);
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false; // Stop when mechanic finishes sentence or pauses
      recognition.interimResults = false;
      recognition.lang = language;

      recognition.onstart = () => {
        setIsListening(true);
        setStatusMessage(`Listening in ${language === 'hi-IN' ? 'Hindi' : 'English'}... Speak findings clearly`);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript;
          }
        }

        if (transcript) {
          const trimmed = transcript.trim();
          if (appendMode && currentValue) {
            const needsSpace = !currentValue.endsWith(' ') && !currentValue.endsWith('\n');
            onTranscript(`${currentValue}${needsSpace ? ' ' : ''}${trimmed}`);
          } else {
            onTranscript(trimmed);
          }
          setStatusMessage(`Dictated: "${trimmed}"`);
          setTimeout(() => setStatusMessage(null), 3000);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'no-speech') {
          setStatusMessage('No speech detected. Please try again.');
        } else if (event.error === 'not-allowed') {
          setStatusMessage('Microphone access denied. Please allow microphone permissions.');
        } else {
          setStatusMessage(`Speech error: ${event.error}`);
        }
        setTimeout(() => setStatusMessage(null), 4000);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
      setStatusMessage('Unable to access microphone.');
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const isSmall = size === 'sm';

  return (
    <div className="relative inline-flex items-center gap-1">
      <button
        type="button"
        onClick={toggleListening}
        title={isListening ? 'Stop Voice Dictation' : 'Click to dictate repair findings via Microphone'}
        className={`relative flex items-center justify-center gap-1.5 font-bold transition-all rounded-xl cursor-pointer shadow-xs ${
          isListening
            ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse ring-2 ring-rose-400/50'
            : 'bg-blue-600 hover:bg-blue-500 text-white dark:bg-blue-600 dark:hover:bg-blue-500'
        } ${
          isSmall
            ? 'px-2.5 py-1 text-[11px]'
            : 'px-3 py-1.5 text-xs'
        } ${className}`}
      >
        {isListening ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
            </span>
            <Mic className={`${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} animate-bounce`} />
            <span>{buttonText || 'Listening...'}</span>
          </>
        ) : (
          <>
            <Mic className={isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
            <span>{buttonText || 'Dictate Notes'}</span>
          </>
        )}
      </button>

      {/* Language Selector Toggle */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowLangMenu(!showLangMenu)}
          title={`Language: ${language === 'hi-IN' ? 'Hindi' : 'English'}`}
          className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer"
        >
          <Globe className="w-3 h-3" />
          <span className="uppercase">{language === 'hi-IN' ? 'HI' : 'EN'}</span>
        </button>

        {showLangMenu && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[120px] animate-in fade-in zoom-in-95 duration-100">
            <button
              type="button"
              onClick={() => { setLanguage('en-IN'); setShowLangMenu(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs font-semibold flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700 ${language === 'en-IN' ? 'text-blue-600 font-bold' : 'text-slate-700 dark:text-slate-300'}`}
            >
              <span>English (IN)</span>
              {language === 'en-IN' && '✓'}
            </button>
            <button
              type="button"
              onClick={() => { setLanguage('hi-IN'); setShowLangMenu(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs font-semibold flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700 ${language === 'hi-IN' ? 'text-blue-600 font-bold' : 'text-slate-700 dark:text-slate-300'}`}
            >
              <span>हिंदी (Hindi)</span>
              {language === 'hi-IN' && '✓'}
            </button>
            <button
              type="button"
              onClick={() => { setLanguage('en-US'); setShowLangMenu(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs font-semibold flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700 ${language === 'en-US' ? 'text-blue-600 font-bold' : 'text-slate-700 dark:text-slate-300'}`}
            >
              <span>English (US)</span>
              {language === 'en-US' && '✓'}
            </button>
          </div>
        )}
      </div>

      {/* Floating Status Toast */}
      {statusMessage && (
        <div className="absolute bottom-full mb-1.5 left-0 z-50 whitespace-nowrap bg-slate-900 text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg shadow-lg border border-slate-700 animate-in fade-in duration-150">
          {statusMessage}
        </div>
      )}
    </div>
  );
};
