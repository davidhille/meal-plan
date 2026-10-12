import { useEffect, useState } from 'react';
import { Loader2, ShoppingBag, Check, Unplug } from 'lucide-react';
import { ShopProvider, ShopRule, ShopState } from '../types';
import CollapsibleCard from './CollapsibleCard';
import { getShopState, saveShopSettings, saveShopRule, connectShop, verifyPicnic, disconnectShop } from '../lib/api';

const SHOPS: { id: ShopProvider; name: string; color: string; hint: string }[] = [
  {
    id: 'knuspr',
    name: 'Knuspr',
    color: '#22c55e',
    hint: 'Produkte suchen und mit einem Klick in deinen Knuspr-Warenkorb legen.',
  },
  {
    id: 'picnic',
    name: 'Picnic',
    color: '#e11d48',
    hint: 'Produkte suchen und verknüpfen. Beim Verbinden schickt Picnic evtl. einen SMS-Code.',
  },
];

/** Mindestbestellwert und Liefergebühr – gespeichert beim Verlassen des Feldes */
function ShopRuleFields({ name, rule, onSave }: { name: string; rule: ShopRule; onSave: (r: ShopRule) => void }) {
  const [minOrder, setMinOrder] = useState(String(rule.minOrder));
  const [fee, setFee] = useState(String(rule.deliveryFee));
  const commit = () => {
    const m = Number(minOrder.replace(',', '.'));
    const f = Number(fee.replace(',', '.') || '0');
    if (!Number.isFinite(m) || !Number.isFinite(f) || m < 0 || f < 0) return;
    if (m !== rule.minOrder || f !== rule.deliveryFee) onSave({ minOrder: m, deliveryFee: f });
  };
  const field = 'mt-1 w-full h-9 px-2 rounded-lg border border-gray-200 text-sm bg-white';
  return (
    <div className="mt-2 grid grid-cols-2 gap-2 pl-5">
      <label className="block">
        <span className="text-[11px] font-semibold text-gray-500">Mindestbestellwert (€)</span>
        <input
          inputMode="decimal"
          value={minOrder}
          onChange={(e) => setMinOrder(e.target.value)}
          onBlur={commit}
          aria-label={`Mindestbestellwert bei ${name} in Euro`}
          className={field}
        />
      </label>
      <label className="block">
        <span className="text-[11px] font-semibold text-gray-500">Liefergebühr (€)</span>
        <input
          inputMode="decimal"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          onBlur={commit}
          aria-label={`Liefergebühr bei ${name} in Euro`}
          className={field}
        />
      </label>
    </div>
  );
}

type ConnectForm = { email: string; password: string; code: string; pending?: { tempAuthKey: string; deviceId: string } };

/** Profil → Einkaufen & Shops: Standard-Liste, Metzger-Automatik, Shops verbinden */
export default function ShopSettings() {
  const [state, setState] = useState<ShopState | null>(null);
  const [openShop, setOpenShop] = useState<ShopProvider | null>(null);
  const [form, setForm] = useState<ConnectForm>({ email: '', password: '', code: '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getShopState().then(setState);
  }, []);

  const act = async (key: string, fn: () => Promise<ShopState | void>) => {
    setBusy(key);
    setError(null);
    try {
      const next = await fn();
      if (next) setState(next);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (!state) {
    return (
      <CollapsibleCard storageKey="shops" title="Einkaufen & Shops" icon={<ShoppingBag size={16} />}>
        <div className="p-6 flex justify-center">
          <Loader2 size={18} className="animate-spin text-gray-300" />
        </div>
      </CollapsibleCard>
    );
  }

  const isActive = (id: ShopProvider) => state.activeShops.includes(id) && !!state.connections[id];

  const submitConnect = async (shop: ShopProvider) => {
    if (shop !== 'knuspr' && shop !== 'picnic') return;
    if (form.pending) {
      const ok = await act('connect', () => verifyPicnic(form.email, form.pending!.tempAuthKey, form.pending!.deviceId, form.code));
      if (ok) {
        setOpenShop(null);
        setForm({ email: '', password: '', code: '' });
      }
      return;
    }
    let needs2fa: { tempAuthKey: string; deviceId: string } | null = null;
    const ok = await act('connect', async () => {
      const res = await connectShop(shop, form.email, form.password);
      if ('needs2fa' in res) {
        needs2fa = { tempAuthKey: res.tempAuthKey, deviceId: res.deviceId };
        return;
      }
      return res;
    });
    if (!ok) return;
    if (needs2fa) setForm((f) => ({ ...f, password: '', pending: needs2fa! }));
    else {
      setOpenShop(null);
      setForm({ email: '', password: '', code: '' });
    }
  };

  const connected = SHOPS.filter((s) => isActive(s.id)).map((s) => s.name);

  return (
    <CollapsibleCard
      storageKey="shops"
      title="Einkaufen & Shops"
      icon={<ShoppingBag size={16} />}
      summary={connected.length ? `Verbunden: ${connected.join(', ')}` : 'Kein Shop verbunden'}
    >

      {/* Standard-Liste + Metzger */}
      <div className="px-4 pb-4 space-y-3">
        <label className="block">
          <span className="text-xs font-semibold text-gray-500">Standard-Liste für neue Zutaten</span>
          <select
            value={state.standardLabel}
            onChange={(e) => act('settings', () => saveShopSettings(e.target.value, state.metzgerAuto))}
            className="mt-1 w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm"
          >
            {state.labels
              .filter((l) => l.id !== 'metzger')
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-gray-700">Fleisch & Wurst automatisch zum Metzger</span>
          <input
            type="checkbox"
            checked={state.metzgerAuto}
            onChange={(e) => act('settings', () => saveShopSettings(state.standardLabel, e.target.checked))}
            className="w-5 h-5 accent-green-600"
          />
        </label>
      </div>

      {/* Shops */}
      <ul className="border-t border-gray-100 divide-y divide-gray-100">
        {SHOPS.map((shop) => {
          const active = isActive(shop.id);
          const conn = state.connections[shop.id];
          const expanded = openShop === shop.id;
          return (
            <li key={shop.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: shop.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{shop.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {active ? (conn ? `Verbunden: ${conn.email}` : 'Aktiv') : shop.hint}
                  </p>
                </div>
                {active ? (
                  <button
                    onClick={() => act(`off-${shop.id}`, () => disconnectShop(shop.id))}
                    disabled={busy !== null}
                    className="flex items-center gap-1 px-3 h-8 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600"
                  >
                    {busy === `off-${shop.id}` ? <Loader2 size={12} className="animate-spin" /> : <Unplug size={12} />}
                    Trennen
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setOpenShop(expanded ? null : shop.id);
                      setForm({ email: '', password: '', code: '' });
                      setError(null);
                    }}
                    className="px-3 h-8 rounded-lg text-xs font-semibold bg-green-700 text-white hover:bg-green-800"
                  >
                    {expanded ? 'Abbrechen' : 'Verbinden'}
                  </button>
                )}
              </div>

              {expanded && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitConnect(shop.id);
                  }}
                  className="mt-3 space-y-2"
                >
                  {form.pending ? (
                    <>
                      <p className="text-xs text-gray-600">Picnic hat dir einen SMS-Code geschickt:</p>
                      <input
                        value={form.code}
                        onChange={(e) => setForm({ ...form, code: e.target.value })}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="SMS-Code"
                        aria-label="SMS-Code"
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm"
                      />
                    </>
                  ) : (
                    <>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        autoComplete="username"
                        placeholder={`E-Mail bei ${shop.name}`}
                        aria-label={`E-Mail bei ${shop.name}`}
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm"
                      />
                      <input
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        autoComplete="current-password"
                        placeholder="Passwort"
                        aria-label={`Passwort bei ${shop.name}`}
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm"
                      />
                      <p className="text-[11px] text-gray-500">
                        Wird verschlüsselt gespeichert und nur für die Suche{shop.id === 'knuspr' ? ' und den Warenkorb' : ''} genutzt.
                        Die Anbindung ist inoffiziell und kann jederzeit ausfallen.
                      </p>
                    </>
                  )}
                  <button
                    type="submit"
                    disabled={busy !== null || (form.pending ? !form.code : !form.email || !form.password)}
                    className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-green-700 text-white text-sm font-semibold disabled:bg-green-300"
                  >
                    {busy === 'connect' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {form.pending ? 'Code bestätigen' : 'Verbinden'}
                  </button>
                </form>
              )}
              {active && state.rules?.[shop.id] && (
                <ShopRuleFields
                  name={shop.name}
                  rule={state.rules[shop.id]}
                  onSave={(r) => act(`rule-${shop.id}`, () => saveShopRule(shop.id, r.minOrder, r.deliveryFee))}
                />
              )}
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="px-4 pb-4 text-xs text-red-600">
          {error}
        </p>
      )}
    </CollapsibleCard>
  );
}
