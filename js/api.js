window.TaskBreaker = window.TaskBreaker || {};

(function (app) {
  const { PROVIDERS, SYSTEM_PROMPT } = app.constants;

  function normalizeBaseUrl(provider, baseUrl) {
    const providerConfig = PROVIDERS[provider];
    const raw = providerConfig.allowCustomBaseUrl ? baseUrl.trim() : providerConfig.defaultBaseUrl;
    return raw.replace(/\/+$/, "");
  }

  function validateConfig(config, options = {}) {
    const requireModel = Boolean(options.requireModel);

    if (!config.provider) {
      throw new Error("请选择 AI 供应商。");
    }
    if (!config.apiKey) {
      throw new Error("请输入 API Key。");
    }
    if (!config.baseUrl) {
      throw new Error("请填写有效的 Base URL。");
    }
    if (requireModel && !config.model) {
      throw new Error("请先拉取并选择一个模型。");
    }
  }

  async function fetchModels(config) {
    validateConfig(config);

    const response = await fetch(config.baseUrl + "/models", {
      method: "GET",
      headers: {
        Authorization: "Bearer " + config.apiKey,
        "Content-Type": "application/json"
      }
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const apiMessage = payload?.error?.message || payload?.message || "拉取模型失败";
      throw new Error(apiMessage);
    }

    return Array.isArray(payload?.data)
      ? payload.data.map((item) => (item && typeof item.id === "string" ? item.id : "")).filter(Boolean)
      : [];
  }

  async function testConnection(config) {
    const models = await fetchModels(config);
    return models.length;
  }

  function extractJsonArray(text) {
    const trimmed = (text || "").trim();
    if (!trimmed) {
      throw new Error("AI 没有返回内容。");
    }

    try {
      return JSON.parse(trimmed);
    } catch (firstError) {
      const start = trimmed.indexOf("[");
      const end = trimmed.lastIndexOf("]");
      if (start >= 0 && end > start) {
        return JSON.parse(trimmed.slice(start, end + 1));
      }
      throw firstError;
    }
  }

  function sanitizeSteps(rawData) {
    if (!Array.isArray(rawData)) {
      throw new Error("AI 返回内容不是 JSON 数组。");
    }

    const steps = rawData
      .map((item, index) => ({
        step: Number(item?.step) || index + 1,
        action: typeof item?.action === "string" ? item.action.trim() : ""
      }))
      .filter((item) => item.action);

    if (steps.length < 3 || steps.length > 10) {
      throw new Error("AI 返回的步骤数量不在 3 到 10 之间，请重试。");
    }

    return steps.map((item, index) => ({
      step: index + 1,
      action: item.action
    }));
  }

  async function breakdownTask(config, task) {
    validateConfig(config, { requireModel: true });

    const response = await fetch(config.baseUrl + "/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + config.apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.4,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: task }
        ]
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const apiMessage = payload?.error?.message || payload?.message || "调用 AI 接口失败";
      throw new Error(apiMessage);
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("AI 返回格式异常，缺少文本内容。");
    }

    return sanitizeSteps(extractJsonArray(content));
  }

  function getFriendlyErrorMessage(error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
      return "网络请求失败。请检查网络、接口地址，以及浏览器是否允许当前页面访问该 API。";
    }
    if (/401|invalid api key|unauthorized/i.test(message)) {
      return "API Key 似乎无效，或当前接口拒绝了认证请求。请检查 Key 是否正确。";
    }
    if (/json/i.test(message)) {
      return "AI 返回的内容没能成功解析成 JSON。可以重试，或调整模型后再试。";
    }
    return message;
  }

  app.api = {
    normalizeBaseUrl,
    validateConfig,
    fetchModels,
    testConnection,
    breakdownTask,
    getFriendlyErrorMessage
  };
})(window.TaskBreaker);
