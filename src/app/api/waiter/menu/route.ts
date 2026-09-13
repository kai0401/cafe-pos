import { NextResponse } from "next/server";
import {
  getCategories,
  getCategoryProducts,
  getCategoryProductsAll,
  getFullMenu,
  getModifierProductsMenu,
  getProductModifierGroups,
} from "@/domain/order/order-service";
import { getDefaultStore } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const store = await getDefaultStore();
    const eatInType = searchParams.get("eatInType") === "TAKEOUT" ? "TAKEOUT" : "DINE_IN";
    const categoryId = searchParams.get("categoryId");
    const modifiers = searchParams.get("modifiers") === "1";

    if (searchParams.get("full") === "1") {
      const menu = await getFullMenu(store.id, eatInType);
      return NextResponse.json(menu);
    }

    if (searchParams.get("addonMenu") === "1") {
      const addons = await getModifierProductsMenu(store.id, eatInType);
      return NextResponse.json(addons);
    }

    if (categoryId && modifiers) {
      const productName = searchParams.get("productName");
      const groups = await getProductModifierGroups(store.id, categoryId, eatInType, productName);
      return NextResponse.json(groups);
    }

    if (categoryId) {
      const products =
        searchParams.get("all") === "1"
          ? await getCategoryProductsAll(store.id, categoryId, eatInType)
          : await getCategoryProducts(store.id, categoryId, eatInType);
      return NextResponse.json(products);
    }

    const categories = await getCategories(store.id, eatInType);
    return NextResponse.json(categories);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "メニュー取得エラー" },
      { status: 500 },
    );
  }
}
