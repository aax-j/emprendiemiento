import React, { useState, useRef } from 'react';
import VoiceInput from './VoiceInput';
import CameraScanner from './CameraScanner';

const RegistroVehiculo: React.FC = () => {
  const [placa, setPlaca] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  
  const placaInputRef = useRef<HTMLInputElement>(null);

  const handlePlacaScanSuccess = (scannedPlate: string) => {
    setPlaca(scannedPlate);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Guardando vehículo:', { placa, marca, modelo });
    alert(`Vehículo ${placa} guardado con éxito!`);
  };

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-2xl shadow-xl mt-10 border border-gray-100">
      <h2 className="text-2xl font-bold text-slate-800 mb-8 pb-4 border-b border-gray-100">
        Nuevo Registro de Vehículo
      </h2>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <label htmlFor="placa" className="mb-2 text-sm font-medium text-gray-700 block">
            Número de Placa
          </label>
          <div className="flex">
            <input
              ref={placaInputRef}
              id="placa"
              type="text"
              value={placa}
              onChange={(e) => setPlaca(e.target.value.toUpperCase())}
              placeholder="Ej: ABC-1234"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase text-lg"
            />
            <CameraScanner onScanSuccess={handlePlacaScanSuccess} inputRef={placaInputRef} />
          </div>
        </div>

        <VoiceInput
          id="marca"
          label="Marca del Vehículo"
          value={marca}
          onChange={setMarca}
          placeholder="Ej: Toyota, Nissan..."
        />
        
        <VoiceInput
          id="modelo"
          label="Modelo"
          value={modelo}
          onChange={setModelo}
          placeholder="Ej: Corolla, Sentra..."
        />

        <div className="mt-10 pt-6 border-t border-gray-100">
          <button
            type="submit"
            className="w-full py-4 px-4 bg-blue-600 text-white font-bold text-lg rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all shadow-lg hover:shadow-xl"
          >
            Registrar Vehículo
          </button>
        </div>
      </form>
    </div>
  );
};

export default RegistroVehiculo;
