// 国家名称到国旗emoji的映射
const countryFlagMap: Record<string, string> = {
  // 主要国家
  中国: "🇨🇳",
  China: "🇨🇳",
  CN: "🇨🇳",

  美国: "🇺🇸",
  "United States": "🇺🇸",
  USA: "🇺🇸",
  US: "🇺🇸",

  日本: "🇯🇵",
  Japan: "🇯🇵",
  JP: "🇯🇵",

  韩国: "🇰🇷",
  "South Korea": "🇰🇷",
  Korea: "🇰🇷",
  KR: "🇰🇷",

  新加坡: "🇸🇬",
  Singapore: "🇸🇬",
  SG: "🇸🇬",

  香港: "🇭🇰",
  "Hong Kong": "🇭🇰",
  HK: "🇭🇰",

  台湾: "🇹🇼",
  Taiwan: "🇹🇼",
  TW: "🇹🇼",

  // 欧洲
  德国: "🇩🇪",
  Germany: "🇩🇪",
  DE: "🇩🇪",

  英国: "🇬🇧",
  "United Kingdom": "🇬🇧",
  UK: "🇬🇧",
  GB: "🇬🇧",

  法国: "🇫🇷",
  France: "🇫🇷",
  FR: "🇫🇷",

  荷兰: "🇳🇱",
  Netherlands: "🇳🇱",
  NL: "🇳🇱",

  俄罗斯: "🇷🇺",
  Russia: "🇷🇺",
  RU: "🇷🇺",

  意大利: "🇮🇹",
  Italy: "🇮🇹",
  IT: "🇮🇹",

  西班牙: "🇪🇸",
  Spain: "🇪🇸",
  ES: "🇪🇸",

  瑞士: "🇨🇭",
  Switzerland: "🇨🇭",
  CH: "🇨🇭",

  瑞典: "🇸🇪",
  Sweden: "🇸🇪",
  SE: "🇸🇪",

  挪威: "🇳🇴",
  Norway: "🇳🇴",
  NO: "🇳🇴",

  丹麦: "🇩🇰",
  Denmark: "🇩🇰",
  DK: "🇩🇰",

  芬兰: "🇫🇮",
  Finland: "🇫🇮",
  FI: "🇫🇮",

  波兰: "🇵🇱",
  Poland: "🇵🇱",
  PL: "🇵🇱",

  // 美洲
  加拿大: "🇨🇦",
  Canada: "🇨🇦",
  CA: "🇨🇦",

  巴西: "🇧🇷",
  Brazil: "🇧🇷",
  BR: "🇧🇷",

  墨西哥: "🇲🇽",
  Mexico: "🇲🇽",
  MX: "🇲🇽",

  阿根廷: "🇦🇷",
  Argentina: "🇦🇷",
  AR: "🇦🇷",

  // 大洋洲
  澳大利亚: "🇦🇺",
  Australia: "🇦🇺",
  AU: "🇦🇺",

  新西兰: "🇳🇿",
  "New Zealand": "🇳🇿",
  NZ: "🇳🇿",

  // 非洲
  南非: "🇿🇦",
  "South Africa": "🇿🇦",
  ZA: "🇿🇦",

  // 中东
  阿联酋: "🇦🇪",
  "United Arab Emirates": "🇦🇪",
  UAE: "🇦🇪",
  AE: "🇦🇪",

  以色列: "🇮🇱",
  Israel: "🇮🇱",
  IL: "🇮🇱",

  土耳其: "🇹🇷",
  Turkey: "🇹🇷",
  TR: "🇹🇷",

  // 东南亚
  泰国: "🇹🇭",
  Thailand: "🇹🇭",
  TH: "🇹🇭",

  马来西亚: "🇲🇾",
  Malaysia: "🇲🇾",
  MY: "🇲🇾",

  印尼: "🇮🇩",
  Indonesia: "🇮🇩",
  ID: "🇮🇩",

  菲律宾: "🇵🇭",
  Philippines: "🇵🇭",
  PH: "🇵🇭",

  越南: "🇻🇳",
  Vietnam: "🇻🇳",
  VN: "🇻🇳",

  // 南亚
  印度: "🇮🇳",
  India: "🇮🇳",
  IN: "🇮🇳",

  巴基斯坦: "🇵🇰",
  Pakistan: "🇵🇰",
  PK: "🇵🇰",
};

/**
 * 根据国家名称获取对应的国旗emoji
 * @param countryName 国家名称
 * @returns 国旗emoji字符串，如果找不到则返回🌍
 */
export const getCountryFlag = (countryName: string): string => {
  if (!countryName) return "🌍";

  // 直接匹配
  if (countryFlagMap[countryName]) {
    return countryFlagMap[countryName];
  }

  // 忽略大小写匹配
  const lowerCountry = countryName.toLowerCase();
  const key = Object.keys(countryFlagMap).find(
    (k) => k.toLowerCase() === lowerCountry,
  );
  if (key) {
    return countryFlagMap[key];
  }

  // 部分匹配（处理 "United States of America" 这种情况）
  const partialKey = Object.keys(countryFlagMap).find(
    (k) =>
      k.toLowerCase().includes(lowerCountry) ||
      lowerCountry.includes(k.toLowerCase()),
  );
  if (partialKey) {
    return countryFlagMap[partialKey];
  }

  // 默认返回地球emoji
  return "🌍";
};

// 新增：将国家名称转换为ISO两位代码（用于SVG国旗）
const countryCodeMap: Record<string, string> = {
  // 常见国家/地区
  中国: "cn",
  china: "cn",
  cn: "cn",
  美国: "us",
  "united states": "us",
  usa: "us",
  us: "us",
  日本: "jp",
  japan: "jp",
  jp: "jp",
  韩国: "kr",
  "south korea": "kr",
  korea: "kr",
  kr: "kr",
  新加坡: "sg",
  singapore: "sg",
  sg: "sg",
  香港: "hk",
  "hong kong": "hk",
  hk: "hk",
  台湾: "tw",
  taiwan: "tw",
  tw: "tw",
  德国: "de",
  germany: "de",
  de: "de",
  英国: "gb",
  "united kingdom": "gb",
  uk: "gb",
  gb: "gb",
  法国: "fr",
  france: "fr",
  fr: "fr",
  荷兰: "nl",
  netherlands: "nl",
  nl: "nl",
  俄罗斯: "ru",
  russia: "ru",
  ru: "ru",
  意大利: "it",
  italy: "it",
  it: "it",
  西班牙: "es",
  spain: "es",
  es: "es",
  瑞士: "ch",
  switzerland: "ch",
  ch: "ch",
  瑞典: "se",
  sweden: "se",
  se: "se",
  挪威: "no",
  norway: "no",
  no: "no",
  丹麦: "dk",
  denmark: "dk",
  dk: "dk",
  芬兰: "fi",
  finland: "fi",
  fi: "fi",
  波兰: "pl",
  poland: "pl",
  pl: "pl",
  加拿大: "ca",
  canada: "ca",
  ca: "ca",
  巴西: "br",
  brazil: "br",
  br: "br",
  墨西哥: "mx",
  mexico: "mx",
  mx: "mx",
  阿根廷: "ar",
  argentina: "ar",
  ar: "ar",
  澳大利亚: "au",
  australia: "au",
  au: "au",
  新西兰: "nz",
  "new zealand": "nz",
  nz: "nz",
  南非: "za",
  "south africa": "za",
  za: "za",
  阿联酋: "ae",
  "united arab emirates": "ae",
  uae: "ae",
  ae: "ae",
  以色列: "il",
  israel: "il",
  il: "il",
  土耳其: "tr",
  turkey: "tr",
  tr: "tr",
  泰国: "th",
  thailand: "th",
  th: "th",
  马来西亚: "my",
  malaysia: "my",
  my: "my",
  印尼: "id",
  indonesia: "id",
  id: "id",
  菲律宾: "ph",
  philippines: "ph",
  ph: "ph",
  越南: "vn",
  vietnam: "vn",
  vn: "vn",
  印度: "in",
  india: "in",
  in: "in",
  巴基斯坦: "pk",
  pakistan: "pk",
  pk: "pk",
};

export const getCountryCode = (countryName: string): string => {
  if (!countryName) return "un";
  const raw = countryName.trim();
  if (/^[a-z]{2}$/i.test(raw)) return raw.toLowerCase();
  const key = raw.toLowerCase();
  if (countryCodeMap[key]) return countryCodeMap[key];
  // 处理包含关系
  const found = Object.keys(countryCodeMap).find((k) => key.includes(k));
  return found ? countryCodeMap[found] : "un";
};

/**
 * 获取国旗emoji的显示组件props
 * @param countryName 国家名称
 * @param className 额外的CSS类名
 * @returns 包含emoji和样式的对象
 */
export const getFlagProps = (countryName: string, className: string = "") => {
  return {
    children: getCountryFlag(countryName),
    className: `inline-block ${className}`,
    title: countryName,
    "aria-label": `${countryName}国旗`,
  };
};
