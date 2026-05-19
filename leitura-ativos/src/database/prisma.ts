import { PrismaClient } from "@prisma/client";

process.env.DATABASE_URL ??= "mysql://app_user:app_password@mysql:3306/investment_orders";

export const prisma = new PrismaClient();
