// 国家名称到国旗emoji的映射
const countryFlagMap: Record<string, string> = {
  // 主要国家
  '中国': '🇨🇳',
  'China': '🇨🇳',
  'CN': '🇨🇳',
  
  '美国': '🇺🇸',
  'United States': '🇺🇸',
  'USA': '🇺🇸',
  'US': '🇺🇸',
  
  '日本': '🇯🇵',
  'Japan': '🇯🇵',
  'JP': '🇯🇵',
  
  '韩国': '🇰🇷',
  'South Korea': '🇰🇷',
  'Korea': '🇰🇷',
  'KR': '🇰🇷',
  
  '新加坡': '🇸🇬',
  'Singapore': '🇸🇬',
  'SG': '🇸🇬',
  
  '香港': '🇭🇰',
  'Hong Kong': '🇭🇰',
  'HK': '🇭🇰',
  
  '台湾': '🇹🇼',
  'Taiwan': '🇹🇼',
  'TW': '🇹🇼',
  
  // 欧洲
  '德国': '🇩🇪',
  'Germany': '🇩🇪',
  'DE': '🇩🇪',
  
  '英国': '🇬🇧',
  'United Kingdom': '🇬🇧',
  'UK': '🇬🇧',
  'GB': '🇬🇧',
  
  '法国': '🇫🇷',
  'France': '🇫🇷',
  'FR': '🇫🇷',
  
  '荷兰': '🇳🇱',
  'Netherlands': '🇳🇱',
  'NL': '🇳🇱',
  
  '俄罗斯': '🇷🇺',
  'Russia': '🇷🇺',
  'RU': '🇷🇺',
  
  '意大利': '🇮🇹',
  'Italy': '🇮🇹',
  'IT': '🇮🇹',
  
  '西班牙': '🇪🇸',
  'Spain': '🇪🇸',
  'ES': '🇪🇸',
  
  '瑞士': '🇨🇭',
  'Switzerland': '🇨🇭',
  'CH': '🇨🇭',
  
  '瑞典': '🇸🇪',
  'Sweden': '🇸🇪',
  'SE': '🇸🇪',
  
  '挪威': '🇳🇴',
  'Norway': '🇳🇴',
  'NO': '🇳🇴',
  
  '丹麦': '🇩🇰',
  'Denmark': '🇩🇰',
  'DK': '🇩🇰',
  
  '芬兰': '🇫🇮',
  'Finland': '🇫🇮',
  'FI': '🇫🇮',
  
  '波兰': '🇵🇱',
  'Poland': '🇵🇱',
  'PL': '🇵🇱',
  
  // 美洲
  '加拿大': '🇨🇦',
  'Canada': '🇨🇦',
  'CA': '🇨🇦',
  
  '巴西': '🇧🇷',
  'Brazil': '🇧🇷',
  'BR': '🇧🇷',
  
  '墨西哥': '🇲🇽',
  'Mexico': '🇲🇽',
  'MX': '🇲🇽',
  
  '阿根廷': '🇦🇷',
  'Argentina': '🇦🇷',
  'AR': '🇦🇷',
  
  // 大洋洲
  '澳大利亚': '🇦🇺',
  'Australia': '🇦🇺',
  'AU': '🇦🇺',
  
  '新西兰': '🇳🇿',
  'New Zealand': '🇳🇿',
  'NZ': '🇳🇿',
  
  // 非洲
  '南非': '🇿🇦',
  'South Africa': '🇿🇦',
  'ZA': '🇿🇦',
  
  // 中东
  '阿联酋': '🇦🇪',
  'United Arab Emirates': '🇦🇪',
  'UAE': '🇦🇪',
  'AE': '🇦🇪',
  
  '以色列': '🇮🇱',
  'Israel': '🇮🇱',
  'IL': '🇮🇱',
  
  '土耳其': '🇹🇷',
  'Turkey': '🇹🇷',
  'TR': '🇹🇷',
  
  // 东南亚
  '泰国': '🇹🇭',
  'Thailand': '🇹🇭',
  'TH': '🇹🇭',
  
  '马来西亚': '🇲🇾',
  'Malaysia': '🇲🇾',
  'MY': '🇲🇾',
  
  '印尼': '🇮🇩',
  'Indonesia': '🇮🇩',
  'ID': '🇮🇩',
  
  '菲律宾': '🇵🇭',
  'Philippines': '🇵🇭',
  'PH': '🇵🇭',
  
  '越南': '🇻🇳',
  'Vietnam': '🇻🇳',
  'VN': '🇻🇳',
  
  // 南亚
  '印度': '🇮🇳',
  'India': '🇮🇳',
  'IN': '🇮🇳',
  
  '巴基斯坦': '🇵🇰',
  'Pakistan': '🇵🇰',
  'PK': '🇵🇰',
};

/**
 * 根据国家名称获取对应的国旗emoji
 * @param countryName 国家名称
 * @returns 国旗emoji字符串，如果找不到则返回🌍
 */
export const getCountryFlag = (countryName: string): string => {
  if (!countryName) return '🌍';
  
  // 直接匹配
  if (countryFlagMap[countryName]) {
    return countryFlagMap[countryName];
  }
  
  // 忽略大小写匹配
  const lowerCountry = countryName.toLowerCase();
  const key = Object.keys(countryFlagMap).find(k => k.toLowerCase() === lowerCountry);
  if (key) {
    return countryFlagMap[key];
  }
  
  // 部分匹配（处理 "United States of America" 这种情况）
  const partialKey = Object.keys(countryFlagMap).find(k => 
    k.toLowerCase().includes(lowerCountry) || lowerCountry.includes(k.toLowerCase())
  );
  if (partialKey) {
    return countryFlagMap[partialKey];
  }
  
  // 默认返回地球emoji
  return '🌍';
};

/**
 * 获取国旗emoji的显示组件props
 * @param countryName 国家名称
 * @param className 额外的CSS类名
 * @returns 包含emoji和样式的对象
 */
export const getFlagProps = (countryName: string, className: string = '') => {
  return {
    children: getCountryFlag(countryName),
    className: `inline-block ${className}`,
    title: countryName,
    'aria-label': `${countryName}国旗`
  };
};