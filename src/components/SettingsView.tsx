import { useState } from 'react';
import { Settings, Plus, Trash2, Edit2, Calendar, HeartPulse, Repeat, Users, Info } from 'lucide-react';
import { FamilyMember, Profile, Routine } from '../types';
import FamilyMemberModal from './FamilyMemberModal';
import PreferencesModal from './PreferencesModal';
import RoutineModal from './RoutineModal';
import ShopSettings from './ShopSettings';
import LabelSettings from './LabelSettings';
import FilterSettings from './FilterSettings';
import ReminderSettings from './ReminderSettings';
import CollapsibleCard from './CollapsibleCard';
import PlanCreationModal from './PlanCreationModal';

interface SettingsViewProps {
  profile: Profile | null;
  familyMembers: FamilyMember[];
  routines: Routine[];
  onUpdateProfile: (goal: string, conditions: string[]) => Promise<void>;
  onAddFamilyMember: (member: Omit<FamilyMember, 'id' | 'profile_id' | 'created_at'>) => Promise<void>;
  onUpdateFamilyMember: (id: string, member: Omit<FamilyMember, 'id' | 'profile_id' | 'created_at'>) => Promise<void>;
  onDeleteFamilyMember: (id: string) => Promise<void>;
  onCreateRoutine: (
    name: string,
    frequency: 'weekly' | 'monthly',
    dayOfWeek: number | null,
    time: string | null,
    durationDays: number
  ) => Promise<void>;
  onDeleteRoutine: (id: string) => Promise<void>;
  onCreatePlan: (startDate: string, endDate: string) => Promise<void>;
  /** Uhrzeit der Erinnerung geändert */
  onReminderTimeChange?: (time: string) => void;
}

export default function SettingsView({
  profile,
  familyMembers,
  routines,
  onUpdateProfile,
  onAddFamilyMember,
  onUpdateFamilyMember,
  onDeleteFamilyMember,
  onCreateRoutine,
  onDeleteRoutine,
  onCreatePlan,
  onReminderTimeChange,
}: SettingsViewProps) {
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [showPrefsModal, setShowPrefsModal] = useState(false);
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  // Löschen erst nach zweitem Tipp ("Löschen?")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const goalLabels: Record<string, string> = {
    balanced: 'Ausgewogene Ernährung',
    weight_loss: 'Gewichtsabnahme',
    muscle_gain: 'Muskelaufbau',
    healthy_lifestyle: 'Gesunder Lebensstil',
  };

  const conditionLabels: Record<string, string> = {
    diabetes: 'Diabetes',
    gluten_free: 'Glutenfrei',
    lactose_intolerant: 'Laktoseintolerant',
    nut_allergy: 'Nussallergie',
    vegetarian: 'Vegetarisch',
    vegan: 'Vegan',
    kosher: 'Koscher',
    halal: 'Halal',
  };

  const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  if (!profile) {
    return (
      <div className="px-4 py-8 flex flex-col items-center justify-center gap-3 text-center">
        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
          <Settings size={20} className="text-gray-500" />
        </div>
        <p className="text-sm text-gray-500">Profil wird geladen …</p>
      </div>
    );
  }

  return (
    <>
      <div className="px-4 py-4 space-y-4">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowPlanModal(true)}
            className="bg-brand-700 text-white rounded-xl px-4 py-3 font-medium text-sm hover:bg-brand-800 transition-colors flex items-center justify-center gap-2"
          >
            <Calendar size={16} />
            Plan erstellen
          </button>
          <button
            onClick={() => setShowRoutineModal(true)}
            className="bg-white text-gray-700 border border-gray-200 rounded-xl px-4 py-3 font-medium text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            Routine anlegen
          </button>
        </div>

        {/* Gesundheit & Ernährung */}
        <CollapsibleCard
          storageKey="gesundheit"
          title="Gesundheit & Ernährung"
          icon={<HeartPulse size={16} />}
          summary={[goalLabels[profile.health_goal] || profile.health_goal, ...profile.health_conditions.map((c) => conditionLabels[c] || c)].join(' · ')}
          action={
            <button
              onClick={() => setShowPrefsModal(true)}
              aria-label="Gesundheit & Ernährung bearbeiten"
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"
            >
              <Edit2 size={14} />
            </button>
          }
        >
          <button onClick={() => setShowPrefsModal(true)} className="w-full text-left px-4 pb-4 hover:bg-gray-50 transition-colors">
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Gesundheitsziel</p>
                <p className="text-sm text-gray-700 font-medium">{goalLabels[profile.health_goal] || profile.health_goal}</p>
              </div>
              {profile.health_conditions.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Krankheiten & Einschränkungen</p>
                  <div className="flex flex-wrap gap-1">
                    {profile.health_conditions.map((cond) => (
                      <span key={cond} className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded border border-orange-200">
                        {conditionLabels[cond] || cond}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </button>
        </CollapsibleCard>

        {/* Einkaufen & Shops */}
        <ShopSettings />
        <LabelSettings />

        {/* Eigene Filter für die Rezept-Übersicht */}
        <FilterSettings />

        {/* Push-Erinnerung zum Bewerten */}
        <ReminderSettings onTimeChange={onReminderTimeChange} />

        {/* Routines Section */}
        <CollapsibleCard
          storageKey="routinen"
          title="Automatische Routinen"
          icon={<Repeat size={16} />}
          summary={routines.length ? routines.map((r) => r.name).join(', ') : 'Keine Routinen'}
          action={
            <button
              onClick={() => setShowRoutineModal(true)}
              aria-label="Routine anlegen"
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-brand-700 text-white hover:bg-brand-800"
            >
              <Plus size={16} />
            </button>
          }
        >
          <div className="px-3 pb-3">
          {routines.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-gray-500">Keine Routinen eingestellt</p>
              <p className="text-xs text-gray-500 mt-1">Mit „Routine anlegen“ entsteht jede Woche automatisch ein neuer Plan.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {routines.map((routine) => (
                <div
                  key={routine.id}
                  className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{routine.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {routine.frequency === 'weekly'
                        ? `Jeden ${routine.day_of_week !== null ? dayNames[routine.day_of_week] : 'Tag'} um ${routine.time}`
                        : `Am 1. jedes Monats um ${routine.time}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {routine.duration_days} Tage Planung ab dem Folgetag
                      {routine.last_run_at &&
                        ` · zuletzt ${new Date(routine.last_run_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`}
                    </p>
                  </div>
                  {confirmDeleteId === routine.id ? (
                    <button
                      autoFocus
                      onClick={() => onDeleteRoutine(routine.id)}
                      onBlur={() => setConfirmDeleteId(null)}
                      className="flex-shrink-0 px-3 h-8 rounded-lg text-xs font-semibold text-white bg-red-600"
                    >
                      Löschen?
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(routine.id)}
                      aria-label={`Routine ${routine.name} löschen`}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        </CollapsibleCard>

        {/* Family Members Section */}
        <CollapsibleCard
          storageKey="familie"
          title={`Familienmitglieder (${familyMembers.length})`}
          icon={<Users size={16} />}
          summary={familyMembers.length ? familyMembers.map((m) => m.name).join(', ') : 'Noch niemand eingetragen'}
          action={
            <button
              onClick={() => setShowFamilyModal(true)}
              aria-label="Familienmitglied hinzufügen"
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors"
            >
              <Plus size={16} />
            </button>
          }
        >
          <div className="px-3 pb-3">
          {familyMembers.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-gray-500">Keine Familienmitglieder hinzugefügt</p>
              <p className="text-xs text-gray-500 mt-1">Tippe auf +, damit Portionen und Vorlieben passen.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {familyMembers.map((member) => (
                <div
                  key={member.id}
                  className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3 flex items-start gap-3"
                >
                  <button onClick={() => setEditingMember(member)} className="flex-1 min-w-0 text-left" title="Bearbeiten">
                    <p className="text-sm font-semibold text-gray-900">
                      {member.name}
                      {member.type === 'child' && member.age && (
                        <span className="text-xs text-gray-500 ml-2">{member.age} Jahre</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {member.type === 'adult' ? 'Erwachsener' : 'Kind'}
                    </p>
                    {member.favorite_foods.length > 0 && (
                      <p className="text-xs text-brand-700 mt-1">
                        Isst gern: {member.favorite_foods.join(', ')}
                      </p>
                    )}
                    {member.disliked_foods.length > 0 && (
                      <p className="text-xs text-red-600 mt-0.5">
                        Mag nicht: {member.disliked_foods.join(', ')}
                      </p>
                    )}
                  </button>
                  <button
                    onClick={() => setEditingMember(member)}
                    aria-label={`${member.name} bearbeiten`}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                  {confirmDeleteId === member.id ? (
                    <button
                      autoFocus
                      onClick={() => onDeleteFamilyMember(member.id)}
                      onBlur={() => setConfirmDeleteId(null)}
                      className="flex-shrink-0 px-3 h-8 rounded-lg text-xs font-semibold text-white bg-red-600"
                    >
                      Löschen?
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(member.id)}
                      aria-label={`${member.name} löschen`}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        </CollapsibleCard>

        {/* Info Card */}
        <CollapsibleCard storageKey="info" title="Wie werden deine Einstellungen genutzt?" icon={<Info size={16} />}>
          <ul className="list-disc pl-8 pr-4 pb-4 space-y-0.5 text-xs text-gray-600">
            <li>Portionen richten sich nach Alter der Familienmitglieder</li>
            <li>Gerichte, die jemand gern isst, kommen öfter</li>
            <li>Unpassendes bei Allergien & Einschränkungen fällt weg</li>
            <li>Gut bewertete Gerichte kommen öfter</li>
            <li>Routinen erstellen automatisch neue Pläne</li>
          </ul>
        </CollapsibleCard>
      </div>

      {/* Modals */}
      {(showFamilyModal || editingMember) && (
        <FamilyMemberModal
          member={editingMember ?? undefined}
          onSave={async (member) => {
            if (editingMember) await onUpdateFamilyMember(editingMember.id, member);
            else await onAddFamilyMember(member);
            setShowFamilyModal(false);
            setEditingMember(null);
          }}
          onClose={() => {
            setShowFamilyModal(false);
            setEditingMember(null);
          }}
        />
      )}

      {showPrefsModal && (
        <PreferencesModal
          healthGoal={profile.health_goal}
          healthConditions={profile.health_conditions}
          onSave={async (goal, conditions) => {
            await onUpdateProfile(goal, conditions);
            setShowPrefsModal(false);
          }}
          onClose={() => setShowPrefsModal(false)}
        />
      )}

      {showRoutineModal && (
        <RoutineModal
          onSave={onCreateRoutine}
          onClose={() => setShowRoutineModal(false)}
        />
      )}

      {showPlanModal && (
        <PlanCreationModal
          onCreate={onCreatePlan}
          onClose={() => setShowPlanModal(false)}
        />
      )}
    </>
  );
}
