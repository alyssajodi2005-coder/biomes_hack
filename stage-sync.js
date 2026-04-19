const storedWeek = Number(window.localStorage.getItem("kneedthat-postop-week")) || 1;
const storedDay = Number(window.localStorage.getItem("kneedthat-postop-day")) || 5;

function getTimelineStage(week) {
  if (week <= 1) {
    return {
      badge: "Week 1",
      range: "90°",
      title: "Track Week 1 recovery and the first controlled bend milestone.",
      support: "The sleeve and app work together to confirm when the first bend milestone has been reached with control.",
      goals: [
        "Week 1: establish controlled bend toward 90°",
        "Reduce stiffness with steady range-of-motion work",
        "Build confidence between physical therapy sessions",
        "Prioritize control over intensity",
      ],
    };
  }

  if (week === 2) {
    return {
      badge: "Week 2",
      range: "100°",
      title: "Track Week 2 recovery and build on early bend progress.",
      support: "The sleeve helps confirm steady progress as the user works toward a deeper bend milestone.",
      goals: [
        "Week 2: build consistency toward 100°",
        "Keep movement smooth and repeatable",
        "Use soreness and pain to pace the session",
        "Stay focused on milestone quality",
      ],
    };
  }

  if (week === 3) {
    return {
      badge: "Week 3",
      range: "110°",
      title: "Track Week 3 recovery and continue gradual range-of-motion gains.",
      support: "The app keeps recovery centered on controlled progress as mobility improves.",
      goals: [
        "Week 3: continue gradual bend gains toward 110°",
        "Support mobility with steady daily practice",
        "Watch for swelling or movement hesitation",
        "Keep progress controlled and consistent",
      ],
    };
  }

  return {
    badge: `Week ${week}`,
    range: "120°",
    title: `Track Week ${week} recovery and work toward fuller flexion.`,
    support: "The sleeve and app support milestone tracking as range of motion continues to improve.",
    goals: [
      `Week ${week}: work toward 120° with control`,
      "Continue mobility with guided pacing",
      "Use symptoms to shape the day plan",
      "Focus on steady recovery momentum",
    ],
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const timelineTitle = document.getElementById("timeline-title");
  const timelineBadge = document.getElementById("timeline-stage-badge");
  const timelineTargetRange = document.getElementById("timeline-target-range");
  const timelineSupportCopy = document.getElementById("timeline-support-copy");
  const timelineGoalsList = document.getElementById("timeline-goals-list");

  if (!timelineTitle || !timelineBadge || !timelineTargetRange || !timelineSupportCopy || !timelineGoalsList) {
    return;
  }

  const stage = getTimelineStage(storedWeek);
  timelineTitle.textContent = stage.title;
  timelineBadge.textContent = `${stage.badge} · Day ${storedDay}`;
  timelineTargetRange.textContent = stage.range;
  timelineSupportCopy.textContent = stage.support;
  timelineGoalsList.innerHTML = "";
  stage.goals.forEach((goal) => {
    const item = document.createElement("li");
    item.textContent = goal;
    timelineGoalsList.appendChild(item);
  });
});
