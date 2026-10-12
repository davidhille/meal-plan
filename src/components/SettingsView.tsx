import { useState } from 'react';
import { Settings, Plus, Trash2, Edit2, Calendar } from 'lucide-react';
import { FamilyMember, Profile, Routine } from '../types';
import FamilyMemberModal from './FamilyMemberModal';
import PreferencesModal from './PreferencesModal';
import RoutineModal from './RoutineModal';
import ShopSettings from './ShopSettings';
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
}: SettingsViewProps) {
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [showPrefsModal, setShowPrefsModal] = useState(false);
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);

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
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
          <Settings size={20} className="text-gray-400" />
        </div>
        <p className="text-sm text-gray-500">Profil wird geladen...</p>
      </div>
    );
  }

  return (
    <>
      <div className="px-4 pb-4 space-y-4">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowPlanModal(true)}
            className="bg-green-500 text-white rounded-full h-11 px-4 font-semibold text-sm hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
          >
            <Calendar size={16} />
            Plan erstellen
          </button>
          <button
            onClick={() => setShowRoutineModal(true)}
            className="bg-white text-gray-700 border border-gray-200 rounded-full h-11 px-4 font-semibold text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            Routine
          </button>
        </div>

        {/* Health Preferences Card */}
        <div className="bg-white rounded-2xl shadow-card border border-gray-200/70 overflow-hidden">
          <button
            onClick={() => setShowPrefsModal(true)}
            className="w-full text-left px-4 py-4 hover:bg-gray-50 transition-colors"
          >
            <p className="text-sm font-semibold text-gray-900 mb-2">Gesundheit & Ernährung</p>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Gesundheitsziel</p>
                <p className="text-sm text-gray-700 font-medium">
                  {goalLabels[profile.health_goal] || profile.health_goal}
                </p>
              </div>
              {profile.health_conditions.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Krankheiten & Einschränkungen</p>
                  <div className="flex flex-wrap gap-1">
                    {profile.health_conditions.map((cond) => (
                      <span
                        key={cond}
                        className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded border border-orange-200"
                      >
                        {conditionLabels[cond] || cond}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </button>
        </div>

        {/* Einkaufen & Shops */}
        <ShopSettings />

        {/* Routines Section */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Automatische Routinen</h3>
          {routines.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-card border border-gray-200/70 px-4 py-6 text-center">
              <p className="text-sm text-gray-500">Keine Routinen eingestellt</p>
              <p className="text-xs text-gray-400 mt-1">Tippe + um Routinen hinzuzufügen</p>
            </div>
          ) : (
            <div className="space-y-2">
              {routines.map((routine) => (
                <div
                  key={routine.id}
                  className="bg-white rounded-2xl shadow-card border border-gray-200/70 px-4 py-3 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{routine.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {routine.frequency === 'weekly'
                        ? `Jeden ${routine.day_of_week !== null ? dayNames[routine.day_of_week] : 'Tag'} um ${routine.time}`
                        : `Am 1. jedes Monats um ${routine.time}`}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {routine.duration_days} Tage Planung ab dem Folgetag
                      {routine.last_run_at &&
                        ` · zuletzt ${new Date(routine.last_run_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`}
                    </p>
                  </div>
                  <button
                    onClick={() => onDeleteRoutine(routine.id)}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Family Members Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Familienmitglieder ({familyMembers.length})</h3>
            <button
              onClick={() => setShowFamilyModal(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>

          {familyMembers.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-card border border-gray-200/70 px-4 py-6 text-center">
              <p className="text-sm text-gray-500">Keine Familienmitglieder hinzugefügt</p>
              <p className="text-xs text-gray-400 mt-1">Tippe + um Mitglieder hinzuzufügen</p>
            </div>
          ) : (
            <div className="space-y-2">
              {familyMembers.map((member) => (
                <div
                  key={member.id}
                  className="bg-white rounded-2xl shadow-card border border-gray-200/70 px-4 py-3 flex items-start gap-3"
                >
                  <button onClick={() => setEditingMember(member)} className="flex-1 min-w-0 text-left" title="Bearbeiten">
                    <p className="text-sm font-semibold text-gray-900">
                      {member.name}
                      {member.type === 'child' && member.age && (
                        <span className="text-xs text-gray-400 ml-2">{member.age} Jahre</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {member.type === 'adult' ? 'Erwachsener' : 'Kind'}
                    </p>
                    {member.favorite_foods.length > 0 && (
                      <p className="text-xs text-green-600 mt-1">
                        Mag: {member.favorite_foods.join(', ')}
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
                    aria-label="Bearbeiten"
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => onDeleteFamilyMember(member.id)}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Card */}
        <div className="bg-sand border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-900">
          <p className="font-medium mb-1">Wie werden deine Einstellungen genutzt?</p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-800">
            <li>Meal-Auswahl berücksichtigt Alter und Vorlieben</li>
            <li>Gerichte mit gemochtem Essen werden bevorzugt</li>
            <li>Allergien & Krankheiten sind ausgeschlossen</li>
            <li>Bewertungen beeinflussen zukünftige Auswahl</li>
            <li>Routinen erstellen automatisch neue Pläne</li>
          </ul>
        </div>
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
