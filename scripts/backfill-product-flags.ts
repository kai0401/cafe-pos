import { isModifierProduct } from "../src/lib/menu-modifiers";
import { prisma } from "../src/lib/prisma";

async function main() {
  const stores = await prisma.store.findMany();
  for (const store of stores) {
    if (store.name.includes("甘味喫茶")) {
      const name = store.name.replace(/甘味喫茶/g, "").trim() || "あづま家";
      await prisma.store.update({ where: { id: store.id }, data: { name } });
      console.log(`store ${store.id}: ${store.name} -> ${name}`);
    }
  }

  const products = await prisma.product.findMany({ select: { id: true, name: true, priceDineIn: true, isTopping: true } });
  let flagged = 0;
  for (const product of products) {
    const isTopping = isModifierProduct(product.name, product.priceDineIn);
    if (isTopping === product.isTopping) continue;
    await prisma.product.update({ where: { id: product.id }, data: { isTopping } });
    if (isTopping) flagged += 1;
  }
  console.log(`topping flags updated: ${flagged}/${products.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
