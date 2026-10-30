ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "description" text NOT NULL DEFAULT '';

UPDATE "roles"
SET "description" = CASE "code"
  WHEN 'system_owner' THEN 'Toàn quyền quản trị hệ thống, bao gồm tất cả các chức năng.'
  WHEN 'ops_manager' THEN 'Quản lý vận hành, đơn hàng, nội dung.'
  WHEN 'content_editor' THEN 'Tạo và quản lý nội dung.'
  WHEN 'sales_staff' THEN 'Tạo đơn, quản lý khách hàng, tư vấn.'
  WHEN 'warehouse_staff' THEN 'Quản lý tồn kho, kiểm hàng.'
  ELSE 'Vai trò tùy chỉnh.'
END
WHERE "description" = '';
