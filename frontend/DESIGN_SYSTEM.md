# SsalgTen 设计系统

## 概述

本设计系统基于 CSS 自定义属性（CSS Variables），为应用提供统一的颜色、间距和样式管理。

## 状态颜色系统

### 基础语义色

所有颜色定义在 `src/index.css` 中。

| 变量 | 用途 | 示例 |
|------|------|------|
| `--success` | 成功、在线、正常 | 在线节点、成功消息 |
| `--warning` | 警告、注意、待处理 | 过期数据、高延迟 |
| `--error` | 错误、离线、失败 | 离线节点、错误消息 |
| `--info` | 信息、中性提示 | 一般信息、平均值 |

### 状态色阶变量

每种状态颜色提供 100-900 色阶以适应不同场景：

```css
--status-success-100  /* 最浅 - 背景色 */
--status-success-200
--status-success-300
--status-success-400
--status-success-500  /* 标准色 */
--status-success-600
--status-success-700
--status-success-800
--status-success-900  /* 最深 */
```

同样适用于 `warning`、`error`、`info`。

## 使用方式

### 在 Tailwind 类中使用 CSS 变量

```tsx
// 推荐：使用 hsl(var(--variable)) 语法
<span className="text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))]">
  在线
</span>

// 背景色
<div className="bg-[hsl(var(--status-error-100))] dark:bg-[hsl(var(--status-error-900)/0.4)]">
  错误提示
</div>

// 带透明度
<div className="bg-[hsl(var(--status-warning-500)/0.2)]">
  警告背景
</div>
```

### 预定义工具类

在 `src/index.css` 中定义了一些常用工具类：

```css
/* 基础状态色 */
.text-success, .bg-success, .border-success
.text-warning, .bg-warning, .border-warning  
.text-error, .bg-error, .border-error
.text-info, .bg-info, .border-info

/* 色阶工具类 */
.text-status-success-600, .bg-status-success-100
.text-status-warning-700, .bg-status-warning-200
...
```

## 颜色对照表

| 状态 | 原 Tailwind 色 | 新设计系统变量 |
|------|---------------|---------------|
| 成功 | `green-*`, `emerald-*` | `--status-success-*` |
| 警告 | `yellow-*`, `amber-*`, `orange-*` | `--status-warning-*` |
| 错误 | `red-*`, `rose-*` | `--status-error-*` |
| 信息 | `blue-*`, `sky-*`, `cyan-*` | `--status-info-*` |

## 最佳实践

1. **状态相关的颜色** 应使用设计系统变量
2. **装饰性/品牌渐变** 可以保留原始 Tailwind 类
3. **始终考虑深色模式**：使用 `dark:` 前缀调整深色模式下的颜色
4. **保持语义化**：选择最能表达意图的颜色变量

## 示例

### 状态指示器

```tsx
// 在线/离线指示器
<span className={`status-indicator ${
  isOnline 
    ? "bg-[hsl(var(--status-success-400))]" 
    : "bg-[hsl(var(--status-error-400))]"
}`} />
```

### 消息提示

```tsx
// 错误消息
<div className="p-3 border border-[hsl(var(--status-error-300)/0.8)] bg-[hsl(var(--status-error-50)/0.8)] dark:border-[hsl(var(--status-error-800)/0.6)] dark:bg-[hsl(var(--status-error-900)/0.3)] rounded-lg">
  <p className="text-sm text-[hsl(var(--status-error-600))] dark:text-[hsl(var(--status-error-300))]">
    {errorMessage}
  </p>
</div>
```

### 条件颜色

```tsx
// 根据状态选择颜色
const getStatusColor = (status: string) => {
  switch (status) {
    case "excellent":
      return "text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))]";
    case "good":
      return "text-[hsl(var(--status-warning-600))] dark:text-[hsl(var(--status-warning-400))]";
    case "poor":
      return "text-[hsl(var(--status-error-600))] dark:text-[hsl(var(--status-error-400))]";
    default:
      return "text-slate-600 dark:text-slate-400";
  }
};
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
