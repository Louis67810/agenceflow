-- =============================================================
-- TABLE agency_profiles
-- Liée à auth.users de Supabase — créée automatiquement
-- à l'inscription ou manuellement par l'admin
-- =============================================================

CREATE TABLE IF NOT EXISTS agency_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin', 'client', 'designer')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security : chaque utilisateur voit uniquement son profil
-- L'admin peut voir tous les profils
ALTER TABLE agency_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateur voit son propre profil"
  ON agency_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admin voit tous les profils"
  ON agency_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agency_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin peut modifier les profils"
  ON agency_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM agency_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger : crée automatiquement un profil quand un user s'inscrit
-- (à personnaliser selon votre flow d'invitation)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO agency_profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================
-- COMMENT CRÉER LES COMPTES :
--
-- 1. Admin :
--    Dans Supabase → Authentication → Users → Invite user
--    Email: votre@email.com
--    Puis dans la table agency_profiles, mettez role = 'admin'
--
-- 2. Client :
--    Dans Supabase → Authentication → Users → Invite user
--    Le trigger crée automatiquement un profil avec role = 'client'
--    Ou passez role dans les metadata lors de l'invitation :
--    { "role": "client", "name": "Prénom Nom" }
--
-- 3. Designer / Développeur :
--    Même chose avec role = 'designer'
-- =============================================================
