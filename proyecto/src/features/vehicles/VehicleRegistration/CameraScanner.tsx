import React, { useState, useRef, useEffect, RefObject } from 'react';

interface CameraScannerProps {
  onScanSuccess: (plate: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}

// Función para limpiar y formatear la placa detectada
function extractPlate(text: string): string | null {
  const upper = text.toUpperCase();

  // Esta expresión regular es "a prueba de balas" contra los espacios del OCR.
  // Busca:
  // - Inicio de línea o caracter no alfanumérico (para no cortar a la mitad de una palabra equivocada)
  // - 2 a 3 Letras (con posibles espacios entre ellas)
  // - 3 a 4 Números (con posibles espacios entre ellos)
  // - Fin de palabra (para no capturar placas de 5 números)
  const regex = /(?:^|[^A-Z0-9])([A-Z])[\s\-]*([A-Z])[\s\-]*([A-Z])?[\s\-]*(\d)[\s\-]*(\d)[\s\-]*(\d)[\s\-]*(\d)?(?=[^A-Z0-9]|$)/;
  
  const match = upper.match(regex);

  if (match) {
    const l1 = match[1];
    const l2 = match[2];
    const l3 = match[3] || '';
    const d1 = match[4];
    const d2 = match[5];
    const d3 = match[6];
    const d4 = match[7] || '';
    
    return `${l1}${l2}${l3}-${d1}${d2}${d3}${d4}`;
  }

  return null;
}


// OCR usando OCR.space API (gratuita, no requiere descarga de modelos)
async function runOCR(imageDataUrl: string): Promise<string> {
  const base64 = imageDataUrl.split(',')[1];

  const formData = new FormData();
  formData.append('base64Image', `data:image/png;base64,${base64}`);
  formData.append('language', 'eng');
  formData.append('isOverlayRequired', 'false');
  formData.append('detectOrientation', 'true');
  formData.append('scale', 'true');
  formData.append('OCREngine', '2'); // Motor 2 es mejor para placas

  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    headers: {
      'apikey': 'K81730165988957', // API key gratuita pública para pruebas
    },
    body: formData,
  });

  if (!response.ok) throw new Error('Error en la API de OCR');

  const data = await response.json();
  const text = data?.ParsedResults?.[0]?.ParsedText || '';
  return text;
}

const CameraScanner: React.FC<CameraScannerProps> = ({ onScanSuccess, inputRef }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedPlate, setDetectedPlate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [ocrRawText, setOcrRawText] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Asignar el stream al video cuando ambos estén listos
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.error);
    }
  }, [stream, isOpen]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => { stopCamera(); };
  }, []);

  const startCamera = async () => {
    setIsOpen(true);
    setDetectedPlate(null);
    setError(null);
    setCapturedImage(null);
    setOcrRawText(null);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }, // Cámara trasera
          width: { ideal: 1280 },
          height: { ideal: 720 },
        }
      });
      setStream(mediaStream);
    } catch (err: any) {
      console.error('Error cámara:', err);
      let msg = 'No se pudo acceder a la cámara.';
      if (err.name === 'NotAllowedError') msg = 'Permiso de cámara denegado. Ve a Configuración > Aplicaciones > AutoTech > Permisos y activa la Cámara.';
      else if (err.name === 'NotFoundError') msg = 'No se encontró ninguna cámara en el dispositivo.';
      setError(msg);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const closeScanner = () => {
    stopCamera();
    setIsOpen(false);
    setDetectedPlate(null);
    setError(null);
    setCapturedImage(null);
    setOcrRawText(null);
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;

    // Calculamos las dimensiones del rectángulo de la guía (80% ancho, 35% alto)
    const cropWidth = vw * 0.8;
    const cropHeight = vh * 0.35;
    const cropX = (vw - cropWidth) / 2;
    const cropY = (vh - cropHeight) / 2;

    // El canvas será del tamaño del rectángulo para guardar solo esa porción
    canvas.width = cropWidth;
    canvas.height = cropHeight;

    // Dibujamos solo el recorte en el canvas
    ctx.drawImage(
      video, 
      cropX, cropY, cropWidth, cropHeight, 
      0, 0, cropWidth, cropHeight
    );

    const imageDataUrl = canvas.toDataURL('image/png');
    setCapturedImage(imageDataUrl);
    stopCamera();
    setIsProcessing(true);
    setError(null);

    try {
      const rawText = await runOCR(imageDataUrl);
      setOcrRawText(rawText);

      const plate = extractPlate(rawText);
      if (plate) {
        setDetectedPlate(plate);
      } else {
        // Si no se detectó patrón, mostrar texto crudo para que el usuario corrija
        setDetectedPlate(rawText.replace(/[^A-Z0-9\-]/gi, '').substring(0, 8).toUpperCase() || '');
        setError('No se detectó una placa con claridad. Puedes corregirla manualmente abajo.');
      }
    } catch (err: any) {
      console.error('OCR error:', err);
      setError('Error al procesar la imagen. Verifica tu conexión a internet e intenta nuevamente.');
      setDetectedPlate('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (detectedPlate) {
      onScanSuccess(detectedPlate.trim().toUpperCase());
    }
    closeScanner();
  };

  const handleRetry = () => {
    setCapturedImage(null);
    setDetectedPlate(null);
    setError(null);
    setOcrRawText(null);
    startCamera();
  };

  const handleManualEdit = () => {
    closeScanner();
    setTimeout(() => inputRef?.current?.focus(), 150);
  };

  // ─── ESTILOS INLINE (sin Tailwind) ────────────────────────────────────────
  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.85)', padding: '1rem',
  };
  const modal: React.CSSProperties = {
    background: '#fff', borderRadius: '1rem',
    width: '100%', maxWidth: '420px',
    boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
    overflow: 'hidden', fontFamily: 'sans-serif',
  };
  const header: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb',
  };
  const body: React.CSSProperties = {
    padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
  };
  const videoBox: React.CSSProperties = {
    width: '100%', background: '#000', borderRadius: '0.75rem',
    overflow: 'hidden', aspectRatio: '16/9', position: 'relative',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const btn = (color: string, bg: string, border?: string): React.CSSProperties => ({
    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.5rem',
    border: border || 'none', background: bg, color, fontWeight: 600,
    fontSize: '1rem', cursor: 'pointer',
  });

  return (
    <>
      {/* Botón de abrir escáner */}
      <button
        type="button"
        onClick={startCamera}
        title="Escanear placa con cámara"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--color-surface-container-high, #f3f4f6)',
          border: '1px solid var(--color-outline-variant, #e5e7eb)',
          color: 'var(--color-on-surface, #1f2937)',
          borderRadius: '0.375rem', width: '2.5rem', height: '2.5rem',
          cursor: 'pointer', flexShrink: 0,
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Modal del escáner */}
      {isOpen && (
        <div style={overlay}>
          <div style={modal}>
            {/* Header */}
            <div style={header}>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#111' }}>📷 Escáner de Placa</span>
              <button onClick={closeScanner} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: '#6b7280', lineHeight: 1 }}>×</button>
            </div>

            <div style={body}>
              {/* ERROR */}
              {error && !isProcessing && (
                <div style={{ width: '100%', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '0.75rem', color: '#991b1b', fontSize: '0.875rem' }}>
                  ⚠️ {error}
                </div>
              )}

              {/* VISTA DE CÁMARA */}
              {!capturedImage && !isProcessing && (
                <>
                  <div style={videoBox}>
                    {stream ? (
                      <>
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {/* Guía de alineación */}
                        <div style={{
                          position: 'absolute', inset: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          pointerEvents: 'none',
                        }}>
                          <div style={{
                            width: '80%', height: '35%',
                            border: '2px solid rgba(59,130,246,0.8)',
                            borderRadius: '0.5rem',
                            boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
                          }} />
                        </div>
                      </>
                    ) : (
                      <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                        {error ? '❌ Sin cámara' : '⏳ Iniciando cámara...'}
                      </p>
                    )}
                  </div>
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  <p style={{ color: '#6b7280', fontSize: '0.8rem', textAlign: 'center', margin: 0 }}>
                    Centra la placa dentro del recuadro azul
                  </p>
                  <button
                    onClick={captureAndScan}
                    disabled={!stream}
                    style={btn('#fff', stream ? '#2563eb' : '#93c5fd')}
                  >
                    📸 Capturar y Escanear
                  </button>
                  {error && (
                    <button onClick={handleManualEdit} style={btn('#2563eb', 'transparent', '2px solid #2563eb')}>
                      ✏️ Ingresar placa manualmente
                    </button>
                  )}
                </>
              )}

              {/* PROCESANDO */}
              {isProcessing && (
                <div style={{ padding: '2rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  {capturedImage && (
                    <img src={capturedImage} alt="Foto capturada" style={{ width: '100%', borderRadius: '0.5rem', maxHeight: '180px', objectFit: 'contain' }} />
                  )}
                  <div style={{
                    width: '48px', height: '48px', border: '4px solid #e5e7eb',
                    borderTop: '4px solid #2563eb', borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }} />
                  <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                  <p style={{ color: '#374151', fontWeight: 600 }}>Analizando imagen...</p>
                  <p style={{ color: '#6b7280', fontSize: '0.8rem', textAlign: 'center' }}>Usando OCR en la nube. Puede tardar unos segundos.</p>
                </div>
              )}

              {/* RESULTADO */}
              {!isProcessing && detectedPlate !== null && capturedImage && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <img src={capturedImage} alt="Foto capturada" style={{ width: '100%', borderRadius: '0.5rem', maxHeight: '150px', objectFit: 'contain' }} />

                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.75rem', padding: '1rem', textAlign: 'center' }}>
                    <p style={{ color: '#1d4ed8', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Placa Detectada:</p>
                    <p style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '0.2em', color: '#1e3a8a', margin: 0 }}>
                      {detectedPlate || '—'}
                    </p>
                    {ocrRawText && (
                      <p style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '0.5rem' }}>
                        Texto OCR: "{ocrRawText.trim().substring(0, 60)}"
                      </p>
                    )}
                  </div>

                  <p style={{ color: '#374151', textAlign: 'center', fontSize: '0.9rem', margin: 0 }}>¿Es correcta esta placa?</p>

                  <button onClick={handleConfirm} disabled={!detectedPlate} style={btn('#fff', detectedPlate ? '#16a34a' : '#86efac')}>
                    ✅ Sí, es correcta
                  </button>
                  <button onClick={handleRetry} style={btn('#374151', '#f3f4f6', '2px solid #e5e7eb')}>
                    🔄 Tomar foto nuevamente
                  </button>
                  <button onClick={handleManualEdit} style={{ ...btn('#2563eb', 'transparent'), fontWeight: 500, fontSize: '0.9rem' }}>
                    ✏️ Corregir manualmente
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CameraScanner;
