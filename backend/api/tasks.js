// Task management API endpoints
import express from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, withOrgScope, requireTaskOwnership } from '../lib/rbac.js';
import { validateBody, validateQuery, commonSchemas, taskSchemas } from '../lib/validation.js';
const router = express.Router();

// Get tasks (main endpoint)
router.get('/', requireAuth, withOrgScope, validateQuery(commonSchemas.pagination), async (req, res) => {
  try {
    const { orgId, userId, status, priority, limit = 50, offset = 0 } = req.query;

    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' });
    }

    console.log('📋 Fetching tasks:', { orgId, userId, status, priority, limit, offset });

    const where = { orgId };

    // Apply filters
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (userId) where.userId = userId;

    const tasks = await prisma.macroTask.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
            status: true
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' }
      ],
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    const total = await prisma.macroTask.count({ where });

    console.log(`✅ Found ${tasks.length} tasks for orgId: ${orgId}`);

    // Format tasks for frontend compatibility
    const formattedTasks = tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      estimatedHours: task.estimatedHours,
      actualHours: task.actualHours || 0,
      dueDate: task.dueDate,
      assignee: task.user?.name,
      project: task.project?.name || null,
      projectId: task.projectId,
      projectColor: task.project?.color,
      projectStatus: task.project?.status,
      isBillable: false, // Default for now
      hourlyRate: 0,
      tags: task.tags ? (Array.isArray(task.tags) ? task.tags : []) : [],
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    }));

    res.json({
      success: true,
      tasks: formattedTasks,
      total
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tasks' });
  }
});

// Get recent tasks
router.get('/recent', requireAuth, withOrgScope, validateQuery(commonSchemas.pagination), async (req, res) => {
  try {
    const { orgId, userId, limit = 10 } = req.query;
    
    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' });
    }
    
    // EMERGENCY FIX: Remove relations causing collation mismatch
    const tasks = await prisma.macroTask.findMany({
      where: {
        orgId: orgId,
        ...(userId ? { userId: userId } : {})
      },
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' }
      ],
      take: parseInt(limit)
    });
    
    // EMERGENCY FIX: Simplify to avoid collation issues
    const tasksWithStats = tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      category: task.category,
      dueDate: task.dueDate,
      lastWorked: null, // Will fix later after database collation issue is resolved
      totalTime: 0, // Will fix later after database collation issue is resolved
      estimatedHours: task.estimatedHours,
      actualHours: task.actualHours,
      completedAt: task.completedAt
    }));
    
    res.json({
      success: true,
      tasks: tasksWithStats,
      total: tasksWithStats.length
    });
  } catch (error) {
    console.error('Error fetching recent tasks:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch recent tasks' });
  }
});

// Get task details
router.get('/:taskId', requireAuth, withOrgScope, requireTaskOwnership, async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const task = await prisma.macroTask.findUnique({
      where: { id: taskId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        org: {
          select: {
            id: true,
            name: true
          }
        },
        timeLogs: {
          select: {
            id: true,
            begin: true,
            end: true,
            duration: true,
            description: true,
            category: true
          },
          orderBy: {
            begin: 'desc'
          }
        }
      }
    });
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Calculate total time worked
    const totalTime = task.timeLogs
      .filter(log => log.end !== null)
      .reduce((sum, log) => sum + log.duration, 0);
    
    // Get last worked time
    const lastWorked = task.timeLogs.length > 0 ? task.timeLogs[0].begin : null;
    
    const taskDetails = {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      category: task.category,
      estimatedHours: task.estimatedHours,
      actualHours: task.actualHours,
      dueDate: task.dueDate,
      completedAt: task.completedAt,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      lastWorked: lastWorked,
      totalTime: totalTime,
      assignedTo: task.user,
      organization: task.org,
      tags: task.tags,
      timeLogs: task.timeLogs
    };
    
    res.json(taskDetails);
  } catch (error) {
    console.error('Error fetching task details:', error);
    res.status(500).json({ error: 'Failed to fetch task details' });
  }
});

// Create new task
router.post('/', requireAuth, withOrgScope, validateBody(taskSchemas.create), async (req, res) => {
  try {
    const {
      title,
      description,
      userId,
      orgId,
      priority = 'Medium',
      estimatedHours = 0,
      category = 'General',
      projectId,
      dueDate,
      tags
    } = req.body;
    
    if (!title || !userId || !orgId) {
      return res.status(400).json({ error: 'title, userId, and orgId are required' });
    }
    
    // If projectId is provided, fetch project name for category
    let taskCategory = category;
    if (projectId) {
      try {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { name: true }
        });
        if (project) {
          taskCategory = `Project: ${project.name}`;
        }
      } catch (error) {
        console.error('Error fetching project for task creation:', error);
      }
    }

    const task = await prisma.macroTask.create({
      data: {
        title,
        description,
        userId,
        orgId,
        createdBy: userId,
        priority,
        estimatedHours: parseFloat(estimatedHours),
        category: taskCategory,
        projectId: projectId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        tags: tags || null
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
            status: true
          }
        }
      }
    });
    
    console.log(`✅ Created new task: ${title}`);
    
    res.status(201).json({
      task: task,
      message: 'Task created successfully'
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task (PUT)
router.put('/:taskId', requireAuth, withOrgScope, requireTaskOwnership, async (req, res) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;

    console.log('🔄 Task update request:', {
      taskId,
      updates: JSON.stringify(updates, null, 2),
      userId: req.user?.id,
      orgId: req.orgId
    });
    
    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.createdAt;
    delete updates.updatedAt;
    delete updates.createdBy;
    
    // Handle date fields
    if (updates.dueDate !== undefined) {
      updates.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
    }
    if (updates.completedAt) {
      updates.completedAt = new Date(updates.completedAt);
    }
    
    // Handle numeric fields
    if (updates.estimatedHours !== undefined) {
      updates.estimatedHours = typeof updates.estimatedHours === 'number' ? updates.estimatedHours : parseFloat(updates.estimatedHours) || 0;
    }
    if (updates.actualHours !== undefined) {
      updates.actualHours = typeof updates.actualHours === 'number' ? updates.actualHours : parseFloat(updates.actualHours) || 0;
    }

    // Handle projectId - store it in database and also update category for compatibility
    if (updates.projectId !== undefined) {
      if (updates.projectId) {
        try {
          const project = await prisma.project.findUnique({
            where: { id: updates.projectId },
            select: { name: true }
          });
          if (project) {
            updates.category = `Project: ${project.name}`;
            // Keep projectId - it IS a valid database field
          }
        } catch (error) {
          console.error('Error fetching project for task update:', error);
        }
      } else {
        updates.category = 'General';
        updates.projectId = null; // Set to null for no project
      }
    }

    const task = await prisma.macroTask.update({
      where: { id: taskId },
      data: updates,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
            status: true
          }
        }
      }
    });
    
    console.log(`📝 Updated task ${taskId}`);
    
    res.json({
      task: task,
      message: 'Task updated successfully'
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Update task (PATCH - same as PUT for compatibility)
router.patch('/:taskId', requireAuth, withOrgScope, requireTaskOwnership, async (req, res) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;

    console.log('🔄 Task PATCH request:', {
      taskId,
      updates: JSON.stringify(updates, null, 2),
      userId: req.user?.id,
      orgId: req.orgId
    });

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.createdAt;
    delete updates.updatedAt;
    delete updates.createdBy;

    // Handle date fields
    if (updates.dueDate !== undefined) {
      updates.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
    }
    if (updates.completedAt) {
      updates.completedAt = new Date(updates.completedAt);
    }

    // Handle numeric fields
    if (updates.estimatedHours !== undefined) {
      updates.estimatedHours = typeof updates.estimatedHours === 'number' ? updates.estimatedHours : parseFloat(updates.estimatedHours) || 0;
    }
    if (updates.actualHours !== undefined) {
      updates.actualHours = typeof updates.actualHours === 'number' ? updates.actualHours : parseFloat(updates.actualHours) || 0;
    }

    // Handle projectId - store it in database and also update category for compatibility
    if (updates.projectId !== undefined) {
      if (updates.projectId) {
        try {
          const project = await prisma.project.findUnique({
            where: { id: updates.projectId },
            select: { name: true }
          });
          if (project) {
            updates.category = `Project: ${project.name}`;
            // Keep projectId - it IS a valid database field
          }
        } catch (error) {
          console.error('Error fetching project for task update:', error);
        }
      } else {
        updates.category = 'General';
        updates.projectId = null; // Set to null for no project
      }
    }

    const task = await prisma.macroTask.update({
      where: { id: taskId },
      data: updates,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
            status: true
          }
        }
      }
    });

    console.log(`📝 PATCH Updated task ${taskId}`);

    res.json({
      task: task,
      message: 'Task updated successfully'
    });
  } catch (error) {
    console.error('Error updating task (PATCH):', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Update task status
router.patch('/:taskId/status', requireAuth, withOrgScope, requireTaskOwnership, validateBody(taskSchemas.statusUpdate), async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }
    
    const updateData = { status };
    
    // If marking as completed, set completedAt timestamp
    if (status === 'completed') {
      updateData.completedAt = new Date();
    } else if (status !== 'completed') {
      // If changing from completed to something else, clear completedAt
      updateData.completedAt = null;
    }
    
    const task = await prisma.macroTask.update({
      where: { id: taskId },
      data: updateData
    });
    
    console.log(`📝 Updated task ${taskId} status to: ${status}`);
    
    res.json({
      message: 'Task status updated successfully',
      taskId: taskId,
      status: status,
      completedAt: task.completedAt
    });
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ error: 'Failed to update task status' });
  }
});

// Delete task
router.delete('/:taskId', requireAuth, withOrgScope, requireTaskOwnership, async (req, res) => {
  try {
    const { taskId } = req.params;
    
    await prisma.macroTask.delete({
      where: { id: taskId }
    });
    
    console.log(`🗑️ Deleted task ${taskId}`);
    
    res.json({
      message: 'Task deleted successfully',
      taskId: taskId
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Get tasks by organization
router.get('/org/:orgId', requireAuth, withOrgScope, validateQuery(commonSchemas.pagination), async (req, res) => {
  try {
    const { orgId } = req.params;
    const { status, priority, userId, limit = 50, offset = 0 } = req.query;
    
    const where = { orgId };
    
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (userId) where.userId = userId;
    
    const tasks = await prisma.macroTask.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            timeLogs: true
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' }
      ],
      take: parseInt(limit),
      skip: parseInt(offset)
    });
    
    const total = await prisma.macroTask.count({ where });
    
    res.json({
      tasks,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching organization tasks:', error);
    res.status(500).json({ error: 'Failed to fetch organization tasks' });
  }
});

// Get tasks for the entire team/organization (admin view)
router.get('/team', requireAuth, withOrgScope, validateQuery(commonSchemas.pagination), async (req, res) => {
  try {
    const { orgId, status, priority, limit = 50, assignedTo } = req.query;
    
    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' });
    }
    
    const where = { orgId };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assignedTo) where.userId = assignedTo;
    
    const tasks = await prisma.macroTask.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        timeLogs: {
          select: {
            begin: true,
            end: true,
            duration: true,
            userId: true,
            user: {
              select: {
                name: true
              }
            }
          },
          orderBy: {
            begin: 'desc'
          },
          take: 1
        },
        _count: {
          select: {
            timeLogs: true
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { updatedAt: 'desc' }
      ],
      take: parseInt(limit)
    });
    
    // Calculate total time and last worked for each task
    const tasksWithStats = await Promise.all(tasks.map(async (task) => {
      // Get total time worked on this task by all users
      const timeStats = await prisma.timeLog.aggregate({
        where: {
          taskId: task.id,
          end: { not: null } // Only completed time entries
        },
        _sum: {
          duration: true
        }
      });
      
      const totalTime = timeStats._sum.duration || 0;
      const lastWorked = task.timeLogs.length > 0 ? task.timeLogs[0].begin : null;
      const lastWorkedBy = task.timeLogs.length > 0 ? task.timeLogs[0].user?.name : null;
      
      return {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        category: task.category,
        dueDate: task.dueDate,
        assignedTo: task.user,
        lastWorked: lastWorked,
        lastWorkedBy: lastWorkedBy,
        totalTime: totalTime,
        estimatedHours: task.estimatedHours,
        actualHours: task.actualHours,
        completedAt: task.completedAt,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      };
    }));
    
    res.json({
      success: true,
      tasks: tasksWithStats,
      total: tasksWithStats.length
    });
  } catch (error) {
    console.error('Error fetching team tasks:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch team tasks' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// COMMENTS
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/tasks/:taskId/comments */
router.get('/:taskId/comments', requireAuth, withOrgScope, async (req, res) => {
  try {
    const comments = await prisma.taskComment.findMany({
      where: { taskId: req.params.taskId, orgId: req.orgId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, comments });
  } catch (e) { console.error('Failed to fetch comments:', e); res.status(500).json({ error: 'Failed to fetch comments' }); }
});

/** POST /api/tasks/:taskId/comments */
router.post('/:taskId/comments', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' });
    const comment = await prisma.taskComment.create({
      data: { taskId: req.params.taskId, orgId: req.orgId, userId: req.user.id, content: content.trim() },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.status(201).json({ success: true, comment });
  } catch (e) { res.status(500).json({ error: 'Failed to post comment' }); }
});

/** DELETE /api/tasks/:taskId/comments/:commentId */
router.delete('/:taskId/comments/:commentId', requireAuth, withOrgScope, async (req, res) => {
  try {
    const comment = await prisma.taskComment.findFirst({
      where: { id: req.params.commentId, taskId: req.params.taskId, orgId: req.orgId },
    });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.userId !== req.user.id) return res.status(403).json({ error: 'Not your comment' });
    await prisma.taskComment.delete({ where: { id: req.params.commentId } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed to delete comment' }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// ATTACHMENTS
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/tasks/:taskId/attachments */
router.get('/:taskId/attachments', requireAuth, withOrgScope, async (req, res) => {
  try {
    const attachments = await prisma.taskAttachment.findMany({
      where: { taskId: req.params.taskId, orgId: req.orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, mimeType: true, size: true, category: true, createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    res.json({ success: true, attachments });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch attachments' }); }
});

/** GET /api/tasks/:taskId/attachments/:attachId/download */
router.get('/:taskId/attachments/:attachId/download', requireAuth, withOrgScope, async (req, res) => {
  try {
    const att = await prisma.taskAttachment.findFirst({
      where: { id: req.params.attachId, taskId: req.params.taskId, orgId: req.orgId },
    });
    if (!att) return res.status(404).json({ error: 'Attachment not found' });
    res.json({ success: true, attachment: att });
  } catch (e) { res.status(500).json({ error: 'Failed to download attachment' }); }
});

/** POST /api/tasks/:taskId/attachments  body: { name, mimeType, size, data (base64), category? } */
router.post('/:taskId/attachments', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { name, mimeType, size, data, category = 'attachment' } = req.body;
    if (!name || !data) return res.status(400).json({ error: 'name and data required' });
    const att = await prisma.taskAttachment.create({
      data: { taskId: req.params.taskId, orgId: req.orgId, userId: req.user.id,
        name, mimeType: mimeType || 'application/octet-stream', size: size || 0, data, category },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    const { data: _d, ...rest } = att;
    res.status(201).json({ success: true, attachment: rest });
  } catch (e) { res.status(500).json({ error: 'Failed to upload attachment' }); }
});

/** DELETE /api/tasks/:taskId/attachments/:attachId */
router.delete('/:taskId/attachments/:attachId', requireAuth, withOrgScope, async (req, res) => {
  try {
    const att = await prisma.taskAttachment.findFirst({
      where: { id: req.params.attachId, taskId: req.params.taskId, orgId: req.orgId },
    });
    if (!att) return res.status(404).json({ error: 'Attachment not found' });
    if (att.userId !== req.user.id) return res.status(403).json({ error: 'Not your attachment' });
    await prisma.taskAttachment.delete({ where: { id: req.params.attachId } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed to delete attachment' }); }
});

export default router;