-- ==============================================================================
-- SETUP AUTHEN TRÊN SUPABASE VỚI 3 USER:
-- 1. Vinh@gmail.com
-- 2. Hung@gmail.com
-- 3. Luu@gmail.com
-- Mật khẩu mặc định: 123 (mã hóa bcrypt crypt('123', gen_salt('bf')))
-- Không phân quyền user trong table (tất cả đều có quyền thao tác quản trị viên)
-- ==============================================================================

-- 1. Bật extension pgcrypto (để băm mật khẩu bcrypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Tạo hoặc cập nhật 3 user trực tiếp trong bảng auth.users của Supabase
DO $$
DECLARE
  v_users TEXT[] := ARRAY['vinh@gmail.com', 'hung@gmail.com', 'luu@gmail.com'];
  v_names TEXT[] := ARRAY['Vinh', 'Hùng', 'Lưu'];
  v_email TEXT;
  v_name TEXT;
  v_i INT;
  v_user_id UUID;
BEGIN
  FOR v_i IN 1..array_length(v_users, 1)
  LOOP
    v_email := v_users[v_i];
    v_name := v_names[v_i];
    
    -- Kiểm tra nếu user chưa tồn tại thì tạo mới
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(v_email)) THEN
      v_user_id := gen_random_uuid();
      
      INSERT INTO auth.users (
        instance_id,
        id,
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
        '00000000-0000-0000-0000-000000000000',
        v_user_id,
        'authenticated',
        'authenticated',
        lower(v_email),
        crypt('123', gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}',
        json_build_object('name', v_name, 'display_name', v_name),
        false
      );

      -- Tạo record trong auth.identities nếu Supabase có bảng này
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'identities') THEN
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
          gen_random_uuid(),
          v_user_id::text,
          v_user_id,
          json_build_object('sub', v_user_id::text, 'email', lower(v_email)),
          'email',
          now(),
          now(),
          now()
        ) ON CONFLICT DO NOTHING;
      END IF;

    ELSE
      -- Nếu user đã tồn tại, lấy v_user_id và cập nhật lại mật khẩu là 123
      SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(v_email) LIMIT 1;

      UPDATE auth.users
      SET encrypted_password = crypt('123', gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          updated_at = now(),
          raw_app_meta_data = '{"provider":"email","providers":["email"]}',
          raw_user_meta_data = json_build_object('name', v_name, 'display_name', v_name)
      WHERE id = v_user_id;

      -- Đảm bảo auth.identities cũng có bản ghi tương ứng
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'identities') THEN
        IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id AND provider = 'email') THEN
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
            gen_random_uuid(),
            v_user_id::text,
            v_user_id,
            json_build_object('sub', v_user_id::text, 'email', lower(v_email)),
            'email',
            now(),
            now(),
            now()
          ) ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END IF;
  END LOOP;
END $$;

-- 3. Làm mới PostgREST schema cache
NOTIFY pgrst, 'reload schema';
