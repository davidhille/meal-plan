import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { FamilyMember, FamilyMemberType } from '../types';

interface FamilyMemberModalProps {
  member?: FamilyMember;
  onSave: (member: Omit<FamilyMember, 'id' | 'profile_id' | 'created_at'>) => void;
  onClose: () => void;
}

export default function FamilyMemberModal({ member, onSave, onClose }: FamilyMemberModalProps) {
  const [type, setType] = useState<FamilyMemberType>(member?.type || 'adult');
  const [name, setName] = useState(member?.name || '');
  const [age, setAge] = useState<string>(member?.age?.toString() || '');
  const [disliked, setDisliked] = useState<string>(member?.disliked_foods.join(', ') || '');
  const [favorites, setFavorites] = useState<string>(member?.favorite_foods.join(', ') || '');

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      type,
      age: type === 'child' && age ? parseInt(age) : null,
      disliked_foods: disliked
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      favorite_foods: favorites
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/40 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {member ? 'Familienmitglied bearbeiten' : 'Neues Mitglied'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Anna"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Typ</label>
            <div className="flex gap-2">
              {(['adult', 'child'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    type === t
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t === 'adult' ? 'Erwachsener' : 'Kind'}
                </button>
              ))}
            </div>
          </div>

          {/* Age (only for children) */}
          {type === 'child' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Alter</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="z.B. 8"
                min="1"
                max="120"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
          )}

          {/* Disliked Foods */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Essen das nicht gemocht wird
            </label>
            <textarea
              value={disliked}
              onChange={(e) => setDisliked(e.target.value)}
              placeholder="z.B. Pilze, Oliven, Fisch (komma-getrennt)"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          {/* Favorite Foods */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Lieblings-Essen
            </label>
            <textarea
              value={favorites}
              onChange={(e) => setFavorites(e.target.value)}
              placeholder="z.B. Pasta, Pizza, Hähnchen (komma-getrennt)"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
