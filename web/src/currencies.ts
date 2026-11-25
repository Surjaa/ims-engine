export interface Currency {
  code: string;
  symbol: string;
  name: string;
  country: string;
  /** ISO 3166-1 alpha-2 (lowercase), used to load the country flag */
  cc: string;
}

export const CURRENCIES: Currency[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', country: 'India', cc: 'in' },
  { code: 'USD', symbol: '$', name: 'US Dollar', country: 'United States', cc: 'us' },
  { code: 'EUR', symbol: '€', name: 'Euro', country: 'European Union', cc: 'eu' },
  { code: 'GBP', symbol: '£', name: 'Pound Sterling', country: 'United Kingdom', cc: 'gb' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', country: 'Japan', cc: 'jp' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', country: 'China', cc: 'cn' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', country: 'Australia', cc: 'au' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', country: 'Canada', cc: 'ca' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', country: 'Switzerland', cc: 'ch' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', country: 'Singapore', cc: 'sg' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', country: 'Hong Kong', cc: 'hk' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', country: 'New Zealand', cc: 'nz' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', country: 'United Arab Emirates', cc: 'ae' },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal', country: 'Saudi Arabia', cc: 'sa' },
  { code: 'QAR', symbol: 'QAR', name: 'Qatari Riyal', country: 'Qatar', cc: 'qa' },
  { code: 'KWD', symbol: 'KWD', name: 'Kuwaiti Dinar', country: 'Kuwait', cc: 'kw' },
  { code: 'BHD', symbol: 'BHD', name: 'Bahraini Dinar', country: 'Bahrain', cc: 'bh' },
  { code: 'OMR', symbol: 'OMR', name: 'Omani Rial', country: 'Oman', cc: 'om' },
  { code: 'JOD', symbol: 'JOD', name: 'Jordanian Dinar', country: 'Jordan', cc: 'jo' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', country: 'Pakistan', cc: 'pk' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', country: 'Bangladesh', cc: 'bd' },
  { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee', country: 'Sri Lanka', cc: 'lk' },
  { code: 'NPR', symbol: 'Rs', name: 'Nepalese Rupee', country: 'Nepal', cc: 'np' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', country: 'Thailand', cc: 'th' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', country: 'Malaysia', cc: 'my' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', country: 'Indonesia', cc: 'id' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', country: 'Philippines', cc: 'ph' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', country: 'Vietnam', cc: 'vn' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', country: 'South Korea', cc: 'kr' },
  { code: 'TWD', symbol: 'NT$', name: 'New Taiwan Dollar', country: 'Taiwan', cc: 'tw' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', country: 'South Africa', cc: 'za' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', country: 'Nigeria', cc: 'ng' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', country: 'Kenya', cc: 'ke' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi', country: 'Ghana', cc: 'gh' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', country: 'Egypt', cc: 'eg' },
  { code: 'MAD', symbol: 'MAD', name: 'Moroccan Dirham', country: 'Morocco', cc: 'ma' },
  { code: 'ETB', symbol: 'Br', name: 'Ethiopian Birr', country: 'Ethiopia', cc: 'et' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', country: 'Mexico', cc: 'mx' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', country: 'Brazil', cc: 'br' },
  { code: 'ARS', symbol: 'AR$', name: 'Argentine Peso', country: 'Argentina', cc: 'ar' },
  { code: 'CLP', symbol: 'CLP$', name: 'Chilean Peso', country: 'Chile', cc: 'cl' },
  { code: 'COP', symbol: 'COL$', name: 'Colombian Peso', country: 'Colombia', cc: 'co' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', country: 'Sweden', cc: 'se' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', country: 'Norway', cc: 'no' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone', country: 'Denmark', cc: 'dk' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty', country: 'Poland', cc: 'pl' },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna', country: 'Czechia', cc: 'cz' },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint', country: 'Hungary', cc: 'hu' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble', country: 'Russia', cc: 'ru' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', country: 'Türkiye', cc: 'tr' },
  { code: 'ILS', symbol: '₪', name: 'Israeli Shekel', country: 'Israel', cc: 'il' },
  { code: 'KZT', symbol: '₸', name: 'Kazakhstani Tenge', country: 'Kazakhstan', cc: 'kz' },
  { code: 'UAH', symbol: '₴', name: 'Ukrainian Hryvnia', country: 'Ukraine', cc: 'ua' },
];

/** Finds a currency by ISO code first, then by symbol; defaults to INR. */
export function findCurrency(code?: string, symbol?: string): Currency {
  return (
    CURRENCIES.find((c) => c.code === code) ??
    CURRENCIES.find((c) => c.symbol === symbol) ??
    CURRENCIES[0]
  );
}
