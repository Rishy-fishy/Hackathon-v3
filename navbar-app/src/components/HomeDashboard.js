import React, { useEffect, useState } from "react";
import "./HomeDashboard.css";
import { recordCounts } from "../offline/db";
import ChildForm from "../offline/ChildForm";
import BottomNav from "./BottomNav";

export default function HomeDashboard() {
  const [counts, setCounts] = useState({
    total: 0,
    uploaded: 0,
    pending: 0,
    failed: 0,
  });
  const [showChildForm, setShowChildForm] = useState(false);

  const load = async () => {
    try {
      const { pending, failed, uploaded } = await recordCounts();
      setCounts({
        total: pending + failed + uploaded,
        uploaded,
        pending,
        failed,
      });
    } catch {}
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <section className="home-dashboard" id="home">
        <div className="hero">
          <div className="hero-icon" aria-hidden>
            <span>👤</span>
          </div>
          <div className="hero-text">
            <h1>Welcome to Child Health Records!</h1>
            <p>Progressive Web Application for child health data collection</p>
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-card gradient-purple">
            <div className="stat-value">{counts.total}</div>
            <div className="stat-label">Total Records</div>
          </div>
          <div className="stat-card gradient-teal">
            <div className="stat-value">{counts.uploaded}</div>
            <div className="stat-label">Sync completed successfully</div>
          </div>
          <div className="stat-card gradient-orange">
            <div className="stat-value">{counts.pending + counts.failed}</div>
            <div className="stat-label">Pending Sync</div>
          </div>
        </div>

        {/* ✅ Tiles Row */}
        <div className="tiles-row">
          <div
            className="tile"
            onClick={() => setShowChildForm(true)}
            style={{ cursor: "pointer" }}
          >
            <div className="tile-icon circle">+</div>
            <div className="tile-title">Add New Child</div>
            <div className="tile-sub">Child Information</div>
          </div>

          <div className="tile">
            <div className="tile-icon circle">≡</div>
            <div className="tile-title">Health Records</div>
            <div className="tile-sub">All Records</div>
          </div>
          <div className="tile">
            <div className="tile-icon circle">⚙</div>
            <div className="tile-title">Settings</div>
            <div className="tile-sub">General</div>
          </div>
          <div className="tile">
            <div className="tile-icon circle">?</div>
            <div className="tile-title">Help & Support</div>
            <div className="tile-sub">User Guide</div>
          </div>
        </div>

        {/* ✅ Show ChildForm conditionally */}
        <div className={`titleforms ${showChildForm ? "active" : ""}`}>
          {showChildForm && (
            <ChildForm onClose={() => setShowChildForm(false)} />
          )}
        </div>

        <div className="getting-started">
          <h3>Getting Started</h3>
          <ul>
            <li>Tap "Add Record" to create your first child health record</li>
            <li>Fill in the child's health information and measurements</li>
            <li>View and manage all records in the Records section</li>
            <li>Access settings and help from the bottom navigation</li>
          </ul>
        </div>
      </section>

      {/* ✅ BottomNav OUTSIDE so it’s always clickable */}
      <BottomNav onAddChild={() => setShowChildForm(true)} />
    </>
  );
}
