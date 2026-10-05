require("dotenv").config();

// Generated client location comes from `output = "../generated/prisma"` in schema.prisma
const { PrismaClient } = require("../generated/prisma");
const { PrismaPg } = require("@prisma/adapter-pg");

// Prisma 7 requires a driver adapter to connect to Postgres
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prisma = new PrismaClient({ adapter });

module.exports = prisma;