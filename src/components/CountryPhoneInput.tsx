import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import type { CountryCode } from 'libphonenumber-js';
import {
  getAllCountries,
  getPopularCountries,
  getRecentCountries,
  recordRecentCountry,
  formatNationalPhoneInput,
  type CountryOption,
} from '../utils/phone';

interface CountryPhoneInputProps {
  country: CountryCode;
  onCountryChange: (code: CountryCode) => void;
  phoneInput: string;
  onPhoneInputChange: (val: string) => void;
  error?: string | null;
  disabled?: boolean;
}

export const CountryPhoneInput: React.FC<CountryPhoneInputProps> = ({
  country,
  onCountryChange,
  phoneInput,
  onPhoneInputChange,
  error,
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const allCountries = useMemo(() => getAllCountries(), []);
  const popularCountries = useMemo(() => getPopularCountries(), []);
  const [recentCountries, setRecentCountries] = useState<CountryOption[]>(() =>
    getRecentCountries()
  );

  const selected = useMemo(
    () => allCountries.find((c) => c.code === country) || allCountries[0],
    [allCountries, country]
  );

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const filteredCountries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allCountries;
    return allCountries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [allCountries, search]);

  const handleSelect = (opt: CountryOption) => {
    recordRecentCountry(opt.code);
    setRecentCountries(getRecentCountries());
    onCountryChange(opt.code);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="space-y-1.5" ref={dropdownRef}>
      <label className="block text-xs font-medium text-[#667781] dark:text-[#8696A0]">
        Country &amp; Phone Number
      </label>
      <div className="relative flex items-stretch gap-2">
        {/* Country Selector Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-[#F4FBF6] dark:bg-[#202C33] px-3 py-3 text-sm font-medium text-[#111B21] dark:text-white hover:border-[#25D366] transition-colors shrink-0 cursor-pointer disabled:opacity-60"
        >
          <span className="text-lg leading-none" aria-hidden="true">
            {selected.flag}
          </span>
          <span className="font-mono-nums text-xs font-semibold text-[#128C7E] dark:text-[#25D366]">
            {selected.dialCode}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-[#667781]" />
        </button>

        {/* Formatted National Number Input */}
        <input
          type="tel"
          inputMode="tel"
          disabled={disabled}
          value={phoneInput}
          onChange={(e) => {
            const formatted = formatNationalPhoneInput(e.target.value, country);
            onPhoneInputChange(formatted);
          }}
          placeholder={country === 'IN' ? '98765 43210' : 'Phone number'}
          className="flex-1 min-w-0 rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-white dark:bg-[#202C33] px-4 py-3 text-sm font-mono-nums text-[#111B21] dark:text-white placeholder:text-[#667781]/60 focus:outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 transition-all"
        />

        {/* Searchable Country Dropdown */}
        {open && (
          <div className="absolute left-0 top-full mt-2 w-full sm:w-96 max-h-80 rounded-2xl border border-[#E7EDE9] dark:border-[#2A3942] bg-white dark:bg-[#1A262E] shadow-2xl z-50 flex flex-col overflow-hidden">
            <div className="p-2.5 border-b border-[#E7EDE9] dark:border-[#2A3942]">
              <div className="relative">
                <Search className="w-4 h-4 text-[#667781] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search country, code, or +91..."
                  className="w-full rounded-xl bg-[#F4FBF6] dark:bg-[#202C33] pl-9 pr-3 py-2 text-xs text-[#111B21] dark:text-white placeholder:text-[#667781] focus:outline-none focus:ring-1 focus:ring-[#25D366]"
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-1.5 space-y-2">
              {!search && recentCountries.length > 0 && (
                <div>
                  <div className="px-2.5 py-1 text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">
                    Recently Selected
                  </div>
                  {recentCountries.map((c) => (
                    <CountryRow
                      key={`rec_${c.code}`}
                      option={c}
                      selected={c.code === country}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              )}

              {!search && (
                <div>
                  <div className="px-2.5 py-1 text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">
                    Popular Countries
                  </div>
                  {popularCountries.map((c) => (
                    <CountryRow
                      key={`pop_${c.code}`}
                      option={c}
                      selected={c.code === country}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              )}

              <div>
                <div className="px-2.5 py-1 text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">
                  {search ? 'Search Results' : `All Countries (${filteredCountries.length})`}
                </div>
                {filteredCountries.length === 0 ? (
                  <p className="px-3 py-4 text-xs text-center text-[#667781]">
                    No matching countries found.
                  </p>
                ) : (
                  filteredCountries.map((c) => (
                    <CountryRow
                      key={c.code}
                      option={c}
                      selected={c.code === country}
                      onSelect={handleSelect}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
};

const CountryRow: React.FC<{
  option: CountryOption;
  selected: boolean;
  onSelect: (opt: CountryOption) => void;
}> = ({ option, selected, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(option)}
    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
      selected
        ? 'bg-[#D9FDD3] dark:bg-[#005C4B] text-[#111B21] dark:text-white font-semibold'
        : 'hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] text-[#111B21] dark:text-[#E9EDEF]'
    }`}
  >
    <span className="flex items-center gap-2.5 min-w-0">
      <span className="text-base shrink-0" aria-hidden="true">
        {option.flag}
      </span>
      <span className="truncate">{option.name}</span>
      <span className="text-[11px] text-[#667781] dark:text-[#8696A0] shrink-0">
        {option.code}
      </span>
    </span>
    <span className="flex items-center gap-2 shrink-0 ml-2">
      <span className="font-mono-nums text-[#128C7E] dark:text-[#25D366] font-medium">
        {option.dialCode}
      </span>
      {selected && <Check className="w-3.5 h-3.5 text-[#128C7E] dark:text-[#25D366]" />}
    </span>
  </button>
);
