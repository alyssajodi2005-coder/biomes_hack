const form = document.getElementById("ai-plan-form");

if (form) {
  const riskLevel = document.getElementById("risk-level");
  const summaryText = document.getElementById("summary-text");
  const warmupList = document.getElementById("warmup-list");
  const mobilityList = document.getElementById("mobility-list");
  const workoutAdjustment = document.getElementById("workout-adjustment");
  const recoveryTip = document.getElementById("recovery-tip");
  const submitButton = form.querySelector('button[type="submit"]');

  const shortenText = (text, maxLength = 135) => {
    if (typeof text !== "string") {
      return "";
    }

    const clean = text.replace(/\s+/g, " ").trim();
    if (clean.length <= maxLength) {
      return clean;
    }

    const shortened = clean.slice(0, maxLength);
    const lastSpace = shortened.lastIndexOf(" ");
    return `${shortened.slice(0, lastSpace > 60 ? lastSpace : maxLength).trim()}...`;
  };

  const renderList = (node, items) => {
    node.innerHTML = "";
    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      node.appendChild(li);
    });
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const payload = {
      exercise: formData.get("exercise"),
      painLevel: Number(formData.get("painLevel")),
      warmupDone: formData.get("warmupDone") === "yes",
      instabilityScore: Number(formData.get("instabilityScore")),
      fatigueScore: Number(formData.get("fatigueScore")),
      goal: formData.get("goal"),
    };

    submitButton.disabled = true;
    submitButton.textContent = "Generating...";

    try {
      const response = await fetch("/api/ai-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || "Failed to generate plan.");
      }

      const result = await response.json();

      riskLevel.textContent = result.risk_level;
      summaryText.textContent = shortenText(result.summary, 150);
      workoutAdjustment.textContent = shortenText(result.workout_adjustment, 120);
      recoveryTip.textContent = shortenText(result.recovery_tip, 120);
      renderList(warmupList, (result.warmup_plan || []).map((item) => shortenText(item, 70)));
      renderList(mobilityList, (result.mobility_plan || []).map((item) => shortenText(item, 70)));
    } catch (error) {
      riskLevel.textContent = "Unavailable";
      summaryText.textContent = error.message;
      workoutAdjustment.textContent = "No adjustment available until the AI response succeeds.";
      recoveryTip.textContent = "Check billing or quota, then try again.";
      renderList(warmupList, [
        "Complete your usual warm-up first",
        "Use low-impact movement",
        "Retry once AI service is available",
      ]);
      renderList(mobilityList, [
        "Light ankle mobility",
        "Gentle hip opener",
        "Easy quad stretch",
      ]);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Get AI plan";
    }
  });
}
