const sleeveStatus = document.getElementById("sleeve-status");
const sleeveAnalyze = document.getElementById("sleeve-analyze");
const angleValue = document.getElementById("angle-value");
const angleNote = document.getElementById("angle-note");
const movementValue = document.getElementById("movement-value");
const movementNote = document.getElementById("movement-note");
const riskValue = document.getElementById("risk-value");
const riskNote = document.getElementById("risk-note");
const sleeveFeedback = document.getElementById("sleeve-feedback");
const milestoneMet = document.getElementById("milestone-met");
const postOpWeek = document.getElementById("postop-week");
const postOpDay = document.getElementById("postop-day");
let currentMockAngle = 0;

function getMilestoneForWeek(week) {
  if (week <= 1) {
    return { target: 65, range: "60-70°", label: "Week 1 goal" };
  }
  if (week === 2) {
    return { target: 95, range: "90-100°", label: "Week 2 goal" };
  }
  if (week === 3) {
    return { target: 110, range: "100-115°", label: "Week 3 bridge" };
  }
  return { target: 125, range: "120-135°+", label: `Week ${week} goal` };
}

function getMockAngle() {
  return Math.floor(Math.random() * 38) + 24;
}

function updateMilestoneUI() {
  const week = Number(postOpWeek?.value || 4);
  const milestone = getMilestoneForWeek(week);
  movementValue.textContent = `${milestone.target}°`;
  movementNote.textContent = `${milestone.label} · ${milestone.range}`;
  return milestone;
}

function setMilestoneState(isMet, note = "Awaiting read") {
  if (milestoneMet) {
    milestoneMet.value = isMet ? "true" : "false";
  }
  riskValue.textContent = isMet ? "Met" : "Not yet";
  riskNote.textContent = note;
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
  updateMilestoneUI();
  setMilestoneState(false, "Awaiting read");
  sleeveFeedback.textContent = "Feedback: demo brace data is ready. Check whether today’s bend milestone has been reached safely.";
}

function setLoadingState() {
  sleeveAnalyze.disabled = true;
  sleeveAnalyze.textContent = "Checking...";
  sleeveFeedback.textContent = "Feedback: checking the latest brace reading against today’s target bend milestone.";
}

function setIdleButton() {
  sleeveAnalyze.disabled = false;
  sleeveAnalyze.textContent = "Check milestone";
}

async function analyzeSleeveAngle() {
  const angle = currentMockAngle || getMockAngle();
  const milestone = updateMilestoneUI();
  const day = Number(postOpDay?.value || 5);

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
    angleNote.textContent = `${payload.angle_note} · day ${day}`;
    updateMilestoneUI();
    setMilestoneState(payload.angle_degrees >= milestone.target, payload.risk_note);
    sleeveFeedback.textContent = `Feedback: ${payload.feedback}`;
  } catch (error) {
    updateMilestoneUI();
    movementNote.textContent = "Retry";
    if (milestoneMet) {
      milestoneMet.value = "false";
    }
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
  postOpWeek?.addEventListener("change", updateMilestoneUI);
  postOpDay?.addEventListener("change", updateMilestoneUI);

  sleeveAnalyze.addEventListener("click", analyzeSleeveAngle);
});
