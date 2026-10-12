import { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { setPassword } from '../lib/api';

interface Props {
  failed: boolean;
  onSubmit: () => void;
}

export default function PasswordGate({ failed, onSubmit }: Props) {
  const [value, setValue] = useState('');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <form
        className="w-full max-w-xs bg-white rounded-2xl border border-gray-100 p-6 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setPassword(value);
          onSubmit();
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
            <UtensilsCrossed size={18} className="text-white" />
          </div>
          <h1 className="text-base font-semibold text-gray-900">Familien-Speiseplaner</h1>
        </div>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Familien-Passwort"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        {failed && <p className="text-xs text-red-500">Passwort stimmt nicht.</p>}
        <button
          type="submit"
          className="bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg py-2"
        >
          Öffnen
        </button>
      </form>
    </div>
  );
}
