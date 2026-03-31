window.TaskBreaker = window.TaskBreaker || {};

(function (app) {
  const { PROVIDERS } = app.constants;
  const { breakdownTask, fetchModels, getFriendlyErrorMessage, normalizeBaseUrl, testConnection, validateConfig } = app.api;
  const { clearSettings, loadSettings, saveSettings } = app.storage;
  const { fillModelOptions, renderSteps, setStatus, toggleBusy, updateStepCounter } = app.ui;

  const dom = {
    sidebarToggleBtn: document.getElementById("sidebarToggleBtn"),
    configSidebar: document.getElementById("configSidebar"),
    providerSelect: document.getElementById("providerSelect"),
    baseUrlField: document.getElementById("baseUrlField"),
    baseUrlInput: document.getElementById("baseUrlInput"),
    baseUrlHint: document.getElementById("baseUrlHint"),
    apiKeyInput: document.getElementById("apiKeyInput"),
    modelSelect: document.getElementById("modelSelect"),
    saveConfigBtn: document.getElementById("saveConfigBtn"),
    testConnectionBtn: document.getElementById("testConnectionBtn"),
    fetchModelsBtn: document.getElementById("fetchModelsBtn"),
    clearStorageBtn: document.getElementById("clearStorageBtn"),
    configStatus: document.getElementById("configStatus"),
    taskInput: document.getElementById("taskInput"),
    breakdownBtn: document.getElementById("breakdownBtn"),
    regenerateBtn: document.getElementById("regenerateBtn"),
    taskStatus: document.getElementById("taskStatus"),
    cardsContainer: document.getElementById("cardsContainer"),
    stepCounter: document.getElementById("stepCounter")
  };

  let currentSteps = [];

  function collectConfig() {
    const provider = dom.providerSelect.value;
    const baseUrl = normalizeBaseUrl(provider, dom.baseUrlInput.value);
    const apiKey = dom.apiKeyInput.value.trim();
    const model = dom.modelSelect.value.trim();
    return { provider, baseUrl, apiKey, model };
  }

  function collectPageState() {
    return {
      taskInput: dom.taskInput.value,
      currentSteps
    };
  }

  async function persistAll() {
    await saveSettings({
      ...collectConfig(),
      ...collectPageState()
    });
  }

  function syncProviderUI() {
    const provider = dom.providerSelect.value;
    const config = PROVIDERS[provider];
    const isCustom = config.allowCustomBaseUrl;

    dom.baseUrlField.style.display = "grid";
    dom.baseUrlHint.style.display = "none";

    if (!isCustom) {
      dom.baseUrlInput.value = config.defaultBaseUrl;
    } else if (!dom.baseUrlInput.value.trim()) {
      dom.baseUrlInput.placeholder = "https://your-openai-compatible-api/v1";
    }
  }

  function setSidebarOpen(isOpen) {
    dom.configSidebar.classList.toggle("is-open", isOpen);
    dom.configSidebar.setAttribute("aria-hidden", String(!isOpen));
    dom.sidebarToggleBtn.setAttribute("aria-expanded", String(isOpen));
    dom.sidebarToggleBtn.setAttribute("aria-label", isOpen ? "关闭设置" : "打开设置");
  }

  function redrawSteps() {
    renderSteps(dom.cardsContainer, currentSteps, async (completedStep) => {
      currentSteps = currentSteps
        .filter((item) => item.step !== completedStep)
        .map((item, index) => ({
          step: index + 1,
          action: item.action
        }));

      redrawSteps();
      await persistAll();
      setStatus(dom.taskStatus, "success", "完成一小步了，页面已经帮你把它移走。继续保持这个节奏。");
    });

    updateStepCounter(dom.stepCounter, currentSteps);
  }

  async function handleSaveConfig() {
    try {
      const config = collectConfig();
      validateConfig(config);
      await persistAll();
      setStatus(dom.configStatus, "success", "配置已保存，下次打开页面会自动恢复。");
    } catch (error) {
      setStatus(dom.configStatus, "error", getFriendlyErrorMessage(error));
    }
  }

  async function handleTestConnection() {
    toggleBusy(dom.testConnectionBtn, true);
    try {
      const config = collectConfig();
      const count = await testConnection(config);
      await persistAll();
      setStatus(dom.configStatus, "success", "连接成功。接口可用，当前共检测到 " + count + " 个模型。");
    } catch (error) {
      setStatus(dom.configStatus, "error", getFriendlyErrorMessage(error));
    } finally {
      toggleBusy(dom.testConnectionBtn, false);
    }
  }

  async function handleFetchModels() {
    toggleBusy(dom.fetchModelsBtn, true);
    try {
      const config = collectConfig();
      const models = await fetchModels(config);
      fillModelOptions(dom.modelSelect, models, config.model);

      if (models.length && !config.model) {
        dom.modelSelect.value = models[0];
      }

      await persistAll();
      setStatus(
        dom.configStatus,
        "success",
        models.length ? "模型列表已更新，请确认已选中合适的模型。" : "请求成功，但没有拿到可用模型列表。"
      );
    } catch (error) {
      setStatus(dom.configStatus, "error", getFriendlyErrorMessage(error));
    } finally {
      toggleBusy(dom.fetchModelsBtn, false);
    }
  }

  async function handleClearStorage() {
    try {
      await clearSettings();
      dom.providerSelect.value = "deepseek";
      dom.baseUrlInput.value = "";
      dom.apiKeyInput.value = "";
      dom.taskInput.value = "";
      currentSteps = [];
      fillModelOptions(dom.modelSelect, []);
      syncProviderUI();
      redrawSteps();
      setStatus(dom.configStatus, "success", "本地存储已清除。你可以重新填写新的 API 配置。");
      setStatus(dom.taskStatus, "info", "");
    } catch (error) {
      setStatus(dom.configStatus, "error", getFriendlyErrorMessage(error));
    }
  }

  async function generateSteps() {
    const task = dom.taskInput.value.trim();
    if (!task) {
      window.alert("请先输入要拆解的任务。");
      return;
    }

    toggleBusy(dom.breakdownBtn, true);
    toggleBusy(dom.regenerateBtn, true);
    setStatus(dom.taskStatus, "info", "AI 正在拆解任务，请稍等片刻...");

    try {
      const config = collectConfig();
      currentSteps = await breakdownTask(config, task);
      redrawSteps();
      await persistAll();
      setStatus(dom.taskStatus, "success", "任务已拆解完成。现在只需要从第一张卡片开始。");
    } catch (error) {
      setStatus(dom.taskStatus, "error", getFriendlyErrorMessage(error));
    } finally {
      toggleBusy(dom.breakdownBtn, false);
      toggleBusy(dom.regenerateBtn, false);
    }
  }

  async function initialize() {
    syncProviderUI();
    redrawSteps();
    setSidebarOpen(false);

    try {
      const settings = await loadSettings();
      if (!settings) {
        return;
      }

      if (settings.provider && PROVIDERS[settings.provider]) {
        dom.providerSelect.value = settings.provider;
      }

      syncProviderUI();

      if (settings.baseUrl) {
        dom.baseUrlInput.value = settings.baseUrl;
      }
      if (settings.apiKey) {
        dom.apiKeyInput.value = settings.apiKey;
      }
      if (settings.model) {
        fillModelOptions(dom.modelSelect, [settings.model], settings.model);
      }
      if (typeof settings.taskInput === "string") {
        dom.taskInput.value = settings.taskInput;
      }
      if (Array.isArray(settings.currentSteps)) {
        currentSteps = settings.currentSteps
          .map((item, index) => ({
            step: Number(item?.step) || index + 1,
            action: typeof item?.action === "string" ? item.action : ""
          }))
          .filter((item) => item.action)
          .map((item, index) => ({
            step: index + 1,
            action: item.action
          }));
        redrawSteps();
      }

      if (settings.provider === "openai-compatible" && !settings.baseUrl) {
        dom.baseUrlInput.placeholder = "https://your-openai-compatible-api/v1";
      }

      setStatus(dom.configStatus, "info", "已从本地恢复上次保存的配置。");
    } catch (error) {
      setStatus(dom.configStatus, "error", "读取本地配置失败，但页面仍可继续使用。");
    }
  }

  dom.sidebarToggleBtn.addEventListener("click", () => {
    setSidebarOpen(!dom.configSidebar.classList.contains("is-open"));
  });

  dom.providerSelect.addEventListener("change", async () => {
    syncProviderUI();
    try {
      await persistAll();
    } catch (error) {
      setStatus(dom.configStatus, "error", getFriendlyErrorMessage(error));
    }
  });

  dom.modelSelect.addEventListener("change", async () => {
    try {
      await persistAll();
    } catch (error) {
      setStatus(dom.configStatus, "error", getFriendlyErrorMessage(error));
    }
  });

  dom.taskInput.addEventListener("input", async () => {
    try {
      await persistAll();
    } catch (error) {
      setStatus(dom.configStatus, "error", getFriendlyErrorMessage(error));
    }
  });

  dom.saveConfigBtn.addEventListener("click", handleSaveConfig);
  dom.testConnectionBtn.addEventListener("click", handleTestConnection);
  dom.fetchModelsBtn.addEventListener("click", handleFetchModels);
  dom.clearStorageBtn.addEventListener("click", handleClearStorage);
  dom.breakdownBtn.addEventListener("click", generateSteps);
  dom.regenerateBtn.addEventListener("click", generateSteps);

  initialize();
})(window.TaskBreaker);
