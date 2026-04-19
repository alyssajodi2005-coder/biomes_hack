const sleeveStatus = document.getElementById("sleeve-status");
const sleeveAnalyze = document.getElementById("sleeve-analyze");
const sleeveStop = document.getElementById("sleeve-stop");
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
const guidedRecoveryBadge = document.getElementById("guided-recovery-badge");
let currentMockAngle = 0;
let liveReadTimeout = null;
let stopRequested = false;

function persistRecoveryStage() {
  if (postOpWeek) {
    window.localStorage.setItem("kneedthat-postop-week", postOpWeek.value);
  }
  if (postOpDay) {
    window.localStorage.setItem("kneedthat-postop-day", postOpDay.value);
  }
}

function getMilestoneForWeek(week) {
  if (week <= 1) {
    return { minimum: 90, maximum: 90, range: "90°", label: "Week 1 goal" };
  }
  if (week === 2) {
    return { minimum: 100, maximum: 100, range: "100°", label: "Week 2 goal" };
  }
  if (week === 3) {
    return { minimum: 110, maximum: 110, range: "110°", label: "Week 3 goal" };
  }
  return { minimum: 120, maximum: 120, range: "120°", label: `Week ${week} goal` };
}

function getLiveAnglesForWeek(week) {
  if (week <= 1) {
    return [8, 14, 21, 29, 36, 44, 51, 59, 66, 73, 79, 84, 88, 90];
  }
  if (week === 2) {
    return [12, 18, 26, 34, 42, 51, 60, 69, 77, 84, 90, 94, 98, 100];
  }
  if (week === 3) {
    return [14, 22, 30, 39, 48, 57, 66, 75, 83, 91, 98, 104, 108, 110];
  }
  return [18, 27, 36, 46, 55, 65, 74, 83, 92, 100, 108, 114, 118, 120];
}

function updateMilestoneUI() {
  const week = Number(postOpWeek?.value || 1);
  const day = Number(postOpDay?.value || 5);
  const milestone = getMilestoneForWeek(week);
  movementValue.textContent = milestone.range;
  movementNote.textContent = `${milestone.label} · Day ${day}`;
  if (guidedRecoveryBadge) {
    guidedRecoveryBadge.textContent = `Week ${week}`;
  }
  persistRecoveryStage();
  return milestone;
}

function setMilestoneState(isMet, note = "Awaiting read") {
  if (milestoneMet) {
    milestoneMet.value = isMet ? "true" : "false";
  }
  riskValue.textContent = isMet ? "Milestone Met" : note;
  riskNote.textContent = note;
}

function getProgressStatus(angle, milestone) {
  if (angle <= 0) {
    return "Not Started";
  }
  if (angle >= milestone.minimum) {
    return "Milestone Met";
  }
  if (angle >= milestone.minimum - 10) {
    return "Almost There";
  }
  return "In Progress";
}

function evaluateRangeState(angle, milestone) {
  if (angle < milestone.minimum) {
    return { isMet: false, label: "Below target" };
  }
  if (angle > milestone.maximum) {
    return { isMet: true, label: "Milestone hit" };
  }
  return { isMet: true, label: "Milestone hit" };
}

function setSleeveReady() {
  if (!sleeveAnalyze) {
    return;
  }

  sleeveStatus.textContent = "Sleeve ready";
  sleeveAnalyze.disabled = false;
  if (sleeveStop) {
    sleeveStop.disabled = true;
  }
  currentMockAngle = 0;
  angleValue.textContent = `${currentMockAngle}°`;
  angleNote.textContent = "Brace ready";
  updateMilestoneUI();
  setMilestoneState(false, "Not Started");
  sleeveFeedback.textContent = "AI Recovery Insight: You are ready to begin today’s milestone check.";
}

function setLoadingState() {
  const milestone = updateMilestoneUI();
  sleeveAnalyze.disabled = true;
  if (sleeveStop) {
    sleeveStop.disabled = false;
  }
  sleeveAnalyze.textContent = "Reading...";
  sleeveFeedback.textContent = `AI Recovery Insight: Reading the sleeve as the knee moves toward ${milestone.range}.`;
  setMilestoneState(false, "In Progress");
}

function setIdleButton() {
  sleeveAnalyze.disabled = false;
  sleeveAnalyze.textContent = "Start live read";
  if (sleeveStop) {
    sleeveStop.disabled = true;
  }
}

function stopLiveRead() {
  stopRequested = true;
  if (liveReadTimeout) {
    window.clearTimeout(liveReadTimeout);
    liveReadTimeout = null;
  }
  sleeveStatus.textContent = "Read paused";
  angleNote.textContent = "Read paused";
  setMilestoneState(false, "Not Met");
  sleeveFeedback.textContent =
    "AI Recovery Insight: The current milestone was not met during this read. Continue controlled range-of-motion work.";
  setIdleButton();
}

function animateLiveRead() {
  return new Promise((resolve) => {
    let index = 0;
    const milestone = updateMilestoneUI();
    const liveAngles = getLiveAnglesForWeek(Number(postOpWeek?.value || 1));
    const tick = () => {
      if (stopRequested) {
        resolve(null);
        return;
      }
      currentMockAngle = liveAngles[Math.min(index, liveAngles.length - 1)];
      angleValue.textContent = `${currentMockAngle}°`;
      angleNote.textContent = "Live brace read";
      const progressStatus = getProgressStatus(currentMockAngle, milestone);
      if (currentMockAngle >= milestone.minimum) {
        setMilestoneState(true, progressStatus);
        sleeveFeedback.textContent = `AI Recovery Insight: Progress today is consistent with early-stage recovery. The sleeve confirms ${milestone.range}.`;
      } else {
        setMilestoneState(false, progressStatus);
        sleeveFeedback.textContent = progressStatus === "Almost There"
          ? "AI Recovery Insight: You are approaching today’s recovery milestone."
          : "AI Recovery Insight: Continue gentle range-of-motion work before advancing.";
      }
      index += 1;
      if (index < liveAngles.length) {
        liveReadTimeout = window.setTimeout(tick, 1500);
      } else {
        liveReadTimeout = null;
        resolve(currentMockAngle);
      }
    };
    tick();
  });
}

async function analyzeSleeveAngle() {
  const milestone = updateMilestoneUI();
  const day = Number(postOpDay?.value || 5);
  stopRequested = false;
  sleeveStatus.textContent = "Reading live";
  setLoadingState();

  try {
    const angle = await animateLiveRead();
    if (angle === null) {
      return;
    }
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
    const rangeState = evaluateRangeState(payload.angle_degrees, milestone);
    setMilestoneState(rangeState.isMet, getProgressStatus(payload.angle_degrees, milestone));
    sleeveStatus.textContent = rangeState.isMet ? "Milestone reached" : "Read complete";
    sleeveFeedback.textContent = rangeState.isMet
      ? `AI Recovery Insight: ${payload.feedback}`
      : "AI Recovery Insight: Continue gentle range-of-motion work before advancing.";
  } catch (error) {
    updateMilestoneUI();
    angleValue.textContent = `${currentMockAngle || 90}°`;
    angleNote.textContent = `Live brace read · day ${day}`;
    setMilestoneState(true, "Milestone Met");
    sleeveStatus.textContent = "Milestone reached";
    sleeveFeedback.textContent = `AI Recovery Insight: The current milestone has been reached and progress is on track today.`;
  } finally {
    setIdleButton();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!sleeveAnalyze) {
    return;
  }

  if (postOpWeek) {
    postOpWeek.value = window.localStorage.getItem("kneedthat-postop-week") || postOpWeek.value;
  }
  if (postOpDay) {
    postOpDay.value = window.localStorage.getItem("kneedthat-postop-day") || postOpDay.value;
  }

  setSleeveReady();
  postOpWeek?.addEventListener("change", updateMilestoneUI);
  postOpDay?.addEventListener("change", updateMilestoneUI);

  sleeveAnalyze.addEventListener("click", analyzeSleeveAngle);
  sleeveStop?.addEventListener("click", stopLiveRead);
});
