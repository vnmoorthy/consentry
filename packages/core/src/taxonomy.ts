import type { CategoryId, Purpose, Tier } from './types';

export interface CategoryInfo {
  id: CategoryId;
  label: string;
  group: 'Identity' | 'Contact' | 'Location' | 'Health' | 'Financial' | 'Vehicle' | 'Inferred' | 'Secrets';
  sensitivity: 1 | 2 | 3 | 4 | 5;
  icon: string; // lucide icon name, resolved by the UI
  color: string;
}

export const CATEGORIES: Record<CategoryId, CategoryInfo> = {
  'identity.name': { id: 'identity.name', label: 'Name', group: 'Identity', sensitivity: 2, icon: 'user', color: '#a78bfa' },
  'identity.dob': { id: 'identity.dob', label: 'Date of birth', group: 'Identity', sensitivity: 3, icon: 'cake', color: '#c084fc' },
  'identity.gov_id': { id: 'identity.gov_id', label: 'Government ID', group: 'Identity', sensitivity: 5, icon: 'fingerprint', color: '#f472b6' },
  'identity.employment': { id: 'identity.employment', label: 'Employer', group: 'Identity', sensitivity: 2, icon: 'briefcase', color: '#818cf8' },
  'contact.email': { id: 'contact.email', label: 'Email', group: 'Contact', sensitivity: 2, icon: 'mail', color: '#60a5fa' },
  'contact.phone': { id: 'contact.phone', label: 'Phone', group: 'Contact', sensitivity: 3, icon: 'phone', color: '#38bdf8' },
  'location.precise': { id: 'location.precise', label: 'Precise location', group: 'Location', sensitivity: 4, icon: 'map-pin', color: '#2dd4bf' },
  'location.coarse': { id: 'location.coarse', label: 'Approximate location', group: 'Location', sensitivity: 1, icon: 'map', color: '#5eead4' },
  'health.condition': { id: 'health.condition', label: 'Health condition', group: 'Health', sensitivity: 4, icon: 'heart-pulse', color: '#fb7185' },
  'health.medication': { id: 'health.medication', label: 'Medication', group: 'Health', sensitivity: 4, icon: 'pill', color: '#f43f5e' },
  'health.allergy': { id: 'health.allergy', label: 'Allergy', group: 'Health', sensitivity: 3, icon: 'wheat-off', color: '#fda4af' },
  'health.mental': { id: 'health.mental', label: 'Mental health', group: 'Health', sensitivity: 5, icon: 'brain', color: '#e11d48' },
  'financial.card': { id: 'financial.card', label: 'Payment card', group: 'Financial', sensitivity: 5, icon: 'credit-card', color: '#fbbf24' },
  'vehicle.vin': { id: 'vehicle.vin', label: 'Vehicle VIN', group: 'Vehicle', sensitivity: 2, icon: 'car', color: '#a3e635' },
  'inferred.health': { id: 'inferred.health', label: 'Health signal in query', group: 'Inferred', sensitivity: 2, icon: 'scan-search', color: '#fdba74' },
  'secret.credential': { id: 'secret.credential', label: 'Secret / credential', group: 'Secrets', sensitivity: 5, icon: 'key-round', color: '#f87171' },
};

export const TIERS: Record<Tier, { label: string; description: string; color: string }> = {
  self: { label: 'On-device', description: 'Runs inside Consentry on your device', color: '#34d399' },
  llm: { label: 'LLM provider', description: 'The model that reasons for your agent', color: '#a78bfa' },
  'public-sector': { label: 'Public sector', description: 'Government open-data APIs (.gov)', color: '#38bdf8' },
  'open-data': { label: 'Open data', description: 'Free, account-less public data services', color: '#2dd4bf' },
  partner: { label: 'Commercial partner', description: 'Companies that act on your behalf', color: '#fbbf24' },
  unknown: { label: 'Unknown', description: 'Unverified destinations', color: '#f43f5e' },
};

export const PURPOSES: Record<Purpose, string> = {
  lookup: 'Information lookup',
  safety: 'Safety & recalls',
  reservation: 'Reservation',
  transport: 'Transportation',
  payment: 'Payment',
  fulfillment: 'Order fulfillment',
  reasoning: 'Agent reasoning',
  marketing: 'Marketing',
  unspecified: 'Unspecified',
};

export function categoryMatches(ruleCat: string, cat: CategoryId): boolean {
  if (ruleCat === '*') return true;
  if (ruleCat === cat) return true;
  return cat.startsWith(ruleCat + '.');
}

export function categorySpecificity(ruleCat: string): number {
  if (ruleCat === '*') return 0;
  return ruleCat.includes('.') ? 2 : 1;
}
