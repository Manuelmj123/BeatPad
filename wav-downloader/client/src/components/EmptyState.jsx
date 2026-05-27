import React from "react";
import SvgMusicOrb from "./SvgMusicOrb.jsx";

export default function EmptyState({ onNew }) {
  return (
    <div className="empty-state">
      <div className="empty-state__orb">
        <SvgMusicOrb size={96} />
      </div>
      <h2 className="empty-state__title">Your songwriting workspace</h2>
      <p className="empty-state__sub">
        Create a song, paste a YouTube beat link, and start writing.
        <br />
        Everything saves to MySQL — Docker handles the rest.
      </p>
      <button className="btn btn--grad btn--lg" onClick={onNew}>
        + Create First Song
      </button>
    </div>
  );
}
