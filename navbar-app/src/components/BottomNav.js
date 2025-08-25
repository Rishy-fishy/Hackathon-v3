import React, { useState } from "react";
import "./BottomNav.css";
import ChildForm from "../offline/ChildForm";

export default function BottomNav() {
  const [showChildForm, setShowChildForm] = useState(false);

  return (
    <>
      {/* Taskbar */}
      <nav className="bottom-nav" aria-label="Bottom Navigation">
        {/* ✅ Home goes back to main screen */}
        <div className="bn-item" onClick={() => setShowChildForm(false)}>
          <span className="bn-icon">🏠</span>
          <span className="bn-label">Home</span>
        </div>

        {/* Toggle form */}
        <div className={`bn-item ${showChildForm ? "active" : ""}`} 
             onClick={() => setShowChildForm(!showChildForm)}>
          <span className="bn-icon">➕</span>
          <span className="bn-label">Add Child</span>
        </div>

        <div className="bn-item" onClick={() => window.location.hash = "#view-data"}>
          <span className="bn-icon">🗂</span>
          <span className="bn-label">Records</span>
        </div>

        <div className="bn-item" onClick={() => window.location.hash = "#settings"}>
          <span className="bn-icon">⚙️</span>
          <span className="bn-label">Settings</span>
        </div>

        <div className="bn-item" onClick={() => window.location.hash = "#help"}>
          <span className="bn-icon">❓</span>
          <span className="bn-label">Help</span>
        </div>
      </nav>

      {/* Floating "window" for child form */}
      {showChildForm && (
        <div className="task-window">
          <div className="task-window-header">
            <span>Add Child Form</span>
            <button onClick={() => setShowChildForm(false)}>✖</button>
          </div>
          <div className="task-window-body">
            <ChildForm />
          </div>
        </div>
      )}
    </>
  );
}
  