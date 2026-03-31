window.TaskBreaker = window.TaskBreaker || {};

window.TaskBreaker.constants = {
  DB_NAME: "adhd-task-breaker-db",
  STORE_NAME: "settings",
  SETTINGS_KEY: "api-config",
  SYSTEM_PROMPT:
    '你是一位帮助 ADHD/AuDHD 用户的执行功能教练。请将用户输入的任务拆解为 3 到 10 个具体的、可执行的微步骤。必须只返回 JSON 数组，不要包含任何其他解释。格式：[{"step": 1, "action": "具体动作"}]',
  PROVIDERS: {
    "openai-compatible": {
      label: "OpenAI 兼容",
      defaultBaseUrl: "",
      allowCustomBaseUrl: true
    },
    deepseek: {
      label: "DeepSeek",
      defaultBaseUrl: "https://api.deepseek.com/v1",
      allowCustomBaseUrl: false
    },
    siliconflow: {
      label: "硅基流动",
      defaultBaseUrl: "https://api.siliconflow.cn/v1",
      allowCustomBaseUrl: false
    }
  }
};
