import React, { useState, useEffect, useRef } from 'react';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface VoiceInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  id: string;
  placeholder?: string;
  inputClassName?: string;
  inputStyle?: React.CSSProperties;
}

const VoiceInput: React.FC<VoiceInputProps> = ({ label, value, onChange, id, placeholder, inputClassName, inputStyle }) => {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = 'es-ES';

      recognitionRef.current.onstart = () => setIsListening(true);

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        const newValue = value ? `${value} ${transcript}` : transcript;
        onChange(newValue);
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    } else {
      setSupported(false);
    }
  }, [value, onChange]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.start();
      } else {
        alert('Tu navegador no soporta la API de dictado por voz.');
      }
    }
  };

  const micBtnStyle: React.CSSProperties = {
    position: 'absolute',
    right: '0.5rem',
    top: '50%',
    transform: 'translateY(-50%)',
    padding: '0.35rem',
    borderRadius: '50%',
    border: 'none',
    background: isListening ? 'rgba(239,68,68,0.1)' : 'transparent',
    color: isListening ? '#ef4444' : 'var(--color-outline, #6b7280)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '0', width: '100%' }}>
      {label && (
        <label htmlFor={id} style={{ marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500, display: 'block' }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
        <input
          id={id}
          type="text"
          className={inputClassName}
          style={{
            width: '100%',
            paddingRight: supported ? '2.5rem' : '0.75rem',
            ...inputStyle,
          }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        {supported && (
          <button
            type="button"
            onClick={toggleListening}
            style={micBtnStyle}
            title={isListening ? 'Detener dictado' : 'Dictar por voz'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8h-2a5 5 0 01-10 0H3a7.001 7.001 0 006 6.93V17H6v2h8v-2h-3v-2.07z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default VoiceInput;
