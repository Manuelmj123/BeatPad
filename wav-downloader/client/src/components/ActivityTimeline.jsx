import React from "react";

const TYPE_ICONS = {
  created:         "✦",
  beat_downloaded: "🎵",
  version_saved:   "📝",
  lyrics_updated:  "✏",
  status_changed:  "⚡",
};

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function ActivityTimeline({ activity = [] }) {
  if (activity.length === 0) return null;

  return (
    <div className="activity">
      <h4 className="activity__heading">Activity</h4>
      <ul className="activity__list">
        {activity.slice(0, 20).map((item) => (
          <li key={item.id} className="activity__item">
            <span className="activity__icon">
              {TYPE_ICONS[item.activity_type] ?? "·"}
            </span>
            <span className="activity__message">{item.message}</span>
            <span className="activity__time">{formatTime(item.created_at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
