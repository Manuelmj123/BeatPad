import React, { useEffect, useState } from "react";
import { fetchSettings, updateSettings, resetSetting } from "../api.js";
import FolderBrowser from "./FolderBrowser.jsx";

function IconFolder() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconWarning() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconReset() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polyline points="1 4 1 10 7 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.51 15a9 9 0 102.25-3.66L1 10"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function PathRow({ label, description, settingKey, info, value, onBrowse, onReset, error, saved }) {
  const isDefault = info ? value === info.default : false;

  return (
    <div className="settings-path-row">
      <div className="settings-path-row__head">
        <div className="settings-path-row__icon"><IconFolder /></div>
        <div className="settings-path-row__label-block">
          <span className="settings-path-row__label">{label}</span>
          <span className="settings-path-row__desc">{description}</span>
        </div>
        {info && (
          <span className={`settings-path-row__status ${info.writable ? "settings-path-row__status--ok" : "settings-path-row__status--warn"}`}>
            {info.writable ? <IconCheck /> : <IconWarning />}
            {info.writable ? "Ready" : "Not writable"}
          </span>
        )}
      </div>

      {/* Current path display + Browse button */}
      <div className="settings-path-row__picker">
        <div className="settings-path-row__current-path" title={value}>
          <span className="settings-path-row__current-label">Save to:</span>
          <code className="settings-path-row__current-val">{info?.hostRelative ?? value}</code>
          {saved && <span className="settings-path-row__inline-saved"><IconCheck /> saved</span>}
        </div>
        <button
          className="btn btn--secondary btn--sm settings-path-row__browse-btn"
          onClick={() => onBrowse(settingKey, value)}
        >
          📂 Browse…
        </button>
      </div>

      {error && <p className="field-error" role="alert">{error}</p>}

      {!isDefault && (
        <button className="settings-path-row__reset-btn" onClick={() => onReset(settingKey)}>
          <IconReset /> Reset to default ({info?.default})
        </button>
      )}
    </div>
  );
}

export default function SettingsModal({ onClose, showToast }) {
  const [info,    setInfo]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [pending, setPending] = useState({});
  const [errors,  setErrors]  = useState({});
  const [saved,   setSaved]   = useState({});
  const [browser, setBrowser] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchSettings()
      .then(({ settings }) => { if (!cancelled) { setInfo(settings); } })
      .catch(() => showToast("Could not load settings.", "error"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [showToast]);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape" && !browser) onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, browser]);

  function handleBrowserSelect(key, containerPath) {
    setBrowser(null);
    setPending((p) => ({ ...p, [key]: containerPath }));
    setErrors((e) => ({ ...e, [key]: null }));
    setSaved((s)  => ({ ...s, [key]: false }));
  }

  function effectiveValue(key) {
    if (key in pending) return pending[key];
    return info?.[key]?.value ?? "";
  }

  async function handleSave() {
    if (Object.keys(pending).length === 0) {
      showToast("No changes to save.", "info");
      return;
    }
    setSaving(true);
    setErrors({});
    setSaved({});
    try {
      const result = await updateSettings(pending);
      const newSaved  = {};
      const newErrors = {};
      for (const [k] of Object.entries(result.saved ?? {})) {
        newSaved[k] = true;
        setPending((p) => { const n = { ...p }; delete n[k]; return n; });
      }
      for (const [k, msg] of Object.entries(result.errors ?? {})) {
        newErrors[k] = msg;
      }
      setSaved(newSaved);
      setErrors(newErrors);

      const { settings } = await fetchSettings();
      setInfo(settings);

      const sc = Object.keys(newSaved).length;
      const ec = Object.keys(newErrors).length;
      if (sc && !ec) showToast(`${sc} path${sc > 1 ? "s" : ""} saved.`, "success");
      else if (sc)   showToast(`${sc} saved, ${ec} failed.`, "warning");
      else           showToast("Could not save — see errors.", "error");
    } catch (err) {
      showToast(err.message || "Save failed.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset(key) {
    setSaving(true);
    try {
      await resetSetting(key);
      const { settings } = await fetchSettings();
      setInfo(settings);
      setPending((p) => { const n = { ...p }; delete n[key]; return n; });
      setSaved((s) => ({ ...s, [key]: true }));
      showToast("Reset to default.", "success");
    } catch (err) {
      showToast(err.message || "Reset failed.", "error");
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = Object.keys(pending).length > 0;

  const ROWS = [
    { key: "downloads_path", label: "Beat Downloads",   desc: "Where YouTube WAV files are saved" },
    { key: "uploads_path",   label: "Uploaded Mixes",   desc: "Where your finished song files go" },
    { key: "exports_path",   label: "Exports",           desc: "Where ZIP packages & lyrics TXT files go" },
  ];

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal settings-modal"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-modal-title"
        >
          <div className="modal__header">
            <h2 className="modal__title" id="settings-modal-title">⚙️ Settings</h2>
            <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>
          </div>

          <div className="modal__body">
            {loading ? (
              <div className="settings-loading">
                <div className="workspace__spinner" />
                <span>Loading settings…</span>
              </div>
            ) : (
              <>
                <div className="settings-info-banner">
                  <strong>📁 Save Paths</strong>
                  <p>
                    Click <strong>Browse…</strong> to navigate folders inside the Docker container,
                    or click the path shown (e.g. <code>/downloads</code>) to type any path directly.
                  </p>
                  <p className="settings-info-banner__docker-note">
                    🐳 <strong>Running in Docker?</strong> The folder browser shows the
                    container&apos;s filesystem. To save files to your Windows Desktop or any other
                    Windows folder, add a volume mount in <code>docker-compose.yml</code> and use
                    that container path here. Example:
                    <code className="settings-info-banner__code-block">
                      volumes:{"\n"}
                      {"  "}- C:\Users\YourName\Desktop:/desktop
                    </code>
                    Then type <code>/desktop</code> as the path here.
                  </p>
                </div>

                {ROWS.map(({ key, label, desc }) => {
                  const val = effectiveValue(key);
                  const infoEntry = info?.[key];

                  return (
                    <PathRow
                      key={key}
                      label={label}
                      description={desc}
                      settingKey={key}
                      info={infoEntry || null}
                      value={val}
                      onBrowse={(k, root) => setBrowser({ key: k, root })}
                      onReset={handleReset}
                      error={errors[key]}
                      saved={saved[key] && !(key in pending)}
                    />
                  );
                })}
              </>
            )}
          </div>

          <div className="modal__footer">
            <button className="btn btn--ghost" onClick={onClose} disabled={saving}>Close</button>
            <button
              className={`btn btn--grad${saving ? " btn--loading" : ""}`}
              onClick={handleSave}
              disabled={saving || loading || !hasChanges}
            >
              {saving
                ? <><span className="spinner" aria-hidden="true" /> Saving…</>
                : "Save Paths"}
            </button>
          </div>
        </div>
      </div>

      {/* Folder browser — starts from current value or "/" for full navigation */}
      {browser && (
        <FolderBrowser
          rootPath={browser.root || "/"}
          onSelect={(path) => handleBrowserSelect(browser.key, path)}
          onClose={() => setBrowser(null)}
        />
      )}
    </>
  );
}
