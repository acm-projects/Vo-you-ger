const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

const router = express.Router();

// Fields that are safe to send back to the front end (never include password)
const publicUserFields = {
  id: true,
  fName: true,
  lName: true,
  email: true,
  nationalities: true,
  firstTime: true,
};

function signToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { fName, lName, password, nationalities } = req.body ?? {};
    const email = (req.body?.email ?? "").trim().toLowerCase();

    if (!fName || !lName) {
      return res
        .status(400)
        .json({ error: "First and last name are required" });
    }
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "A valid email is required" });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        fName,
        lName,
        email,
        password: hashedPassword,
        nationalities: Array.isArray(nationalities) ? nationalities : [],
      },
      select: publicUserFields,
    });

    return res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    // P2002 = unique constraint failed (two people registering the same email at once)
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Email already registered" });
    }
    console.error(err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const password = req.body?.password ?? "";
    const email = (req.body?.email ?? "").trim().toLowerCase();

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const found = await prisma.user.findUnique({ where: { email } });

    // Same error for "no such user" and "wrong password" so attackers can't tell which emails exist
    const valid = found && (await bcrypt.compare(password, found.password));
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = {
      id: found.id,
      fName: found.fName,
      lName: found.lName,
      email: found.email,
      nationalities: found.nationalities,
      firstTime: found.firstTime,
    };

    return res.json({ token: signToken(user), user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;