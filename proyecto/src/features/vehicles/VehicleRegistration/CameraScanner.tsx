import React, { useState, useRef, useEffect, RefObject } from 'react';

interface CameraScannerProps {
  onScanSuccess: (plate: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}

const CameraScanner: React.FC<CameraScannerProps> = ({ onScanSuccess, inputRef }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedPlate, setDetectedPlate] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    setIsOpen(true);
    setDetectedPlate(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error("Error accediendo a la cámara", error);
      alert("No se pudo acceder a la cámara. Revisa los permisos.");
      setIsOpen(false);
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
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stream]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        stopCamera();
        setIsProcessing(true);
        
        // Simulación de llamada a API (OCR)
        setTimeout(() => {
          setIsProcessing(false);
          setDetectedPlate('ABC-1234');
        }, 1500);
      }
    }
  };

  const handleConfirm = () => {
    if (detectedPlate) {
      onScanSuccess(detectedPlate);
    }
    closeScanner();
  };

  const handleRetry = () => {
    startCamera();
  };

  const handleManualEdit = () => {
    closeScanner();
    if (inputRef && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={startCamera}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-surface-container-high, #f3f4f6)',
          border: '1px solid var(--color-ghost-border, #e5e7eb)',
          color: 'var(--color-on-surface, #1f2937)',
          borderRadius: 'var(--radius-md, 0.375rem)',
          width: '2.5rem',
          height: '2.5rem',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 0.15s ease',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
        }}
        title="Escanear placa"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-800">Escáner de Placa</h3>
              <button onClick={closeScanner} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-5 flex flex-col items-center">
              {!detectedPlate && !isProcessing && (
                <>
                  <div className="w-full bg-black rounded-lg overflow-hidden relative aspect-video flex items-center justify-center shadow-inner">
                    {stream ? (
                       <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    ) : (
                       <p className="text-gray-400 animate-pulse">Iniciando cámara...</p>
                    )}
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                  
                  <button 
                    onClick={capturePhoto}
                    disabled={!stream}
                    className="mt-6 px-8 py-3 bg-blue-600 text-white font-medium rounded-full hover:bg-blue-700 disabled:opacity-50 shadow-lg transition-all active:scale-95"
                  >
                    Capturar Foto
                  </button>
                </>
              )}

              {isProcessing && (
                <div className="py-12 flex flex-col items-center">
                   <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                   <p className="text-gray-600 font-medium">Analizando imagen (OCR)...</p>
                </div>
              )}

              {detectedPlate && !isProcessing && (
                <div className="w-full flex flex-col items-center">
                  <div className="bg-blue-50 px-6 py-4 rounded-lg mb-6 text-center w-full border border-blue-100">
                     <p className="text-sm text-blue-600 mb-1 font-medium">Placa Detectada:</p>
                     <p className="text-4xl font-bold tracking-widest text-slate-800">{detectedPlate}</p>
                  </div>
                  
                  <p className="mb-6 text-center text-gray-700">¿Es correcta esta placa?</p>
                  
                  <div className="flex flex-col gap-3 w-full">
                    <button onClick={handleConfirm} className="w-full py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm">
                      Sí, es correcta
                    </button>
                    <button onClick={handleRetry} className="w-full py-3 border-2 border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">
                      Tomar foto nuevamente
                    </button>
                    <button onClick={handleManualEdit} className="w-full py-2 text-blue-600 font-medium hover:text-blue-800 transition-colors mt-2">
                      Corregir manualmente
                    </button>
                  </div>
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
