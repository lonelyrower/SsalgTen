import React from 'react';

// 国家名称到ISO 3166-1 alpha-2代码的映射
const countryCodeMap: Record<string, string> = {
  // 常见国家
  'China': 'cn',
  '中国': 'cn',
  'United States': 'us',
  '美国': 'us',
  'Japan': 'jp',
  '日本': 'jp',
  'South Korea': 'kr',
  '韩国': 'kr',
  'Singapore': 'sg',
  '新加坡': 'sg',
  'Hong Kong': 'hk',
  '香港': 'hk',
  'Taiwan': 'tw',
  '台湾': 'tw',
  'Germany': 'de',
  '德国': 'de',
  'United Kingdom': 'gb',
  '英国': 'gb',
  'France': 'fr',
  '法国': 'fr',
  'Canada': 'ca',
  '加拿大': 'ca',
  'Australia': 'au',
  '澳大利亚': 'au',
  'Netherlands': 'nl',
  '荷兰': 'nl',
  'Russia': 'ru',
  '俄罗斯': 'ru',
  'India': 'in',
  '印度': 'in',
  'Brazil': 'br',
  '巴西': 'br',
  'Thailand': 'th',
  '泰国': 'th',
  'Vietnam': 'vn',
  '越南': 'vn',
  'Malaysia': 'my',
  '马来西亚': 'my',
  'Indonesia': 'id',
  '印度尼西亚': 'id',
  'Philippines': 'ph',
  '菲律宾': 'ph',
  'Italy': 'it',
  '意大利': 'it',
  'Spain': 'es',
  '西班牙': 'es',
  'Sweden': 'se',
  '瑞典': 'se',
  'Norway': 'no',
  '挪威': 'no',
  'Finland': 'fi',
  '芬兰': 'fi',
  'Switzerland': 'ch',
  '瑞士': 'ch',
  'Belgium': 'be',
  '比利时': 'be',
  'Denmark': 'dk',
  '丹麦': 'dk',
  'Poland': 'pl',
  '波兰': 'pl',
  'Czech Republic': 'cz',
  '捷克': 'cz',
  'Austria': 'at',
  '奥地利': 'at',
  'Ireland': 'ie',
  '爱尔兰': 'ie',
  'Portugal': 'pt',
  '葡萄牙': 'pt',
  'Greece': 'gr',
  '希腊': 'gr',
  'Turkey': 'tr',
  '土耳其': 'tr',
  'Israel': 'il',
  '以色列': 'il',
  'South Africa': 'za',
  '南非': 'za',
  'Egypt': 'eg',
  '埃及': 'eg',
  'Mexico': 'mx',
  '墨西哥': 'mx',
  'Argentina': 'ar',
  '阿根廷': 'ar',
  'Chile': 'cl',
  '智利': 'cl',
  'Colombia': 'co',
  '哥伦比亚': 'co',
  'Peru': 'pe',
  '秘鲁': 'pe',
  'Ukraine': 'ua',
  '乌克兰': 'ua',
  'Bangladesh': 'bd',
  '孟加拉国': 'bd',
  'Pakistan': 'pk',
  '巴基斯坦': 'pk',
  'Nepal': 'np',
  '尼泊尔': 'np',
  'Sri Lanka': 'lk',
  '斯里兰卡': 'lk',
  'Myanmar': 'mm',
  '缅甸': 'mm',
  'Cambodia': 'kh',
  '柬埔寨': 'kh',
  'Laos': 'la',
  '老挝': 'la',
  'Mongolia': 'mn',
  '蒙古': 'mn',
  'Kazakhstan': 'kz',
  '哈萨克斯坦': 'kz',
  'Uzbekistan': 'uz',
  '乌兹别克斯坦': 'uz',
  'New Zealand': 'nz',
  '新西兰': 'nz',
  // 默认值（使用空字符串代替null）
  'Unknown': '',
  '未知': ''
};

interface CountryFlagProps {
  country: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showName?: boolean;
}

export const CountryFlag: React.FC<CountryFlagProps> = ({ 
  country, 
  size = 'md', 
  className = '',
  showName = true 
}) => {
  // 获取国家代码
  const getCountryCode = (countryName: string): string => {
    if (!countryName || countryName.toLowerCase() === 'unknown') {
      return '';
    }
    
    // 直接查找
    const code = countryCodeMap[countryName];
    if (code) return code;
    
    // 模糊匹配 - 查找包含关键词的
    const lowerCountry = countryName.toLowerCase();
    for (const [key, value] of Object.entries(countryCodeMap)) {
      if (key.toLowerCase().includes(lowerCountry) || lowerCountry.includes(key.toLowerCase())) {
        return value || '';
      }
    }
    
    return '';
  };

  const countryCode = getCountryCode(country);
  
  // 尺寸映射
  const sizeClasses = {
    sm: 'w-4 h-3',
    md: 'w-5 h-4', 
    lg: 'w-6 h-5'
  };
  
  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  if (!countryCode || countryCode === '') {
    // 如果没有找到国家代码，显示地球图标
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className={`${sizeClasses[size]} bg-gray-200 dark:bg-gray-700 rounded-sm flex items-center justify-center`}>
          <span className="text-xs text-gray-500">🌍</span>
        </div>
        {showName && (
          <span className={`${textSizeClasses[size]} text-gray-700 dark:text-gray-300`}>
            {country}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <img
        src={`https://flagcdn.com/w40/${countryCode}.png`}
        srcSet={`https://flagcdn.com/w80/${countryCode}.png 2x`}
        alt={`${country} flag`}
        className={`${sizeClasses[size]} object-cover rounded-sm shadow-sm`}
        loading="lazy"
        onError={(e) => {
          // 如果图片加载失败，显示emoji标志
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const parent = target.parentElement;
          if (parent) {
            const fallback = document.createElement('div');
            fallback.className = `${sizeClasses[size]} bg-gray-200 dark:bg-gray-700 rounded-sm flex items-center justify-center`;
            fallback.innerHTML = '<span class="text-xs text-gray-500">🏳️</span>';
            parent.insertBefore(fallback, target);
          }
        }}
      />
      {showName && (
        <span className={`${textSizeClasses[size]} text-gray-700 dark:text-gray-300`}>
          {country}
        </span>
      )}
    </div>
  );
};