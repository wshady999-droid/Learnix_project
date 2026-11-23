export interface CountryCallingCode {
  iso2: string;
  name: string;
  dialCode: string;
  flag: string;
}

export const COUNTRY_CALLING_CODES: readonly CountryCallingCode[] = [
  { iso2: "US", name: "United States", dialCode: "+1", flag: "🇺🇸" },
  { iso2: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧" },
  { iso2: "EG", name: "Egypt", dialCode: "+20", flag: "🇪🇬" },
  { iso2: "SA", name: "Saudi Arabia", dialCode: "+966", flag: "🇸🇦" },
  { iso2: "AE", name: "United Arab Emirates", dialCode: "+971", flag: "🇦🇪" },
  { iso2: "DE", name: "Germany", dialCode: "+49", flag: "🇩🇪" },
  { iso2: "AT", name: "Austria", dialCode: "+43", flag: "🇦🇹" },
  { iso2: "CH", name: "Switzerland", dialCode: "+41", flag: "🇨🇭" },
  { iso2: "IT", name: "Italy", dialCode: "+39", flag: "🇮🇹" },
  { iso2: "FR", name: "France", dialCode: "+33", flag: "🇫🇷" },
  { iso2: "CA", name: "Canada", dialCode: "+1", flag: "🇨🇦" },
  { iso2: "QA", name: "Qatar", dialCode: "+974", flag: "🇶🇦" },
  { iso2: "KW", name: "Kuwait", dialCode: "+965", flag: "🇰🇼" },
  { iso2: "JO", name: "Jordan", dialCode: "+962", flag: "🇯🇴" },
  { iso2: "MA", name: "Morocco", dialCode: "+212", flag: "🇲🇦" },
  { iso2: "TN", name: "Tunisia", dialCode: "+216", flag: "🇹🇳" },
  { iso2: "ES", name: "Spain", dialCode: "+34", flag: "🇪🇸" },
  { iso2: "NL", name: "Netherlands", dialCode: "+31", flag: "🇳🇱" },
  { iso2: "SE", name: "Sweden", dialCode: "+46", flag: "🇸🇪" },
  { iso2: "IN", name: "India", dialCode: "+91", flag: "🇮🇳" },
] as const;

export const DEFAULT_COUNTRY_ISO2 = "US";

export function findCountryByIso2(iso2: string): CountryCallingCode {
  return (
    COUNTRY_CALLING_CODES.find((c) => c.iso2 === iso2) ??
    COUNTRY_CALLING_CODES[0]!
  );
}
