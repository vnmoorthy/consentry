import type { PolicyRule, Recipient, Settings, Stats, VaultItem } from './types';

const T0 = Date.UTC(2026, 9, 1);

/** Demo persona. All values are fictional (555-01xx phone, example.com email, Stripe test card, the famous void SSN 078-05-1120). */
export function seedVault(): VaultItem[] {
  const base = { createdAt: T0, updatedAt: T0 };
  return [
    { id: 'v_name', key: 'full_name', label: 'Full name', category: 'identity.name', value: 'Maya Rivera', sensitivity: 2, meta: { first: 'Maya', last: 'Rivera' }, ...base },
    { id: 'v_email', key: 'email', label: 'Personal email', category: 'contact.email', value: 'maya.rivera@example.com', sensitivity: 2, ...base },
    { id: 'v_phone', key: 'phone', label: 'Mobile phone', category: 'contact.phone', value: '+1 (415) 555-0142', sensitivity: 3, ...base },
    {
      id: 'v_home', key: 'home_address', label: 'Home address', category: 'location.precise', value: '88 Larkspur Alley, Apt 3, San Francisco, CA 94110', sensitivity: 4,
      keywords: ['88 larkspur', 'larkspur alley'],
      meta: { street: '88 Larkspur Alley', city: 'San Francisco', state: 'CA', zip: '94110', neighborhood: 'Mission District', intersection: 'Larkspur Alley & 18th St', lat: 37.7612, lon: -122.4148 },
      ...base,
    },
    {
      id: 'v_gps', key: 'home_location', label: 'Home GPS', category: 'location.precise', value: '37.7612,-122.4148', sensitivity: 4,
      meta: { city: 'San Francisco', state: 'CA', zip: '94110', neighborhood: 'Mission District', intersection: 'Larkspur Alley & 18th St', lat: 37.7612, lon: -122.4148 },
      ...base,
    },
    { id: 'v_dob', key: 'date_of_birth', label: 'Date of birth', category: 'identity.dob', value: '1991-04-12', sensitivity: 3, ...base },
    { id: 'v_ssn', key: 'ssn', label: 'Social Security Number', category: 'identity.gov_id', value: '078-05-1120', sensitivity: 5, ...base },
    { id: 'v_card', key: 'card', label: 'Visa (personal)', category: 'financial.card', value: '4242 4242 4242 4242', sensitivity: 5, meta: { brand: 'Visa' }, ...base },
    { id: 'v_asthma', key: 'condition_asthma', label: 'Asthma', category: 'health.condition', value: 'Asthma (moderate persistent)', sensitivity: 4, keywords: ['asthma', 'asthmatic'], ...base },
    { id: 'v_albuterol', key: 'med_albuterol', label: 'Rescue inhaler', category: 'health.medication', value: 'Albuterol HFA inhaler (ProAir)', sensitivity: 4, keywords: ['albuterol', 'proair', 'ventolin', 'salbutamol'], ...base },
    { id: 'v_flovent', key: 'med_fluticasone', label: 'Controller inhaler', category: 'health.medication', value: 'Fluticasone 110 mcg (Flovent HFA)', sensitivity: 4, keywords: ['fluticasone', 'flovent'], ...base },
    { id: 'v_sertraline', key: 'med_sertraline', label: 'Anxiety medication', category: 'health.mental', value: 'Sertraline 50 mg (anxiety)', sensitivity: 5, keywords: ['sertraline', 'zoloft'], ...base },
    { id: 'v_peanut', key: 'allergy_peanut', label: 'Food allergy', category: 'health.allergy', value: 'Severe peanut allergy (carries EpiPen)', sensitivity: 3, keywords: ['peanut allergy', 'nut allergy', 'epipen'], meta: { dietary: 'Peanut-free meal required' }, ...base },
    { id: 'v_vin', key: 'car_vin', label: 'Car VIN (2003 Honda Accord)', category: 'vehicle.vin', value: '1HGCM82633A004352', sensitivity: 2, ...base },
    { id: 'v_employer', key: 'employer', label: 'Employer', category: 'identity.employment', value: 'Lumen Health, Inc.', sensitivity: 2, keywords: ['lumen health'], ...base },
  ];
}

export function seedRecipients(): Recipient[] {
  return [
    { id: 'claude', name: 'Claude (LLM)', domain: 'api.anthropic.com', tier: 'llm', description: 'The model that plans and writes for your agent.', retention: 'Per your Anthropic org settings', color: '#d4a27f', emoji: '✳️' },
    { id: 'open-meteo', name: 'Open-Meteo', domain: 'api.open-meteo.com', tier: 'open-data', description: 'Open-source weather, air quality and geocoding APIs.', retention: 'No account; standard request logs', color: '#2dd4bf', emoji: '🌤️' },
    { id: 'nws', name: 'National Weather Service', domain: 'api.weather.gov', tier: 'public-sector', description: 'Official US weather alerts (NOAA).', retention: 'Federal logs; no account', color: '#38bdf8', emoji: '⛈️' },
    { id: 'usgs', name: 'USGS Earthquakes', domain: 'earthquake.usgs.gov', tier: 'public-sector', description: 'Real-time seismic events from the US Geological Survey.', retention: 'Federal logs; no account', color: '#0ea5e9', emoji: '🌋' },
    { id: 'nhtsa', name: 'NHTSA', domain: 'api.nhtsa.gov', tier: 'public-sector', description: 'Vehicle decoding and safety recalls (US DOT).', retention: 'Federal logs; no account', color: '#60a5fa', emoji: '🚗' },
    { id: 'openfda', name: 'openFDA', domain: 'api.fda.gov', tier: 'public-sector', description: 'Drug & food recalls and drug labels (US FDA).', retention: 'Federal logs; no account', color: '#818cf8', emoji: '💊' },
    { id: 'fema', name: 'OpenFEMA', domain: 'www.fema.gov', tier: 'public-sector', description: 'Federal disaster declarations.', retention: 'Federal logs; no account', color: '#93c5fd', emoji: '🚨' },
    { id: 'wikipedia', name: 'Wikipedia', domain: 'en.wikipedia.org', tier: 'open-data', description: 'Encyclopedia summaries via the Wikimedia REST API.', retention: 'Wikimedia privacy policy', color: '#e5e7eb', emoji: '📚' },
    { id: 'bitefinder', name: 'BiteFinder', domain: 'api.bitefinder.example', tier: 'partner', simulated: true, description: 'Restaurant discovery & reviews (simulated partner).', retention: 'Claims 13 months; shares with ad partners', color: '#fb923c', emoji: '🍜' },
    { id: 'tabletap', name: 'TableTap', domain: 'api.tabletap.example', tier: 'partner', simulated: true, description: 'Restaurant reservations (simulated partner).', retention: 'Claims 24 months', color: '#f59e0b', emoji: '🍽️' },
    { id: 'ridenow', name: 'RideNow', domain: 'api.ridenow.example', tier: 'partner', simulated: true, description: 'Ride hailing (simulated partner).', retention: 'Claims 7 years for trip records', color: '#facc15', emoji: '🚕' },
    { id: 'medimart', name: 'MediMart Pharmacy', domain: 'api.medimart.example', tier: 'partner', simulated: true, description: 'Prescription refills & delivery (simulated partner).', retention: 'HIPAA-covered entity', color: '#a3e635', emoji: '🏥' },
    { id: 'quickquote', name: 'QuickQuote Insurance', domain: 'api.quickquote.example', tier: 'partner', simulated: true, description: 'Instant insurance quotes (simulated partner that over-collects).', retention: 'Sells "anonymized" data to brokers', color: '#f97316', emoji: '📋' },
    { id: 'unknown', name: 'Unknown destination', domain: '*', tier: 'unknown', description: 'Any domain Consentry has never verified.', retention: 'Unknown', color: '#f43f5e', emoji: '❓' },
  ];
}

type R = Omit<PolicyRule, 'createdAt' | 'enabled' | 'source' | 'hits'>;

const DEFAULT_RULES: R[] = [
  // ── Hard lines ──────────────────────────────────────────────
  { id: 'p_govid', title: 'Never share government IDs (like my SSN) with anyone.', match: { categories: ['identity.gov_id'] }, effect: 'deny', priority: 1000, hard: true },
  { id: 'p_secrets', title: 'Never share passwords, API keys or tokens.', match: { categories: ['secret.credential'] }, effect: 'deny', priority: 1000, hard: true },
  { id: 'p_unknown', title: 'Never send personal data to unknown or unverified destinations.', match: { categories: ['*'], tiers: ['unknown'] }, effect: 'deny', priority: 1000, hard: true },
  { id: 'p_mental', title: 'Mental-health information never leaves this device.', match: { categories: ['health.mental'] }, effect: 'deny', priority: 990, hard: true },
  { id: 'p_marketing', title: 'Never share personal data for marketing.', match: { categories: ['*'], purposes: ['marketing'] }, effect: 'deny', priority: 980, hard: true },

  // ── The LLM is a recipient too ──────────────────────────────
  { id: 'p_llm_health', title: 'Claude may see my health conditions and allergies so it can reason about my requests.', match: { categories: ['health.condition', 'health.allergy', 'health.medication'], tiers: ['llm'] }, effect: 'allow', priority: 700 },
  { id: 'p_llm_coarse', title: 'Claude may see my city.', match: { categories: ['location.coarse'], tiers: ['llm'] }, effect: 'allow', priority: 700 },
  { id: 'p_llm_tokens', title: 'Claude sees everything else as vault tokens — never raw values.', match: { categories: ['*'], tiers: ['llm'] }, effect: 'minimize', transform: 'token', priority: 650 },

  // ── Health ──────────────────────────────────────────────────
  { id: 'p_pharmacy', title: 'Ask before my pharmacy gets my medications for a refill.', match: { categories: ['health.medication'], recipients: ['medimart'], purposes: ['fulfillment'] }, effect: 'ask', priority: 640 },
  { id: 'p_allergy_res', title: 'Ask before telling restaurants about allergies — and share it as a dietary need, not a diagnosis.', match: { categories: ['health.allergy'], tiers: ['partner'], purposes: ['reservation'] }, effect: 'ask', transform: 'dietary-need', priority: 620 },
  { id: 'p_health_partner', title: 'Never share health data with commercial partners.', match: { categories: ['health'], tiers: ['partner'] }, effect: 'deny', priority: 600 },
  { id: 'p_health_gov', title: 'Ask before health details go to public health APIs like openFDA.', match: { categories: ['health'], tiers: ['public-sector'] }, effect: 'ask', priority: 500 },
  { id: 'p_health_open', title: 'Weather and open-data services never get my health data.', match: { categories: ['health'], tiers: ['open-data'] }, effect: 'deny', priority: 500 },
  { id: 'p_inferred_partner', title: 'Ask if a query to a company could reveal my health.', match: { categories: ['inferred.health'], tiers: ['partner'] }, effect: 'ask', priority: 450 },
  { id: 'p_inferred_public', title: 'Health-related search terms are OK for account-less public APIs.', match: { categories: ['inferred.health'], tiers: ['public-sector', 'open-data'] }, effect: 'allow', priority: 300 },

  // ── Location ────────────────────────────────────────────────
  { id: 'p_loc_ride', title: 'Ask before sharing my exact address with ride services.', match: { categories: ['location.precise'], tiers: ['partner'], purposes: ['transport'] }, effect: 'ask', transform: 'intersection', priority: 560 },
  { id: 'p_loc_public', title: 'Weather, maps and government APIs only get my approximate location (~10 km).', match: { categories: ['location.precise'], tiers: ['public-sector', 'open-data'] }, effect: 'minimize', transform: 'coarse-location', priority: 400 },
  { id: 'p_loc_partner', title: 'Partners get my neighborhood, never my street address.', match: { categories: ['location.precise'], tiers: ['partner'] }, effect: 'minimize', transform: 'neighborhood', priority: 400 },
  { id: 'p_coarse', title: 'My city or ZIP code is fine to share.', match: { categories: ['location.coarse'] }, effect: 'allow', priority: 150 },

  // ── Contact & identity ──────────────────────────────────────
  { id: 'p_contact_alias', title: 'Partners get relay aliases for my email and phone — never the real ones.', match: { categories: ['contact'], tiers: ['partner'] }, effect: 'minimize', transform: 'alias', priority: 400 },
  { id: 'p_contact_public', title: 'Public data APIs never need my contact info.', match: { categories: ['contact', 'identity.name', 'identity.dob', 'identity.employment'], tiers: ['public-sector', 'open-data'] }, effect: 'deny', priority: 300 },
  { id: 'p_name_booking', title: 'Share my name with partners for reservations, rides and orders.', match: { categories: ['identity.name'], tiers: ['partner'], purposes: ['reservation', 'transport', 'fulfillment'] }, effect: 'allow', priority: 420 },
  { id: 'p_name_partner', title: 'Ask before any other company gets my name.', match: { categories: ['identity.name'], tiers: ['partner'] }, effect: 'ask', priority: 300 },
  { id: 'p_dob_pharmacy', title: 'Ask before my pharmacy gets my date of birth.', match: { categories: ['identity.dob'], recipients: ['medimart'], purposes: ['fulfillment'] }, effect: 'ask', priority: 560 },
  { id: 'p_dob_partner', title: 'Partners get my age range, never my birthday.', match: { categories: ['identity.dob'], tiers: ['partner'] }, effect: 'minimize', transform: 'age-range', priority: 400 },
  { id: 'p_employer', title: 'Keep my employer private.', match: { categories: ['identity.employment'], tiers: ['partner'] }, effect: 'deny', priority: 300 },

  // ── Money ───────────────────────────────────────────────────
  { id: 'p_card_virtual', title: 'Pay partners with a single-use virtual card — never my real card number.', match: { categories: ['financial.card'], tiers: ['partner'], purposes: ['payment', 'reservation', 'transport', 'fulfillment'] }, effect: 'minimize', transform: 'virtual-card', priority: 560 },
  { id: 'p_card_never', title: 'My real card number never leaves the vault.', match: { categories: ['financial.card'] }, effect: 'deny', priority: 500 },

  // ── Vehicle ─────────────────────────────────────────────────
  { id: 'p_vin_nhtsa', title: 'Share my VIN with NHTSA to check safety recalls.', match: { categories: ['vehicle.vin'], recipients: ['nhtsa'] }, effect: 'allow', priority: 500 },
  { id: 'p_vin_other', title: 'Ask before anyone else gets my VIN.', match: { categories: ['vehicle.vin'] }, effect: 'ask', priority: 300 },

  // ── Catch-all ───────────────────────────────────────────────
  { id: 'p_default', title: 'Ask me about anything not covered above.', match: { categories: ['*'] }, effect: 'ask', priority: 0 },
];

export function seedPolicies(): PolicyRule[] {
  return DEFAULT_RULES.map((r) => ({ ...r, enabled: true, source: 'default', createdAt: T0, hits: 0 }));
}

export function seedStats(): Stats {
  return { inspected: 0, shared: 0, minimized: 0, withheld: 0, blocked: 0, consentAsked: 0, threats: 0, tokenized: 0 };
}

export function seedSettings(): Omit<Settings, 'hasApiKey' | 'keySource'> {
  return { agentMode: 'autopilot', model: 'claude-opus-5-5', effort: 'low', compromisedAgent: false, poisonPartners: false, consentTimeoutSec: 180 };
}
