import { useState } from 'react';
import { KPIReport } from '../components/KPIReport';
import './KPIPage.css';

export function KPIPage() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Get orgId from context or URL params
  const orgId = new URLSearchParams(window.location.search).get('orgId') || 'default-org';

  return (
    <div className="kpi-page">
      <div className="kpi-page-controls">
        <div className="control-group">
          <label htmlFor="period-select">Period:</label>
          <select
            id="period-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="period-select"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="date-input">Date:</label>
          <input
            id="date-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="date-input"
          />
        </div>
      </div>

      <KPIReport orgId={orgId} period={period} date={date} />
    </div>
  );
}
