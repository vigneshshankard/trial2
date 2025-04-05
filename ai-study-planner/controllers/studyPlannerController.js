const { validationResult } = require('express-validator');
const StudyPlan = require('../models/studyPlanModel');

// Generate a new study plan with circuit breaker
exports.generatePlan = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const planData = {
            ...req.body,
            userId: req.user.id,
        };

        // Add advanced features for Subscribers
        if (req.user.role === 'subscriber') {
            planData.advancedFeatures = true;
        }

        // Use circuit breaker for AI plan generation
        const aiPlanGenerator = req.app.get('aiPlanGenerator');
        const generatedPlan = await aiPlanGenerator.fire(planData);

        const newPlan = await StudyPlan.create({
            ...planData,
            ...generatedPlan
        });

        res.status(201).json({ 
            message: 'Study plan generated successfully',
            plan: newPlan 
        });
    } catch (error) {
        console.error('Error in generatePlan:', error);
        if (error.type === 'circuit-breaker') {
            return res.status(503).json({
                message: 'AI Study Planner temporarily unavailable',
                error: error.message
            });
        }
        next(error);
    }
};

// Retrieve a user's study plan with circuit breaker
exports.getPlan = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const fetchPlan = async () => {
            const plan = await StudyPlan.findOne({ userId: req.params.userId });
            if (!plan) {
                throw new Error('Study plan not found');
            }
            return plan;
        };

        const planBreaker = createCircuitBreaker(fetchPlan, {
            timeout: 3000,
            errorThresholdPercentage: 20,
            resetTimeout: 5000
        });

        const plan = await planBreaker.fire();

        // Restrict advanced details for non-Subscribers
        if (req.user.role !== 'subscriber') {
            delete plan.advancedFeatures;
        }

        res.status(200).json(plan);
    } catch (error) {
        console.error('Error in getPlan:', error);
        if (error.type === 'circuit-breaker') {
            return res.status(503).json({
                message: 'Unable to fetch study plan at this time',
                error: error.message
            });
        }
        if (error.message === 'Study plan not found') {
            return res.status(404).json({ message: error.message });
        }
        next(error);
    }
};

// Update a study plan with circuit breaker
exports.updatePlan = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const updatePlanOperation = async () => {
            const updatedPlan = await StudyPlan.findOneAndUpdate(
                { userId: req.params.userId },
                req.body,
                { new: true }
            );
            if (!updatedPlan) {
                throw new Error('Study plan not found');
            }
            return updatedPlan;
        };

        const updateBreaker = createCircuitBreaker(updatePlanOperation, {
            timeout: 3000,
            errorThresholdPercentage: 20,
            resetTimeout: 5000
        });

        const updatedPlan = await updateBreaker.fire();
        res.status(200).json({ 
            message: 'Study plan updated successfully',
            plan: updatedPlan 
        });
    } catch (error) {
        console.error('Error in updatePlan:', error);
        if (error.type === 'circuit-breaker') {
            return res.status(503).json({
                message: 'Unable to update study plan at this time',
                error: error.message
            });
        }
        if (error.message === 'Study plan not found') {
            return res.status(404).json({ message: error.message });
        }
        next(error);
    }
};