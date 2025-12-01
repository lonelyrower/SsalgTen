# SsalgTen 设计系统

## 概述

本设计系统基于 CSS 自定义属性（CSS Variables），为应用提供统一的颜色、圆角、阴影、透明度和样式管理。所有设计令牌定义在 `src/index.css` 中。

## 设计令牌

### 圆角系统 (Border Radius)

```css
--radius-xs: 0.25rem;     /* 4px - 小标签、徽章 */
--radius-sm: 0.375rem;    /* 6px - 按钮、输入框 */
--radius-md: 0.5rem;      /* 8px - 小卡片 */
--radius-lg: 0.75rem;     /* 12px - 标准卡片 */
--radius-xl: 1rem;        /* 16px - 大卡片、模态框 */
--radius-2xl: 1.5rem;     /* 24px - 特大容器 */
--radius-3xl: 2rem;       /* 32px - 英雄区域 */
--radius-full: 9999px;    /* 圆形 */
```

使用示例：
```tsx
<div className="rounded-[var(--radius-lg)]">标准卡片</div>
<span className="rounded-[var(--radius-full)]">圆形徽章</span>
```

### 阴影系统 (Box Shadow)

```css
--shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-sm: 0 2px 4px 0 rgb(0 0 0 / 0.06), 0 1px 2px 0 rgb(0 0 0 / 0.04);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -1px rgb(0 0 0 / 0.04);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -2px rgb(0 0 0 / 0.05);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 10px 10px -5px rgb(0 0 0 / 0.04);
--shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25);
--shadow-inner: inset 0 2px 4px 0 rgb(0 0 0 / 0.05);
```

使用示例：
```tsx
<div className="shadow-[var(--shadow-md)]">中等阴影</div>
<div className="shadow-[var(--shadow-lg)] hover:shadow-[var(--shadow-xl)]">悬停放大阴影</div>
```

### 间距系统 (Spacing)

```css
--spacing-card-sm: 1rem;      /* 16px - 小卡片内边距 */
--spacing-card-md: 1.25rem;   /* 20px - 中等卡片内边距 */
--spacing-card-lg: 1.5rem;    /* 24px - 大卡片内边距 */
--spacing-card-xl: 2rem;      /* 32px - 特大卡片内边距 */
```

### 模糊系统 (Blur)

```css
--blur-sm: 4px;
--blur-md: 8px;
--blur-lg: 12px;
--blur-xl: 16px;
--blur-2xl: 24px;
```

使用示例：
```tsx
<div className="backdrop-blur-[var(--blur-md)]">玻璃模糊效果</div>
```

### 过渡动画 (Transition)

```css
/* 时间 */
--duration-fast: 150ms;
--duration-normal: 200ms;
--duration-slow: 300ms;
--duration-slower: 500ms;

/* 缓动函数 */
--ease-default: cubic-bezier(0.4, 0, 0.2, 1);
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
```

使用示例：
```tsx
<button className="transition-all duration-[var(--duration-normal)] ease-[var(--ease-default)]">
  平滑过渡
</button>
```

### 玻璃效果系统 (Glass Morphism)

**亮色模式：**
```css
--glass-bg: rgba(255, 255, 255, 0.8);
--glass-bg-subtle: rgba(255, 255, 255, 0.6);
--glass-bg-strong: rgba(255, 255, 255, 0.9);
--glass-border: rgba(255, 255, 255, 0.2);
--glass-border-subtle: rgba(255, 255, 255, 0.1);
--glass-border-strong: rgba(255, 255, 255, 0.3);
--glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
```

**深色模式：**
```css
--glass-bg: rgba(255, 255, 255, 0.1);
--glass-bg-subtle: rgba(255, 255, 255, 0.05);
--glass-bg-strong: rgba(255, 255, 255, 0.15);
/* ... */
```

### 边框系统 (Border)

```css
/* 边框颜色 (HSL 值) */
--border-subtle: 220 13% 91%;     /* 浅灰边框 */
--border-muted: 214 32% 85%;      /* 中灰边框 */
--border-strong: 214 32% 75%;     /* 深灰边框 */

/* 边框透明度 */
--border-opacity-subtle: 0.5;
--border-opacity-muted: 0.6;
--border-opacity-strong: 0.8;
```

使用示例：
```tsx
<div className="border border-[hsl(var(--border-subtle))]">浅边框</div>
```

---

## 状态颜色系统

### 基础语义色

| 变量 | 用途 | 示例 |
|------|------|------|
| `--success` | 成功、在线、正常 | 在线节点、成功消息 |
| `--warning` | 警告、注意、待处理 | 过期数据、高延迟 |
| `--error` | 错误、离线、失败 | 离线节点、错误消息 |
| `--info` | 信息、中性提示 | 一般信息、平均值 |

### 状态色阶变量

每种状态颜色提供 50-900 色阶以适应不同场景：

```css
--status-success-50   /* 最浅 - 浅背景色 */
--status-success-100  /* 背景色 */
--status-success-200  /* 浅边框 */
--status-success-300  /* 边框 */
--status-success-400  /* 次要文字 */
--status-success-500  /* 标准色 */
--status-success-600  /* 主要文字/按钮 */
--status-success-700  /* 深文字 */
--status-success-800  /* 深色边框 */
--status-success-900  /* 最深 - 深色背景 */
```

同样适用于 `warning`、`error`、`info`。

## 使用方式

### 在 Tailwind 类中使用 CSS 变量

```tsx
// 颜色变量
<span className="text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))]">
  在线
</span>

// 圆角变量
<div className="rounded-[var(--radius-xl)]">大圆角卡片</div>

// 阴影变量
<div className="shadow-[var(--shadow-lg)]">大阴影</div>

// 过渡变量
<button className="transition-all duration-[var(--duration-normal)]">按钮</button>
```

## 颜色对照表

| 状态 | 原 Tailwind 色 | 新设计系统变量 |
|------|---------------|---------------|
| 成功 | `green-*`, `emerald-*` | `--status-success-*` |
| 警告 | `yellow-*`, `amber-*`, `orange-*` | `--status-warning-*` |
| 错误 | `red-*`, `rose-*` | `--status-error-*` |
| 信息 | `blue-*`, `sky-*`, `cyan-*` | `--status-info-*` |

## 组件参考

### GlassCard

支持的 variant：
- `default` - 默认玻璃效果
- `subtle` - 轻微效果
- `strong` - 强烈效果
- `tech` - 科技感
- `gradient` - 渐变
- `success` - 成功状态
- `warning` - 警告状态
- `danger` - 危险状态
- `info` - 信息状态
- `orange` - 橙色主题

### Badge

支持的 variant：
- `default`, `secondary`, `destructive`, `outline`
- `success`, `warning`, `info` - 实心状态色
- `success-soft`, `warning-soft`, `error-soft`, `info-soft` - 柔和状态色

### Button

支持的 variant：
- `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`
- `success`, `warning`, `info` - 状态按钮

## 最佳实践

1. **使用设计令牌** 而非硬编码值
2. **圆角**：使用 `rounded-[var(--radius-*)]`
3. **阴影**：使用 `shadow-[var(--shadow-*)]`
4. **过渡**：使用 `duration-[var(--duration-*)]`
5. **状态颜色**：使用 `hsl(var(--status-*-NNN))`
6. **深色模式**：始终使用 `dark:` 前缀提供深色变体

## 示例

### 卡片组件

```tsx
<div className="
  rounded-[var(--radius-xl)]
  shadow-[var(--shadow-md)]
  border border-[hsl(var(--border-subtle))]
  bg-[var(--glass-bg)]
  backdrop-blur-[var(--blur-md)]
  p-[var(--spacing-card-lg)]
  transition-all duration-[var(--duration-normal)]
  hover:shadow-[var(--shadow-lg)]
">
  卡片内容
</div>
```

### 状态指示器

```tsx
<span className={`
  inline-flex items-center gap-1.5
  px-2 py-0.5
  rounded-[var(--radius-full)]
  text-xs font-medium
  ${isOnline 
    ? "bg-[hsl(var(--status-success-100))] text-[hsl(var(--status-success-700))] dark:bg-[hsl(var(--status-success-900)/0.3)] dark:text-[hsl(var(--status-success-300))]"
    : "bg-[hsl(var(--status-error-100))] text-[hsl(var(--status-error-700))] dark:bg-[hsl(var(--status-error-900)/0.3)] dark:text-[hsl(var(--status-error-300))]"
  }
`}>
  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-[hsl(var(--status-success-500))]" : "bg-[hsl(var(--status-error-500))]"}`} />
  {isOnline ? "在线" : "离线"}
</span>
```

## 品牌颜色

```css
--brand-cyan: 189 94% 43%;   /* 科技青色 */
--brand-blue: 217 91% 55%;   /* 科技蓝色 */
```

使用方式：
```tsx
<span className="text-[hsl(var(--brand-cyan))]">科技青</span>
<div className="bg-gradient-to-r from-[hsl(var(--brand-cyan))] to-[hsl(var(--brand-blue))]">
  渐变背景
</div>
```
