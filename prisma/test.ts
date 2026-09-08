import { prisma } from "../src/lib/prisma";

async function test() {
  try {
    const result = await prisma.user.count();
    console.log("Connexion à la base réussie !");
    console.log("Nombre de clients :", result);
  } catch (error) {
    console.error("ERREUR :", error);
  } finally {
    await prisma.$disconnect();
  }
}

test();