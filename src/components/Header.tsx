import AppIcon from './AppIcon';
import Logo from './Logo';

export default function Header() {
  return (
    <header className="bg-gray-50">
      <div className="flex items-center gap-3 px-4 pt-4 pb-1 max-w-2xl mx-auto">
        <AppIcon size={40} />
        <div>
          <h1 className="leading-none">
            <Logo size={26} />
          </h1>
          <p className="text-xs text-gray-500 mt-1">Familien-Speiseplaner</p>
        </div>
      </div>
    </header>
  );
}
