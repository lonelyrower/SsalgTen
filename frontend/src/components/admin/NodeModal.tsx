import React, { useState, useEffect } from "react";
import { apiService, type NodeData } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  X,
  Server,
  Globe,
  MapPin,
  Settings,
  Activity,
  AlertCircle,
} from "lucide-react";

interface NodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  node?: NodeData | null;
  onSaved: () => void;
}

interface NodeFormData {
  name: string;
  country: string;
  city: string;
  provider: string;
  ipv4: string;
  ipv6: string;
  latitude: number;
  longitude: number;
  description: string;
  apiKey: string;
  port: number;
  enabled: boolean;
}

export const NodeModal: React.FC<NodeModalProps> = ({
  isOpen,
  onClose,
  node,
  onSaved,
}) => {
  const [formData, setFormData] = useState<NodeFormData>({
    name: "",
    country: "",
    city: "",
    provider: "",
    ipv4: "",
    ipv6: "",
    latitude: 0,
    longitude: 0,
    description: "",
    apiKey: "",
    port: 3002,
    enabled: true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (isOpen) {
      if (node) {
        setFormData({
          name: node.name || "",
          country: node.country || "",
          city: node.city || "",
          provider: node.provider || "",
          ipv4: node.ipv4 || "",
          ipv6: node.ipv6 || "",
          latitude: node.latitude || 0,
          longitude: node.longitude || 0,
          description: node.description || "",
          apiKey: node.apiKey || "",
          port: node.port || 3002,
          enabled: node.enabled !== false,
        });
      } else {
        setFormData({
          name: "",
          country: "",
          city: "",
          provider: "",
          ipv4: "",
          ipv6: "",
          latitude: 0,
          longitude: 0,
          description: "",
          apiKey: "",
          port: 3002,
          enabled: true,
        });
      }
      setError("");
      setValidationErrors({});
    }
  }, [isOpen, node]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "节点名称不能为空";
    }

    if (!formData.country.trim()) {
      errors.country = "国家不能为空";
    }

    if (!formData.city.trim()) {
      errors.city = "城市不能为空";
    }

    if (!formData.provider.trim()) {
      errors.provider = "服务商不能为空";
    }

    if (!formData.ipv4.trim()) {
      errors.ipv4 = "IPv4地址不能为空";
    } else {
      const ipv4Regex =
        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipv4Regex.test(formData.ipv4)) {
        errors.ipv4 = "IPv4地址格式不正确";
      }
    }

    if (formData.ipv6 && formData.ipv6.trim()) {
      const ipv6Regex =
        /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
      if (!ipv6Regex.test(formData.ipv6)) {
        errors.ipv6 = "IPv6地址格式不正确";
      }
    }

    if (formData.latitude < -90 || formData.latitude > 90) {
      errors.latitude = "纬度必须在-90到90之间";
    }

    if (formData.longitude < -180 || formData.longitude > 180) {
      errors.longitude = "经度必须在-180到180之间";
    }

    if (formData.port < 1 || formData.port > 65535) {
      errors.port = "端口必须在1到65535之间";
    }

    if (!formData.apiKey.trim()) {
      errors.apiKey = "API密钥不能为空";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = node
        ? await apiService.updateNode(node.id, formData)
        : await apiService.createNode(formData);

      if (response.success) {
        onSaved();
        onClose();
      } else {
        setError(
          response.error || `Failed to ${node ? "update" : "create"} node`,
        );
      }
    } catch {
      setError(`Failed to ${node ? "update" : "create"} node`);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    field: keyof NodeFormData,
    value: string | number | boolean,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (validationErrors[field]) {
      setValidationErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Server className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {node ? "编辑节点" : "添加节点"}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 内容区域 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <p className="text-red-800 dark:text-red-200">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 基本信息 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                  <Settings className="h-5 w-5 mr-2 text-primary" />
                  基本信息
                </h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    节点名称 *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary ${
                      validationErrors.name
                        ? "border-red-300 dark:border-red-600"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                    placeholder="输入节点名称"
                  />
                  {validationErrors.name && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {validationErrors.name}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      国家 *
                    </label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) =>
                        handleInputChange("country", e.target.value)
                      }
                      className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary ${
                        validationErrors.country
                          ? "border-red-300 dark:border-red-600"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                      placeholder="中国"
                    />
                    {validationErrors.country && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {validationErrors.country}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      城市 *
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) =>
                        handleInputChange("city", e.target.value)
                      }
                      className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary ${
                        validationErrors.city
                          ? "border-red-300 dark:border-red-600"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                      placeholder="北京"
                    />
                    {validationErrors.city && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {validationErrors.city}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    服务商 *
                  </label>
                  <input
                    type="text"
                    value={formData.provider}
                    onChange={(e) =>
                      handleInputChange("provider", e.target.value)
                    }
                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary ${
                      validationErrors.provider
                        ? "border-red-300 dark:border-red-600"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                    placeholder="阿里云"
                  />
                  {validationErrors.provider && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {validationErrors.provider}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    描述
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      handleInputChange("description", e.target.value)
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="节点描述信息"
                  />
                </div>
              </div>

              {/* 网络配置 */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                  <Globe className="h-5 w-5 mr-2 text-green-600" />
                  网络配置
                </h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    IPv4地址 *
                  </label>
                  <input
                    type="text"
                    value={formData.ipv4}
                    onChange={(e) => handleInputChange("ipv4", e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary font-mono ${
                      validationErrors.ipv4
                        ? "border-red-300 dark:border-red-600"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                    placeholder="192.168.1.1"
                  />
                  {validationErrors.ipv4 && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {validationErrors.ipv4}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    IPv6地址
                  </label>
                  <input
                    type="text"
                    value={formData.ipv6}
                    onChange={(e) => handleInputChange("ipv6", e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary font-mono ${
                      validationErrors.ipv6
                        ? "border-red-300 dark:border-red-600"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                    placeholder="2001:db8::1"
                  />
                  {validationErrors.ipv6 && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {validationErrors.ipv6}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    端口 *
                  </label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) =>
                      handleInputChange("port", parseInt(e.target.value) || 0)
                    }
                    min="1"
                    max="65535"
                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary ${
                      validationErrors.port
                        ? "border-red-300 dark:border-red-600"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                    placeholder="3002"
                  />
                  {validationErrors.port && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {validationErrors.port}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    API密钥 *
                  </label>
                  <input
                    type="text"
                    value={formData.apiKey}
                    onChange={(e) =>
                      handleInputChange("apiKey", e.target.value)
                    }
                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary font-mono ${
                      validationErrors.apiKey
                        ? "border-red-300 dark:border-red-600"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                    placeholder="agent-api-key-here"
                  />
                  {validationErrors.apiKey && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {validationErrors.apiKey}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 地理位置 */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center mb-4">
                <MapPin className="h-5 w-5 mr-2 text-orange-600" />
                地理位置
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    纬度 *
                  </label>
                  <input
                    type="number"
                    value={formData.latitude}
                    onChange={(e) =>
                      handleInputChange(
                        "latitude",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    step="0.000001"
                    min="-90"
                    max="90"
                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary ${
                      validationErrors.latitude
                        ? "border-red-300 dark:border-red-600"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                    placeholder="39.904211"
                  />
                  {validationErrors.latitude && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {validationErrors.latitude}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    经度 *
                  </label>
                  <input
                    type="number"
                    value={formData.longitude}
                    onChange={(e) =>
                      handleInputChange(
                        "longitude",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    step="0.000001"
                    min="-180"
                    max="180"
                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary ${
                      validationErrors.longitude
                        ? "border-red-300 dark:border-red-600"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                    placeholder="116.407395"
                  />
                  {validationErrors.longitude && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {validationErrors.longitude}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 状态设置 */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center mb-4">
                <Activity className="h-5 w-5 mr-2 text-purple-600" />
                状态设置
              </h3>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled}
                  onChange={(e) =>
                    handleInputChange("enabled", e.target.checked)
                  }
                  className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <label
                  htmlFor="enabled"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  启用节点
                </label>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                禁用的节点将不会接收诊断请求
              </p>
            </div>
          </form>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            取消
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={loading}
            className=""
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {node ? "更新中..." : "创建中..."}
              </>
            ) : node ? (
              "更新节点"
            ) : (
              "创建节点"
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};
