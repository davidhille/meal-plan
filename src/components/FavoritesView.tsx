import { Heart } from 'lucide-react';

/** Platzhalter – wird mit „Favoriten mit Turnus“ gefüllt */
export default function FavoritesView() {
  return (
    <div className="px-5 py-12 flex flex-col items-center text-center gap-3">
      <Heart size={32} className="text-gray-300" />
      <p className="text-sm text-gray-500">Noch keine Favoriten.</p>
    </div>
  );
}
