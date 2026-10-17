import { Download } from 'lucide-react';
import { MealPlan, PlanMeal } from '../types';
import { formatShortDate } from '../lib/dateUtils';
import { exportPlan } from '../lib/planExport';
import ConfirmDialog from './ConfirmDialog';

interface ReplacePlanDialogProps {
  plan: MealPlan;
  meals: PlanMeal[];
  portions: number;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  /** Statt ersetzen: laufenden Plan auf den neuen Zeitraum verlängern (geplante Tage bleiben) */
  onExtend?: () => Promise<void>;
  onClose: () => void;
}

/** Rückfrage, bevor ein neuer Plan den laufenden ersetzt – mit Möglichkeit, ihn vorher herunterzuladen */
export default function ReplacePlanDialog({ plan, meals, portions, confirmLabel, onConfirm, onExtend, onClose }: ReplacePlanDialogProps) {
  const count = meals.filter((m) => !m.rejected).length;
  return (
    <ConfirmDialog
      title="Aktuellen Plan ersetzen?"
      message={
        <>
          <span className="block">
            Dein Plan vom <strong>{formatShortDate(plan.start_date)}</strong> bis <strong>{formatShortDate(plan.end_date)}</strong> mit{' '}
            {count} {count === 1 ? 'Gericht' : 'Gerichten'} wird ersetzt. Hast du dafür schon eingekauft, brauchst du die Rezepte
            vielleicht noch.
          </span>
          {onExtend && (
            <span className="block mt-2">
              <strong>Plan verlängern</strong> behält alle geplanten Tage – auch verschobene Gerichte und bewusst leere Tage – und
              füllt nur die freien Tage im neuen Zeitraum.
            </span>
          )}
          <button
            type="button"
            onClick={() => exportPlan(plan, meals, portions)}
            className="mt-3 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100"
          >
            <Download size={14} aria-hidden="true" />
            Vorher herunterladen
          </button>
        </>
      }
      confirmLabel={confirmLabel}
      onConfirm={onConfirm}
      danger={!!onExtend}
      secondaryLabel={onExtend ? 'Plan verlängern – geplante Tage behalten' : undefined}
      onSecondary={onExtend}
      onClose={onClose}
    />
  );
}
