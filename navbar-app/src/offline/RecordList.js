import React, { useEffect, useState } from 'react';
import { listChildRecords } from './db';

export default function RecordList() {
  const [records, setRecords] = useState([]);

  const load = async () => {
    const all = await listChildRecords();
    setRecords(all);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 5000); // periodic refresh to reflect sync status changes
    return () => clearInterval(id);
  }, []);

  return (
    <div className="record-list">
      <h2>Local Records</h2>
      <table className="records-table">
        <thead>
          <tr>
            <th>Health ID</th><th>Name</th><th>Age(m)</th><th>Status</th><th>Created</th>
          </tr>
        </thead>
        <tbody>
          {records.map(r => (
            <tr key={r.healthId} className={`status-${r.status}`}>
              <td>{r.healthId}</td>
              <td>{r.name}</td>
              <td>{r.ageMonths ?? '-'}</td>
              <td>
                <span className={`status-badge ${r.status}`}>
                  {r.status}
                </span>
              </td>
              <td>{new Date(r.createdAt).toLocaleString()}</td>
            </tr>
          ))}
          {!records.length && <tr><td colSpan={5}>No records found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}