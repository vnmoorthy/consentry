import type { ToolContext, ToolDef, ToolResultData } from '../types';
import { truncate } from '../util';

const UA = { Accept: 'application/json' };

async function getJson(ctx: ToolContext, url: string, headers: Record<string, string> = {}): Promise<any> {
  const res = await ctx.fetch(url, { headers: { ...UA, ...headers }, signal: ctx.signal });
  if (res.status === 404) return { __notFound: true };
  if (!res.ok) throw new Error(`${new URL(url).hostname} responded ${res.status}`);
  return res.json();
}

export function parseLocation(v: unknown): { lat: number; lon: number } | null {
  if (typeof v !== 'string') return null;
  const m = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(v);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lon = parseFloat(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

const fail = (error: string): ToolResultData => ({ ok: false, error, summary: error });

export const WMO: Record<number, string> = {
  0: 'Clear sky', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Freezing fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains', 80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers',
  85: 'Snow showers', 86: 'Heavy snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Severe thunderstorm',
};

const locationProp = { type: 'string', description: 'Coordinates as "lat,lon", or a vault token such as {{vault:home_location}}.' };

export const geocodePlace: ToolDef = {
  name: 'geocode_place',
  title: 'Find a place',
  description: 'Resolve a place name (park, city, landmark) to coordinates using the Open-Meteo geocoder.',
  recipientId: 'open-meteo',
  purpose: 'lookup',
  endpoint: 'geocoding-api.open-meteo.com/v1/search',
  limits: 'Picks the best-known match, so an ambiguous place name can land in the wrong spot.',
  requiredArgs: ['query'],
  inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Place name, e.g. "Yosemite"' }, region_hint: { type: 'string', description: 'Optional state/country to prefer, e.g. "California"' } }, required: ['query'] },
  async run(args, ctx) {
    const q = String(args.query ?? '').trim();
    if (!q) return fail('No place name given');
    const hint = String(args.region_hint ?? '').toLowerCase();
    const queries = [q];
    if (!/park|city|county|lake|mount|beach/i.test(q) && q.split(/\s+/).length <= 3) queries.push(`${q} National Park`);
    const lists = await Promise.all(queries.map((qq) => getJson(ctx, `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(qq)}&count=8&language=en&format=json`).then((d) => d.results ?? []).catch(() => [])));
    const all = lists.flat();
    if (!all.length) return fail(`No place found for "${q}"`);
    const score = (r: any) =>
      (r.feature_code === 'PRK' ? 6 : 0) + (r.country_code === 'US' ? 2 : 0) + (hint && String(r.admin1 ?? '').toLowerCase().includes(hint) ? 4 : 0) +
      (String(r.name).toLowerCase() === q.toLowerCase() ? 1 : 0) + Math.log10((r.population ?? 0) + 10) * 0.6;
    const best = all.sort((a: any, b: any) => score(b) - score(a))[0];
    const data = { name: best.name, region: best.admin1, country: best.country, lat: Number(best.latitude.toFixed(4)), lon: Number(best.longitude.toFixed(4)), kind: best.feature_code, timezone: best.timezone };
    return { ok: true, data, summary: `${data.name}, ${data.region ?? data.country} → ${data.lat}, ${data.lon}` };
  },
};

export const weatherForecast: ToolDef = {
  name: 'weather_forecast',
  title: 'Weather forecast',
  description: '7-day forecast and current conditions for coordinates (Open-Meteo). Temperatures in °F, wind in mph.',
  recipientId: 'open-meteo',
  purpose: 'lookup',
  endpoint: 'api.open-meteo.com/v1/forecast',
  limits: 'A model forecast on a roughly 11 km grid; less reliable beyond 3 days.',
  requiredArgs: ['location'],
  inputSchema: { type: 'object', properties: { location: locationProp }, required: ['location'] },
  async run(args, ctx) {
    const loc = parseLocation(args.location);
    if (!loc) return fail('Location must be "lat,lon"');
    const d = await getJson(ctx, `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,uv_index_max&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=7`);
    const days = (d.daily?.time ?? []).map((date: string, i: number) => ({
      date,
      conditions: WMO[d.daily.weather_code[i]] ?? 'Unknown',
      high_f: Math.round(d.daily.temperature_2m_max[i]),
      low_f: Math.round(d.daily.temperature_2m_min[i]),
      rain_chance: d.daily.precipitation_probability_max[i],
      wind_mph: Math.round(d.daily.wind_speed_10m_max[i]),
      uv: Math.round(d.daily.uv_index_max[i] * 10) / 10,
    }));
    const current = d.current ? { temp_f: Math.round(d.current.temperature_2m), conditions: WMO[d.current.weather_code] ?? '', wind_mph: Math.round(d.current.wind_speed_10m), humidity: d.current.relative_humidity_2m } : null;
    return { ok: true, data: { timezone: d.timezone, current, days }, summary: current ? `Now ${current.temp_f}°F, ${current.conditions.toLowerCase()} · 7-day outlook` : '7-day outlook' };
  },
};

export const airQuality: ToolDef = {
  name: 'air_quality',
  title: 'Air quality',
  description: 'Current US AQI, PM2.5 and ozone plus the 3-day AQI outlook for coordinates (Open-Meteo Air Quality, CAMS model).',
  recipientId: 'open-meteo',
  purpose: 'lookup',
  endpoint: 'air-quality-api.open-meteo.com/v1/air-quality',
  limits: 'Modeled, not measured by a nearby sensor, so local smoke can differ.',
  requiredArgs: ['location'],
  inputSchema: { type: 'object', properties: { location: locationProp }, required: ['location'] },
  async run(args, ctx) {
    const loc = parseLocation(args.location);
    if (!loc) return fail('Location must be "lat,lon"');
    const d = await getJson(ctx, `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${loc.lat}&longitude=${loc.lon}&current=us_aqi,pm2_5,ozone&hourly=us_aqi&forecast_days=4&timezone=auto`);
    const hourly: number[] = d.hourly?.us_aqi ?? [];
    const times: string[] = d.hourly?.time ?? [];
    const byDay = new Map<string, number>();
    times.forEach((t, i) => {
      const day = t.slice(0, 10);
      const v = hourly[i];
      if (v != null) byDay.set(day, Math.max(byDay.get(day) ?? 0, v));
    });
    const outlook = [...byDay.entries()].map(([date, max_aqi]) => ({ date, max_aqi }));
    const c = d.current ?? {};
    return { ok: true, data: { us_aqi: c.us_aqi, pm2_5: c.pm2_5, ozone: c.ozone, category: aqiCategory(c.us_aqi), outlook }, summary: `US AQI ${c.us_aqi} (${aqiCategory(c.us_aqi)})` };
  },
};

export function aqiCategory(aqi: number | undefined): string {
  if (aqi == null) return 'Unknown';
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for sensitive groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very unhealthy';
  return 'Hazardous';
}

export const weatherAlerts: ToolDef = {
  name: 'weather_alerts',
  title: 'Weather alerts',
  description: 'Active official alerts (red flag, heat, flood, winter storm…) from the US National Weather Service for coordinates.',
  recipientId: 'nws',
  purpose: 'safety',
  endpoint: 'api.weather.gov/alerts/active',
  limits: 'US only, and only once a forecast office issues an alert.',
  requiredArgs: ['location'],
  inputSchema: { type: 'object', properties: { location: locationProp }, required: ['location'] },
  async run(args, ctx) {
    const loc = parseLocation(args.location);
    if (!loc) return fail('Location must be "lat,lon"');
    const d = await getJson(ctx, `https://api.weather.gov/alerts/active?point=${loc.lat.toFixed(4)},${loc.lon.toFixed(4)}`, { Accept: 'application/geo+json' });
    const alerts = (d.features ?? []).slice(0, 5).map((f: any) => ({ event: f.properties.event, severity: f.properties.severity, headline: truncate(f.properties.headline ?? '', 180), ends: f.properties.ends ?? f.properties.expires }));
    return { ok: true, data: { count: alerts.length, alerts }, summary: alerts.length ? `${alerts.length} active alert(s): ${alerts[0].event}` : 'No active alerts' };
  },
};

export const earthquakes: ToolDef = {
  name: 'recent_earthquakes',
  title: 'Recent earthquakes',
  description: 'Earthquakes within a radius of coordinates over the last N days (USGS).',
  recipientId: 'usgs',
  purpose: 'safety',
  endpoint: 'earthquake.usgs.gov/fdsnws/event/1/query',
  limits: 'Magnitudes are preliminary and often revised in the first hours.',
  requiredArgs: ['location'],
  inputSchema: { type: 'object', properties: { location: locationProp, radius_km: { type: 'number', description: 'Default 150' }, days: { type: 'number', description: 'Default 30' }, min_magnitude: { type: 'number', description: 'Default 2.5' } }, required: ['location'] },
  async run(args, ctx) {
    const loc = parseLocation(args.location);
    if (!loc) return fail('Location must be "lat,lon"');
    const days = Number(args.days ?? 30);
    const start = new Date(Date.now() - days * 86400e3).toISOString().slice(0, 10);
    const d = await getJson(ctx, `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${loc.lat}&longitude=${loc.lon}&maxradiuskm=${Number(args.radius_km ?? 150)}&starttime=${start}&minmagnitude=${Number(args.min_magnitude ?? 2.5)}&orderby=magnitude&limit=8`);
    const quakes = (d.features ?? []).map((f: any) => ({ magnitude: f.properties.mag, place: f.properties.place, time: new Date(f.properties.time).toISOString(), url: f.properties.url }));
    return { ok: true, data: { days, count: quakes.length, strongest: quakes.slice(0, 5) }, summary: quakes.length ? `${quakes.length} quake(s) ≥M${args.min_magnitude ?? 2.5}; strongest M${quakes[0].magnitude}` : 'No significant quakes' };
  },
};

export const decodeVin: ToolDef = {
  name: 'decode_vin',
  title: 'Decode VIN',
  description: 'Decode a vehicle identification number into make, model and year (NHTSA vPIC).',
  recipientId: 'nhtsa',
  purpose: 'safety',
  endpoint: 'vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues',
  limits: 'Built from manufacturer filings, so trim details can be missing.',
  requiredArgs: ['vin'],
  inputSchema: { type: 'object', properties: { vin: { type: 'string', description: 'VIN, or the vault token {{vault:car_vin}}' } }, required: ['vin'] },
  async run(args, ctx) {
    const vin = String(args.vin ?? '').trim();
    if (!/^[A-HJ-NPR-Z0-9]{11,17}$/i.test(vin)) return fail('Invalid VIN');
    const d = await getJson(ctx, `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`);
    const r = d.Results?.[0] ?? {};
    const data = { make: r.Make, model: r.Model, year: r.ModelYear, body: r.BodyClass, engine: r.EngineCylinders ? `${r.EngineCylinders}-cyl ${r.FuelTypePrimary ?? ''}`.trim() : r.FuelTypePrimary, plant: r.PlantCity };
    return { ok: true, data, summary: `${data.year} ${data.make} ${data.model} (${data.body})` };
  },
};

export const vehicleRecalls: ToolDef = {
  name: 'vehicle_recalls',
  title: 'Vehicle recalls',
  description: 'Safety recall campaigns for a make/model/year (NHTSA).',
  recipientId: 'nhtsa',
  purpose: 'safety',
  endpoint: 'api.nhtsa.gov/recalls/recallsByVehicle',
  limits: "Listed by make, model and year, so it can't tell whether this car was already repaired.",
  requiredArgs: ['make', 'model', 'year'],
  inputSchema: { type: 'object', properties: { make: { type: 'string' }, model: { type: 'string' }, year: { type: 'string' } }, required: ['make', 'model', 'year'] },
  async run(args, ctx) {
    const d = await getJson(ctx, `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(String(args.make))}&model=${encodeURIComponent(String(args.model))}&modelYear=${encodeURIComponent(String(args.year))}`);
    const severe = /air ?bag|fire|crash|brake|steering|fuel|explo/i;
    const recalls = (d.results ?? [])
      .map((r: any) => ({ campaign: r.NHTSACampaignNumber, component: r.Component, summary: truncate(r.Summary ?? '', 260), consequence: truncate(r.Consequence ?? '', 200), remedy: truncate(r.Remedy ?? '', 160), park_it: r.parkIt === true || r.parkIt === 'True', date: r.ReportReceivedDate, critical: severe.test(`${r.Component} ${r.Consequence}`) }))
      .sort((a: any, b: any) => Number(b.park_it) - Number(a.park_it) || Number(b.critical) - Number(a.critical));
    return { ok: true, data: { count: d.Count ?? recalls.length, critical: recalls.filter((r: any) => r.critical).length, airbag: recalls.filter((r: any) => /air ?bag/i.test(r.component)).length, top: recalls.slice(0, 4) }, summary: `${d.Count ?? recalls.length} recall campaign(s)` };
  },
};

export const drugRecalls: ToolDef = {
  name: 'drug_recalls',
  title: 'Drug recalls',
  description: 'FDA drug enforcement (recall) reports that mention a drug name (openFDA), newest first.',
  recipientId: 'openfda',
  purpose: 'safety',
  endpoint: 'api.fda.gov/drug/enforcement.json',
  limits: 'Reports can lag by weeks and match on drug name, not your exact lot.',
  requiredArgs: ['drug'],
  inputSchema: { type: 'object', properties: { drug: { type: 'string', description: 'Generic drug name, e.g. "albuterol"' } }, required: ['drug'] },
  async run(args, ctx) {
    const drug = String(args.drug ?? '').trim();
    if (!drug || drug.startsWith('[')) return fail('No drug name');
    const term = drug.split(/[\s(]/)[0];
    const d = await getJson(ctx, `https://api.fda.gov/drug/enforcement.json?search=product_description:%22${encodeURIComponent(term)}%22&sort=report_date:desc&limit=4`);
    if (d.__notFound) return { ok: true, data: { drug: term, total: 0, recent: [] }, summary: `No recalls for ${term}` };
    const recent = (d.results ?? []).map((r: any) => ({ recall_number: r.recall_number, status: r.status, classification: r.classification, firm: r.recalling_firm, product: truncate(r.product_description ?? '', 160), reason: truncate(r.reason_for_recall ?? '', 160), lots: truncate(r.code_info ?? '', 90), reported: r.report_date }));
    return { ok: true, data: { drug: term, total: d.meta?.results?.total ?? recent.length, recent }, summary: `${d.meta?.results?.total ?? recent.length} recall record(s) for ${term}` };
  },
};

export const drugLabel: ToolDef = {
  name: 'drug_label',
  title: 'Drug label',
  description: 'Official FDA label highlights (warnings, interactions) for a drug (openFDA).',
  recipientId: 'openfda',
  purpose: 'safety',
  endpoint: 'api.fda.gov/drug/label.json',
  limits: 'Manufacturer text, not medical advice.',
  requiredArgs: ['drug'],
  inputSchema: { type: 'object', properties: { drug: { type: 'string' } }, required: ['drug'] },
  async run(args, ctx) {
    const term = String(args.drug ?? '').trim().split(/[\s(]/)[0];
    if (!term || term.startsWith('[')) return fail('No drug name');
    const d = await getJson(ctx, `https://api.fda.gov/drug/label.json?search=openfda.generic_name:%22${encodeURIComponent(term)}%22&limit=1`);
    const r = d.results?.[0];
    if (!r) return fail(`No label for ${term}`);
    const pick = (k: string) => truncate(String((r[k] ?? [''])[0]).replace(/\s+/g, ' ').replace(/^\d+(\.\d+)?\s+[A-Z &]+\s/, ''), 320);
    return { ok: true, data: { drug: term, brand: r.openfda?.brand_name?.[0], warnings: pick('warnings_and_cautions') || pick('warnings'), interactions: pick('drug_interactions') }, summary: `Label: ${r.openfda?.brand_name?.[0] ?? term}` };
  },
};

export const foodRecalls: ToolDef = {
  name: 'food_recalls',
  title: 'Food recalls',
  description: 'Recent FDA food recalls whose reason mentions a term (e.g. an allergen like "peanut") (openFDA).',
  recipientId: 'openfda',
  purpose: 'safety',
  endpoint: 'api.fda.gov/food/enforcement.json',
  limits: 'Reports can lag by weeks; check the lot number on the package.',
  requiredArgs: ['term'],
  inputSchema: { type: 'object', properties: { term: { type: 'string', description: 'Allergen or contaminant, e.g. "peanut", "listeria"' } }, required: ['term'] },
  async run(args, ctx) {
    const term = String(args.term ?? '').trim();
    if (!term || term.startsWith('[')) return fail('No search term');
    const d = await getJson(ctx, `https://api.fda.gov/food/enforcement.json?search=reason_for_recall:%22${encodeURIComponent(term)}%22&sort=report_date:desc&limit=5`);
    if (d.__notFound) return { ok: true, data: { term, total: 0, recent: [] }, summary: `No food recalls for ${term}` };
    const recent = (d.results ?? []).map((r: any) => ({ product: truncate(r.product_description ?? '', 120), firm: r.recalling_firm, reason: truncate(r.reason_for_recall ?? '', 150), classification: r.classification, reported: r.report_date, distribution: truncate(r.distribution_pattern ?? '', 80) }));
    return { ok: true, data: { term, total: d.meta?.results?.total ?? recent.length, recent }, summary: `${d.meta?.results?.total ?? recent.length} food recall(s) mentioning "${term}"` };
  },
};

export const disasterDeclarations: ToolDef = {
  name: 'disaster_declarations',
  title: 'Disaster declarations',
  description: 'Most recent federal disaster declarations for a US state (OpenFEMA).',
  recipientId: 'fema',
  purpose: 'safety',
  endpoint: 'www.fema.gov/api/open/v2/DisasterDeclarationsSummaries',
  limits: 'Federally declared disasters only, usually days after the event.',
  requiredArgs: ['state'],
  inputSchema: { type: 'object', properties: { state: { type: 'string', description: 'Two-letter state code, e.g. "CA"' } }, required: ['state'] },
  async run(args, ctx) {
    const st = String(args.state ?? '').trim().toUpperCase().slice(0, 2);
    if (!/^[A-Z]{2}$/.test(st)) return fail('State must be a 2-letter code');
    const d = await getJson(ctx, `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$filter=state%20eq%20'${st}'&$top=40&$orderby=declarationDate%20desc`);
    const seen = new Set<string>();
    const items = (d.DisasterDeclarationsSummaries ?? []).filter((r: any) => !seen.has(r.disasterNumber) && seen.add(r.disasterNumber)).slice(0, 5).map((r: any) => ({ title: r.declarationTitle, type: r.incidentType, declared: r.declarationDate?.slice(0, 10), area: r.designatedArea }));
    return { ok: true, data: { state: st, recent: items }, summary: items.length ? `Latest: ${items[0].title} (${items[0].declared})` : 'No declarations' };
  },
};

export const wikiSummary: ToolDef = {
  name: 'wiki_summary',
  title: 'Encyclopedia lookup',
  description: 'Short encyclopedia summary of a topic (Wikipedia REST API).',
  recipientId: 'wikipedia',
  purpose: 'lookup',
  endpoint: 'en.wikipedia.org/api/rest_v1/page/summary',
  limits: 'Crowd-edited and can be out of date.',
  requiredArgs: ['topic'],
  inputSchema: { type: 'object', properties: { topic: { type: 'string' } }, required: ['topic'] },
  async run(args, ctx) {
    const topic = String(args.topic ?? '').trim();
    if (!topic || topic.startsWith('[')) return fail('No topic');
    const d = await getJson(ctx, `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic.replace(/\s+/g, '_'))}?redirect=true`);
    if (d.__notFound || !d.extract) return fail(`Nothing found for "${topic}"`);
    return { ok: true, data: { title: d.title, description: d.description, extract: truncate(d.extract, 700), url: d.content_urls?.desktop?.page }, summary: `${d.title}: ${truncate(d.description ?? '', 60)}` };
  },
};

/** Generic fetch. Its recipient is whoever owns the URL — unknown domains are default-deny. */
export const httpFetch: ToolDef = {
  name: 'http_fetch',
  title: 'Fetch a URL',
  description: 'Fetch an arbitrary URL. Destinations Consentry has not verified are blocked by default.',
  recipientId: 'dynamic',
  purpose: 'unspecified',
  endpoint: '*',
  requiredArgs: ['url'],
  inputSchema: { type: 'object', properties: { url: { type: 'string' }, method: { type: 'string', enum: ['GET', 'POST'] }, body: { type: 'string' } }, required: ['url'] },
  async run(args, ctx) {
    const url = String(args.url ?? '');
    const res = await ctx.fetch(url, { method: String(args.method ?? 'GET'), body: args.method === 'POST' ? String(args.body ?? '') : undefined, signal: ctx.signal });
    const text = await res.text();
    return { ok: res.ok, data: { status: res.status, body: truncate(text, 1500) }, summary: `HTTP ${res.status}` };
  },
};

export const PUBLIC_TOOLS: ToolDef[] = [geocodePlace, weatherForecast, airQuality, weatherAlerts, earthquakes, decodeVin, vehicleRecalls, drugRecalls, drugLabel, foodRecalls, disasterDeclarations, wikiSummary, httpFetch];
