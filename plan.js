const form = document.getElementById("ai-plan-form");

if (form) {
  const planStage = document.getElementById("plan-stage");
  const recoveryIntroTitle = document.getElementById("recovery-intro-title");
  const recoveryIntroCopy = document.getElementById("recovery-intro-copy");
  const recoveryPlanBadge = document.getElementById("recovery-plan-badge");
  const dailyAngleGoal = document.getElementById("daily-angle-goal");
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

  const readRecoveryStage = () => {
    const storedWeek = Number(window.localStorage.getItem("kneedthat-postop-week")) || 1;
    const storedDay = Number(window.localStorage.getItem("kneedthat-postop-day")) || 5;
    const stageText = `Week ${storedWeek}, Day ${storedDay}`;
    const introText = storedWeek === 1
      ? `Build a day plan around Week ${storedWeek}, Day ${storedDay} recovery.`
      : `Build a day plan around Week ${storedWeek}, Day ${storedDay} progress.`;
    if (planStage) {
      if (storedWeek === 1) {
        planStage.textContent = "90°";
      } else if (storedWeek === 2) {
        planStage.textContent = "100°";
      } else if (storedWeek === 3) {
        planStage.textContent = "110°";
      } else {
        planStage.textContent = "120°";
      }
    }
    if (recoveryIntroTitle) {
      recoveryIntroTitle.textContent = introText;
    }
    if (recoveryIntroCopy) {
      recoveryIntroCopy.textContent = `Recovery is not one-size-fits-all. ${stageText} guidance adapts to symptoms and milestone progress.`;
    }
    if (recoveryPlanBadge) {
      recoveryPlanBadge.textContent = stageText;
    }
    return {
      postOpWeek: storedWeek,
      postOpDay: storedDay,
    };
  };

  readRecoveryStage();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const recoveryStage = readRecoveryStage();
    const payload = {
      postOpWeek: recoveryStage.postOpWeek,
      postOpDay: recoveryStage.postOpDay,
      painLevel: Number(formData.get("painLevel")),
      sorenessLevel: Number(formData.get("sorenessLevel")),
      swellingToday: formData.get("swellingToday") === "yes",
      confidenceLevel: Number(formData.get("confidenceLevel")),
      goal: formData.get("goal"),
    };

    submitButton.disabled = true;
    submitButton.textContent = "Building plan...";

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

      dailyAngleGoal.textContent = shortenText(result.todays_focus, 40);
      summaryText.textContent = shortenText(result.summary, 150);
      workoutAdjustment.textContent = shortenText(result.recovery_summary, 120);
      recoveryTip.textContent = shortenText(result.caution_note, 120);
      renderList(warmupList, (result.recommended_activities || []).map((item) => shortenText(item, 70)));
      renderList(mobilityList, [
        shortenText(result.daily_angle_goal || "Work toward controlled bend", 70),
        `Match pacing to Week ${recoveryStage.postOpWeek}, Day ${recoveryStage.postOpDay}`,
        "Stop before compensating",
      ]);
    } catch (error) {
      dailyAngleGoal.textContent = "Protect early bend progress";
      summaryText.textContent = "Pain and soreness may affect early progress. Focus on controlled movement.";
      workoutAdjustment.textContent = "Based on your current input, prioritize mobility over intensity.";
      recoveryTip.textContent = "Pause if discomfort rises and keep today’s movement controlled.";
      renderList(warmupList, [
        "Heel slides",
        "Quad sets",
        "Supported knee bends",
      ]);
      renderList(mobilityList, [
        "Gentle range-of-motion work",
        "Light quad activation",
        "Short walking block",
      ]);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Get recovery plan";
    }
  });
}
