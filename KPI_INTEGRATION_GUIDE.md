# KPI Report System - Integration Guide

## Quick Setup

### 1. Backend Services (Already Created)
- ✅ **`backend/services/kpiService.js`** - Core KPI logic with performance categorization
- ✅ **`backend/api/kpi.js`** - API endpoints

### 2. Frontend Components (Already Created)
- ✅ **`frontend/src/components/KPIReport/KPIReport.tsx`** - Main report component
- ✅ **`frontend/src/components/KPIReport/KPIReport.css`** - Styles
- ✅ **`frontend/src/pages/KPIPage.tsx`** - Full page implementation

### 3. Documentation
- ✅ **`KPI_SYSTEM_DOCUMENTATION.md`** - Complete feature documentation
- ✅ **`SAMPLE_KPI_REPORT.json`** - Sample API response
- ✅ **`KPI_INTEGRATION_GUIDE.md`** - This file

---

## API Endpoints

### 1. `/api/kpi/generate`
**Full KPI report with all details**
```bash
GET /api/kpi/generate?orgId=YOUR_ORG_ID&period=weekly
```

**Supported periods:**
- `daily` - 24-hour period
- `weekly` - Mon-Sun (default)
- `monthly` - Calendar month
- `yearly` - Calendar year

**Optional parameters:**
- `date` - Reference date (e.g., `2026-02-22`, defaults to today)

### 2. `/api/kpi/summary`
**Quick metrics without employee lists**
```bash
GET /api/kpi/summary?orgId=YOUR_ORG_ID&period=weekly
```
Returns: Summary, trends, top performers, action items count

### 3. `/api/kpi/performance`
**Performance categorization details**
```bash
GET /api/kpi/performance?orgId=YOUR_ORG_ID&period=weekly
```
Returns: Performance categories, action items, recommendations

---

## Frontend Integration

### Step 1: Add to Main Router

In your main `App.tsx` or router configuration:

```tsx
import { KPIPage } from '@/pages/KPIPage';

// Add to your routes
<Route path="/kpi-reports" element={<KPIPage />} />
```

### Step 2: Add Navigation Link

Add link in your navigation/sidebar:
```tsx
<NavLink to="/kpi-reports">
  📊 KPI Reports
</NavLink>
```

### Step 3: Use in Dashboard/Components

```tsx
import { KPIReport } from '@/components/KPIReport';

function MyDashboard() {
  const orgId = useContext(OrgContext).id;

  return (
    <KPIReport 
      orgId={orgId}
      period="weekly"
    />
  );
}
```

---

## Performance Categories Explained

### ⭐ **Star Performers**
Employees exceeding targets across hours, tasks, and reports.

**Metrics:**
- Hours in top 25%
- Tasks in top 25%
- Reports in top 25%

**Action Items:**
- Consider for promotions/leadership roles
- Recognize and reward
- Use as mentors for struggling staff

### ⚡ **Overworked Staff**
High performers logging excessive hours (>160% of average).

**Metrics:**
- Hours > 60% above average
- Task completion above average
- Active most days

**Action Items:**
- Redistribute workload
- Offer overtime/compensation
- Schedule wellness check-ins
- Prevent burnout

### 📊 **Coasters**
Average performers with moderate engagement.

**Metrics:**
- Hours within ±20% of average
- Tasks within ±20% of average
- Not top or bottom performers

**Action Items:**
- Performance improvement plans
- Skill development opportunities
- Career development discussions
- Engagement initiatives

### 🚨 **Underperformers**
Employees with low activity across metrics.

**Metrics:**
- Hours < 50% of average
- Tasks < 50% of average
- Minimal reports or activity

**Action Items:**
- Schedule performance reviews
- Discuss support needs
- Check for personal issues/leave
- Provide training/resources
- Set clear expectations

---

## Sample Usage Scenarios

### Scenario 1: Weekly Team Huddle
```bash
curl "http://localhost:3001/api/kpi/summary?orgId=org-123&period=weekly"
```
Use result to:
- Show team overview metrics
- Highlight action items
- Celebrate top performers

### Scenario 2: Monthly Performance Reviews
```bash
curl "http://localhost:3001/api/kpi/generate?orgId=org-123&period=monthly"
```
Use to:
- Review individual performance
- Discuss goals vs actuals
- Plan development opportunities
- Address underperformance

### Scenario 3: Quarterly Leadership Review
```bash
curl "http://localhost:3001/api/kpi/generate?orgId=org-123&period=yearly"
```
Use to:
- Assess annual team performance
- Plan talent management
- Budget planning
- Strategic decisions

### Scenario 4: Project Post-Mortem
```bash
curl "http://localhost:3001/api/kpi/generate?orgId=org-123&period=monthly&date=2026-01-15"
```
Use to:
- Analyze project team performance
- Identify bottlenecks
- Plan next projects

---

## Understanding the Data

### Summary Metrics

| Metric | Definition | Use Case |
|--------|-----------|----------|
| Total Hours | Sum of logged hours | Resource allocation, capacity planning |
| Total Reports | Number of submissions | Team engagement, documentation habits |
| Total Tasks | Completed task count | Productivity, project progress |
| Active Employees | Employees with any activity | Team engagement, turnover risk |
| Completion Rate | % of team submitting reports | Accountability, communication |
| Avg Hours/Employee | Total hours ÷ active employees | Workload distribution |
| Avg Tasks/Employee | Tasks ÷ active employees | Productivity benchmarking |

### Trends

Percentage change from previous period:
- `+15` = 15% increase (good for hours/tasks, concerning for burnout)
- `-10` = 10% decrease (concerning for productivity, good for overwork reduction)
- `null` = No previous period data (first report)

### Performance Score

0.0 - 2.0 scale:
- `1.5+` = Star performer (top 25%)
- `1.0-1.4` = Strong contributor
- `0.5-0.9` = Average performer
- `<0.5` = Needs improvement

---

## Backend Service Functions

The `kpiService.js` exports these functions:

### `generateKPIReport(orgId, period, referenceDate)`
Main function to generate complete report.

```javascript
import { generateKPIReport } from '../services/kpiService.js';

const report = await generateKPIReport('org-123', 'weekly', new Date());
```

### `categorizeEmployeePerformance(employees, org)`
Categorizes employees into 4 groups.

```javascript
const performance = categorizeEmployeePerformance(employees);
// Returns: { starPerformers, overworked, coasters, underperformers }
```

### `generateActionItems(performanceData, metrics)`
Creates actionable recommendations.

```javascript
const actions = generateActionItems(performance, metrics);
// Returns: Array of action items with severity
```

### `calculateMetrics(data)`
Computes summary statistics.

```javascript
const metrics = calculateMetrics({
  attendanceLogs, 
  reports, 
  tasksCompleted, 
  timeLogs
});
```

---

## Customization

### Adjust Performance Thresholds

In `backend/services/kpiService.js`, modify the `categorizeEmployeePerformance` function:

```javascript
// Current: 60% above average = overworked
const excessiveHours = emp.hours > avgHours * 1.6;

// Change to 50% above average
const excessiveHours = emp.hours > avgHours * 1.5;
```

### Add Custom Metrics

Extend the `calculateMetrics` function:

```javascript
// Add a new metric
efficiency: totalTasks / totalHours,
```

### Change Chart Colors

In `frontend/src/components/KPIReport/KPIReport.tsx`:

```javascript
const COLORS = {
  'starPerformers': '#00c853',  // Change from green
  'overworked': '#ffc400',      // Change from orange
  'coasters': '#2196f3',        // Change from blue
  'underperformers': '#f44336', // Change from red
};
```

---

## Troubleshooting

### "No data available"
- Check that orgId is correct
- Verify attendance logs exist for the date range
- Ensure tasks have `completedAt` timestamps

### Missing employee names
- Verify User records have `name` field
- If empty, falls back to email username

### Incorrect trends
- Ensure both current and previous period have data
- Check that dates are correctly formatted

### Performance categories empty
- Verify task completion data exists
- Check time logs are recorded
- Ensure reports are submitted

---

## Database Requirements

Ensure these tables are populated:

| Table | Required Fields | Purpose |
|-------|-----------------|---------|
| `attendance_logs` | userId, orgId, timeIn, duration, date | Hours tracking |
| `time_logs` | userId, orgId, begin, duration, taskId | Detailed time |
| `macro_tasks` | id, userId, orgId, status, completedAt | Tasks |
| `reports` | id, userId, orgId, createdAt | Daily reports |
| `members` | userId, orgId, role | Team structure |

---

## Performance Tips

1. **Cache reports for dashboards**
   - Weekly/monthly reports change infrequently
   - Cache for 1-6 hours

2. **Use summary endpoint for dashboards**
   - `/api/kpi/summary` returns in <100ms
   - `/api/kpi/generate` takes 200-500ms with detailed data

3. **Schedule batch generation**
   - Generate reports at 2 AM (server off-peak)
   - Store results in cache

4. **Optimize database indexes**
   - Ensure `userId`, `orgId`, `begin`/`createdAt` are indexed
   - Query performance critical for large datasets

---

## Next Steps

1. ✅ Backend service created
2. ✅ API endpoints implemented
3. ✅ Frontend component built
4. **Test with your org data**
5. **Integrate into navigation**
6. **Monitor and optimize performance**
7. **Gather feedback from users**
8. **Customize thresholds based on org needs**

---

## Support & Feedback

For issues or enhancements:
- Check sample JSON response structure
- Review calculation logic in kpiService.js
- Verify data completeness in database
- Test with `/api/kpi/summary` first
