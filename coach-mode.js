const COACH_MODE_KEY = "kneedthat-coach-mode";

function readCoachMode() {
  return window.localStorage.getItem(COACH_MODE_KEY) === "on";
}

function writeCoachMode(isOn) {
  window.localStorage.setItem(COACH_MODE_KEY, isOn ? "on" : "off");
}

function setPanelState(element, isVisible) {
  if (!element) return;
  element.hidden = !isVisible;
}

function updateCoachUI(isOn) {
  const rosterPanel = document.getElementById("coach-roster-panel");
  const codePanel = document.getElementById("coach-code-panel");
  const coachBadge = document.getElementById("coach-mode-badge");
  const coachToggle = document.getElementById("coach-mode-toggle");

  setPanelState(rosterPanel, isOn);
  setPanelState(codePanel, isOn);

  if (coachBadge) {
    coachBadge.textContent = isOn ? "On" : "Off";
  }

  if (coachToggle) {
    coachToggle.checked = isOn;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const coachToggle = document.getElementById("coach-mode-toggle");
  const currentState = readCoachMode();

  updateCoachUI(currentState);

  if (coachToggle) {
    coachToggle.addEventListener("change", (event) => {
      const isOn = event.target.checked;
      writeCoachMode(isOn);
      updateCoachUI(isOn);
    });
  }
});
