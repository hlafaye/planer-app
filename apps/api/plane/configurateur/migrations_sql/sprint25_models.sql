-- Sprint 2.5 : New referentiel models + enrichment of existing models
-- Run via: docker exec planer-plane-api python manage.py dbshell < /path/to/this.sql

-- ============ ENRICH EXISTING MODELS ============

-- PosteType : add new fields
ALTER TABLE ao_postes_types ADD COLUMN IF NOT EXISTS heures_mois INTEGER DEFAULT 152;
ALTER TABLE ao_postes_types ADD COLUMN IF NOT EXISTS label_excel VARCHAR(255) DEFAULT '';
ALTER TABLE ao_postes_types ADD COLUMN IF NOT EXISTS section_excel VARCHAR(100) DEFAULT '';
ALTER TABLE ao_postes_types ADD COLUMN IF NOT EXISTS ordre_excel INTEGER DEFAULT 0;
ALTER TABLE ao_postes_types ADD COLUMN IF NOT EXISTS est_mi_temps BOOLEAN DEFAULT FALSE;
ALTER TABLE ao_postes_types ADD COLUMN IF NOT EXISTS actif BOOLEAN DEFAULT TRUE;

-- PointDeVente : add new fields
ALTER TABLE ao_points_de_vente ADD COLUMN IF NOT EXISTS nb_tranches INTEGER DEFAULT 5;
ALTER TABLE ao_points_de_vente ADD COLUMN IF NOT EXISTS jours_basse_frequentation INTEGER DEFAULT 0;
ALTER TABLE ao_points_de_vente ADD COLUMN IF NOT EXISTS horaires_ouverture VARCHAR(100) DEFAULT '';
ALTER TABLE ao_points_de_vente ADD COLUMN IF NOT EXISTS taux_tva NUMERIC(4,2) DEFAULT 10.0;

-- ProjetAO : add new fields
ALTER TABLE ao_projets ADD COLUMN IF NOT EXISTS duree_contrat_annees INTEGER DEFAULT 5;
ALTER TABLE ao_projets ADD COLUMN IF NOT EXISTS pct_frais_siege NUMERIC(4,2) DEFAULT 6.5;
ALTER TABLE ao_projets ADD COLUMN IF NOT EXISTS pct_produits_achats NUMERIC(4,2) DEFAULT 25;
ALTER TABLE ao_projets ADD COLUMN IF NOT EXISTS remise_commerciale_pct NUMERIC(4,2) DEFAULT 0;
ALTER TABLE ao_projets ADD COLUMN IF NOT EXISTS semaines_par_an INTEGER DEFAULT 45;

-- ============ NEW TABLES : NIVEAU 1 (CATALOGUE EMPREINTES) ============

CREATE TABLE IF NOT EXISTS ao_tranches_frequentation (
    id SERIAL PRIMARY KEY,
    numero INTEGER UNIQUE NOT NULL,
    borne_min INTEGER DEFAULT 0,
    borne_max INTEGER DEFAULT 0,
    mediane INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ao_produits_alimentaires (
    id SERIAL PRIMARY KEY,
    designation VARCHAR(255) NOT NULL,
    famille VARCHAR(100) DEFAULT '',
    gamme VARCHAR(50) DEFAULT '',
    categorie VARCHAR(80) DEFAULT '',
    grammage_net_min NUMERIC(6,3),
    grammage_net_max NUMERIC(6,3),
    perte_pct NUMERIC(4,2) DEFAULT 0,
    prix_ht_reference NUMERIC(8,2),
    types_pdv JSONB DEFAULT '[]'::jsonb,
    actif BOOLEAN DEFAULT TRUE,
    date_maj DATE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS ao_gradation_prix (
    id SERIAL PRIMARY KEY,
    categorie_produit VARCHAR(100) NOT NULL,
    gamme_numero INTEGER NOT NULL,
    prix_ttc_min NUMERIC(6,2) NOT NULL,
    prix_ttc_max NUMERIC(6,2),
    UNIQUE (categorie_produit, gamme_numero)
);

CREATE TABLE IF NOT EXISTS ao_frais_generaux_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    libelle VARCHAR(255) NOT NULL,
    section VARCHAR(100) NOT NULL,
    mode_calcul VARCHAR(20) DEFAULT 'forfait',
    montant_reference NUMERIC(10,2) DEFAULT 0,
    varie_par_tranche BOOLEAN DEFAULT FALSE,
    ordre INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ao_frais_generaux_baremes (
    id SERIAL PRIMARY KEY,
    fg_type_id INTEGER REFERENCES ao_frais_generaux_types(id) ON DELETE CASCADE,
    tranche INTEGER NOT NULL,
    montant NUMERIC(10,2) NOT NULL,
    UNIQUE (fg_type_id, tranche)
);

CREATE TABLE IF NOT EXISTS ao_investissements_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    libelle VARCHAR(255) NOT NULL,
    section VARCHAR(100) NOT NULL,
    montant_unitaire NUMERIC(10,2) DEFAULT 0,
    quantite_defaut INTEGER DEFAULT 1,
    financeur VARCHAR(30) DEFAULT 'prestataire_repercute',
    duree_amortissement INTEGER DEFAULT 5,
    pct_frais_financiers NUMERIC(4,2) DEFAULT 0,
    varie_par_tranche BOOLEAN DEFAULT FALSE,
    ordre INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ao_investissements_baremes (
    id SERIAL PRIMARY KEY,
    invest_type_id INTEGER REFERENCES ao_investissements_types(id) ON DELETE CASCADE,
    tranche INTEGER NOT NULL,
    montant NUMERIC(10,2) NOT NULL,
    quantite INTEGER DEFAULT 1,
    UNIQUE (invest_type_id, tranche)
);

CREATE TABLE IF NOT EXISTS ao_taux_charges_sociales (
    id SERIAL PRIMARY KEY,
    tranche INTEGER UNIQUE NOT NULL,
    taux NUMERIC(5,4) NOT NULL
);

-- ============ NEW TABLES : NIVEAU 2 (PAR PROJET AO) ============

CREATE TABLE IF NOT EXISTS ao_programmes_ouverture (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    projet_ao_id UUID REFERENCES ao_projets(id) ON DELETE CASCADE,
    point_de_vente_id UUID REFERENCES ao_points_de_vente(id) ON DELETE CASCADE,
    tranche INTEGER NOT NULL,
    est_ouvert BOOLEAN DEFAULT TRUE,
    horaires VARCHAR(100) DEFAULT '',
    mode_service VARCHAR(100) DEFAULT '',
    nb_comptoirs_chauds_assiste INTEGER DEFAULT 0,
    nb_comptoirs_chauds_ls INTEGER DEFAULT 0,
    UNIQUE (projet_ao_id, point_de_vente_id, tranche)
);

CREATE TABLE IF NOT EXISTS ao_projet_fg (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    projet_ao_id UUID REFERENCES ao_projets(id) ON DELETE CASCADE,
    fg_type_id INTEGER REFERENCES ao_frais_generaux_types(id) ON DELETE CASCADE,
    tranche INTEGER NOT NULL,
    montant NUMERIC(10,2) NOT NULL,
    UNIQUE (projet_ao_id, fg_type_id, tranche)
);

CREATE TABLE IF NOT EXISTS ao_projet_invest (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    projet_ao_id UUID REFERENCES ao_projets(id) ON DELETE CASCADE,
    invest_type_id INTEGER REFERENCES ao_investissements_types(id) ON DELETE CASCADE,
    tranche INTEGER NOT NULL,
    montant NUMERIC(10,2) NOT NULL,
    quantite INTEGER DEFAULT 1,
    UNIQUE (projet_ao_id, invest_type_id, tranche)
);

CREATE TABLE IF NOT EXISTS ao_projet_prix (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    projet_ao_id UUID REFERENCES ao_projets(id) ON DELETE CASCADE,
    produit_id INTEGER REFERENCES ao_produits_alimentaires(id) ON DELETE CASCADE,
    prix_ht NUMERIC(8,2) NOT NULL,
    UNIQUE (projet_ao_id, produit_id)
);
