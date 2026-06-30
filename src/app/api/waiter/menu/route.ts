import { NextResponse } from "next/server";
import { getCategories, getCategoryProducts, getProductModifierGroups } from "@/domain/order/order-service";
import { ensureWaiterSetup } from "@/lib/waiter-setup";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const store = await ensureWaiterSetup();
  const eatInType = searchParams.get("eatInType") === "TAKEOUT" ? "TAKEOUT" : "DINE_IN";
  const categoryId = searchParams.get("categoryId");
  const modifiers = searchParams.get("modifiers") === "1";

  if (categoryId && modifiers) {
    const groups = await getProductModifierGroups(store.id, categoryId, eatInType);
    return NextResponse.json(groups);
  }

  if (categoryId) {
    const products = await getCategoryProducts(store.id, categoryId, eatInType);
    return NextResponse.json(products);
  }

  const categories = await getCategories(store.id, eatInType);
  return NextResponse.json(categories);
}
