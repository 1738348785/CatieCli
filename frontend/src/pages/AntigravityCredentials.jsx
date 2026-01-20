import {
    ArrowLeft,
    Cat,
    CheckCircle,
    ChevronDown,
    ChevronUp,
    Download,
    ExternalLink,
    RefreshCw,
    Rocket,
    Shield,
    Trash2,
    X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../App";

export default function AntigravityCredentials() {
  const { user } = useAuth();
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [verifyResult, setVerifyResult] = useState(null);
  const [quotaResult, setQuotaResult] = useState(null);
  const [loadingQuota, setLoadingQuota] = useState(null);
  const [stats, setStats] = useState(null);
  
  // 额度预览相关状态
  const [expandedQuota, setExpandedQuota] = useState(null); // 当前展开的凭证ID
  const [quotaCache, setQuotaCache] = useState({}); // 缓存额度数据 { credId: { claude, gemini, banana } }
  const [loadingQuotaPreview, setLoadingQuotaPreview] = useState(null);

  useEffect(() => {
    fetchCredentials();
    fetchStats();
  }, []);

  const fetchCredentials = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/antigravity/credentials");
      setCredentials(res.data);
    } catch (err) {
      setMessage({ type: "error", text: "获取凭证失败" });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get("/api/antigravity/stats");
      setStats(res.data);
    } catch (err) {
      console.error("获取统计失败", err);
    }
  };

  const togglePublic = async (id, currentPublic) => {
    try {
      await api.patch(`/api/antigravity/credentials/${id}`, null, {
        params: { is_public: !currentPublic },
      });
      fetchCredentials();
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.detail || "操作失败",
      });
    }
  };

  const toggleActive = async (id, currentActive) => {
    try {
      await api.patch(`/api/antigravity/credentials/${id}`, null, {
        params: { is_active: !currentActive },
      });
      fetchCredentials();
    } catch (err) {
      setMessage({ type: "error", text: "操作失败" });
    }
  };

  const deleteCred = async (id) => {
    if (!confirm("确定删除此凭证？此操作不可恢复！")) return;
    try {
      await api.delete(`/api/antigravity/credentials/${id}`);
      setMessage({ type: "success", text: "删除成功" });
      fetchCredentials();
      fetchStats();
    } catch (err) {
      setMessage({ type: "error", text: "删除失败" });
    }
  };

  const [verifying, setVerifying] = useState(null);

  // 导出格式选择弹窗
  const [exportModal, setExportModal] = useState(null); // { id, email }

  const showExportModal = (id, email) => {
    setExportModal({ id, email });
  };

  const exportCred = async (format = "full") => {
    if (!exportModal) return;
    const { id, email } = exportModal;
    try {
      const res = await api.get(`/api/antigravity/credentials/${id}/export`, {
        params: { format },
      });
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        format === "simple"
          ? `simple_${email || id}.json`
          : `antigravity_${email || id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage({ type: "success", text: "凭证已导出！" });
      setExportModal(null);
    } catch (err) {
      setMessage({
        type: "error",
        text: "导出失败: " + (err.response?.data?.detail || err.message),
      });
    }
  };

  const verifyCred = async (id, email) => {
    setVerifying(id);
    try {
      const res = await api.post(`/api/antigravity/credentials/${id}/verify`);
      setVerifyResult({ ...res.data, email });
      fetchCredentials();
    } catch (err) {
      setVerifyResult({
        error: err.response?.data?.detail || err.message,
        is_valid: false,
        email,
      });
    } finally {
      setVerifying(null);
    }
  };

  const refreshProjectId = async (id, email) => {
    setVerifying(id);
    try {
      const res = await api.post(
        `/api/antigravity/credentials/${id}/refresh-project-id`,
      );
      setVerifyResult({
        ...res.data,
        email,
        is_project_id_refresh: true,
        is_valid: res.data.success,
      });
      if (res.data.success) {
        fetchCredentials();
      }
    } catch (err) {
      setVerifyResult({
        error: err.response?.data?.detail || err.message,
        is_valid: false,
        email,
        is_project_id_refresh: true,
      });
    } finally {
      setVerifying(null);
    }
  };

  const fetchQuota = async (id, email) => {
    setLoadingQuota(id);
    try {
      const res = await api.get(`/api/antigravity/credentials/${id}/quota`);
      setQuotaResult({ ...res.data, email });
    } catch (err) {
      setQuotaResult({
        success: false,
        error: err.response?.data?.detail || err.message,
        email,
      });
    } finally {
      setLoadingQuota(null);
    }
  };

  const deleteAllInactive = async () => {
    if (!confirm("确定删除所有失效的 Antigravity 凭证？此操作不可恢复！"))
      return;
    try {
      const res = await api.delete(
        "/api/antigravity/credentials/inactive/batch",
      );
      setMessage({ type: "success", text: res.data.message });
      fetchCredentials();
      fetchStats();
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.detail || "删除失败",
      });
    }
  };

  // 切换额度预览展开/收起
  const toggleQuotaPreview = async (credId) => {
    if (expandedQuota === credId) {
      setExpandedQuota(null);
      return;
    }
    
    setExpandedQuota(credId);
    
    // 如果没有缓存，则加载额度
    if (!quotaCache[credId]) {
      await fetchQuotaPreview(credId);
    }
  };

  // 获取额度预览（简化版本）
  const fetchQuotaPreview = async (credId) => {
    setLoadingQuotaPreview(credId);
    try {
      const res = await api.get(`/api/antigravity/credentials/${credId}/quota`);
      if (res.data.success) {
        // 聚合额度数据
        const models = res.data.models || {};
        const aggregated = aggregateQuota(models);
        setQuotaCache(prev => ({ ...prev, [credId]: aggregated }));
      } else {
        setQuotaCache(prev => ({ ...prev, [credId]: { error: res.data.error || "获取失败" } }));
      }
    } catch (err) {
      setQuotaCache(prev => ({ ...prev, [credId]: { error: "获取额度失败" } }));
    } finally {
      setLoadingQuotaPreview(null);
    }
  };

  // 聚合额度数据为三类：Claude、Gemini、banana
  const aggregateQuota = (models) => {
    const result = {
      claude: { remaining: 0, count: 0, resetTime: "" },
      gemini: { remaining: 0, count: 0, resetTime: "" },
      banana: { remaining: 0, count: 0, resetTime: "" },
    };
    
    Object.entries(models).forEach(([modelId, data]) => {
      const lower = modelId.toLowerCase();
      const remaining = data.remaining || 0;
      const resetTime = data.resetTime || "";
      
      if (lower.includes("claude")) {
        result.claude.remaining += remaining;
        result.claude.count += 1;
        if (!result.claude.resetTime && resetTime) result.claude.resetTime = resetTime;
      } else if (lower.includes("gemini") || lower.includes("flash") || lower.includes("pro")) {
        // 排除 image 模型
        if (!lower.includes("image") && !lower.includes("banana")) {
          result.gemini.remaining += remaining;
          result.gemini.count += 1;
          if (!result.gemini.resetTime && resetTime) result.gemini.resetTime = resetTime;
        }
      }
      
      // banana / image 模型
      if (lower.includes("image") || lower.includes("banana")) {
        result.banana.remaining += remaining;
        result.banana.count += 1;
        if (!result.banana.resetTime && resetTime) result.banana.resetTime = resetTime;
      }
    });
    
    // 计算平均值
    if (result.claude.count > 0) result.claude.remaining = Math.round(result.claude.remaining / result.claude.count);
    if (result.gemini.count > 0) result.gemini.remaining = Math.round(result.gemini.remaining / result.gemini.count);
    if (result.banana.count > 0) result.banana.remaining = Math.round(result.banana.remaining / result.banana.count);
    
    return result;
  };

  // 额度进度条颜色
  const getQuotaColor = (remaining) => {
    if (remaining >= 80) return { bar: "bg-green-500", text: "text-green-400" };
    if (remaining >= 40) return { bar: "bg-yellow-500", text: "text-yellow-400" };
    if (remaining >= 20) return { bar: "bg-orange-500", text: "text-orange-400" };
    return { bar: "bg-red-500", text: "text-red-400" };
  };

  return (
    <div className="min-h-screen">
      {/* 导出格式选择弹窗 */}
      {exportModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-xl p-6 max-w-sm w-full mx-4 border border-dark-600">
            <h3 className="text-lg font-bold mb-4">选择导出格式</h3>
            <p className="text-gray-400 text-sm mb-4">
              凭证: {exportModal.email}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => exportCred("full")}
                className="w-full p-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-left"
              >
                <div className="font-medium">完整格式</div>
                <div className="text-xs text-blue-200 mt-1">
                  包含 client_id, client_secret, refresh_token, token,
                  project_id
                </div>
              </button>
              <button
                onClick={() => exportCred("simple")}
                className="w-full p-3 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-left"
              >
                <div className="font-medium">简化格式</div>
                <div className="text-xs text-orange-200 mt-1">
                  仅包含 email + refresh_token
                </div>
              </button>
            </div>
            <button
              onClick={() => setExportModal(null)}
              className="w-full mt-4 p-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-gray-400"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 导航栏 */}
      <nav className="bg-dark-900 border-b border-dark-700">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Cat className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400" />
            <span className="hidden sm:inline text-xl font-bold">Catiecli</span>
            <span className="text-xs sm:text-sm text-orange-400 bg-orange-500/20 px-1.5 sm:px-2 py-0.5 rounded flex items-center gap-1">
              <Rocket size={12} className="sm:hidden" />
              <Rocket size={14} className="hidden sm:block" />
              <span className="hidden sm:inline">Antigravity</span> 凭证
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/antigravity-oauth"
              className="px-2 sm:px-3 py-1 sm:py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded text-xs sm:text-sm font-medium flex items-center gap-1"
            >
              <ExternalLink size={14} />
              <span className="hidden xs:inline">获取凭证</span>
              <span className="xs:hidden">获取</span>
            </Link>
            <Link
              to="/dashboard"
              className="text-gray-400 hover:text-white flex items-center gap-2"
            >
              <ArrowLeft size={20} />
              返回
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 统计信息 */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="card p-4">
              <div className="text-2xl font-bold text-orange-400">
                {stats.total}
              </div>
              <div className="text-xs text-gray-400">总凭证</div>
            </div>
            <div className="card p-4">
              <div className="text-2xl font-bold text-green-400">
                {stats.active}
              </div>
              <div className="text-xs text-gray-400">活跃凭证</div>
            </div>
            <div className="card p-4">
              <div className="text-2xl font-bold text-purple-400">
                {stats.public}
              </div>
              <div className="text-xs text-gray-400">公开凭证</div>
            </div>
            <div className="card p-4">
              <div className="text-2xl font-bold text-cyan-400">
                {stats.user_active}
              </div>
              <div className="text-xs text-gray-400">我的活跃</div>
            </div>
          </div>
        )}

        {/* 消息提示 */}
        {message.text && (
          <div
            className={`mb-6 p-4 rounded-xl border ${
              message.type === "success"
                ? "bg-green-500/10 border-green-500/30 text-green-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* 凭证列表 */}
        <div className="card p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
              <Shield className="text-orange-400" size={20} />
              我的 Antigravity 凭证 ({credentials.length})
            </h2>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {credentials.some((c) => !c.is_active) && (
                <button
                  onClick={deleteAllInactive}
                  className="text-red-400 hover:text-red-300 text-xs px-2 py-1 border border-red-500/30 rounded hover:bg-red-500/10"
                  title="删除所有失效凭证"
                >
                  清理失效
                </button>
              )}
              <Link
                to="/antigravity-oauth"
                className="px-2 sm:px-3 py-1 sm:py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded text-xs font-medium flex items-center gap-1"
              >
                <ExternalLink size={12} />
                <span className="hidden xs:inline">获取</span>新凭证
              </Link>
              <button
                onClick={() => {
                  fetchCredentials();
                  fetchStats();
                }}
                className="text-gray-400 hover:text-white p-1.5 sm:p-2"
                title="刷新"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-400">
              <RefreshCw className="animate-spin mx-auto mb-2" />
              加载中...
            </div>
          ) : credentials.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Rocket size={48} className="mx-auto mb-4 opacity-30" />
              <p>暂无 Antigravity 凭证</p>
              <p className="text-sm mt-2">
                点击上方"获取凭证"按钮获取或上传凭证
              </p>
              <Link
                to="/antigravity-oauth"
                className="inline-flex items-center gap-2 px-6 py-3 mt-4 bg-orange-600 hover:bg-orange-500 text-white rounded-lg"
              >
                <ExternalLink size={18} />
                获取 Antigravity 凭证
              </Link>
            </div>
          ) : (
            /* 网格布局的凭证卡片 - 桌面端4列，平板2列，移动端1列 */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {credentials.map((cred, index) => (
                <div
                  key={cred.id}
                  className={`rounded-xl border-2 transition-all hover:shadow-lg ${
                    cred.is_active
                      ? "bg-gradient-to-br from-dark-800 to-dark-900 border-cyan-500/30 hover:border-cyan-500/50"
                      : "bg-dark-900 border-red-500/30 opacity-70"
                  }`}
                >
                  {/* 卡片头部 - 状态和序号 */}
                  <div className="flex items-center justify-between p-3 border-b border-dark-600/50">
                    <div className="flex items-center gap-1.5">
                      {cred.is_active ? (
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-500 text-white rounded font-medium">
                          ✓ 启用
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white rounded font-medium">
                          ✕ 禁用
                        </span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/30 text-orange-400 rounded">
                        🚀
                      </span>
                      {cred.remark?.includes("[PRO]") && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/30 text-yellow-400 rounded">
                          ⭐
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* 搜索/查看按钮 */}
                      <button
                        onClick={() => fetchQuota(cred.id, cred.email || cred.name)}
                        disabled={loadingQuota === cred.id || !cred.is_active}
                        className="w-7 h-7 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 flex items-center justify-center text-white"
                        title="查看额度详情"
                      >
                        {loadingQuota === cred.id ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <span className="text-xs">🔍</span>
                        )}
                      </button>
                      <span className="text-xs text-gray-500">#{index + 1}</span>
                    </div>
                  </div>

                  {/* 凭证信息区 */}
                  <div className="p-3 space-y-2">
                    {/* Project ID */}
                    {cred.project_id && (
                      <div className="flex items-center gap-2">
                        <span className="text-green-400 text-xs">📦</span>
                        <span className="text-xs font-mono text-gray-300 truncate flex-1" title={cred.project_id}>
                          {cred.project_id}
                        </span>
                      </div>
                    )}
                    {/* Email */}
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-xs">📧</span>
                      <span className="text-xs text-gray-400 truncate flex-1" title={cred.email || cred.name}>
                        {cred.email || cred.name}
                      </span>
                    </div>
                    {/* 密钥图标（装饰） */}
                    {cred.is_public && (
                      <div className="flex items-center gap-2">
                        <span className="text-purple-400 text-xs">🔑</span>
                        <span className="text-xs text-purple-400">已公开</span>
                      </div>
                    )}
                  </div>

                  {/* 额度预览区域 */}
                  <div className="px-3 pb-2">
                    <button
                      onClick={() => cred.is_active && toggleQuotaPreview(cred.id)}
                      disabled={!cred.is_active}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors ${
                        cred.is_active
                          ? "bg-dark-700/50 hover:bg-dark-600/50 cursor-pointer"
                          : "bg-dark-800/50 text-gray-600 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>📊</span>
                        <span className="text-gray-400">
                          {loadingQuotaPreview === cred.id
                            ? "加载..."
                            : quotaCache[cred.id]
                              ? "额度"
                              : "暂无额度"}
                        </span>
                      </div>
                      {cred.is_active && (
                        expandedQuota === cred.id
                          ? <ChevronUp size={12} className="text-gray-500" />
                          : <ChevronDown size={12} className="text-gray-500" />
                      )}
                    </button>

                    {/* 展开的额度详情 */}
                    {expandedQuota === cred.id && cred.is_active && (
                      <div className="mt-2 space-y-1.5 bg-dark-700/30 rounded-lg p-2">
                        {loadingQuotaPreview === cred.id ? (
                          <div className="flex items-center justify-center py-3 text-gray-500 text-xs">
                            <RefreshCw size={12} className="animate-spin mr-1" />
                            加载中...
                          </div>
                        ) : quotaCache[cred.id]?.error ? (
                          <div className="text-center py-2 text-red-400 text-xs">
                            {quotaCache[cred.id].error}
                          </div>
                        ) : quotaCache[cred.id] ? (
                          <>
                            {/* Claude 额度 */}
                            {quotaCache[cred.id].claude?.count > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="text-purple-400 text-xs w-12">Claude</span>
                                <div className="flex-1 bg-dark-600 rounded-full h-1.5">
                                  <div
                                    className={`h-1.5 rounded-full ${getQuotaColor(quotaCache[cred.id].claude.remaining).bar}`}
                                    style={{ width: `${Math.min(quotaCache[cred.id].claude.remaining, 100)}%` }}
                                  />
                                </div>
                                <span className={`text-xs w-12 text-right ${getQuotaColor(quotaCache[cred.id].claude.remaining).text}`}>
                                  {quotaCache[cred.id].claude.remaining.toFixed(0)}%
                                </span>
                              </div>
                            )}
                            {/* Gemini 额度 */}
                            {quotaCache[cred.id].gemini?.count > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="text-cyan-400 text-xs w-12">Gemini</span>
                                <div className="flex-1 bg-dark-600 rounded-full h-1.5">
                                  <div
                                    className={`h-1.5 rounded-full ${getQuotaColor(quotaCache[cred.id].gemini.remaining).bar}`}
                                    style={{ width: `${Math.min(quotaCache[cred.id].gemini.remaining, 100)}%` }}
                                  />
                                </div>
                                <span className={`text-xs w-12 text-right ${getQuotaColor(quotaCache[cred.id].gemini.remaining).text}`}>
                                  {quotaCache[cred.id].gemini.remaining.toFixed(0)}%
                                </span>
                              </div>
                            )}
                            {/* banana/image 额度 */}
                            {quotaCache[cred.id].banana?.count > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="text-yellow-400 text-xs w-12">banana</span>
                                <div className="flex-1 bg-dark-600 rounded-full h-1.5">
                                  <div
                                    className={`h-1.5 rounded-full ${getQuotaColor(quotaCache[cred.id].banana.remaining).bar}`}
                                    style={{ width: `${Math.min(quotaCache[cred.id].banana.remaining, 100)}%` }}
                                  />
                                </div>
                                <span className={`text-xs w-12 text-right ${getQuotaColor(quotaCache[cred.id].banana.remaining).text}`}>
                                  {quotaCache[cred.id].banana.remaining.toFixed(0)}%
                                </span>
                              </div>
                            )}
                            {!quotaCache[cred.id].claude?.count && !quotaCache[cred.id].gemini?.count && !quotaCache[cred.id].banana?.count && (
                              <div className="text-center py-1 text-gray-500 text-xs">
                                暂无数据
                              </div>
                            )}
                            {(quotaCache[cred.id].claude?.resetTime || quotaCache[cred.id].gemini?.resetTime) && (
                              <div className="text-[10px] text-gray-500 text-right">
                                重置: {quotaCache[cred.id].claude?.resetTime || quotaCache[cred.id].gemini?.resetTime}
                              </div>
                            )}
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {/* 操作按钮 - 三个主要按钮 */}
                  <div className="p-3 pt-0 grid grid-cols-3 gap-1.5">
                    {/* 详情按钮 */}
                    <button
                      onClick={() => fetchQuota(cred.id, cred.email || cred.name)}
                      disabled={loadingQuota === cred.id || !cred.is_active}
                      className="px-2 py-2 rounded-lg text-xs font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 hover:bg-cyan-500/30 disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      📊 详情
                    </button>

                    {/* 启用/禁用按钮 */}
                    <button
                      onClick={() => toggleActive(cred.id, cred.is_active)}
                      className={`px-2 py-2 rounded-lg text-xs font-medium border flex items-center justify-center gap-1 ${
                        cred.is_active
                          ? "bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30"
                          : "bg-green-500/20 text-green-400 border-green-500/40 hover:bg-green-500/30"
                      }`}
                    >
                      ▶ {cred.is_active ? "禁用" : "启用"}
                    </button>

                    {/* 删除按钮 */}
                    <button
                      onClick={() => deleteCred(cred.id)}
                      className="px-2 py-2 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 flex items-center justify-center gap-1"
                    >
                      🗑️ 删除
                    </button>
                  </div>

                  {/* 更多操作 - 折叠 */}
                  <details className="border-t border-dark-600/50">
                    <summary className="text-[10px] text-gray-500 cursor-pointer hover:text-gray-400 p-2 text-center">
                      ▼ 更多操作
                    </summary>
                    <div className="p-2 pt-0 grid grid-cols-2 gap-1">
                      {/* 检测 */}
                      <button
                        onClick={() => verifyCred(cred.id, cred.email || cred.name)}
                        disabled={verifying === cred.id}
                        className="px-2 py-1.5 rounded text-[10px] font-medium bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {verifying === cred.id ? (
                          <RefreshCw size={10} className="animate-spin" />
                        ) : (
                          <CheckCircle size={10} />
                        )}
                        检测
                      </button>

                      {/* 刷新ID */}
                      <button
                        onClick={() => refreshProjectId(cred.id, cred.email || cred.name)}
                        disabled={verifying === cred.id}
                        className="px-2 py-1.5 rounded text-[10px] font-medium bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <RefreshCw size={10} />
                        刷新ID
                      </button>

                      {/* 导出 */}
                      <button
                        onClick={() => showExportModal(cred.id, cred.email)}
                        className="px-2 py-1.5 rounded text-[10px] font-medium bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-1"
                      >
                        <Download size={10} />
                        导出
                      </button>

                      {/* 公开/取消公开 */}
                      <button
                        onClick={() => togglePublic(cred.id, cred.is_public)}
                        disabled={!cred.is_public && !cred.is_active}
                        className={`px-2 py-1.5 rounded text-[10px] font-medium ${
                          cred.is_public
                            ? "bg-gray-600 hover:bg-gray-500 text-white"
                            : !cred.is_active
                              ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                              : "bg-purple-600 hover:bg-purple-500 text-white"
                        }`}
                      >
                        {cred.is_public ? "取消公开" : "设为公开"}
                      </button>
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 说明 */}
        <div className="mt-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl text-sm">
          <div className="text-orange-400 font-medium mb-2">
            🚀 Antigravity API 说明
          </div>
          <ul className="text-orange-300/70 space-y-1">
            <li>• Antigravity 凭证与 GeminiCLI 凭证是独立的，不能混用</li>
            <li>• 点击导航栏"获取凭证"可获取或上传凭证</li>
            <li>
              • 调用端点:{" "}
              <code className="bg-dark-800 px-1 rounded">
                /agy/v1/chat/completions
              </code>
            </li>
          </ul>
        </div>
      </div>

      {/* 检测结果弹窗 */}
      {verifyResult && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-dark-600">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                {verifyResult.is_project_id_refresh ? (
                  <RefreshCw
                    className={
                      verifyResult.is_valid ? "text-green-400" : "text-red-400"
                    }
                  />
                ) : (
                  <CheckCircle
                    className={
                      verifyResult.is_valid ? "text-green-400" : "text-red-400"
                    }
                  />
                )}
                {verifyResult.is_project_id_refresh
                  ? "刷新 Project ID 结果"
                  : "凭证检测结果"}
              </h3>
              <button
                onClick={() => setVerifyResult(null)}
                className="p-2 hover:bg-dark-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* 邮箱 */}
              <div className="text-gray-400 text-sm">{verifyResult.email}</div>

              {/* 状态 */}
              <div className="flex items-center gap-3">
                <span className="text-gray-400">状态</span>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    verifyResult.is_valid
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {verifyResult.is_project_id_refresh
                    ? verifyResult.is_valid
                      ? "✅ 刷新成功"
                      : "❌ 刷新失败"
                    : verifyResult.is_valid
                      ? "✅ 有效"
                      : "❌ 无效"}
                </span>
              </div>

              {/* Project ID */}
              {verifyResult.project_id && (
                <div className="flex items-center gap-3">
                  <span className="text-gray-400">Project ID</span>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-orange-500/20 text-orange-400 truncate max-w-[200px]">
                    {verifyResult.project_id}
                  </span>
                </div>
              )}

              {verifyResult.is_project_id_refresh &&
                verifyResult.old_project_id &&
                verifyResult.is_valid && (
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400">旧 ID</span>
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-600/50 text-gray-300 line-through truncate max-w-[200px]">
                      {verifyResult.old_project_id}
                    </span>
                  </div>
                )}

              {/* 错误信息 */}
              {verifyResult.error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {verifyResult.error}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-dark-600 flex justify-end">
              <button
                onClick={() => setVerifyResult(null)}
                className="px-6 py-2 bg-dark-600 hover:bg-dark-500 text-white rounded-lg"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 额度查询弹窗 */}
      {quotaResult && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-dark-600">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <span className="text-2xl">📊</span>
                额度信息详情
              </h3>
              <button
                onClick={() => setQuotaResult(null)}
                className="p-2 hover:bg-dark-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* 凭证名称 */}
              <div className="text-sm text-gray-400 mb-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-2">
                文件: {quotaResult.filename || quotaResult.email}
              </div>

              {quotaResult.success ? (
                <>
                  {Object.keys(quotaResult.models || {}).length > 0 ? (
                    (() => {
                      // 分类模型
                      const categorizeModel = (modelId) => {
                        const lower = modelId.toLowerCase();
                        if (lower.includes("claude")) return "Claude";
                        if (
                          lower.includes("gemini-3") ||
                          lower.includes("3-pro") ||
                          lower.includes("3-flash")
                        )
                          return "Gemini 3.0";
                        // 隐藏 2.5 模型
                        if (
                          lower.includes("gemini-2.5") ||
                          lower.includes("2.5-")
                        )
                          return null;
                        if (
                          lower.includes("gpt-oss") ||
                          lower.includes("gpt_oss")
                        )
                          return "GPT-OSS";
                        // 过滤内部/测试模型
                        if (
                          lower.includes("chat_") ||
                          lower.includes("rev") ||
                          lower.includes("tab_") ||
                          lower.includes("uic")
                        )
                          return null;
                        return "其他";
                      };

                      const categories = {
                        Claude: { color: "purple", icon: "🟣", models: [] },
                        "Gemini 3.0": { color: "cyan", icon: "🔵", models: [] },

                        "GPT-OSS": { color: "orange", icon: "🟠", models: [] },
                        其他: { color: "gray", icon: "⚪", models: [] },
                      };

                      Object.entries(quotaResult.models).forEach(
                        ([modelId, data]) => {
                          const category = categorizeModel(modelId);
                          if (category && categories[category]) {
                            categories[category].models.push({ modelId, data });
                          }
                        },
                      );

                      const categoryColors = {
                        Claude: "border-purple-500/50 bg-purple-500/10",
                        "Gemini 3.0": "border-cyan-500/50 bg-cyan-500/10",

                        "GPT-OSS": "border-orange-500/50 bg-orange-500/10",
                        其他: "border-gray-500/50 bg-gray-500/10",
                      };

                      return (
                        <div className="space-y-4">
                          {Object.entries(categories).map(
                            ([catName, catData]) => {
                              if (catData.models.length === 0) return null;
                              return (
                                <div
                                  key={catName}
                                  className={`rounded-lg border p-3 ${categoryColors[catName]}`}
                                >
                                  <div className="text-sm font-medium mb-3 flex items-center gap-2">
                                    <span>{catData.icon}</span>
                                    <span>{catName}</span>
                                    <span className="text-xs text-gray-400">
                                      ({catData.models.length})
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {catData.models.map(({ modelId, data }) => {
                                      const remaining = data.remaining || 0;
                                      const colorClass =
                                        remaining >= 80
                                          ? "bg-green-500"
                                          : remaining >= 40
                                            ? "bg-yellow-500"
                                            : remaining >= 20
                                              ? "bg-orange-500"
                                              : "bg-red-500";
                                      const textColor =
                                        remaining >= 80
                                          ? "text-green-400"
                                          : remaining >= 40
                                            ? "text-yellow-400"
                                            : remaining >= 20
                                              ? "text-orange-400"
                                              : "text-red-400";
                                      // 简化模型名称显示
                                      const shortName = modelId
                                        .replace("gemini-", "")
                                        .replace("claude-", "")
                                        .replace("-thinking", "");
                                      return (
                                        <div
                                          key={modelId}
                                          className="bg-dark-800/80 rounded p-2"
                                        >
                                          <div
                                            className="text-xs text-gray-400 truncate mb-1"
                                            title={modelId}
                                          >
                                            {shortName}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span
                                              className={`text-sm font-bold ${textColor}`}
                                            >
                                              {remaining}%
                                            </span>
                                            <div className="flex-1 bg-dark-600 rounded-full h-1">
                                              <div
                                                className={`h-1 rounded-full ${colorClass}`}
                                                style={{
                                                  width: `${Math.min(remaining, 100)}%`,
                                                }}
                                              />
                                            </div>
                                          </div>
                                          <div className="text-[9px] text-gray-500 mt-1">
                                            📅 {data.resetTime || "N/A"}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            },
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      没有额度数据
                    </div>
                  )}
                </>
              ) : (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
                  {quotaResult.error || "获取额度失败"}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-dark-600 flex justify-end">
              <button
                onClick={() => setQuotaResult(null)}
                className="px-6 py-2 bg-dark-600 hover:bg-dark-500 text-white rounded-lg"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
