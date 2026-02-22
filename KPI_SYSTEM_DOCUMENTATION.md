# KPI Report System Documentation

## Overview

The KPI (Key Performance Indicator) Report System provides comprehensive, actionable intelligence about team performance by automatically categorizing employees into performance groups and identifying optimization opportunities.

## Features

### 1. **Time Period Support**
- ✅ Daily - 24-hour period
- ✅ Weekly - Monday-Sunday (7 days)
- ✅ Monthly - Calendar month
- ✅ Yearly - Calendar year

### 2. **Performance Categorization**

Employees are automatically classified into 4 categories based on multiple metrics:

#### **⭐ Star Performers**
- High hours logged + high task completion + high reports submitted
- Top 25% performers across metrics
- **Action**: Recognize and retain; consider for leadership roles

#### **⚡ Overworked Staff**
- Excessive hours (60%+ above average) with sustained productivity
- Active most days of the period
- **Action**: Workload redistribution; burnout risk mitigation

#### **📊 Coasters**
- Moderate activity; average engagement
- Not in top or bottom quartiles
- **Action**: Performance improvement plans; skill development

#### **🚨 Underperformers**
- Low activity across metrics (hours, tasks, reports < 50% avg)
- May indicate disengagement or support needs
- **Action**: Performance review; discuss support needs

### 3. **Key Metrics**

#### **Summary Level**
- Total Hours: Hours logged by all employees
- Reports Submitted: Number of daily/weekly reports filed
- Tasks Completed: Tasks moved to completed status
- Active Employees: Employees with any recorded activity
- Completion Rate: % of team members who submitted reports
- Average Hours/Employee: Total hours ÷ active employees
- Average Tasks/Employee: Total tasks ÷ active employees

#### **Per-Employee Metrics**
- Hours Logged: Total time tracked on projects/tasks
- Tasks Completed: Number of completed macrotasks
- Reports: Number of reports submitted
- Days Active: Number of distinct days with activity
- Avg Hours/Day: Hours ÷ days active
- Performance Score: Calculated metric (0-1.0 scale)

#### **Per-Project Metrics**
- Total Hours: Time logged to project
- Task Count: Completed tasks in project
- Contributors: Number of team members working on project

### 4. **Trend Analysis**

Each report includes percentage changes from previous period:
- Hours trend
- Reports trend
- Task completion trend
- Staff engagement trend
- Completion rate trend

Positive trend = ↑ (green), Negative trend = ↓ (red)

### 5. **Action Items**

The system automatically generates recommendations:
- **Underperformance alerts** with specific reasons (low hours, few tasks, etc.)
- **Burnout risk alerts** for overworked staff
- **Missing report notifications** for non-submitters

## API Endpoints

### `GET /api/kpi/generate`

**Generate comprehensive KPI report with all details**

Query Parameters:
- `orgId` (required): Organization ID
- `period` (optional): 'daily' | 'weekly' | 'monthly' | 'yearly' (default: 'weekly')
- `date` (optional): Reference date for period (default: today)

Example:
```bash
GET /api/kpi/generate?orgId=org-123&period=weekly&date=2025-02-22
```

Response:
```json
{
  "reportMeta": {
    "period": "weekly",
    "dateRange": {
      "start": "2025-02-17",
      "end": "2025-02-23"
    },
    "previousDateRange": {
      "start": "2025-02-10",
      "end": "2025-02-16"
    },
    "generatedAt": "2025-02-22T10:30:45.123Z"
  },
  "summary": {
    "totalHours": 385.5,
    "totalReports": 12,
    "totalTasks": 28,
    "activeEmployees": 8,
    "memberCount": 10,
    "completionRate": 80,
    "avgHoursPerEmployee": 48.19,
    "avgTasksPerEmployee": 3.5,
    "avgReportsPerEmployee": 1.5,
    "topProject": {
      "name": "Website Redesign",
      "hours": 140.5
    }
  },
  "trends": {
    "hours": 12,
    "reports": 5,
    "tasks": 8,
    "activeEmployees": 0,
    "completionRate": 10
  },
  "performance": {
    "starPerformers": [
      {
        "id": "user-456",
        "name": "Alice Johnson",
        "email": "alice@company.com",
        "hours": 62.5,
        "tasksCompleted": 8,
        "reports": 3,
        "performanceScore": 1.85
      }
    ],
    "overworked": [
      {
        "id": "user-789",
        "name": "Bob Smith",
        "email": "bob@company.com",
        "hours": 78.25,
        "daysActive": 6,
        "performanceScore": 1.62
      }
    ],
    "coasters": [
      {
        "id": "user-321",
        "name": "Charlie Brown",
        "email": "charlie@company.com",
        "hours": 35.0,
        "tasksCompleted": 2,
        "performanceScore": 0.72
      }
    ],
    "underperformers": [
      {
        "id": "user-654",
        "name": "Diana Prince",
        "email": "diana@company.com",
        "hours": 12.5,
        "tasksCompleted": 0,
        "reports": 0,
        "performanceScore": 0.26
      }
    ]
  },
  "actionItems": [
    {
      "type": "underperformance",
      "severity": "high",
      "employee": {
        "id": "user-654",
        "name": "Diana Prince",
        "email": "diana@company.com"
      },
      "reasons": [
        "Logged 12.5h vs 48.19h avg",
        "Completed 0 tasks vs 3.5 avg",
        "Submitted 0 reports vs 1.5 avg"
      ],
      "recommendation": "Schedule performance review and discuss support needs"
    },
    {
      "type": "burnout-risk",
      "severity": "medium",
      "employee": {
        "id": "user-789",
        "name": "Bob Smith",
        "email": "bob@company.com"
      },
      "reasons": [
        "78.25h logged (162% above avg)",
        "Active 6 days (86% of period)"
      ],
      "recommendation": "Consider workload redistribution or additional support"
    }
  ],
  "employees": [
    {
      "id": "user-456",
      "name": "Alice Johnson",
      "email": "alice@company.com",
      "role": "STAFF",
      "hours": 62.5,
      "reports": 3,
      "tasksCompleted": 8,
      "projects": ["Website Redesign", "Dashboard"],
      "daysActive": 6,
      "avgHoursPerDay": 10.42,
      "hasActivity": true
    }
  ],
  "projects": [
    {
      "id": "proj-123",
      "name": "Website Redesign",
      "hours": 140.5,
      "tasksCount": 12,
      "contributors": 4
    }
  ],
  "missingReporters": [
    {
      "id": "user-999",
      "name": "Eve Wilson",
      "email": "eve@company.com"
    }
  ]
}
```

### `GET /api/kpi/summary`

**Quick summary without detailed employee lists**

Returns: reportMeta, summary, trends, topPerformers (top 5), underperformers, actionItemsCount

### `GET /api/kpi/performance`

**Detailed performance data for analytics/coaching**

Returns: reportMeta, performance (categorized employees), actionItems, summary

## Frontend Usage

### Basic Implementation

```tsx
import { KPIReport } from '@/components/KPIReport';

function Dashboard() {
  const orgId = useContext(OrgContext).id;

  return (
    <KPIReport 
      orgId={orgId}
      period="weekly"
      date="2025-02-22"
    />
  );
}
```

### With Page Controls

```tsx
import { useState } from 'react';
import { KPIReport } from '@/components/KPIReport';

function KPIPage() {
  const [period, setPeriod] = useState('weekly');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const orgId = getOrgIdFromContext();

  return (
    <>
      <div>
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
        <input 
          type="date" 
          value={date} 
          onChange={(e) => setDate(e.target.value)} 
        />
      </div>
      <KPIReport orgId={orgId} period={period} date={date} />
    </>
  );
}
```

## UI Layout

### Overview Tab
- Summary cards (hours, reports, tasks, completion rate)
- Top project display
- Pie chart: hours distribution by project
- Bar chart: project hours comparison

### Performance Tab
- Performance cards showing:
  - Star Performers (⭐)
  - Overworked Staff (⚡)
  - Coasters (📊)
  - Underperformers (🚨)
- Performance distribution chart
- Top employees in each category

### Projects Tab
- Bar chart: hours per project
- Table: project details (hours, tasks, contributors)

### Actions Tab
- High-priority alerts (underperformance, burnout risk)
- Specific reasons for each alert
- Recommendations for managers

## Performance Calculation Logic

### Star Performer Score
Equal weight to:
- Hours relative to top performer
- Tasks completed relative to top
- Reports submitted relative to top

### Overworked Detection
- Hours > 160% of average AND
- Tasks > 120% of average AND
- Days active > 80% of period

### Underperformer Detection
- Hours < 50% of average OR
- Tasks < 50% of average OR
- No activity recorded

## Sample Use Cases

### 1. Weekly Team Status
```
GET /api/kpi/generate?orgId=org-123&period=weekly
```
Shows current week's team performance vs previous week

### 2. Monthly Review
```
GET /api/kpi/generate?orgId=org-123&period=monthly&date=2025-02-01
```
Comprehensive monthly review for team 1-on-1s

### 3. Year-to-Date Performance
```
GET /api/kpi/generate?orgId=org-123&period=yearly
```
Annual performance review for all employees

### 4. Performance Coach Dashboard
```
GET /api/kpi/performance?orgId=org-123&period=weekly
```
Detailed performance data for HR/manager coaching

## Database Requirements

The KPI system relies on:
- `AttendanceLog` - Daily work hours
- `TimeLog` - Detailed time tracking per task
- `MacroTask` - Tasks (status: completed, completedAt)
- `Report` - Daily/weekly reports
- `Membership` - Team members
- `Project` - Project assignments

Ensure these tables are properly populated for accurate reports.

## Performance Tips

- For large organizations (500+ employees), consider caching weekly/monthly reports
- Use `/api/kpi/summary` for dashboard overviews (faster response)
- Use `/api/kpi/performance` for detailed analysis pages
- Schedule reports generation off-peak (e.g., 2 AM daily, 12 PM Mondays)

## Error Handling

```tsx
try {
  const report = await fetch(`/api/kpi/generate?orgId=${orgId}`);
  if (!report.ok) {
    console.error('KPI generation failed');
  }
} catch (error) {
  console.error('Network error:', error);
}
```

Common errors:
- `400` - Missing orgId or invalid period
- `500` - Database query failure; check data consistency
