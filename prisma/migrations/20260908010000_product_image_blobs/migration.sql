-- AlterTable
CREATE TABLE "product_image_blobs" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mime_type" TEXT NOT NULL DEFAULT 'image/jpeg',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_image_blobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_image_blobs_product_id_key" ON "product_image_blobs"("product_id");

-- AddForeignKey
ALTER TABLE "product_image_blobs" ADD CONSTRAINT "product_image_blobs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
