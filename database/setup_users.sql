-- ==============================================================================
-- SETUP AUTHEN TRÊN SUPABASE VỚI 4 USER:
-- 1. Vinh@gmail.com
-- 2. Hung@gmail.com
-- 3. Luu@gmail.com
-- 4. Tiennguyen@legget.com
-- Mật khẩu mặc định: 123 (mã hóa bcrypt bằng crypt('123', gen_salt('bf')))
-- Tất cả user đều có quyền quản trị viên đầy đủ.
-- Cách dùng: chạy toàn bộ file này trong Supabase Dashboard > SQL Editor.
-- ==============================================================================

-- 1. Bật extension pgcrypto (để băm mật khẩu bcrypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Xóa dữ liệu cũ của các user này (nếu có) để tránh xung đột id / email
DELETE FROM auth.identities 
WHERE user_id IN (
  SELECT id FROM auth.users WHERE lower(email) IN ('vinh@gmail.com', 'hung@gmail.com', 'luu@gmail.com', 'tiennguyen@legget.com')
);

DELETE FROM auth.users 
WHERE lower(email) IN ('vinh@gmail.com', 'hung@gmail.com', 'luu@gmail.com', 'tiennguyen@legget.com');

-- 3. Tạo User 1: Vinh (vinh@gmail.com) - Mật khẩu: 123
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'vinh@gmail.com',
  crypt('123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Vinh","display_name":"Vinh"}',
  false
);

INSERT INTO auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '{"sub":"a0000000-0000-0000-0000-000000000001","email":"vinh@gmail.com"}',
  'email',
  now(),
  now(),
  now()
);

-- 4. Tạo User 2: Hùng (hung@gmail.com) - Mật khẩu: 123
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin
) VALUES (
  'a0000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'hung@gmail.com',
  crypt('123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Hùng","display_name":"Hùng"}',
  false
);

INSERT INTO auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000002',
  '{"sub":"a0000000-0000-0000-0000-000000000002","email":"hung@gmail.com"}',
  'email',
  now(),
  now(),
  now()
);

-- 5. Tạo User 3: Lưu (luu@gmail.com) - Mật khẩu: 123
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin
) VALUES (
  'a0000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'luu@gmail.com',
  crypt('123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Lưu","display_name":"Lưu"}',
  false
);

INSERT INTO auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  'a0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000003',
  '{"sub":"a0000000-0000-0000-0000-000000000003","email":"luu@gmail.com"}',
  'email',
  now(),
  now(),
  now()
);

-- 6. Tạo User 4: Tiên Nguyễn (tiennguyen@legget.com) - Mật khẩu: 123
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin
) VALUES (
  'a0000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'tiennguyen@legget.com',
  crypt('123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Tiên Nguyễn","display_name":"Tiên Nguyễn"}',
  false
);

INSERT INTO auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  'a0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000004',
  '{"sub":"a0000000-0000-0000-0000-000000000004","email":"tiennguyen@legget.com"}',
  'email',
  now(),
  now(),
  now()
);

-- 7. Làm mới PostgREST schema cache
NOTIFY pgrst, 'reload schema';
