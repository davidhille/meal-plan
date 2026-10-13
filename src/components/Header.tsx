import AppIcon from './AppIcon';

export default function Header() {
  return (
    <header className="bg-gray-50">
      <div className="flex items-center gap-3 px-4 pt-4 pb-1 max-w-2xl mx-auto">
        <AppIcon size={40} />
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-brand-700 leading-tight">Familien-Speiseplaner</h1>
          <p className="text-xs text-gray-500">& Einkaufs-Assistent</p>
        </div>
      </div>
    </header>
  );
}
