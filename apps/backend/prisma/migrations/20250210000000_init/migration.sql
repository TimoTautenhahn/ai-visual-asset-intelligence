-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_type" TEXT NOT NULL DEFAULT 'web',
    "source_url" TEXT,
    "page_url" TEXT,
    "original_path" TEXT NOT NULL,
    "thumb_path" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "filesize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'imported',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AssetOccurrence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asset_id" TEXT NOT NULL,
    "page_url" TEXT NOT NULL,
    CONSTRAINT "AssetOccurrence_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetAI" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asset_id" TEXT NOT NULL,
    "description" TEXT,
    "tags_json" TEXT,
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "described_at" DATETIME,
    "error" TEXT,
    CONSTRAINT "AssetAI_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "start_url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "max_pages" INTEGER NOT NULL DEFAULT 200,
    "max_depth" INTEGER NOT NULL DEFAULT 4,
    "min_size" INTEGER NOT NULL DEFAULT 800,
    "pages_visited" INTEGER NOT NULL DEFAULT 0,
    "images_found" INTEGER NOT NULL DEFAULT 0,
    "images_downloaded" INTEGER NOT NULL DEFAULT 0,
    "images_processed" INTEGER NOT NULL DEFAULT 0,
    "ai_described" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collection_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "CollectionItem_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "Collection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CollectionItem_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_sha256_key" ON "Asset"("sha256");
CREATE INDEX "Asset_sha256_idx" ON "Asset"("sha256");
CREATE INDEX "Asset_status_idx" ON "Asset"("status");
CREATE UNIQUE INDEX "AssetOccurrence_asset_id_page_url_key" ON "AssetOccurrence"("asset_id", "page_url");
CREATE INDEX "AssetOccurrence_asset_id_idx" ON "AssetOccurrence"("asset_id");
CREATE UNIQUE INDEX "AssetAI_asset_id_key" ON "AssetAI"("asset_id");
CREATE INDEX "AssetAI_asset_id_idx" ON "AssetAI"("asset_id");
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");
CREATE INDEX "Job_type_status_idx" ON "Job"("type", "status");
CREATE UNIQUE INDEX "CollectionItem_collection_id_asset_id_key" ON "CollectionItem"("collection_id", "asset_id");
CREATE INDEX "CollectionItem_collection_id_idx" ON "CollectionItem"("collection_id");
