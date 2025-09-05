import React from 'react';

export default function AdminReports({ token }){
  return (
    <div className="section-wrapper">
      <header className="section-header"><h1>Reports</h1><p className="section-desc">Generate and view reports related to child health data, field agent activities, and system performance.</p></header>
      <div className="panel-card">
        <form className="report-form" onSubmit={e=>{ e.preventDefault(); alert('Report generation placeholder.'); }}>
          <div className="form-row">
            <label className="form-label" htmlFor="report-type">Report Type</label>
            <select id="report-type" className="form-input" defaultValue="">
              <option value="" disabled>Select Report Type</option>
              <option value="summary">Summary Metrics</option>
              <option value="uploads">Recent Uploads</option>
              <option value="agents">Field Agent Activity</option>
              <option value="locations">Location Coverage</option>
            </select>
          </div>
          <div className="form-row two">
            <div>
              <label className="form-label" htmlFor="date-from">Date From</label>
              <input id="date-from" type="date" className="form-input" />
            </div>
            <div>
              <label className="form-label" htmlFor="date-to">Date To</label>
              <input id="date-to" type="date" className="form-input" />
            </div>
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="export-format">Export Format</label>
            <select id="export-format" className="form-input" defaultValue="">
              <option value="" disabled>Select Export Format</option>
              <option value="pdf">PDF</option>
              <option value="csv">CSV</option>
            </select>
          </div>
          <div className="form-actions">
            <button className="primary-btn" type="submit">⇩ Generate Report</button>
          </div>
        </form>
      </div>
    </div>
  );
}
