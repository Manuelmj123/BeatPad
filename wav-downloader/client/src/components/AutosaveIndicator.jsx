import React from "react";

/**
 * Shows autosave status next to the lyrics editor.
 * @param {{ status: "idle"|"modified"|"saving"|"saved"|"error" }} props
 */
export default function AutosaveIndicator({ status }) {
  if (status === "idle") return null;

  const CONFIG = {
    modified: { text: "Unsaved changes", cls: "autosave--modified" },
    saving:   { text: "Saving…",         cls: "autosave--saving"   },
    saved:    { text: "Saved ✓",         cls: "autosave--saved"    },
    error:    { text: "Could not save",  cls: "autosave--error"    },
  };

  const { text, cls } = CONFIG[status] ?? CONFIG.modified;

  return (
    <span className={`autosave ${cls}`} aria-live="polite">
      {status === "saving" && <span className="autosave__spinner" aria-hidden="true" />}
      {text}
    </span>
  );
}
