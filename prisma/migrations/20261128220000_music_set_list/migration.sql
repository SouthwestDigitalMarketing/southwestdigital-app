-- One song list per brand for the wedding band (Music > Set list).
CREATE TABLE "MusicSetList" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "songs" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MusicSetList_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MusicSetList_brandId_key" ON "MusicSetList"("brandId");
ALTER TABLE "MusicSetList" ADD CONSTRAINT "MusicSetList_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MusicSetList" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MusicSetList" FORCE ROW LEVEL SECURITY;
CREATE POLICY music_set_list_brand_context ON "MusicSetList"
  USING ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''))
  WITH CHECK ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''));
