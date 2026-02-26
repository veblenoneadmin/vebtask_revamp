// Project management API endpoints
import express from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, withOrgScope, requireResourceOwnership } from '../lib/rbac.js';
import { validateBody, validateQuery, commonSchemas, projectSchemas } from '../lib/validation.js';
import { checkDatabaseConnection, handleDatabaseError } from '../lib/api-error-handler.js';
const router = express.Router();

// Get all projects for a user/organization
router.get('/', requireAuth, withOrgScope, validateQuery(commonSchemas.pagination), async (req, res) => {
  try {
    const { userId, orgId, status, limit = 50 } = req.query;
    
    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' });
    }
    
    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }
    
    const where = { orgId };
    if (status) where.status = status;
    
    const projects = await prisma.project.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' }
      ],
      take: parseInt(limit)
    });
    
    res.json({ 
      success: true, 
      projects,
      total: projects.length 
    });
    
  } catch (error) {
    return handleDatabaseError(error, res, 'fetch projects');
  }
});

// Create new project
router.post('/', requireAuth, withOrgScope, validateBody(projectSchemas.create), async (req, res) => {
  try {
    let { orgId, name, description, clientId, budget, estimatedHours, startDate, endDate, priority, status, color } = req.body;
    
    // EMERGENCY FIX: Auto-provide orgId if missing but user is authenticated
    if (!orgId && req.user?.id) {
      console.log('🔧 EMERGENCY: Auto-adding orgId for project creation');
      orgId = 'org_1757046595553';
    }
    
    if (!orgId || !name) {
      return res.status(400).json({ error: 'Missing required fields: orgId and name are required' });
    }
    
    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }
    
    const project = await prisma.project.create({
      data: {
        orgId,
        name,
        description: description || null,
        clientId: clientId || null,
        budget: budget ? parseFloat(budget) : null,
        estimatedHours: estimatedHours ? parseInt(estimatedHours) : 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        priority: priority || 'medium',
        status: status || 'planning',
        color: color || 'bg-primary'
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    console.log(`✅ Created new project: ${name}`);
    
    res.status(201).json({ 
      success: true, 
      project 
    });
    
  } catch (error) {
    return handleDatabaseError(error, res, 'create project');
  }
});

// Update project
router.patch('/:id', requireAuth, withOrgScope, validateBody(projectSchemas.update), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }
    
    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.createdAt;
    delete updates.updatedAt;
    delete updates.orgId;
    
    // Handle numeric fields
    if (updates.budget !== undefined) {
      updates.budget = updates.budget ? parseFloat(updates.budget) : null;
    }
    if (updates.estimatedHours !== undefined) {
      updates.estimatedHours = updates.estimatedHours ? parseInt(updates.estimatedHours) : 0;
    }
    if (updates.hoursLogged !== undefined) {
      updates.hoursLogged = updates.hoursLogged ? parseInt(updates.hoursLogged) : 0;
    }
    if (updates.progress !== undefined) {
      updates.progress = updates.progress ? parseInt(updates.progress) : 0;
    }
    if (updates.spent !== undefined) {
      updates.spent = updates.spent ? parseFloat(updates.spent) : 0;
    }
    
    // Handle date fields
    if (updates.startDate) {
      updates.startDate = new Date(updates.startDate);
    }
    if (updates.endDate) {
      updates.endDate = new Date(updates.endDate);
    }
    
    const project = await prisma.project.update({
      where: { id },
      data: updates,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    console.log(`📝 Updated project ${id}`);
    
    res.json({ 
      success: true, 
      project,
      message: 'Project updated successfully' 
    });
    
  } catch (error) {
    return handleDatabaseError(error, res, 'update project');
  }
});

// Delete project
router.delete('/:id', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }
    
    await prisma.project.delete({
      where: { id }
    });
    
    console.log(`🗑️ Deleted project ${id}`);
    
    res.json({ 
      success: true, 
      message: 'Project deleted successfully' 
    });
    
  } catch (error) {
    return handleDatabaseError(error, res, 'delete project');
  }
});

// Get project statistics
router.get('/stats', requireAuth, withOrgScope, validateQuery(commonSchemas.pagination), async (req, res) => {
  try {
    const { userId, orgId } = req.query;
    
    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' });
    }
    
    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }
    
    const projects = await prisma.project.findMany({
      where: { orgId },
      select: {
        status: true,
        budget: true,
        spent: true,
        hoursLogged: true,
        estimatedHours: true,
        endDate: true
      }
    });
    
    const now = new Date();
    const stats = {
      total: projects.length,
      active: projects.filter(p => p.status === 'active').length,
      completed: projects.filter(p => p.status === 'completed').length,
      overdue: projects.filter(p => p.endDate && new Date(p.endDate) < now && p.status !== 'completed').length,
      totalBudget: projects.reduce((sum, p) => sum + (p.budget || 0), 0),
      totalSpent: projects.reduce((sum, p) => sum + (p.spent || 0), 0),
      totalHours: projects.reduce((sum, p) => sum + (p.hoursLogged || 0), 0),
      totalEstimatedHours: projects.reduce((sum, p) => sum + (p.estimatedHours || 0), 0)
    };
    
    res.json({ 
      success: true, 
      stats 
    });
    
  } catch (error) {
    return handleDatabaseError(error, res, 'fetch project statistics');
  }
});

// ── POST /api/projects/:id/generate-tasks ────────────────────────────────────
// Uses Claude AI to generate tasks from project keywords, then auto-assigns
// each task to the best available staff member by skill rating + workload.
router.post('/:id/generate-tasks', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId  = req.orgId;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project)              return res.status(404).json({ error: 'Project not found' });
    if (project.orgId !== orgId) return res.status(403).json({ error: 'Access denied' });

    // 1. Ask Claude to generate a task list ───────────────────────────────────
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-5',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `You are a project management assistant. Generate a practical, specific task list for this project.

Project Name: ${project.name}
Description:  ${project.description || 'No description provided'}
Priority:     ${project.priority}

Return ONLY a JSON array — no markdown, no extra text:
[
  {
    "title": "Task title",
    "description": "One sentence describing what needs to be done",
    "requiredSkills": ["Skill name"],
    "priority": "high|medium|low",
    "estimatedHours": <number>
  }
]

Rules:
- Generate 4-8 focused, actionable tasks
- Each task should have 1-2 required skills (use common skill names like "React", "UI Design", "Backend API", "QA Testing", "Project Management", "Database", "DevOps")
- estimatedHours should be realistic (1-16)`,
        }],
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      console.error('[Projects] Claude API error:', err);
      return res.status(500).json({ error: 'AI service unavailable' });
    }

    const aiData    = await aiRes.json();
    const rawText   = aiData.content?.[0]?.text || '';
    let generatedTasks;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      generatedTasks = JSON.parse(clean);
    } catch {
      console.error('[Projects] Failed to parse AI response:', rawText);
      return res.status(500).json({ error: 'Failed to parse AI task list', raw: rawText });
    }

    // 2. Fetch all staff with their skills ────────────────────────────────────
    const memberships = await prisma.membership.findMany({
      where: { orgId, role: { in: ['STAFF', 'ADMIN', 'OWNER'] } },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
          include: {
            staffSkills: {
              where:   { orgId },
              include: { skill: true },
            },
          },
        },
      },
    });

    // Workload: open task count per user
    const workloadMap = {};
    if (memberships.length) {
      const counts = await Promise.all(
        memberships.map(m =>
          prisma.macroTask.count({
            where: { userId: m.userId, orgId, status: { in: ['not_started', 'in_progress'] } },
          }).then(count => ({ userId: m.userId, count }))
        )
      );
      counts.forEach(w => { workloadMap[w.userId] = w.count; });
    }

    const WORKLOAD_LIMIT = 10; // open tasks before considered overloaded

    // 3. Assign + create each task ────────────────────────────────────────────
    const createdTasks = [];

    for (const taskDef of generatedTasks) {
      const reqSkills = taskDef.requiredSkills || [];

      // Score every staff member
      const scored = memberships.map(m => {
        const workload       = workloadMap[m.userId] || 0;
        const matchingSkills = m.user.staffSkills.filter(ss =>
          reqSkills.some(rs =>
            ss.skill.name.toLowerCase().includes(rs.toLowerCase()) ||
            rs.toLowerCase().includes(ss.skill.name.toLowerCase())
          )
        );
        const skillScore = matchingSkills.reduce((sum, ss) => sum + ss.level, 0);
        const topSkill   = matchingSkills.sort((a, b) => b.level - a.level)[0];

        return {
          userId:        m.userId,
          name:          m.user.name || m.user.email,
          email:         m.user.email,
          image:         m.user.image,
          workload,
          skillScore,
          topSkillName:  topSkill?.skill.name  || null,
          topSkillLevel: topSkill?.level        || 0,
          available:     workload < WORKLOAD_LIMIT,
        };
      });

      // Sort: highest skill match first, then lowest workload
      scored.sort((a, b) => {
        if (b.skillScore !== a.skillScore) return b.skillScore - a.skillScore;
        return a.workload - b.workload;
      });

      const assignee    = scored[0] || null;
      const assignedTo  = assignee?.userId || req.user.id;

      const priorityFmt = { high: 'High', medium: 'Medium', low: 'Low' };
      const priority    = priorityFmt[taskDef.priority?.toLowerCase()] ||
                          priorityFmt[project.priority?.toLowerCase()]  || 'Medium';

      const task = await prisma.macroTask.create({
        data: {
          title:          taskDef.title,
          description:    taskDef.description || null,
          userId:         assignedTo,
          orgId,
          projectId:      id,
          createdBy:      req.user.id,
          priority,
          estimatedHours: taskDef.estimatedHours || 0,
          status:         'not_started',
          tags:           reqSkills.length ? reqSkills : [],
        },
      });

      // Update in-memory workload for next iteration
      if (assignee) workloadMap[assignee.userId] = (workloadMap[assignee.userId] || 0) + 1;

      createdTasks.push({
        id:             task.id,
        title:          task.title,
        description:    task.description,
        priority:       task.priority,
        estimatedHours: task.estimatedHours,
        status:         task.status,
        requiredSkills: reqSkills,
        assignee: assignee ? {
          userId:        assignee.userId,
          name:          assignee.name,
          email:         assignee.email,
          image:         assignee.image,
          workload:      assignee.workload,
          skillScore:    assignee.skillScore,
          topSkillName:  assignee.topSkillName,
          topSkillLevel: assignee.topSkillLevel,
        } : null,
      });
    }

    console.log(`[Projects] ✅ Generated ${createdTasks.length} tasks for "${project.name}"`);
    res.json({ success: true, tasks: createdTasks, count: createdTasks.length });

  } catch (err) {
    console.error('[Projects] generate-tasks error:', err);
    res.status(500).json({ error: 'Failed to generate tasks', details: err.message });
  }
});

// ── GET /api/projects/:id/overview ───────────────────────────────────────────
// Returns project + all its tasks with assignee info.
router.get('/:id/overview', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where:   { id },
      include: { client: { select: { id: true, name: true, email: true } } },
    });
    if (!project)                  return res.status(404).json({ error: 'Project not found' });
    if (project.orgId !== req.orgId) return res.status(403).json({ error: 'Access denied' });

    const tasks = await prisma.macroTask.findMany({
      where:   { projectId: id },
      orderBy: { createdAt: 'asc' },
    });

    // Enrich with user data (non-fatal)
    const userIds  = [...new Set(tasks.map(t => t.userId).filter(Boolean))];
    const usersMap = {};
    if (userIds.length) {
      try {
        const users = await prisma.user.findMany({
          where:  { id: { in: userIds } },
          select: { id: true, name: true, email: true, image: true },
        });
        users.forEach(u => { usersMap[u.id] = u; });
      } catch { /* non-fatal */ }
    }

    const enriched = tasks.map(t => {
      const u = t.userId ? usersMap[t.userId] : null;
      return {
        id:             t.id,
        title:          t.title,
        description:    t.description,
        status:         t.status,
        priority:       t.priority,
        estimatedHours: t.estimatedHours,
        requiredSkills: Array.isArray(t.tags) ? t.tags : [],
        createdAt:      t.createdAt,
        assignee: u ? {
          userId: t.userId,
          name:   u.name || u.email,
          email:  u.email,
          image:  u.image,
        } : null,
      };
    });

    res.json({ success: true, project, tasks: enriched });

  } catch (err) {
    console.error('[Projects] overview error:', err);
    res.status(500).json({ error: 'Failed to fetch project overview' });
  }
});

export default router;