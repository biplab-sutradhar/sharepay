// backend/routes/user.js
const express = require('express');
const router = express.Router();
const zod = require("zod");
const { User } = require("../db");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config");
const { authMiddleware } = require('../middleware');
const { Account } = require('../db');

// Zod schemas
const signupBody = zod.object({
    username: zod.string().min(3).max(30),  // Adjusted for username
    firstName: zod.string().min(1),
    lastName: zod.string().min(1),
    password: zod.string().min(6)
});

const signinBody = zod.object({
    username: zod.string().min(3).max(30), // Adjusted for username
    password: zod.string().min(6)
});

const updateBody = zod.object({
    password: zod.string().min(6).optional(), // Corrected order
    firstName: zod.string().optional(),
    lastName: zod.string().optional(),
});


// Sign up route
router.post("/signup", async (req, res) => {
    try {
        const validationResult = signupBody.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({
                message: "Validation failed",
                errors: validationResult.error.errors
            });
        }

        const existingUser = await User.findOne({ username: req.body.username });
        if (existingUser) {
            return res.status(409).json({
                message: "Username already taken"
            });
        }

        const user = await User.create(req.body);
        const userId = user._id;

        await Account.create({
            userId,
            balance: 1 + Math.random() * 10000
        });

        const token = jwt.sign({ userId }, JWT_SECRET);
        res.status(201).json({
            message: "User created successfully",
            token: token
        });
    } catch (error) {
        console.error("Sign-up error:", error);
        res.status(500).json({
            message: "Internal server error"
        });
    }
});

// Sign in route
router.post("/signin", async (req, res) => {
    try {
        const validationResult = signinBody.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({
                message: "Validation failed",
                errors: validationResult.error.errors
            });
        }

        const user = await User.findOne({
            username: req.body.username,
            password: req.body.password
        });

        if (user) {
            const token = jwt.sign({ userId: user._id }, JWT_SECRET);
            return res.json({ token: token });
        }

        res.status(401).json({
            message: "Invalid username or password"
        });
    } catch (error) {
        console.error("Sign-in error:", error);
        res.status(500).json({
            message: "Internal server error"
        });
    }
});

// Route to update user information
router.put("/", authMiddleware, async (req, res) => {
    try {
        const validationResult = updateBody.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({
                message: "Validation failed",
                errors: validationResult.error.errors
            });
        }

        await User.updateOne({ _id: req.userId }, req.body);
        res.json({
            message: "Updated successfully"
        });
    } catch (error) {
        console.error("Update error:", error);
        res.status(500).json({
            message: "Internal server error"
        });
    }
});

// Route to get users from the backend, filterable via firstName/lastName
router.get("/bulk", async (req, res) => {
    try {
        const filter = req.query.filter || "";
        const users = await User.find({
            $or: [
                { firstName: { "$regex": filter, "$options": "i" } },
                { lastName: { "$regex": filter, "$options": "i" } }
            ]
        });

        res.json({
            users: users.map(user => ({
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                _id: user._id
            }))
        });
    } catch (error) {
        console.error("Bulk user retrieval error:", error);
        res.status(500).json({
            message: "Internal server error"
        });
    }
});

module.exports = router;
