import express from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../lib/rbac.js';

const router = express.Router();

/**
 * GET /api/onboarding/status
 * Check if user needs onboarding
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if user has completed onboarding
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { completedWizards: true }
    });

    if (!user) {
      return res.json({ needsOnboarding: true });
    }

    const completedSteps = user.completedWizards ? user.completedWizards.split(',').filter(Boolean) : [];
    const requiredSteps = ['welcome', 'organization', 'profile', 'team'];
    
    // Check if all required steps are completed
    const allStepsCompleted = requiredSteps.every(step => completedSteps.includes(step));
    
    res.json({ 
      needsOnboarding: !allStepsCompleted,
      completedSteps,
      requiredSteps 
    });
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    // Default to requiring onboarding if there's an error
    res.json({ needsOnboarding: true });
  }
});

export default router;