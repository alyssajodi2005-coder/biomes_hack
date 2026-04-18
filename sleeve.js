const sleeveStatus = document.getElementById("sleeve-status");
const sleeveAnalyze = document.getElementById("sleeve-analyze");
const angleValue = document.getElementById("angle-value");
const angleNote = document.getElementById("angle-note");
const movementValue = document.getElementById("movement-value");
const movementNote = document.getElementById("movement-note");
const riskValue = document.getElementById("risk-value");
const riskNote = document.getElementById("risk-note");
const sleeveFeedback = document.getElementById("sleeve-feedback");
let currentMockAngle = 0;

function getMockAngle() {
  return Math.floor(Math.random() * 38) + 24;
}

function setSleeveReady() {
  if (!sleeveAnalyze) {
    return;
  }

  sleeveStatus.textContent = "Demo feed";
  sleeveAnalyze.disabled = false;
  currentMockAngle = getMockAngle();
  angleValue.textContent = `${currentMockAngle}°`;
  angleNote.textContent = "Sensor preview";
  movementValue.textContent = "0%";
  movementNote.textContent = "Ready";
  riskValue.textContent = "0";
  riskNote.textContent = "Awaiting read";
  sleeveFeedback.textContent = "Feedback: demo sleeve data is ready. Analyze the latest feed for a recovery-safe risk check.";
}

function setLoadingState() {
  sleeveAnalyze.disabled = true;
  sleeveAnalyze.textContent = "Reading...";
  sleeveFeedback.textContent = "Feedback: checking the latest sleeve reading and building a recovery-safe risk read.";
}

function setIdleButton() {
  sleeveAnalyze.disabled = false;
  sleeveAnalyze.textContent = "Interpret sleeve";
}

async function analyzeSleeveAngle() {
  const angle = currentMockAngle || getMockAngle();

  angleValue.textContent = `${angle}°`;
  setLoadingState();

  try {
    const response = await fetch("/api/sleeve-risk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ angle }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Unable to read sleeve data.");
    }

    angleValue.textContent = `${payload.angle_degrees}°`;
    angleNote.textContent = payload.angle_note;
    movementValue.textContent = `${payload.movement_score}%`;
    movementNote.textContent = payload.movement_note;
    riskValue.textContent = payload.risk_level;
    riskNote.textContent = payload.risk_note;
    sleeveFeedback.textContent = `Feedback: ${payload.feedback}`;
  } catch (error) {
    movementValue.textContent = "0%";
    movementNote.textContent = "Retry";
    riskValue.textContent = "Error";
    riskNote.textContent = "Unavailable";
    sleeveFeedback.textContent = `Feedback: ${error.message}`;
  } finally {
    setIdleButton();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!sleeveAnalyze) {
    return;
  }

  setSleeveReady();

  sleeveAnalyze.addEventListener("click", analyzeSleeveAngle);
});
