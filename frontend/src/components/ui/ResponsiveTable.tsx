import React from "react";
import { useMobile } from "@/hooks/useMobile";

interface ResponsiveTableProps {
  children: React.ReactNode;
  className?: string;
  mobileClassName?: string;
  breakpoint?: "sm" | "md" | "lg"; // 在哪个断点切换为卡片模式
}

interface ResponsiveTableRowProps {
  children: React.ReactNode;
  className?: string;
  mobileCardContent?: React.ReactNode; // 移动端显示的卡片内容
}

interface ResponsiveTableCellProps {
  children: React.ReactNode;
  className?: string;
  label?: string; // 移动端显示的标签
  hideOnMobile?: boolean; // 在移动端隐藏
}

export const ResponsiveTable: React.FC<ResponsiveTableProps> = ({
  children,
  className = "",
  mobileClassName = "",
  breakpoint = "md",
}) => {
  const { isMobile, screenWidth } = useMobile();

  const shouldUseMobileLayout = () => {
    switch (breakpoint) {
      case "sm":
        return screenWidth <= 640;
      case "md":
        return screenWidth <= 768;
      case "lg":
        return screenWidth <= 1024;
      default:
        return isMobile;
    }
  };

  if (shouldUseMobileLayout()) {
    return (
      <div className={`mobile-table-cards ${mobileClassName}`}>{children}</div>
    );
  }

  return (
    <div className="mobile-table mobile-scroll">
      <table className={`w-full ${className}`}>{children}</table>
    </div>
  );
};

export const ResponsiveTableRow: React.FC<ResponsiveTableRowProps> = ({
  children,
  className = "",
  mobileCardContent,
}) => {
  const { isMobile } = useMobile();

  if (isMobile && mobileCardContent) {
    return (
      <div className={`mobile-card-row ${className}`}>{mobileCardContent}</div>
    );
  }

  return <tr className={className}>{children}</tr>;
};

export const ResponsiveTableCell: React.FC<ResponsiveTableCellProps> = ({
  children,
  className = "",
  label = "",
  hideOnMobile = false,
}) => {
  const { isMobile } = useMobile();

  if (isMobile) {
    if (hideOnMobile) return null;

    return (
      <div className={`mobile-table-cell ${className}`}>
        {label && (
          <span className="mobile-table-label text-sm font-medium text-gray-500 dark:text-gray-400">
            {label}:
          </span>
        )}
        <span className="mobile-table-content">{children}</span>
      </div>
    );
  }

  return <td className={className}>{children}</td>;
};

// 移动端表格样式的 CSS 类
const tableStyles = `
  .mobile-table-cards {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .mobile-card-row {
    background: white;
    border-radius: 0.75rem;
    padding: 1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    border: 1px solid rgb(229 231 235);
  }

  .dark .mobile-card-row {
    background: rgb(31 41 55);
    border-color: rgb(75 85 99);
  }

  .mobile-table-cell {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
  }

  .mobile-table-cell:last-child {
    margin-bottom: 0;
  }

  .mobile-table-label {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .mobile-table-content {
    font-size: 0.875rem;
  }
`;

// 将样式注入到文档中
if (
  typeof window !== "undefined" &&
  !document.getElementById("responsive-table-styles")
) {
  const style = document.createElement("style");
  style.id = "responsive-table-styles";
  style.textContent = tableStyles;
  document.head.appendChild(style);
}

// 简化的表格组件，用于快速替换现有表格
interface SimpleResponsiveTableProps<T> {
  data: T[];
  columns: Array<{
    key: keyof T;
    label: string;
    render?: (value: T[keyof T], item: T) => React.ReactNode;
    hideOnMobile?: boolean;
    className?: string;
  }>;
  className?: string;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
}

export function SimpleResponsiveTable<T>({
  data,
  columns,
  className = "",
  emptyMessage = "暂无数据",
  onRowClick,
}: SimpleResponsiveTableProps<T>) {
  const { isMobile } = useMobile();

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="mobile-card-stack">
        {data.map((item, index) => (
          <div
            key={index}
            className={`mobile-card-row ${
              onRowClick
                ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                : ""
            }`}
            onClick={() => onRowClick?.(item)}
          >
            {columns.map((column) => {
              if (column.hideOnMobile) return null;
              const value = item[column.key];
              const renderedValue = column.render
                ? column.render(value, item)
                : String(value || "");

              return (
                <div key={String(column.key)} className="mobile-table-cell">
                  <span className="mobile-table-label">{column.label}</span>
                  <span className="mobile-table-content">{renderedValue}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mobile-table">
      <table className={`w-full ${className}`}>
        <thead>
          <tr className="border-b border-[hsl(var(--border-subtle))] dark:border-[hsl(var(--border-muted))]">
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className={`text-left py-3 px-4 font-medium text-gray-900 dark:text-white ${column.className || ""}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr
              key={index}
              className={`border-b border-gray-100 dark:border-gray-800 ${
                onRowClick
                  ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  : ""
              }`}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((column) => {
                const value = item[column.key];
                const renderedValue = column.render
                  ? column.render(value, item)
                  : String(value || "");

                return (
                  <td
                    key={String(column.key)}
                    className={`py-3 px-4 text-gray-700 dark:text-gray-300 ${column.className || ""}`}
                  >
                    {renderedValue}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
