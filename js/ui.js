window.TaskBreaker = window.TaskBreaker || {};

(function (app) {
  function setStatus(element, tone, message) {
    element.dataset.tone = tone;
    element.textContent = message;
  }

  function fillModelOptions(selectElement, models, selectedValue = "") {
    selectElement.innerHTML = "";

    if (!models.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "没有拉取到模型";
      selectElement.appendChild(option);
      return;
    }

    models.forEach((modelId) => {
      const option = document.createElement("option");
      option.value = modelId;
      option.textContent = modelId;
      if (modelId === selectedValue) {
        option.selected = true;
      }
      selectElement.appendChild(option);
    });
  }

  function toggleBusy(button, busy) {
    button.disabled = busy;
    if (busy) {
      button.dataset.originalText = button.textContent;
      button.textContent = "处理中...";
    } else if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
    }
  }

  function updateStepCounter(element, steps) {
    element.textContent = "当前 " + steps.length + " 个步骤";
  }

  function renderSteps(container, steps, onComplete) {
    container.innerHTML = "";

    if (!steps.length) {
      container.innerHTML = '<div class="empty-state">当前没有待完成的步骤。</div>';
      return;
    }

    steps.forEach((item) => {
      const card = document.createElement("article");
      card.className = "task-card";
      card.dataset.step = String(item.step);
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", "完成：" + item.action);

      const action = document.createElement("p");
      action.className = "task-action";
      action.textContent = item.action;

      const finish = () => {
        if (card.classList.contains("removing")) {
          return;
        }
        card.classList.add("removing");
        window.setTimeout(() => onComplete(item.step), 220);
      };

      card.addEventListener("click", finish);
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          finish();
        }
      });

      card.appendChild(action);
      container.appendChild(card);
    });
  }

  app.ui = {
    setStatus,
    fillModelOptions,
    toggleBusy,
    updateStepCounter,
    renderSteps
  };
})(window.TaskBreaker);
