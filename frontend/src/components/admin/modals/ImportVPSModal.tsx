import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiService } from "@/services/api";

interface ImportVPSModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export const ImportVPSModal: React.FC<ImportVPSModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onError,
}) => {
  const [importText, setImportText] = useState("");
  const [importNeverAdopt, setImportNeverAdopt] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<null | {
    created: number;
    updated: number;
    skipped: number;
    total: number;
  }>(null);

  if (!isOpen) return null;

  const handleImport = async () => {
    const raw = importText.trim();
    if (!raw) {
      onError("请输入或选择包含 IP 的内容");
      return;
    }

    let items: Array<{
      ip: string;
      name?: string;
      notes?: string;
      tags?: string[];
      neverAdopt?: boolean;
    }> = [];

    try {
      if (raw.startsWith("[") || raw.startsWith("{")) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) items = parsed;
        else if (Array.isArray(parsed.items)) items = parsed.items;
      }
    } catch {
      // JSON解析失败时忽略错误，继续处理原始文本
    }

    if (items.length === 0) {
      const lines = raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      items = lines.map((ip) => ({ ip }));
    }

    items = items.map((it) => ({
      ...it,
      neverAdopt:
        typeof it.neverAdopt === "boolean" ? it.neverAdopt : importNeverAdopt,
    }));

    setImporting(true);
    setImportResult(null);

    try {
      const resp = await apiService.importPlaceholderNodes(items);
      if (resp.success && resp.data) {
        setImportResult(resp.data);
        onSuccess();
      } else {
        onError(resp.error || "导入失败");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error && e.message ? String(e.message) : "";
      if (
        msg.includes("Placeholder feature not available") ||
        msg.includes("501")
      ) {
        onError(
          "占位功能不可用：请先在后端执行数据库迁移（prisma migrate deploy）后重试。",
        );
      } else {
        onError("导入失败");
      }
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setImportText("");
    setImportResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="bg-white dark:bg-gray-800 p-0  shadow-2xl max-w-2xl w-full border-0 ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            导入过期 VPS
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            支持两种方式：1) 选择文件（.txt 每行一个 IP；或 .json，数组为包含 ip 字段的对象）；2)
            直接在文本框中粘贴 IP（每行一个）。 这些节点将以"离线"状态显示；默认设置为"纪念/冻结"，不会被后续相同
            IP 的新 Agent 自动合并。
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">选择文件（可选）</label>
              <input
                type="file"
                accept=".txt,.json"
                aria-label="选择节点导入文件"
                placeholder="选择 .txt 或 .json 文件"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const text = await file.text();
                    setImportText((prev) => (prev ? prev + "\n" + text : text));
                  } catch {
                    onError("读取文件失败");
                  }
                }}
                className="block w-full text-sm text-gray-700 dark:text-gray-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                IP 列表（每行一个）或 JSON
              </label>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={10}
                placeholder={
                  '示例:\n203.0.113.10\n2001:db8::1234\n或 JSON:\n[{"ip":"203.0.113.10","name":"Expired-1"}]'
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={importNeverAdopt}
                onChange={(e) => setImportNeverAdopt(e.target.checked)}
              />
              <span className="text-gray-700 dark:text-gray-300">
                设置为"纪念/冻结"（neverAdopt）
              </span>
            </label>

            {importResult && (
              <div className="text-sm text-gray-700 dark:text-gray-200 bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded">
                导入完成：新增 {importResult.created}，更新 {importResult.updated}，跳过{" "}
                {importResult.skipped}，共 {importResult.total}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <Button
              variant="outline"
              onClick={handleClose}
              className="min-w-[80px] hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              取消
            </Button>
            <Button
              variant="success"
              onClick={handleImport}
              disabled={importing || !importText.trim()}
              className="min-w-[120px]"
            >
              {importing ? "正在导入…" : "开始导入"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
