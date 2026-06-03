-- CreateTable
CREATE TABLE "cashflow_cell_comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "rowKey" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "cashflow_cell_comments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "cashflow_cell_comments_year_week_rowKey_key" ON "cashflow_cell_comments"("year", "week", "rowKey");

-- CreateIndex
CREATE INDEX "cashflow_cell_comments_year_week_idx" ON "cashflow_cell_comments"("year", "week");
