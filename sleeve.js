const sleeveToggle = document.getElementById("sleeve-toggle");
const sleeveStatus = document.getElementById("sleeve-status");
const sleeveAngle = document.getElementById("sleeve-angle");
const sleeveAnalyze = document.getElementById("sleeve-analyze");
const angleValue = document.getElementById("angle-value");
const angleNote = document.getElementById("angle-note");
const movementValue = document.getElementById("movement-value");
const movementNote = document.getElementById("movement-note");
const riskValue = document.getElementById("risk-value");
const riskNote = document.getElementById("risk-note");
const sleeveFeedback = document.getElementById("sleeve-feedback");

function setSleeveDisconnected() {
  if (!sleeveToggle) {
    return;
  }

  sleeveStatus.textContent = "Off";
  sleeveAngle.disabled = true;
  sleeveAnalyze.disabled = true;
  sleeveAngle.value = 0;
  angleValue.textContent = "0°";
  angleNote.textContent = "Waiting";
  movementValue.textContent = "0%";
  movementNote.textContent = "No data";
  riskValue.textContent = "0";
  riskNote.textContent = "Connect sleeve";
  sleeveFeedback.textContent = "Feedback: connect the sleeve to start reading knee movement.";
}

function setSleeveConnected() {
  sleeveStatus.textContent = "Live";
  sleeveAngle.disabled = false;
  sleeveAnalyze.disabled = false;
  angleValue.textContent = `${Number(sleeveAngle.value) || 0}°`;
  angleNote.textContent = "Connected";
  movementValue.textContent = "0%";
  movementNote.textContent = "Ready";
  riskValue.textContent = "0";
  riskNote.textContent = "Awaiting read";
  sleeveFeedback.textContent = "Feedback: enter a knee angle to get a quick AI risk read for recovery.";
}

function setLoadingState() {
  sleeveAnalyze.disabled = true;
  sleeveAnalyze.textContent = "Reading...";
  sleeveFeedback.textContent = "Feedback: checking the current knee angle and building a recovery-safe risk read.";
}

function setIdleButton() {
  sleeveAnalyze.disabled = false;
  sleeveAnalyze.textContent = "Interpret sleeve";
}

async function analyzeSleeveAngle() {
  const angle = Number(sleeveAngle.value) || 0;

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
    if (sleeveToggle.checked) {
      setIdleButton();
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!sleeveToggle) {
    return;
  }

  setSleeveDisconnected();

  sleeveToggle.addEventListener("change", () => {
    if (sleeveToggle.checked) {
      setSleeveConnected();
      return;
    }

    setSleeveDisconnected();
  });

  sleeveAngle.addEventListener("input", () => {
    angleValue.textContent = `${Number(sleeveAngle.value) || 0}°`;
  });

  sleeveAnalyze.addEventListener("click", analyzeSleeveAngle);
});
