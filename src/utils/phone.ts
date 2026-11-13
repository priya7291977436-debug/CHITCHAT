import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  AsYouType,
  type CountryCode,
} from 'libphonenumber-js';

export interface CountryOption {
  code: CountryCode;
  name: string;
  dialCode: string;
  flag: string;
}

const POPULAR_CODES: CountryCode[] = ['IN', 'US', 'GB', 'CA', 'AU', 'AE', 'PK', 'BD', 'NP', 'JP', 'DE', 'FR'];
const RECENT_KEY = 'chitchat_recent_countries';

export function countryCodeToFlag(isoCode: string): string {
  const code = isoCode.toUpperCase();
  if (code.length !== 2) return '🌐';
  const offset = 127397;
  return String.fromCodePoint(code.charCodeAt(0) + offset, code.charCodeAt(1) + offset);
}

const regionDisplay =
  typeof Intl !== 'undefined' && Intl.DisplayNames
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null;

let cachedCountries: CountryOption[] | null = null;

export function getAllCountries(): CountryOption[] {
  if (cachedCountries) return cachedCountries;
  const raw = getCountries();
  const list: CountryOption[] = raw.map((code) => {
    const name = regionDisplay?.of(code) || code;
    const dialCode = `+${getCountryCallingCode(code)}`;
    return {
      code,
      name,
      dialCode,
      flag: countryCodeToFlag(code),
    };
  });
  list.sort((a, b) => a.name.localeCompare(b.name));
  cachedCountries = list;
  return list;
}

export function getPopularCountries(): CountryOption[] {
  const all = getAllCountries();
  const map = new Map(all.map((c) => [c.code, c]));
  return POPULAR_CODES.map((code) => map.get(code)).filter((c): c is CountryOption => Boolean(c));
}

export function getRecentCountries(): CountryOption[] {
  try {
    const saved = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as CountryCode[];
    const all = getAllCountries();
    const map = new Map(all.map((c) => [c.code, c]));
    return saved.map((code) => map.get(code)).filter((c): c is CountryOption => Boolean(c)).slice(0, 5);
  } catch {
    return [];
  }
}

export function recordRecentCountry(code: CountryCode) {
  try {
    const existing = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as CountryCode[];
    const next = [code, ...existing.filter((c) => c !== code)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage issues
  }
}

export function detectDefaultCountry(): CountryCode {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.includes('Calcutta') || tz.includes('Kolkata')) return 'IN';
    const lang = navigator.language || '';
    const parts = lang.split('-');
    if (parts.length === 2) {
      const candidate = parts[1].toUpperCase() as CountryCode;
      if (getCountries().includes(candidate)) return candidate;
    }
  } catch {
    // Fallback below
  }
  return 'IN';
}

export function formatNationalPhoneInput(value: string, country: CountryCode): string {
  const digitsOnly = value.replace(/[^\d]/g, '');
  if (!digitsOnly) return '';
  const formatter = new AsYouType(country);
  return formatter.input(digitsOnly);
}

export function validateAndNormalizePhone(
  nationalInput: string,
  country: CountryCode
): { valid: boolean; e164?: string; formatted?: string; error?: string } {
  const trimmed = nationalInput.trim();
  if (!trimmed) {
    return { valid: false, error: 'Enter your phone number to continue.' };
  }

  const parsed = parsePhoneNumberFromString(trimmed, country);
  if (!parsed) {
    return { valid: false, error: 'Phone number format is invalid for the selected country.' };
  }
  if (!parsed.isPossible()) {
    return { valid: false, error: `Invalid length for ${regionDisplay?.of(country) || country}.` };
  }
  if (!parsed.isValid()) {
    return { valid: false, error: `Please enter a valid ${regionDisplay?.of(country) || country} phone number.` };
  }
  return {
    valid: true,
    e164: parsed.number,
    formatted: parsed.formatInternational(),
  };
}
