import React from "react";

function Badge({ label, ok, version, detail }) {
  return (
    <div className={`hbadge ${ok ? "hbadge--ok" : "hbadge--error"}`} title={detail || ""}>
      <span className="hbadge__dot" />
      <span className="hbadge__label">{label}</span>
      {ok && version && (
        <span className="hbadge__version">{version.slice(0, 20)}</span>
      )}
      {!ok && <span className="hbadge__missing">not found</span>}
    </div>
  );
}

export default function HealthStatus({ health, loading }) {
  if (loading) {
    return (
      <div className="health-bar">
        <span className="health-bar__checking">Checking Docker dependencies…</span>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="health-bar">
        <span className="health-bar__error">
          ⚠ Backend unreachable — is Docker running?
          Run: <code>docker compose up --build</code>
        </span>
      </div>
    );
  }

  return (
    <div className="health-bar">
      <Badge label="MySQL"  ok={health.databaseConnected} version={null}              detail="Database connection" />
      <Badge label="yt-dlp" ok={health.ytDlpInstalled}    version={health.ytDlpVersion} />
      <Badge label="ffmpeg" ok={health.ffmpegInstalled}    version={health.ffmpegVersion} />
      <Badge label="downloads" ok={health.downloadsReady} version={null} detail={health.downloadsPath} />

      {health.downloadsPath && (
        <span className="health-bar__path" title={health.downloadsPath}>
          📁 {health.downloadsPath}
        </span>
      )}
    </div>
  );
}
